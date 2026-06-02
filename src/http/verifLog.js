// Verification logging for WDI API. Fire-and-forget: must NEVER break a response.
// Records every /wl* license check into the `verifications` collection with a TTL.
const mongoose = require("mongoose");

const schema = new mongoose.Schema({
	route: String, // wl | wln | wlt | wlv2
	product: String, // product name or id header
	clientRoblox: String, // x-jid
	placeId: String, // roblox-id (the game)
	placeOwner: String, // x-pid
	ip: String, // cf-connecting-ip
	owns: Boolean, // result
	reason: String, // why (Authorized / Invalid client / Invalid whitelist / place mismatch / etc.)
	at: { type: Date, default: Date.now }
});

// TTL index: auto-delete raw logs after 60 days to keep the 1GB box healthy.
schema.index({ at: 1 }, { expireAfterSeconds: 60 * 24 * 3600 });
// Helpful query indexes
schema.index({ product: 1, owns: 1, at: -1 });
schema.index({ placeId: 1, at: -1 });

const Verification = mongoose.models.Verification || mongoose.model("Verification", schema);

/**
 * Express middleware: wraps res.json to capture the verification result for /wl* routes.
 * Safe — any logging error is swallowed.
 */
function verifLogger(req, res, next) {
	if (!req.path.startsWith("/wl")) return next();

	const origJson = res.json.bind(res);
	res.json = (body) => {
		try {
			const h = req.headers;
			const ip = ((h["cf-connecting-ip"] || h["x-forwarded-for"] || req.connection.remoteAddress || "") + "").split(",")[0];
			Verification.create({
				route: req.path.replace("/", ""),
				product: String(h["x-prd"] || h["x-uid"] || ""),
				clientRoblox: String(h["x-jid"] || ""),
				placeId: String(h["roblox-id"] || ""),
				placeOwner: String(h["x-pid"] || ""),
				ip,
				owns: !!(body && body.owns),
				reason: (body && body.message) ? String(body.message) : (body && body.owns ? "Authorized" : "Denied")
			}).catch(() => {});
		} catch (e) { /* never break the response */ }
		return origJson(body);
	};
	next();
}

module.exports = { verifLogger, Verification };
