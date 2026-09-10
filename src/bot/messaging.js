// WDI messaging + membership module. Runs inside the bot process and shares its Discord client.
const mongoose = require("mongoose");

const Client = require("../model/Client.js");
const Product = require("../model/Product.js");
const Whitelist = require("../model/Whitelist.js");

const broadcastSchema = new mongoose.Schema({
    product: String,
    productId: mongoose.Schema.Types.ObjectId,
    message: String,
    total: Number,
    sent: Number,
    failed: Number,
    notInServer: Number,
    results: [{ discord: String, roblox: String, status: String }],
    at: { type: Date, default: Date.now },
});
const Broadcast = mongoose.models.Broadcast || mongoose.model("Broadcast", broadcastSchema);

let discordClient = null;
let guild = null;
let membershipTimer = null;
const activeBroadcasts = new Map();

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function botReady() {
    return Boolean(discordClient && typeof discordClient.isReady === "function" && discordClient.isReady());
}

async function syncMembership() {
    if (!botReady() || !guild) return { ok: false, error: "bot not ready", code: "BOT_NOT_READY" };
    try {
        const members = await guild.members.fetch();
        const present = new Set(members.map((member) => member.user.id));
        const clients = await Client.find({}, { discord: 1 }).lean();
        let inCount = 0;
        let outCount = 0;
        const now = new Date();
        const inIds = [];
        const outIds = [];

        for (const client of clients) {
            if (present.has(String(client.discord))) {
                inCount++;
                inIds.push(client._id);
            } else {
                outCount++;
                outIds.push(client._id);
            }
        }

        if (inIds.length) await Client.updateMany({ _id: { $in: inIds } }, { $set: { inServer: true, membershipChecked: now } });
        if (outIds.length) await Client.updateMany({ _id: { $in: outIds } }, { $set: { inServer: false, membershipChecked: now } });
        console.log(`[membership] synced: ${inCount} in server, ${outCount} left/unknown`);
        return { ok: true, inServer: inCount, notInServer: outCount, total: clients.length };
    } catch (error) {
        console.error("[membership] sync error:", error);
        return { ok: false, error: error.message };
    }
}

async function broadcastToProduct(productId, message, opts = {}) {
    if (!botReady()) return { ok: false, error: "bot not ready", code: "BOT_NOT_READY" };

    const lockKey = String(productId);
    const isFullBroadcast = !opts.testDiscordId;
    if (isFullBroadcast && activeBroadcasts.has(lockKey)) {
        return {
            ok: false,
            error: "a broadcast for this product is already running",
            code: "BROADCAST_ACTIVE",
            active: activeBroadcasts.get(lockKey),
        };
    }

    const progress = {
        productId: lockKey,
        startedAt: new Date().toISOString(),
        sent: 0,
        failed: 0,
        notInServer: 0,
        total: null,
    };
    if (isFullBroadcast) activeBroadcasts.set(lockKey, progress);

    try {
        const product = await Product.findById(productId);
        if (!product) return { ok: false, error: "product not found", code: "PRODUCT_NOT_FOUND" };

        const purchases = await Whitelist.find({ product: product._id }).populate("client").lean();
        let owners = purchases.map((purchase) => purchase.client).filter(Boolean);

        if (opts.testDiscordId) {
            owners = owners.filter((owner) => String(owner.discord) === String(opts.testDiscordId));
            if (!owners.length) return { ok: false, error: "that user does not own this product", code: "NOT_AN_OWNER" };
        }

        progress.product = product.name;
        progress.total = owners.length;
        const results = [];

        for (const owner of owners) {
            const discordId = String(owner.discord);
            try {
                const user = await discordClient.users.fetch(discordId);
                await user.send(message);
                results.push({ discord: discordId, roblox: owner.roblox, status: "sent" });
                progress.sent++;
            } catch (error) {
                const status = error && error.code === 50007 ? "not_in_server" : "failed";
                progress[status === "not_in_server" ? "notInServer" : "failed"]++;
                results.push({ discord: discordId, roblox: owner.roblox, status });
            }
            await sleep(1200);
        }

        const doc = await Broadcast.create({
            product: product.name,
            productId: product._id,
            message,
            total: owners.length,
            sent: progress.sent,
            failed: progress.failed,
            notInServer: progress.notInServer,
            results,
            at: new Date(),
        });

        return {
            ok: true,
            total: owners.length,
            sent: progress.sent,
            failed: progress.failed,
            notInServer: progress.notInServer,
            broadcastId: String(doc._id),
        };
    } finally {
        if (isFullBroadcast) activeBroadcasts.delete(lockKey);
    }
}

function getActiveBroadcasts() {
    return Array.from(activeBroadcasts.values()).map((item) => ({ ...item }));
}

function setClient(client) {
    discordClient = client;
}

async function bindGuild() {
    if (!botReady()) throw new Error("Discord client is not ready");
    guild = await discordClient.guilds.fetch(process.env.GUILD);
    await syncMembership();
    if (membershipTimer) clearInterval(membershipTimer);
    membershipTimer = setInterval(() => {
        syncMembership().catch((error) => console.error("[membership] scheduled sync failed:", error));
    }, 3 * 60 * 60 * 1000);
    membershipTimer.unref();
}

function stop() {
    if (membershipTimer) clearInterval(membershipTimer);
    membershipTimer = null;
    guild = null;
    discordClient = null;
}

module.exports = {
    Broadcast,
    bindGuild,
    broadcastToProduct,
    getActiveBroadcasts,
    setClient,
    stop,
    syncMembership,
};
