const mongoose = require("mongoose");

const schema = new mongoose.Schema({

    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
    },

    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Client",
        required: true,
    },

    created: {
        type: Date,
        default: Date.now,
    },
});

schema.set("toJSON", { virtuals: true });

// A customer can own a product only once. This makes Wix retries, Discord
// retries, and crash-resumed transfers idempotent at the database layer.
schema.index({ client: 1, product: 1 }, { unique: true });

const testPrefix = process.env.TRANSFER_TEST_COLLECTION_PREFIX;
module.exports = mongoose.model("Whitelist", schema, testPrefix ? `${testPrefix}_whitelists` : undefined);
