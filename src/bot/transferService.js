const crypto = require("crypto");

const Client = require("../model/Client.js");
const Whitelist = require("../model/Whitelist.js");
const TransferOperation = require("../model/TransferOperation.js");

const LEASE_MS = 2 * 60 * 1000;
const RECOVERY_MS = 60 * 1000;
const VALID_MODES = new Set(["tr_confirm", "tr_merge", "tr_overwrite"]);

let recoveryTimer = null;
let recoveryRunning = false;

function stringSet(values) {
    return new Set((values || []).map(String));
}

function uniqueIds(values) {
    return [...stringSet(values)];
}

function desiredProducts(mode, sourceProducts, targetProducts) {
    if (mode === "tr_overwrite") return uniqueIds(sourceProducts);
    return uniqueIds([...(targetProducts || []), ...(sourceProducts || [])]);
}

async function productIdsFor(clientId) {
    if (!clientId) return [];
    return uniqueIds(await Whitelist.distinct("product", { client: clientId }));
}

async function createTransfer({ sourceClientId, destinationRoblox, mode, actorDiscord }) {
    if (!VALID_MODES.has(mode)) throw new Error("invalid transfer mode");

    const source = await Client.findById(sourceClientId).lean();
    if (!source) throw new Error("source client no longer exists");
    if (String(source.roblox) === String(destinationRoblox)) throw new Error("source and destination are the same account");

    // Resume an already-journaled transfer instead of starting a competing one.
    const existing = await TransferOperation.findOne({
        sourceClient: source._id,
        destinationRoblox: String(destinationRoblox),
        status: { $in: ["pending", "applying"] },
    }).sort({ createdAt: -1 });
    if (existing) {
        if (existing.mode !== mode) throw new Error("a transfer to this account is already pending with a different mode");
        return existing;
    }

    const target = await Client.findOne({ roblox: String(destinationRoblox) }).lean();
    const sourceProducts = await productIdsFor(source._id);
    const targetProducts = target ? await productIdsFor(target._id) : [];

    return TransferOperation.create({
        sourceClient: source._id,
        targetClient: target ? target._id : undefined,
        destinationRoblox: String(destinationRoblox),
        mode,
        sourceProducts,
        targetProducts,
        desiredProducts: target ? desiredProducts(mode, sourceProducts, targetProducts) : sourceProducts,
        sourceDiscord: source.discord || undefined,
        actorDiscord: actorDiscord ? String(actorDiscord) : undefined,
        status: "pending",
    });
}

async function claimOperation(operationId) {
    const now = new Date();
    const token = crypto.randomUUID();
    const claimed = await TransferOperation.findOneAndUpdate(
        {
            _id: operationId,
            status: { $ne: "complete" },
            $or: [
                { status: "pending" },
                { status: "applying", leaseUntil: { $lt: now } },
                { status: "applying", leaseUntil: { $exists: false } },
            ],
        },
        {
            $set: {
                status: "applying",
                leaseToken: token,
                leaseUntil: new Date(now.getTime() + LEASE_MS),
                updatedAt: now,
            },
            $unset: { lastError: 1 },
            $inc: { attempts: 1 },
        },
        { new: true }
    );
    return claimed ? { operation: claimed, token } : null;
}

async function ensureTargetOperation(op, token) {
    let target = op.targetClient ? await Client.findById(op.targetClient).lean() : null;
    if (target && String(target.roblox) !== String(op.destinationRoblox)) target = null;
    if (!target) target = await Client.findOne({ roblox: String(op.destinationRoblox) }).lean();

    if (!target) return null;
    if (String(target._id) === String(op.sourceClient)) return null;

    if (!op.targetClient || String(op.targetClient) !== String(target._id)) {
        const targetProducts = await productIdsFor(target._id);
        const wanted = desiredProducts(op.mode, op.sourceProducts, targetProducts);
        await TransferOperation.updateOne(
            { _id: op._id, leaseToken: token },
            {
                $set: {
                    targetClient: target._id,
                    targetProducts,
                    desiredProducts: wanted,
                    updatedAt: new Date(),
                },
            }
        );
        op.targetClient = target._id;
        op.targetProducts = targetProducts;
        op.desiredProducts = wanted;
    }
    return target;
}

async function applyRetarget(op, token) {
    // Retargeting a client with no pre-existing destination profile is a single
    // atomic document update; its whitelists and Discord relation stay attached.
    const update = await Client.updateOne(
        { _id: op.sourceClient, roblox: { $ne: String(op.destinationRoblox) } },
        { $set: { roblox: String(op.destinationRoblox) } }
    );
    const source = await Client.findById(op.sourceClient).lean();
    if (!source || String(source.roblox) !== String(op.destinationRoblox)) {
        throw new Error("destination account appeared during transfer; retry will merge safely");
    }

    return {
        moved: op.sourceProducts.length,
        skipped: 0,
        removedFromTarget: 0,
        discord: op.sourceDiscord ? "retargeted" : "none",
        modifiedClient: !!update.modifiedCount,
    };
}

async function applyMerge(op, target) {
    const sourceSet = stringSet(op.sourceProducts);
    const originalTargetSet = stringSet(op.targetProducts);
    const wanted = uniqueIds(op.desiredProducts);

    // COPY FIRST. The unique compound whitelist index makes every upsert
    // idempotent even if Discord retries or the process restarts mid-transfer.
    for (const product of wanted) {
        await Whitelist.updateOne(
            { client: target._id, product },
            { $setOnInsert: { client: target._id, product, created: new Date() } },
            { upsert: true }
        );
    }

    const copied = await Whitelist.countDocuments({ client: target._id, product: { $in: wanted } });
    if (copied !== wanted.length) throw new Error(`destination verification failed (${copied}/${wanted.length})`);

    let removedFromTarget = 0;
    if (op.mode === "tr_overwrite") {
        const removed = await Whitelist.deleteMany({ client: target._id, product: { $nin: wanted } });
        removedFromTarget = removed.deletedCount || 0;
    }

    // Only now that the destination is complete do we remove the captured
    // source entitlements. A crash before this point can duplicate access but
    // cannot lose it; recovery safely repeats the same idempotent operation.
    if (op.sourceProducts.length) {
        await Whitelist.deleteMany({ client: op.sourceClient, product: { $in: op.sourceProducts } });
    }

    let discord = "none";
    if (op.sourceDiscord) {
        const freshTarget = await Client.findById(target._id).lean();
        if (!freshTarget.discord) {
            await Client.updateOne(
                { _id: target._id, $or: [{ discord: { $exists: false } }, { discord: null }] },
                { $set: { discord: op.sourceDiscord } }
            );
        }
        const confirmedTarget = await Client.findById(target._id).lean();
        if (confirmedTarget && confirmedTarget.discord === op.sourceDiscord) {
            await Client.updateOne({ _id: op.sourceClient, discord: op.sourceDiscord }, { $unset: { discord: 1 } });
            discord = "moved";
        } else {
            discord = "target_conflict";
        }
    }

    const finalTarget = stringSet(await productIdsFor(target._id));
    for (const product of wanted) {
        if (!finalTarget.has(product)) throw new Error("post-transfer destination verification failed");
    }
    const remainingSource = await Whitelist.countDocuments({ client: op.sourceClient, product: { $in: op.sourceProducts } });
    if (remainingSource !== 0) throw new Error("post-transfer source cleanup verification failed");

    const skipped = op.mode === "tr_overwrite"
        ? 0
        : [...sourceSet].filter(product => originalTargetSet.has(product)).length;
    return {
        moved: op.sourceProducts.length - skipped,
        skipped,
        removedFromTarget,
        discord,
    };
}

async function runTransfer(operationId) {
    const claim = await claimOperation(operationId);
    if (!claim) return TransferOperation.findById(operationId).lean();

    const { operation: op, token } = claim;
    try {
        const target = await ensureTargetOperation(op, token);
        const result = target ? await applyMerge(op, target) : await applyRetarget(op, token);
        const completed = await TransferOperation.findOneAndUpdate(
            { _id: op._id, leaseToken: token },
            {
                $set: { status: "complete", result, completedAt: new Date(), updatedAt: new Date() },
                $unset: { leaseToken: 1, leaseUntil: 1, lastError: 1 },
            },
            { new: true }
        );
        return completed ? completed.toObject() : TransferOperation.findById(op._id).lean();
    } catch (error) {
        await TransferOperation.updateOne(
            { _id: op._id, leaseToken: token },
            {
                $set: { status: "pending", lastError: String(error.message || error).slice(0, 500), updatedAt: new Date() },
                $unset: { leaseToken: 1, leaseUntil: 1 },
            }
        );
        throw error;
    }
}

async function executeTransfer(input) {
    const operation = await createTransfer(input);
    try {
        return await runTransfer(operation._id);
    } catch (error) {
        error.transferOperationId = String(operation._id);
        throw error;
    }
}

async function recoverPendingTransfers() {
    if (recoveryRunning) return;
    recoveryRunning = true;
    try {
        const now = new Date();
        const pending = await TransferOperation.find({
            $or: [
                { status: "pending" },
                { status: "applying", leaseUntil: { $lt: now } },
                { status: "applying", leaseUntil: { $exists: false } },
            ],
        }).sort({ createdAt: 1 }).limit(50).select("_id").lean();
        for (const op of pending) {
            try {
                await runTransfer(op._id);
            } catch (error) {
                console.log("[transfer-recovery]", String(op._id), error.message);
            }
        }
    } finally {
        recoveryRunning = false;
    }
}

function startRecovery() {
    if (recoveryTimer) return;
    recoverPendingTransfers().catch(error => console.log("[transfer-recovery] startup:", error.message));
    recoveryTimer = setInterval(() => {
        recoverPendingTransfers().catch(error => console.log("[transfer-recovery] interval:", error.message));
    }, RECOVERY_MS);
    if (recoveryTimer.unref) recoveryTimer.unref();
}

module.exports = {
    createTransfer,
    runTransfer,
    executeTransfer,
    recoverPendingTransfers,
    startRecovery,
    desiredProducts,
};
