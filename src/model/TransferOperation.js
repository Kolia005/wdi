const mongoose = require("mongoose");

// Durable journal for account transfers. MongoDB is currently a standalone
// server, so multi-document transactions are unavailable. Transfer operations
// therefore copy and verify destination entitlements before removing source
// entitlements, and this journal lets an interrupted operation resume safely.
const schema = new mongoose.Schema({
    sourceClient: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    targetClient: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
    destinationRoblox: { type: String, required: true },
    mode: { type: String, enum: ["tr_confirm", "tr_merge", "tr_overwrite"], required: true },

    sourceProducts: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    targetProducts: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    desiredProducts: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    sourceDiscord: String,
    actorDiscord: String,

    status: { type: String, enum: ["pending", "applying", "complete"], default: "pending", index: true },
    leaseToken: String,
    leaseUntil: Date,
    attempts: { type: Number, default: 0 },
    lastError: String,
    result: mongoose.Schema.Types.Mixed,

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    completedAt: Date,
});

schema.index({ status: 1, leaseUntil: 1, createdAt: 1 });

const testPrefix = process.env.TRANSFER_TEST_COLLECTION_PREFIX;
module.exports = mongoose.models.TransferOperation || mongoose.model(
    "TransferOperation",
    schema,
    testPrefix ? `${testPrefix}_operations` : undefined
);
