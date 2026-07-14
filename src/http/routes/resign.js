// Re-sign service — ADMIN-only (INTERNAL_SECRET header), returns an RSA rig signature the in-game
// gate actually verifies (WL.verifyRig does an RSA PKCS1/SHA-256 check).
//   POST /resign   header: X-Internal-Secret;   body/query: { place|universe, digest, pack, ver? }
// Re-signs an edited rig's fingerprint IF the resolved game owner owns `pack`.
// NB: was previously public with a FAKE ownership gate — it checked the owner of whatever placeId
// you passed, not the caller, so anyone could mint a valid "<pack>" signature using a licensed
// game's public place ID. Now gated on the shared secret (nginx also restricts /resign to
// localhost). A proper self-serve customer re-sign needs an authenticated caller-identity flow.
const wrapAsync = require("../util/wrapAsync.js");
const signer = require("../util/signer.js");
const { resolveOwner, fullEntitlement } = require("../util/roblox.js");

module.exports = wrapAsync(async (req, res) => {
    const secret = process.env.INTERNAL_SECRET;
    if (!secret || req.headers["x-internal-secret"] !== secret) {
        return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const body = req.body || {};
    const place = body.place || req.query.place || null;
    const universe = body.universe || req.query.universe || null;
    const digest = String(body.digest || req.query.digest || "").trim();
    const pack = String(body.pack || req.query.pack || "").trim();
    const ver = String(body.ver || req.query.ver || "1");

    if (!digest || !pack) return res.status(400).json({ ok: false, error: "digest and pack required" });
    if (!place && !universe) return res.status(400).json({ ok: false, error: "place or universe required" });

    const { ownerId } = await resolveOwner(place, universe);
    const packs = await fullEntitlement(ownerId);
    if (!packs.includes(pack)) {
        return res.status(403).json({ ok: false, error: "owner is not licensed for that pack" });
    }

    const msg = `rig|${digest}|${pack}|${ver}`;
    const rsa = signer.rsaSign(msg);
    if (!rsa) return res.status(500).json({ ok: false, error: "signing unavailable (no RSA key)" });

    // rsa = what the in-game WL.verifyRig checks (WLSig). sig (Ed25519) returned too for parity with /internal/sign.
    return res.status(200).json({ ok: true, digest, pack, ver, rsa, sig: signer.signMessage(msg) || "" });
});
