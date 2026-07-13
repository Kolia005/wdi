// Internal endpoints for the panel to call (same box, localhost). Protected by a shared secret.
const express = require("express");
const messaging = require("../bot/messaging.js");

const router = express.Router();

// JSON body parsing for these routes only
router.use(express.json({ limit: "256kb" }));

// Auth: require the X-Internal-Secret header to match env INTERNAL_SECRET
router.use((req, res, next) => {
	const secret = process.env.INTERNAL_SECRET;
	if (!secret || req.headers["x-internal-secret"] !== secret) {
		return res.status(403).json({ ok: false, error: "forbidden" });
	}
	next();
});

// Trigger a membership re-sync on demand
router.post("/sync-membership", async (_req, res) => {
	const r = await messaging.syncMembership();
	res.status(r.ok ? 200 : 500).json(r);
});

// Preview: how many owners are reachable for a product (no sends)
router.get("/broadcast-preview", async (req, res) => {
	try {
		const Whitelist = require("../model/Whitelist.js");
		const Product = require("../model/Product.js");
		const product = await Product.findById(req.query.productId);
		if (!product) return res.status(404).json({ ok: false, error: "product not found" });
		const purchases = await Whitelist.find({ product: product._id }).populate("client").lean();
		const owners = purchases.map((p) => p.client).filter(Boolean);
		const reachable = owners.filter((o) => o.inServer).length;
		res.json({
			ok: true,
			product: product.name,
			total: owners.length,
			reachable,
			unreachable: owners.length - reachable
		});
	} catch (e) {
		res.status(500).json({ ok: false, error: e.message });
	}
});

// Send broadcast (or test). body: { productId, message, testDiscordId? }
router.post("/broadcast", async (req, res) => {
	const { productId, message, testDiscordId } = req.body || {};
	if (!productId || !message) return res.status(400).json({ ok: false, error: "productId and message required" });
	const r = await messaging.broadcastToProduct(productId, message, { testDiscordId });
	res.status(r.ok ? 200 : 400).json(r);
});

// --- Remote kill list (dashboard-controlled). Matches make /verify return signed killed:true. ---
const KillList = require("../model/KillList.js");

router.get("/kills", async (_req, res) => {
	try {
		const kills = await KillList.find({ active: true }).sort({ created: -1 }).lean();
		res.json({ ok: true, kills });
	} catch (e) {
		res.status(500).json({ ok: false, error: e.message });
	}
});

// body: { scope: "universe"|"place"|"user", value, reason?, by? }
router.post("/kill", async (req, res) => {
	const { scope, value, reason, by } = req.body || {};
	if (!scope || !value || !["universe", "place", "user"].includes(scope)) {
		return res.status(400).json({ ok: false, error: "scope (universe|place|user) and value required" });
	}
	try {
		const doc = await KillList.findOneAndUpdate(
			{ scope, value: String(value) },
			{ $set: { scope, value: String(value), reason: reason || "", active: true, createdBy: by || "panel", created: new Date() } },
			{ upsert: true, new: true }
		);
		res.json({ ok: true, kill: doc });
	} catch (e) {
		res.status(500).json({ ok: false, error: e.message });
	}
});

// body: { scope, value }
router.post("/unkill", async (req, res) => {
	const { scope, value } = req.body || {};
	if (!scope || !value) return res.status(400).json({ ok: false, error: "scope and value required" });
	try {
		const r = await KillList.updateOne({ scope, value: String(value) }, { $set: { active: false } });
		res.json({ ok: true, modified: r.modifiedCount || 0 });
	} catch (e) {
		res.status(500).json({ ok: false, error: e.message });
	}
});

// --- Pack enforcement level (dashboard-controlled remote toggle). full | entitlement | off ---
const Setting = require("../model/Setting.js");

router.get("/enforce", async (_req, res) => {
	try {
		const doc = await Setting.findOne({ key: "packEnforcement" }).lean();
		res.json({ ok: true, enforcement: (doc && doc.value) || {} });
	} catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// body: { pack, mode: "full"|"entitlement"|"off" }  (full = default, clears the override)
router.post("/enforce", async (req, res) => {
	const { pack, mode } = req.body || {};
	if (!pack || !["full", "entitlement", "off"].includes(mode)) {
		return res.status(400).json({ ok: false, error: "pack + mode (full|entitlement|off) required" });
	}
	try {
		const doc = await Setting.findOne({ key: "packEnforcement" }).lean();
		const map = (doc && doc.value && typeof doc.value === "object") ? doc.value : {};
		if (mode === "full") delete map[pack]; else map[pack] = mode;
		await Setting.updateOne({ key: "packEnforcement" }, { $set: { value: map, updated: new Date() } }, { upsert: true });
		res.json({ ok: true, enforcement: map });
	} catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// --- Admin signer: sign a rig fingerprint for the initial pack manifest. body: { digest, pack, ver? } ---
const signer = require("./util/signer.js");
router.post("/sign", (req, res) => {
	const { digest, pack, ver } = req.body || {};
	if (!digest || !pack) return res.status(400).json({ ok: false, error: "digest and pack required" });
	const v = String(ver || "1");
	const sig = signer.signMessage(`rig|${String(digest)}|${String(pack)}|${v}`);
	if (!sig) return res.status(500).json({ ok: false, error: "signing unavailable (no key)" });
	res.json({ ok: true, digest: String(digest), pack: String(pack), ver: v, sig });
});

module.exports = router;
