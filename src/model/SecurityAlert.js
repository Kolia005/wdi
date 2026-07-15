const mongoose = require("mongoose");

const schema = new mongoose.Schema({
 key: { type: String, required: true, unique: true },
 type: { type: String, required: true },
 severity: { type: String, default: "warning" },
 title: { type: String, required: true },
 message: { type: String, required: true },
 client: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
 robloxId: { type: String },
 universeId: { type: String },
 placeId: { type: String },
 data: { type: mongoose.Schema.Types.Mixed },
 active: { type: Boolean, default: true },
 acknowledgedAt: { type: Date },
 acknowledgedBy: { type: String },
 created: { type: Date, default: Date.now },
 updated: { type: Date, default: Date.now },
 resolvedAt: { type: Date },
});

schema.index({ active: 1, acknowledgedAt: 1, updated: -1 });

module.exports = mongoose.models.SecurityAlert || mongoose.model("SecurityAlert", schema);
