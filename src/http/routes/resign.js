// Re-sign service (customer-facing, gated on pack ownership).
//   POST /resign   body/query: { place|universe, digest, pack, ver? }
// A legit owner who edits a bound rig submits its recomputed fingerprint `digest` here; if the
// resolved owner of place/universe owns `pack`, we return a fresh signature so the edited rig keeps
// working. A non-owner (thief) is refused. NB: the signature is a portable "this rig is <pack>"
// assertion; the per-game entitlement from /verify is what actually gates running it — so a sig
// obtained via someone else's licensed game is useless in a game that doesn't own the pack.
const wrapAsync = require("../util/wrapAsync.js");
const signer = require("../util/signer.js");
const { resolveOwner, fullEntitlement } = require("../util/roblox.js");

module.exports = wrapAsync(async (req, res) => {
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

    const sig = signer.signMessage(`rig|${digest}|${pack}|${ver}`);
    if (!sig) return res.status(500).json({ ok: false, error: "signing unavailable" });

    return res.status(200).json({ ok: true, digest, pack, ver, sig });
});
