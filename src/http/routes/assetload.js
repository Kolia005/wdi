// Bulk asset-ID loader. Studio POSTs the mesh/texture/decal IDs it extracts from each vehicle, and
// the audio IDs, straight into the products / global audio library. Token-gated. Asset IDs are not
// secrets (they're visible in-game and the assets are Roblox-restricted regardless), so this is a
// low-sensitivity write channel; it only ever unions IDs into meshAssetIds / globalAudioAssetIds.
//   POST /assetload   header x-load-token;  body { kind:"mesh"|"audio", product?, ids:[...], replace? }
const wrapAsync = require("../util/wrapAsync.js");
const Product = require("../../model/Product.js");
const mongoose = require("mongoose");
const Setting = mongoose.models.Setting || require("../../model/Setting.js");

module.exports = wrapAsync(async (req, res) => {
    if (!process.env.ASSETLOAD_TOKEN || req.headers["x-load-token"] !== process.env.ASSETLOAD_TOKEN) {
        return res.status(403).json({ ok: false, error: "forbidden" });
    }
    const body = req.body || {};
    const kind = String(body.kind || "");
    const replace = body.replace === true;
    const clean = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(String).map(s => s.trim()).filter(s => /^\d{5,}$/.test(s)))];
    if (!clean.length) return res.status(400).json({ ok: false, error: "no valid ids" });

    if (kind === "audio") {
        const doc = await Setting.findOne({ key: "globalAudioAssetIds" }).lean();
        const prev = (doc && Array.isArray(doc.value)) ? doc.value.map(String) : [];
        const merged = replace ? clean : [...new Set([...prev, ...clean])];
        await Setting.updateOne({ key: "globalAudioAssetIds" }, { $set: { value: merged, updated: new Date() } }, { upsert: true });
        return res.json({ ok: true, kind, added: clean.length, total: merged.length });
    }

    if (kind === "mesh") {
        const name = String(body.product || "");
        const p = await Product.findOne({ name });
        if (!p) return res.status(404).json({ ok: false, error: "product not found: " + name });
        const prev = Array.isArray(p.meshAssetIds) ? p.meshAssetIds.map(String) : [];
        const merged = replace ? clean : [...new Set([...prev, ...clean])];
        await Product.updateOne({ _id: p._id }, { $set: { meshAssetIds: merged } });
        return res.json({ ok: true, kind, product: name, added: clean.length, total: merged.length });
    }

    return res.status(400).json({ ok: false, error: "kind must be mesh|audio" });
});
