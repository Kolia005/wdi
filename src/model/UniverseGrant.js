// Records which universes have had their entitled assets auto-granted (from a /verify call), so we
// don't re-hit the Open Cloud grant API on every check. `sig` = sorted packs + asset epoch, so the
// grant re-fires when the owner buys a new pack (packs change) or Nick loads new assets (epoch bumps).
const mongoose = require("mongoose");

const schema = new mongoose.Schema({
    universe: { type: String, required: true, unique: true },
    sig: String,
    packs: [String],
    count: Number,
    granted: Number,
    total: Number,
    attempts: { type: Number, default: 0 },
    grantedAt: Date,
    lastResult: String,
});

module.exports = mongoose.models.UniverseGrant || mongoose.model("UniverseGrant", schema);
