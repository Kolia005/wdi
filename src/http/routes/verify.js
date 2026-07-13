// Signed license-verification endpoint for the in-game whitelist gate.
//   GET /verify?place=<placeId>&universe=<universeId>[&product=<name>][&nonce=<n>]
// Returns an Ed25519-SIGNED assertion bound to the universe:
//   { u, p, prod, lic, packs, killed, iat, nonce }
//   - packs   = the owner's FULL entitlement (every product/pack they own) -> the in-game gate
//               does pack checks (AVCS, US_Pack, ...) as LOCAL lookups, so ONE ping covers all.
//   - killed  = remote-kill flag (dashboard-controlled); when set, lic=false and packs=[] so a
//               killed game shuts down on its next check.
const signer = require("../util/signer.js");
const { resolveOwner, fullEntitlement } = require("../util/roblox.js");
const KillList = require("../../model/KillList.js");
const wrapAsync = require("../util/wrapAsync.js");

async function isKilled(universeId, place, ownerId) {
    const or = [];
    if (universeId) or.push({ scope: "universe", value: String(universeId) });
    if (place) or.push({ scope: "place", value: String(place) });
    if (ownerId) or.push({ scope: "user", value: String(ownerId) });
    if (!or.length) return false;
    const hit = await KillList.findOne({ active: true, $or: or }).lean();
    return !!hit;
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

    const { universeId, ownerId } = await resolveOwner(place, universe);
    const packs = await fullEntitlement(ownerId);
    const killed = await isKilled(universeId, place, ownerId);

    // lic (for the specifically-queried product(s)) is a convenience; the gate really uses `packs`.
    const lic = !killed && (products.length ? products.every(p => packs.includes(p)) : packs.length > 0);

    const payload = {
        u: universeId ? String(universeId) : null,
        p: place ? String(place) : null,
        prod: products,
        lic: !!lic,
        packs: killed ? [] : packs,
        killed: !!killed,
        iat: Math.floor(Date.now() / 1000),
        nonce,
    };

    return res.status(200).json(signer.signPayload(payload));
});
