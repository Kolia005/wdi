const assert = require("assert");
const mongoose = require("mongoose");

const uri = process.env.TRANSFER_TEST_DB_URI;
if (!uri || process.env.TRANSFER_TEST_COLLECTION_PREFIX !== "wdi_transfer_test") {
    throw new Error("A database URI and the exact isolated collection prefix wdi_transfer_test are required");
}

const Client = require("../src/model/Client.js");
const Whitelist = require("../src/model/Whitelist.js");
const TransferOperation = require("../src/model/TransferOperation.js");
const transfer = require("../src/bot/transferService.js");

const product = () => new mongoose.Types.ObjectId();
const ids = values => values.map(String).sort();

async function productsFor(clientId) {
    return ids(await Whitelist.distinct("product", { client: clientId }));
}

async function reset() {
    await Promise.all([
        Client.deleteMany({}),
        Whitelist.deleteMany({}),
        TransferOperation.deleteMany({}),
    ]);
}

async function main() {
    console.log("transfer integration: connecting to disposable database");
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log("transfer integration: building test indexes");
    await Promise.all([Client.init(), Whitelist.init(), TransferOperation.init()]);
    console.log("transfer integration: running cases");

    const a = product(), b = product(), c = product();

    // Destination profile absent: one atomic Client retarget; whitelist IDs stay attached.
    await reset();
    let source = await Client.create({ roblox: "test-source-1", discord: "discord-1" });
    await Whitelist.create([{ client: source._id, product: a }, { client: source._id, product: b }]);
    let op = await transfer.executeTransfer({ sourceClientId: source._id, destinationRoblox: "test-dest-1", mode: "tr_confirm", actorDiscord: "admin" });
    assert.strictEqual(op.status, "complete");
    source = await Client.findById(source._id).lean();
    assert.strictEqual(source.roblox, "test-dest-1");
    assert.deepStrictEqual(await productsFor(source._id), ids([a, b]));

    // Merge: union at destination, captured source entitlements removed, Discord follows.
    await reset();
    source = await Client.create({ roblox: "test-source-2", discord: "discord-2" });
    let target = await Client.create({ roblox: "test-dest-2" });
    await Whitelist.create([
        { client: source._id, product: a }, { client: source._id, product: b },
        { client: target._id, product: b }, { client: target._id, product: c },
    ]);
    op = await transfer.executeTransfer({ sourceClientId: source._id, destinationRoblox: target.roblox, mode: "tr_merge", actorDiscord: "admin" });
    assert.strictEqual(op.status, "complete");
    assert.deepStrictEqual(await productsFor(target._id), ids([a, b, c]));
    assert.deepStrictEqual(await productsFor(source._id), []);
    assert.strictEqual((await Client.findById(target._id).lean()).discord, "discord-2");
    assert.strictEqual((await Client.findById(source._id).lean()).discord, undefined);

    // Overwrite: destination becomes exactly the source product set.
    await reset();
    source = await Client.create({ roblox: "test-source-3" });
    target = await Client.create({ roblox: "test-dest-3" });
    await Whitelist.create([
        { client: source._id, product: a }, { client: source._id, product: b },
        { client: target._id, product: b }, { client: target._id, product: c },
    ]);
    op = await transfer.executeTransfer({ sourceClientId: source._id, destinationRoblox: target.roblox, mode: "tr_overwrite", actorDiscord: "admin" });
    assert.strictEqual(op.status, "complete");
    assert.deepStrictEqual(await productsFor(target._id), ids([a, b]));
    assert.deepStrictEqual(await productsFor(source._id), []);

    // Crash recovery: an expired applying lease is reclaimed and completed.
    await reset();
    source = await Client.create({ roblox: "test-source-4" });
    target = await Client.create({ roblox: "test-dest-4" });
    await Whitelist.create({ client: source._id, product: a });
    op = await transfer.createTransfer({ sourceClientId: source._id, destinationRoblox: target.roblox, mode: "tr_merge", actorDiscord: "admin" });
    await TransferOperation.updateOne(
        { _id: op._id },
        { $set: { status: "applying", leaseToken: "dead-process", leaseUntil: new Date(Date.now() - 1000) } }
    );
    op = await transfer.runTransfer(op._id);
    assert.strictEqual(op.status, "complete");
    assert.deepStrictEqual(await productsFor(target._id), ids([a]));
    assert.deepStrictEqual(await productsFor(source._id), []);

    // Re-running a completed operation is harmless.
    const again = await transfer.runTransfer(op._id);
    assert.strictEqual(again.status, "complete");
    assert.deepStrictEqual(await productsFor(target._id), ids([a]));

    console.log("transfer integration tests passed");
}

main()
    .finally(async () => {
        if (mongoose.connection.readyState) {
            for (const model of [TransferOperation, Whitelist, Client]) {
                try { await model.collection.drop(); } catch (error) {
                    if (error.codeName !== "NamespaceNotFound") throw error;
                }
            }
            await mongoose.disconnect();
        }
    })
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
