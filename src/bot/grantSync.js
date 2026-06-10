// Grant-sync engine. Keeps every whitelisted experience's Roblox asset grants up to date,
// re-checks ownership for drift (group-churn abuse), and DMs admins on anomalies.
// Runs INSIDE the bot process (shares the Discord client), messaging.js-style.
//
// Entitlement model:
//   - meshes: per-product (Product.meshAssetIds), strictly scoped to what the client owns
//   - audio:  ONE global library (Setting "globalAudioAssetIds") — every customer with
//             at least one product gets the whole library (not gatekept per-product)
//
// Drift policy: grants are irrevocable on Roblox, so when ownership of a whitelisted
// experience changes hands we can only (a) stop granting NEW assets to it, (b) alert.
const Whitelist = require("../model/Whitelist.js");
const Client = require("../model/Client.js");
const Setting = require("../model/Setting.js");
const ExperienceGrant = require("../model/ExperienceGrant.js");
const { resolveExperience, getGroupOwnerId, entitledAssetIds, grantUniversePermission } = require("./robloxExperience.js");

let discordClient = null;
function setClient(c) { discordClient = c; }

const AUDIO_KEY = "globalAudioAssetIds";

function parseIds(input) {
	return [...new Set(String(input || "").split(/[^0-9]+/).filter(s => s.length >= 5))];
}

async function getGlobalAudioIds() {
	const doc = await Setting.findOne({ key: AUDIO_KEY }).lean();
	return (doc && Array.isArray(doc.value)) ? doc.value.map(String) : [];
}

async function setGlobalAudioIds(ids) {
	const clean = [...new Set((ids || []).map(s => String(s).trim()).filter(s => /^\d{5,}$/.test(s)))];
	await Setting.updateOne({ key: AUDIO_KEY }, { $set: { value: clean, updated: new Date() } }, { upsert: true });
	return clean;
}

// Everything this client's experiences should be able to load:
// product meshes they own + (if they own anything at all) the global audio library.
async function fullEntitlement(clientId) {
	const mesh = await entitledAssetIds(clientId);
	const owns = await Whitelist.countDocuments({ client: clientId });
	const audio = owns ? await getGlobalAudioIds() : [];
	return [...new Set([...mesh, ...audio])];
}

async function describeClient(clientId) {
	try {
		const c = await Client.findById(clientId).lean();
		if (!c) return `client ${clientId}`;
		return c.discord ? `<@${c.discord}> (roblox \`${c.roblox}\`)` : `roblox \`${c.roblox}\``;
	} catch (e) { return `client ${clientId}`; }
}

// DM the guild owner (+ anyone in ALERT_DISCORD_IDS, comma-separated) — same DM
// mechanics as messaging.js broadcasts.
async function alertAdmins(text) {
	console.log("[grantsync][ALERT]", text.replace(/\n/g, " | "));
	if (!discordClient) return;
	const targets = new Set((process.env.ALERT_DISCORD_IDS || "").split(",").map(s => s.trim()).filter(Boolean));
	try {
		const guild = await discordClient.guilds.fetch(process.env.GUILD);
		const owner = await guild.fetchOwner();
		if (owner) targets.add(owner.id);
	} catch (e) { /* env targets still get it */ }
	for (const id of targets) {
		try {
			const u = await discordClient.users.fetch(id);
			await u.send({ content: text.slice(0, 1900) });
		} catch (e) { console.log("[grantsync] alert DM failed:", id, e.message); }
	}
}

async function alertOnDrift(grant) {
	const who = await describeClient(grant.client);
	await alertAdmins(
		"⚠️ **WDI grant alert — possible group churn**\n" +
		`Whitelisted experience (universe \`${grant.universeId}\`, place \`${grant.placeId || "?"}\`) of ${who} no longer checks out:\n` +
		`> ${grant.flagReason}\n` +
		"Already-granted assets stay usable there (Roblox grants are irrevocable), but **no new assets** will be granted to it. " +
		"If this is abuse, cut the customer's store/whitelist access."
	);
}

// Called after a new experience grant is recorded: one customer spreading grants
// across multiple different GROUPS is the classic churn-for-hire pattern.
async function checkCrossGroup(clientId) {
	const grants = await ExperienceGrant.find({ client: clientId }).lean();
	const groups = new Set(grants.filter(g => g.creatorType === "Group" && g.creatorId).map(g => String(g.creatorId)));
	if (groups.size >= 2) {
		const who = await describeClient(clientId);
		await alertAdmins(
			"🔎 **WDI grant notice — one customer, multiple groups**\n" +
			`${who} now has whitelisted experiences under **${groups.size} different groups** (${[...groups].join(", ")}). Worth a look.`
		);
	}
}

// Re-check one grant: ownership drift first, then apply any missing asset grants.
async function syncGrant(grant) {
	const out = { granted: 0, flagged: false, newlyFlagged: false, status: grant.status };

	// 1) drift check — only acts on POSITIVE evidence; API hiccups skip silently
	let driftReason = null;
	const exp = await resolveExperience(grant.universeId);
	if (exp) {
		if (grant.creatorId && (exp.creator.type !== grant.creatorType || String(exp.creator.id) !== String(grant.creatorId))) {
			driftReason = `experience creator changed: ${grant.creatorType} \`${grant.creatorId}\` → ${exp.creator.type} \`${exp.creator.id}\``;
		} else if (exp.creator.type === "Group") {
			const ownerNow = await getGroupOwnerId(exp.creator.id);
			if (ownerNow && String(ownerNow) !== String(grant.robloxId)) {
				driftReason = `group \`${exp.creator.id}\` owner changed: \`${grant.robloxId}\` → \`${ownerNow}\``;
			}
		}
	}
	if (driftReason) {
		if (!grant.flagged) out.newlyFlagged = true;
		grant.flagged = true;
		grant.flagReason = driftReason;
		out.flagged = true;
	} else if (exp && grant.flagged) {
		// ownership checks out again (e.g. group returned to the customer) — unflag
		grant.flagged = false;
		grant.flagReason = undefined;
	}

	// 2) entitlement top-up (idempotent). Flagged grants get NO new assets.
	if (!grant.flagged) {
		const want = await fullEntitlement(grant.client);
		const have = new Set((grant.assetIds || []).map(String));
		const missing = want.filter(id => !have.has(id));
		if (missing.length) {
			const res = await grantUniversePermission(grant.universeId, missing);
			const okIds = (res.results || []).filter(r => r.ok).map(r => String(r.assetId));
			if (okIds.length) {
				grant.assetIds = [...new Set([...(grant.assetIds || []).map(String), ...okIds])];
				grant.status = "granted";
				if (!grant.grantedAt) grant.grantedAt = new Date();
				out.granted = okIds.length;
			}
		}
	}

	grant.lastSyncAt = new Date();
	await grant.save();
	out.status = grant.status;
	return out;
}

async function runSet(grants, label) {
	const sum = { total: grants.length, granted: 0, flagged: 0, newlyFlagged: 0, pendingLeft: 0 };
	for (const g of grants) {
		try {
			const r = await syncGrant(g);
			sum.granted += r.granted;
			if (r.flagged) sum.flagged++;
			if (r.newlyFlagged) { sum.newlyFlagged++; await alertOnDrift(g); }
			if (r.status === "pending") sum.pendingLeft++;
		} catch (e) {
			console.log("[grantsync] sync error on universe", String(g.universeId) + ":", e.message);
		}
	}
	if (sum.total) console.log(`[grantsync] ${label}: ${JSON.stringify(sum)}`);
	return sum;
}

async function resyncClient(clientId, label) {
	const grants = await ExperienceGrant.find({ client: clientId });
	return runSet(grants, label || "client");
}

async function resyncAll(label) {
	const grants = await ExperienceGrant.find({});
	return runSet(grants, label || "all");
}

// Fire-and-forget hook for every place a whitelist gets created
// (/whitelist grant, /masswhitelist, Wix purchases).
function afterWhitelistChange(clientId, reason) {
	resyncClient(clientId, `hook:${reason}`).catch(e => console.log("[grantsync] hook error:", e.message));
}

function start() {
	// initial pass shortly after boot (covers panel-made grants + anything missed
	// while down), then every 6 hours — also the drift/churn watchdog cadence
	setTimeout(() => resyncAll("boot").catch(() => {}), 2 * 60 * 1000);
	setInterval(() => resyncAll("cron").catch(() => {}), 6 * 60 * 60 * 1000);
	console.log("[grantsync] scheduled (boot +2min, then every 6h)");
}

module.exports = {
	setClient, start,
	afterWhitelistChange, resyncClient, resyncAll,
	fullEntitlement, getGlobalAudioIds, setGlobalAudioIds, parseIds,
	checkCrossGroup, alertAdmins,
};
