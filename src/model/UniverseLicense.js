// Explicit per-universe license grant (dashboard-controlled).
// Licenses a SPECIFIC game (universe) for a set of packs, independent of owner resolution.
// Needed because Roblox's public games API returns creator id 0 / "[UNKNOWN]" for private /
// unpublished games, so owner-based entitlement can't reach them (a private dev game, a comped
// customer, or a game whose owner can't be resolved). These grants are UNIONed with owner entitlement
// in /verify. Keyed on the universe id, so they can never re-open the "owner 0 licenses everything" hole.
const mongoose = require("mongoose");

const schema = new mongoose.Schema({
    universe: { type: String, required: true, unique: true },
    packs: { type: [String], default: [] }, // WDI product names this universe is licensed for
    note: { type: String, default: "" },
    createdBy: { type: String, default: "panel" },
    at: { type: Date, default: Date.now },
});

module.exports = mongoose.models.UniverseLicense || mongoose.model("UniverseLicense", schema);
