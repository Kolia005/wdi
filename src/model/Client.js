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
        required: true
    },

    created: {
        type: Date,
        default: Date.now,
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