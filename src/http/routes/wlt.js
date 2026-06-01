const express = require("express");
const mongoose = require("mongoose");
const wait = require('node:timers/promises').setTimeout;

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

    await wait(Math.floor((Math.random() * 3000) + 1000));
    let placeOwner = await getGameOwner(place);
    let productId = await req.headers["product-id"];
    if (!productId) {
        console.log("No product id specified")
        return res.status(404).json({ status: 404, message: "No productId id specified" });
    }

    let productId2 = await req.headers["product-id-2"];
    if (!productId2) {
        console.log("No product id specified")
        return res.status(404).json({ status: 404, message: "No productId id specified" });
    }

    console.log(`productId id: ${productId}`);
    console.log(`productId2 id: ${productId2}`);

    const productRecord = await Product.findOne({
        name: productId,
    }).exec();

    if (!productRecord) {
        console.log("Invalid product id")
        return res.status(404).json({ status: 404, message: "Invalid product id" });
    }

    const product2Record = await Product.findOne({
        name: productId2,
    }).exec();

    if (!product2Record) {
        console.log("Invalid product id")
        return res.status(404).json({ status: 404, message: "Invalid product id" });
    }

    console.log(placeOwner)
    const clientRecord = await Client.findOne({
        roblox: String(placeOwner),
    }).exec();

    if (!clientRecord) {
        console.log("Invalid client id")
        return res.status(404).json({ status: 404, message: "Invalid client id" });
    }

    if (clientRecord.roblox !== placeOwner.toString()) {
        console.log("Invalid owner")
        return res.status(404).json({ status: 404, message: "Invalid owner" });
    }

    const purchaseRecord = await Purchase.findOne({
        product: productRecord._id,
        client: clientRecord._id
    }).exec();

    if (!purchaseRecord) {
        console.log("Invalid whitelist id")
        return res.status(404).json({ status: 404, message: "Invalid whitelist" });
    }

    const purchase2Record = await Purchase.findOne({
        product: product2Record._id,
        client: clientRecord._id
    }).exec();

    if (!purchase2Record) {
        console.log("Invalid whitelist id")
        return res.status(404).json({ status: 404, message: "Invalid whitelist" });
    }

    console.log(`place: ${place} owner: ${placeOwner}`);

    return res.status(200).json({
        status: 200,
        whitelisted: true,
        placeOwner: placeOwner,
    });
});