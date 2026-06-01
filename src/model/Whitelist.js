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

module.exports = mongoose.model("Whitelist", schema);
