const mongoose = require("mongoose");

// Tiny key/value store for system-wide config (e.g. the global audio asset library).
const schema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed },
    updated: { type: Date, default: Date.now },
});

schema.set("toJSON", { virtuals: true });

module.exports = mongoose.models.Setting || mongoose.model("Setting", schema);
