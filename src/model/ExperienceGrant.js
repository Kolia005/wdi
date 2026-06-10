const mongoose = require("mongoose");

// Records a customer's request to whitelist one of their Roblox experiences for mesh access.
// status: "pending"  -> ownership verified, grant not yet applied (no API key / no mesh IDs yet)
//         "granted"  -> Open Cloud grant succeeded
//         "failed"   -> grant attempted but errored
const schema = new mongoose.Schema({
    client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    robloxId: { type: String },        // verified owner Roblox ID at time of request
    placeId: { type: String },
    universeId: { type: String, required: true },
    creatorId: { type: String },       // the experience's creator id (user or group)
    creatorType: { type: String },     // "User" | "Group"
    ownedVia: { type: String },        // "user" | "group"
    assetIds: { type: [String], default: [] }, // mesh asset ids granted (when granted)
    status: { type: String, default: "pending" },
    error: { type: String },
    flagged: { type: Boolean, default: false }, // ownership drift (possible group churn) — no new grants while set
    flagReason: { type: String },
    lastSyncAt: { type: Date },
    created: { type: Date, default: Date.now },
    grantedAt: { type: Date },
});

schema.index({ client: 1, universeId: 1 }, { unique: true });
schema.set("toJSON", { virtuals: true });

module.exports = mongoose.models.ExperienceGrant || mongoose.model("ExperienceGrant", schema);
