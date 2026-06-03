// Public (internet-reachable) Wix purchase endpoints. Authenticated by WIX_SECRET shared key.
// Mounted at /wix on the bot's express app; reachable via nginx (isemil.me/wix/...).
const express = require("express");
const wix = require("../bot/wixPurchase.js");

const router = express.Router();
router.use(express.json({ limit: "256kb" }));

// Auth: Wix must send the shared secret. Constant-time-ish compare.
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
		const { wixOrderId, wixProduct, robloxInput, roblox, email } = req.body || {};
		const result = await wix.processWixPurchase({
			wixOrderId,
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
