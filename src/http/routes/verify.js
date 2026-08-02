// Signed license-verification endpoint for the in-game whitelist gate.
//   GET /verify?place=<placeId>&universe=<universeId>[&product=<name>][&nonce=<n>]
// Returns an Ed25519-SIGNED assertion bound to the universe:
//   { u, p, prod, lic, packs, killed, enf, vpack, iat, nonce }
//   - packs  = the owner's FULL entitlement (every product/pack they own) -> the in-game gate does
//              pack checks (AVCS, US_Pack, ...) as LOCAL lookups, so ONE ping covers all.
//   - killed = remote-kill flag (dashboard); when set, lic=false, packs=[] -> game shuts down.
//   - enf    = per-pack enforcement OVERRIDES { "<pack>": "entitlement"|"off" }. Absent pack = "full"
//              (entitlement + rig-lock). "entitlement" = license only, rig-lock off. "off" = open to
//              everyone. Signed, so only WDI controls it; a client can't flip it.
const signer = require("../util/signer.js");
const { resolveOwner, fullEntitlement, universeGrants } = require("../util/roblox.js");
const KillList = require("../../model/KillList.js");
const Setting = require("../../model/Setting.js");
const { getVehiclePackPolicy } = require("../util/vehiclePackPolicy.js");
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

async function enforcementMap() {
    const doc = await Setting.findOne({ key: "packEnforcement" }).lean();
    return (doc && doc.value && typeof doc.value === "object") ? doc.value : {};
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
    // entitlement = what the resolved owner owns, UNION explicit per-universe grants (covers private /
    // unresolvable games whose owner API returns id 0 / "[UNKNOWN]"). Never derived from owner "0".
    const [ownerPacks, uniPacks, killed, enf, vpack] = await Promise.all([
        fullEntitlement(ownerId),
        universeGrants(universeId),
        isKilled(universeId, place, ownerId),
        enforcementMap(),
        getVehiclePackPolicy(),
    ]);
    const packs = [...new Set([...ownerPacks, ...uniPacks])];

    const lic = !killed && (products.length ? products.every(p => packs.includes(p)) : packs.length > 0);

    const payload = {
        u: universeId ? String(universeId) : null,
        p: place ? String(place) : null,
        prod: products,
        lic: !!lic,
        packs: killed ? [] : packs,
        killed: !!killed,
        enf,                       // per-pack enforcement overrides (global, signed)
        vpack,                     // remotely managed vehicle -> pack policy (global, signed)
        iat: Math.floor(Date.now() / 1000),
        nonce,
    };

    // Licensing is intentionally read-only. Asset distribution/permissions are
    // independent from /verify, so a license check never mutates a customer's
    // universe or calls Roblox's asset-permission API.
    res.locals.licenseVerification = {
        universeId: universeId ? String(universeId) : "",
        ownerId: ownerId ? String(ownerId) : "",
        product: products.join(","),
        licensed: !!lic,
        killed: !!killed,
        reason: killed ? "Remote kill" : (lic ? "Authorized" : "Not entitled"),
    };

    // A licensing/kill endpoint must NEVER be cached (Cloudflare edge or Roblox HttpService),
    // or a game gets stale entitlement/kill state.
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.set("CDN-Cache-Control", "no-store");
    res.set("Pragma", "no-cache");
    return res.status(200).json(signer.signPayload(payload));
});
