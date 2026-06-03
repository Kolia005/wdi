// Public (internet-reachable) Wix purchase endpoints. Authenticated by WIX_SECRET shared key.
// Mounted at /wix on the bot's express app; reachable via nginx (isemil.me/wix/...).
const express = require("express");
const crypto = require("crypto");
const wix = require("../bot/wixPurchase.js");
const { refreshDiscordUrl } = require("../bot/fileDeliver.js");
const Product = require("../model/Product.js");

const router = express.Router();
router.use(express.json({ limit: "256kb" }));

// --- PUBLIC download link (no secret; protected by an HMAC token tied to the product) ---
// A buyer's thank-you page links here; we refresh the Discord URL and redirect to the live file.
function downloadToken(productId) {
	const secret = process.env.WIX_SECRET || "x";
	return crypto.createHmac("sha256", secret).update("dl:" + productId).digest("hex").slice(0, 24);
}
router.get("/download/:productId/:token", async (req, res) => {
	try {
		const { productId, token } = req.params;
		if (token !== downloadToken(productId)) return res.status(403).send("Invalid or expired download link.");
		const product = await Product.findById(productId);
		if (!product) return res.status(404).send("Product not found.");
		const src = product.stableFile || product.fileurl;
		if (!src) return res.status(404).send("No file available for this product yet. Please contact support.");
		const fresh = await refreshDiscordUrl(src);
		return res.redirect(302, fresh);
	} catch (e) {
		return res.status(500).send("Download error.");
	}
});

// Auth: everything below requires the Wix shared secret.
router.use((req, res, next) => {
	const expected = process.env.WIX_SECRET;
	const got = req.headers["x-wix-secret"] || (req.body && req.body.secret);
	if (!expected || got !== expected) {
		return res.status(403).json({ ok: false, error: "forbidden" });
	}
	next();
});

// Health check for the Wix side to confirm connectivity
router.get("/ping", (_req, res) => res.json({ ok: true, service: "wdi-wix" }));

// Main purchase hook. body: { wixOrderId, wixProduct, robloxInput, email }
router.post("/purchase", async (req, res) => {
	try {
		const { wixOrderId, wixProductId, wixProduct, robloxInput, roblox, email } = req.body || {};
		const result = await wix.processWixPurchase({
			wixOrderId,
			wixProductId,
			wixProduct,
			robloxInput: robloxInput || roblox,
			email
		});
		res.status(result.ok ? 200 : 202).json(result); // 202 = accepted but held
	} catch (e) {
		console.log("[wix] purchase error:", e.message);
		res.status(500).json({ ok: false, error: "server_error" });
	}
});

// Refund hook. body: { wixOrderId }
router.post("/refund", async (req, res) => {
	try {
		const r = await wix.refundWixPurchase(req.body && req.body.wixOrderId);
		res.json(r);
	} catch (e) {
		res.status(500).json({ ok: false, error: "server_error" });
	}
});

module.exports = router;
