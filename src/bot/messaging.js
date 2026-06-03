// WDI messaging + membership module. Runs INSIDE the bot process (shares the Discord client).
// - Periodically syncs which linked Discord users are still in the guild (inServer flag on Client).
// - Exposes broadcastToProduct(): DM every owner of a product, throttled, recording results.
const mongoose = require("mongoose");

const Client = require("../model/Client.js");
const Product = require("../model/Product.js");
const Whitelist = require("../model/Whitelist.js");

// Broadcast history collection (created lazily)
const broadcastSchema = new mongoose.Schema({
	product: String,
	productId: mongoose.Schema.Types.ObjectId,
	message: String,
	total: Number,
	sent: Number,
	failed: Number,
	notInServer: Number,
	results: [{ discord: String, roblox: String, status: String }], // status: sent | failed | not_in_server
	at: { type: Date, default: Date.now }
});
const Broadcast = mongoose.models.Broadcast || mongoose.model("Broadcast", broadcastSchema);

let discordClient = null;
let guild = null;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * Refresh the set of guild members and update Client.inServer for every linked client.
 */
async function syncMembership() {
	if (!discordClient || !guild) return { ok: false, error: "bot not ready" };
	try {
		const members = await guild.members.fetch(); // full member list
		const present = new Set(members.map((m) => m.user.id));
		const clients = await Client.find({}, { discord: 1 }).lean();
		let inCount = 0, outCount = 0;
		const now = new Date();
		const inIds = [];
		const outIds = [];
		for (const c of clients) {
			if (present.has(String(c.discord))) { inCount++; inIds.push(c._id); }
			else { outCount++; outIds.push(c._id); }
		}
		// two bulk updateMany calls — simplest & version-safe
		if (inIds.length) await Client.updateMany({ _id: { $in: inIds } }, { $set: { inServer: true, membershipChecked: now } });
		if (outIds.length) await Client.updateMany({ _id: { $in: outIds } }, { $set: { inServer: false, membershipChecked: now } });
		console.log(`[membership] synced: ${inCount} in server, ${outCount} left/unknown`);
		return { ok: true, inServer: inCount, notInServer: outCount, total: clients.length };
	} catch (e) {
		console.log("[membership] sync error:", e.message);
		return { ok: false, error: e.message };
	}
}

/**
 * DM all owners of a product. Throttled. Records a Broadcast doc.
 * @param {string} productId
 * @param {string} message
 * @param {object} opts { testDiscordId }  if set, only DM that one user (test send)
 */
async function broadcastToProduct(productId, message, opts = {}) {
	if (!discordClient) return { ok: false, error: "bot not ready" };
	const product = await Product.findById(productId);
	if (!product) return { ok: false, error: "product not found" };

	// Resolve owners (client docs) of this product
	const purchases = await Whitelist.find({ product: product._id }).populate("client").lean();
	let owners = purchases.map((p) => p.client).filter(Boolean);

	// Test mode: single recipient
	if (opts.testDiscordId) {
		owners = owners.filter((o) => String(o.discord) === String(opts.testDiscordId));
		if (!owners.length) return { ok: false, error: "that user does not own this product" };
	}

	const results = [];
	let sent = 0, failed = 0, notInServer = 0;

	for (const o of owners) {
		const discordId = String(o.discord);
		try {
			// fetch user; DM only works if a mutual guild exists
			const user = await discordClient.users.fetch(discordId);
			await user.send(message);
			results.push({ discord: discordId, roblox: o.roblox, status: "sent" });
			sent++;
		} catch (e) {
			// 50007 = cannot send messages to this user (left server / DMs closed / blocked bot)
			const code = e?.code;
			const status = code === 50007 ? "not_in_server" : "failed";
			if (status === "not_in_server") notInServer++; else failed++;
			results.push({ discord: discordId, roblox: o.roblox, status });
		}
		await sleep(1200); // throttle ~0.8/sec to stay well under Discord limits
	}

	const doc = await Broadcast.create({
		product: product.name,
		productId: product._id,
		message,
		total: owners.length,
		sent, failed, notInServer,
		results,
		at: new Date()
	});

	return { ok: true, total: owners.length, sent, failed, notInServer, broadcastId: String(doc._id) };
}

function setClient(c) {
	discordClient = c;
}
async function bindGuild() {
	if (!discordClient) return;
	try {
		guild = await discordClient.guilds.fetch(process.env.GUILD);
		await syncMembership(); // initial sync
		// re-sync every 3 hours
		setInterval(syncMembership, 3 * 60 * 60 * 1000);
	} catch (e) {
		console.log("[membership] could not bind guild:", e.message);
	}
}

module.exports = { setClient, bindGuild, syncMembership, broadcastToProduct, Broadcast };
