const mongoose = require("mongoose");

// Remote-kill / blacklist. A match here makes /verify return a SIGNED killed:true so the
// in-game gate shuts the vehicle system down on its next check. Controlled from the dashboard.
const schema = new mongoose.Schema({
    scope: { type: String, enum: ["universe", "place", "user"], required: true },
    value: { type: String, required: true }, // universeId / placeId / roblox userId
    reason: { type: String },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    createdBy: { type: String },
});

schema.index({ scope: 1, value: 1 }, { unique: true });

module.exports = mongoose.models.KillList || mongoose.model("KillList", schema);
