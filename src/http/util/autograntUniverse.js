// Auto-grant a licensed game's entitled mesh/audio assets to its universe when it calls /verify.
// The customer buys, drops the vehicle files into their game, runs it, and on the first /verify their
// universe gets the Restricted meshes + audio granted with zero manual steps. Deduped so we don't
// re-hit the Open Cloud API on every check. Fire-and-forget (never blocks /verify, never throws out).
const Product = require("../../model/Product.js");
const UniverseGrant = require("../../model/UniverseGrant.js");
const { grantUniversePermission } = require("../../bot/robloxExperience.js");
const mongoose = require("mongoose");
const Setting = mongoose.models.Setting || require("../../model/Setting.js");

const AUDIO_KEY = "globalAudioAssetIds";
const EPOCH_KEY = "assetEpoch";

// epoch (bumped by /assetload when assets change) — cached 60s so we don't read it every request
let _epoch = null, _epochAt = 0;
async function getEpoch() {
    const now = Date.now();
    if (_epoch !== null && now - _epochAt < 60000) return _epoch;
    const doc = await Setting.findOne({ key: EPOCH_KEY }).lean();
    _epoch = (doc && Number(doc.value)) || 0;
    _epochAt = now;
    return _epoch;
}

// every asset a universe entitled to `packs` should be able to load: global audio + each pack's meshes
async function assetsForPacks(packs) {
    const ids = new Set();
    const audio = await Setting.findOne({ key: AUDIO_KEY }).lean();
    if (audio && Array.isArray(audio.value)) audio.value.forEach(id => ids.add(String(id)));
    for (const name of packs) {
        const p = await Product.findOne({ name }).lean();
        if (p && Array.isArray(p.meshAssetIds)) p.meshAssetIds.forEach(id => ids.add(String(id)));
    }
    return [...ids];
}

const _cache = new Map(); // universe -> sig; in-process fast path so a granted game costs zero DB

async function autoGrantUniverse(universeId, packs) {
    try {
        universeId = String(universeId || "");
        if (!universeId || !Array.isArray(packs) || !packs.length) return;
        if (!process.env.ROBLOX_OPEN_CLOUD_KEY) return; // no key -> nothing to grant with

        const sig = packs.slice().sort().join(",") + "@" + (await getEpoch());
        if (_cache.get(universeId) === sig) return; // already granted this exact set (hot path)

        const doc = await UniverseGrant.findOne({ universe: universeId }).lean();
        if (doc && doc.sig === sig) { _cache.set(universeId, sig); return; } // granted in a prior boot

        const assetIds = await assetsForPacks(packs);
        if (!assetIds.length) return;
        const res = await grantUniversePermission(universeId, assetIds); // batches 50/call, idempotent + permanent
        const full = !!(res && res.ok === true);
        const attempts = ((doc && doc.attempts) || 0) + 1;
        // settle (record sig -> stop retrying) on full success, or after 3 tries so a handful of bad ids
        // can't spam the grant API forever. Retries are safe: granting an already-granted asset is a no-op.
        const settle = full || attempts >= 3;

        await UniverseGrant.updateOne(
            { universe: universeId },
            { $set: Object.assign(
                { universe: universeId, packs, count: assetIds.length, granted: (res && res.granted) || 0, total: (res && res.total) || 0, attempts, grantedAt: new Date(), lastResult: full ? "ok" : ("partial " + ((res && res.granted) || 0) + "/" + ((res && res.total) || 0)) },
                settle ? { sig } : {}
            ) },
            { upsert: true }
        );
        if (settle) _cache.set(universeId, sig);
        console.log("[autogrant] universe", universeId, full ? "OK" : ("partial att#" + attempts), ((res && res.granted) || 0) + "/" + assetIds.length, "assets, packs:", packs.join(", "));
    } catch (e) {
        console.log("[autogrant] error", String(universeId) + ":", e.message);
    }
}

module.exports = { autoGrantUniverse };
