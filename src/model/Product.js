const mongoose = require("mongoose");

const schema = new mongoose.Schema({

    name: {
        type: String,
        maxlength: [32, "Name cannot be longer than 32 characters"],
        required: true,
    },

    description: {
        type: String,
        maxlength: [256, "Description cannot be longer than 256 characters"],
        required: true,
    },

    fileurl: {
        type: String,
    },

    // Roblox asset IDs of this product's PRIVATE meshes. Used by the experience-whitelisting
    // feature to grant a buyer's universe permission to load these meshes. Populate at launch.
    meshAssetIds: {
        type: [String],
        default: [],
    },

    file: {
        format: {
            type: String,
        },
        contents: {
            type: String,
        },
    },

    created: {
        type: Date,
        default: Date.now,
    },
});

schema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Product", schema);
