// Handles purchases coming from the Wix store. Self-contained.
// Flow: verify secret -> resolve roblox username -> map wix product -> grant whitelist -> deliver file.
// On any problem (bad username / unmapped product), HOLD the purchase + flag for manual review (never mis-grant).
const mongoose = require("mongoose");
const axios = require("axios");
const crypto = require("crypto");

const Client = require("../model/Client.js");
const Product = require("../model/Product.js");
const Whitelist = require("../model/Whitelist.js");

const PUBLIC_BASE = process.env.PUBLIC_BASE || "https://isemil.me";
function downloadLink(product) {
	const hasFile = product.stableFile || product.fileurl;
	if (!hasFile) return null;
	const token = crypto.createHmac("sha256", process.env.WIX_SECRET || "x").update("dl:" + product._id).digest("hex").slice(0, 24);
	return `${PUBLIC_BASE}/wix/download/${product._id}/${token}`;
}

// --- collections ---
const mappingSchema = new mongoose.Schema({
	wixProductId: { type: String, unique: true, sparse: true }, // Wix product ID — the reliable unique key
	wixName: { type: String }, // human label (NOT unique — names can collide)
	productId: mongoose.Schema.Types.ObjectId, // WDI product
	productName: String,
	at: { type: Date, default: Date.now }
});
const ProductMapping = mongoose.models.ProductMapping || mongoose.model("ProductMapping", mappingSchema);

const purchaseSchema = new mongoose.Schema({
	source: { type: String, default: "wix" },
	wixOrderId: String,
	wixProductId: String,
	wixProduct: String,
	robloxInput: String, // what the buyer typed
	robloxId: String, // resolved
	robloxName: String,
	email: String,
	productId: mongoose.Schema.Types.ObjectId,
	productName: String,
	status: String, // granted | held | error | refunded
	reason: String, // why held/errored
	fileDelivered: Boolean,
	at: { type: Date, default: Date.now }
});
const WebPurchase = mongoose.models.WebPurchase || mongoose.model("WebPurchase", purchaseSchema);

// --- helpers ---
async function resolveRobloxId(input) {
	const raw = String(input || "").trim();
	if (!raw) return null;
	// already a numeric id?
	if (/^\d+$/.test(raw)) {
		try {
			const r = await axios.get(`https://users.roblox.com/v1/users/${raw}`, { timeout: 8000 });
			if (r.data && r.data.id) return { id: String(r.data.id), name: r.data.name };
		} catch { return null; }
		return null;
	}
	// username -> id via the usernames endpoint
	try {
		const r = await axios.post(
			"https://users.roblox.com/v1/usernames/users",
			{ usernames: [raw], excludeBannedUsers: false },
			{ timeout: 8000 }
		);
		const u = r.data && r.data.data && r.data.data[0];
		if (u) return { id: String(u.id), name: u.name };
	} catch { return null; }
	return null;
}

async function mapProduct(wixProductId, wixProductName) {
	const id = String(wixProductId || "").trim();
	const name = String(wixProductName || "").trim();
	// 1. explicit mapping by Wix product ID (handles duplicate names reliably)
	if (id) {
		const mById = await ProductMapping.findOne({ wixProductId: id });
		if (mById) { const p = await Product.findById(mById.productId); if (p) return p; }
	}
	// 2. explicit mapping by name (legacy / when no id mapping exists)
	if (name) {
		const mByName = await ProductMapping.findOne({ wixName: name });
		if (mByName) { const p = await Product.findById(mByName.productId); if (p) return p; }
	}
	if (!name) return null;
	// 3. exact name match against WDI products
	let p = await Product.findOne({ name });
	if (p) return p;
	// 4. case-insensitive exact name match (collation — no regex escaping pitfalls)
	p = await Product.findOne({ name }).collation({ locale: "en", strength: 2 });
	return p || null;
}

function fileInfo(product) {
	// Prefer a re-hosted stable file if present; else the (maybe-dead) fileurl; else none.
	if (product.stableFile) return { url: product.stableFile, kind: "stable" };
	if (product.fileurl) return { url: product.fileurl, kind: "external" };
	return { url: null, kind: "none" };
}

/**
 * Process a Wix purchase.
 * @returns {object} result for Wix to show the buyer + recorded WebPurchase
 */
async function processWixPurchase({ wixOrderId, wixProductId, wixProduct, robloxInput, email }) {
	const base = { source: "wix", wixOrderId, wixProductId, wixProduct, robloxInput, email, at: new Date() };

	// 1. map product (by Wix product ID first, then name)
	const product = await mapProduct(wixProductId, wixProduct);
	if (!product) {
		const doc = await WebPurchase.create({ ...base, status: "held", reason: "product_not_mapped" });
		return { ok: false, status: "held", reason: "product_not_mapped", message: "Your purchase is recorded but the product couldn't be matched automatically. Our team will set it up shortly.", purchaseId: String(doc._id) };
	}

	// 2. resolve roblox
	const rb = await resolveRobloxId(robloxInput);
	if (!rb) {
		const doc = await WebPurchase.create({ ...base, productId: product._id, productName: product.name, status: "held", reason: "roblox_unresolved" });
		return { ok: false, status: "held", reason: "roblox_unresolved", message: "We couldn't find that Roblox username. Your purchase is saved — please contact us with your correct Roblox username and we'll activate it.", purchaseId: String(doc._id) };
	}

	// 3. find or create client (web buyer — discord optional)
	let client = await Client.findOne({ roblox: rb.id });
	if (!client) {
		client = await Client.create({ roblox: rb.id, source: "wix", email, created: new Date() });
	} else if (email && !client.email) {
		await Client.updateOne({ _id: client._id }, { $set: { email } });
	}

	// 4. grant whitelist (idempotent)
	const existing = await Whitelist.findOne({ client: client._id, product: product._id });
	if (!existing) {
		await Whitelist.create({ client: client._id, product: product._id, created: new Date() });
	}

	// 5. file delivery — always-fresh tokenized download link (refreshes Discord URL on click)
	const dl = downloadLink(product);
	const doc = await WebPurchase.create({
		...base,
		robloxId: rb.id,
		robloxName: rb.name,
		productId: product._id,
		productName: product.name,
		status: "granted",
		fileDelivered: !!dl,
		reason: existing ? "already_owned" : "granted"
	});

	return {
		ok: true,
		status: "granted",
		product: product.name,
		roblox: rb.name,
		downloadUrl: dl,
		fileAvailable: !!dl,
		message: `Success! "${product.name}" is now active for Roblox user ${rb.name}.`,
		purchaseId: String(doc._id)
	};
}

async function refundWixPurchase(wixOrderId) {
	const purchase = await WebPurchase.findOne({ wixOrderId, status: "granted" });
	if (!purchase) return { ok: false, reason: "no_matching_purchase" };
	const client = await Client.findOne({ roblox: purchase.robloxId });
	if (client && purchase.productId) {
		await Whitelist.deleteOne({ client: client._id, product: purchase.productId });
	}
	await WebPurchase.updateOne({ _id: purchase._id }, { $set: { status: "refunded" } });
	return { ok: true, product: purchase.productName, roblox: purchase.robloxName };
}

module.exports = { processWixPurchase, refundWixPurchase, mapProduct, resolveRobloxId, ProductMapping, WebPurchase };
