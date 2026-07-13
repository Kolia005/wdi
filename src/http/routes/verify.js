// Signed license-verification endpoint for the in-game whitelist gate.
//   GET /verify?place=<placeId>&universe=<universeId>&product=<name>[&product2=<name>][&nonce=<n>]
// Server-side owner resolution (modern Roblox APIs — the old getGameOwner used the
// retired api.roblox.com) -> license check (owner must own ALL requested products) ->
// Ed25519-SIGNED assertion bound to the universe + products, so a client can't forge or
// replay it. Key from env VERIFY_PRIVATE_KEY_PEM (base64 of a pkcs8 PEM).
const crypto = require("crypto");
const axios = require("axios");

const Client = require("../../model/Client.js");
const Product = require("../../model/Product.js");
const Whitelist = require("../../model/Whitelist.js");
const wrapAsync = require("../util/wrapAsync.js");

const TIMEOUT = 10000;

let _key = null;
let _keyTried = false;
function privateKey() {
	if (_keyTried) return _key;
	_keyTried = true;
	const b64 = process.env.VERIFY_PRIVATE_KEY_PEM;
	if (b64) {
		try { _key = crypto.createPrivateKey(Buffer.from(b64, "base64").toString("utf8")); }
		catch (e) { console.log("[verify] bad VERIFY_PRIVATE_KEY_PEM:", e.message); }
	} else {
		console.log("[verify] no VERIFY_PRIVATE_KEY_PEM set — responses will be UNSIGNED");
	}
	return _key;
}

// place -> universe -> creator -> (group owner). Returns { universeId, ownerId } (ownerId may be null).
async function resolveOwner(place, universe) {
	let universeId = universe ? String(universe) : null;
	if (!universeId && place) {
		try {
			const r = await axios.get(`https://apis.roblox.com/universes/v1/places/${place}/universe`, { timeout: TIMEOUT });
			if (r.data && r.data.universeId) universeId = String(r.data.universeId);
		} catch (e) { /* not a place / lookup failed */ }
	}
	if (!universeId) return { universeId: null, ownerId: null };
	try {
		const g = await axios.get(`https://games.roblox.com/v1/games?universeIds=${universeId}`, { timeout: TIMEOUT });
		const game = g.data && g.data.data && g.data.data[0];
		if (!game || !game.creator) return { universeId, ownerId: null };
		if (game.creator.type === "User") return { universeId, ownerId: String(game.creator.id) };
		if (game.creator.type === "Group") {
			const gr = await axios.get(`https://groups.roblox.com/v1/groups/${game.creator.id}`, { timeout: TIMEOUT });
			const ownerId = gr.data && gr.data.owner && gr.data.owner.userId ? String(gr.data.owner.userId) : null;
			return { universeId, ownerId };
		}
	} catch (e) { /* ignore */ }
	return { universeId, ownerId: null };
}

// Does ownerId own EVERY requested product? (matches wlt semantics.)
async function licensedFor(ownerId, productNames) {
	if (!ownerId) return false;
	const client = await Client.findOne({ roblox: String(ownerId) }).lean();
	if (!client) return false;
	for (const name of productNames) {
		const product = await Product.findOne({ name }).lean();
		if (!product) return false;
		const wl = await Whitelist.findOne({ product: product._id, client: client._id }).lean();
		if (!wl) return false;
	}
	return true;
}

function sign(payloadObj) {
	const payloadStr = JSON.stringify(payloadObj);
	const key = privateKey();
	let sig = "";
	if (key) sig = crypto.sign(null, Buffer.from(payloadStr, "utf8"), key).toString("base64"); // Ed25519
	return { v: 1, payload: Buffer.from(payloadStr, "utf8").toString("base64"), sig };
}

module.exports = wrapAsync(async (req, res) => {
	const place = req.query.place || req.headers["place-id"] || null;
	const universe = req.query.universe || req.headers["universe-id"] || null;
	const nonce = String(req.query.nonce || "").slice(0, 64);

	let products = [];
	if (req.query.product) products.push(String(req.query.product));
	if (req.query.product2) products.push(String(req.query.product2));
	if (!products.length && req.query.products) products = String(req.query.products).split(",").map(s => s.trim()).filter(Boolean);
	products = [...new Set(products)];
	if (!products.length) return res.status(400).json({ status: 400, message: "no product specified" });

	const { universeId, ownerId } = await resolveOwner(place, universe);
	const licensed = await licensedFor(ownerId, products);

	// Signed assertion of the TRUE state, bound to the universe + products so it can't be
	// forged or replayed into another game. The gate must check payload.u === game.GameId.
	const payload = {
		u: universeId ? String(universeId) : null,
		p: place ? String(place) : null,
		prod: products,
		lic: !!licensed,
		iat: Math.floor(Date.now() / 1000),
		nonce,
	};

	return res.status(200).json(sign(payload));
});
