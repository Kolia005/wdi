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

module.exports = router;
