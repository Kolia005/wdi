const express = require("express");
const mongoose = require("mongoose");

const wrapAsync = require("../util/wrapAsync.js");

const Client = require("../../model/Client.js");
const Product = require("../../model/Product.js");
const Purchase = require("../../model/Whitelist.js");

const getGameOwner = require("../util/getGameOwner.js");

/**
 * A route
 * @param {express.Request} req 
 * @param {express.Response} res 
 */
module.exports = wrapAsync(async (req, res) => {
    let ip = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    if (ip) {
        ip = ip.split(",");
        [ip] = ip;
    }

    console.log(`checking ip: ${ip}`);
    
    const place = String(req.headers["roblox-id"]) ? String(req.headers["roblox-id"]) : "0";

    let productId = await req.headers["product-id"];
    if (!productId) {
        console.log("No product id specified")
        return res.status(404).json({ status: 404, message: "No productId id specified" });
    }

    console.log(`productId id: ${productId}`);

    const productRecord = await Product.findOne({
        name: productId,
    }).exec();

    if (!productRecord) {
        console.log("Invalid product id")
        return res.status(404).json({ status: 404, message: "Invalid product id" });
    }

    const clientRecord = await Client.findOne({
        roblox: req.headers["place-id"],
    }).exec();

    if (!clientRecord) {
        console.log("Invalid client id")
        return res.status(404).json({ status: 404, message: "Invalid client id" });
    }

    const purchaseRecord = await Purchase.findOne({
        product: productRecord._id,
        client: clientRecord._id
    }).exec();

    if (!purchaseRecord) {
        console.log("Invalid whitelist id")
        return res.status(404).json({ status: 404, message: "Invalid whitelist" });
    }

    console.log(`place: ${place} owner: ${req.headers["place-id"]}`);

    return res.status(200).json({
        status: 200,
        whitelisted: true,
        placeOwner: req.headers["place-id"],
    });
});