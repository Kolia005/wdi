const mongoose = require("mongoose");
const Schema = mongoose.Schema

const Client = new Schema({

    roblox: {
        type: String,
        required: true,
        index: {
            unique: true
        }
    },

    discord: {
        type: String,
    },

    created: {
        type: Date,
        default: Date.now,
    },

    inServer: {
        type: Boolean,
        default: null,
    },

    membershipChecked: {
        type: Date,
    },

    source: {
        type: String,
        default: "discord",
    },

    email: {
        type: String,
    },

}, {
    toJSON: {
        virtuals: true
    }
});

Client.virtual("purchases", {
    ref: "Purchase",
    localField: "_id",
    foreignField: "client"
});

Client.virtual("groupstaff", {
    ref: "GroupStaff",
    localField: "_id",
    foreignField: "group"
});

module.exports = mongoose.model("Client", Client);