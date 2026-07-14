// Server-side Roblox owner resolution + entitlement lookup (modern APIs).
// Shared by /verify and /resign. The old getGameOwner.js used the retired api.roblox.com.
const axios = require("axios");

const Client = require("../../model/Client.js");
const Product = require("../../model/Product.js");
const Whitelist = require("../../model/Whitelist.js");

const TIMEOUT = 10000;

// place -> universe -> creator -> (group owner). Returns { universeId, ownerId } (either may be null).
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
        if (game.creator.type === "User") return { universeId, ownerId: game.creator.id ? String(game.creator.id) : null };
        if (game.creator.type === "Group") {
            const gr = await axios.get(`https://groups.roblox.com/v1/groups/${game.creator.id}`, { timeout: TIMEOUT });
            const ownerId = gr.data && gr.data.owner && gr.data.owner.userId ? String(gr.data.owner.userId) : null;
            return { universeId, ownerId };
        }
    } catch (e) { /* ignore */ }
    return { universeId, ownerId: null };
}

// Every product name this owner is licensed for (their full entitlement / pack set).
async function fullEntitlement(ownerId) {
    // "0" is the Studio-test / failed-resolution sentinel — NEVER treat it as a real licensed owner
    // (a client with roblox="0" must not license every game whose owner can't be resolved).
    if (!ownerId || String(ownerId) === "0") return [];
    const client = await Client.findOne({ roblox: String(ownerId) }).lean();
    if (!client) return [];
    const wls = await Whitelist.find({ client: client._id }).lean();
    const names = [];
    for (const w of wls) {
        const p = await Product.findById(w.product).lean();
        if (p && p.name) names.push(p.name);
    }
    return [...new Set(names)];
}

module.exports = { resolveOwner, fullEntitlement };
