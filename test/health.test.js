const test = require("node:test");
const assert = require("node:assert/strict");
const { Status } = require("discord.js");
const health = require("../src/bot/health.js");

test.afterEach(() => health.resetForTests());

test("health follows Discord client readiness", () => {
    let ready = false;
    const client = { isReady: () => ready, ws: { status: Status.Connecting, ping: 42 } };
    health.attach(client);
    assert.equal(health.snapshot().ready, false);

    ready = true;
    client.ws.status = Status.Ready;
    health.markReady();
    const snapshot = health.snapshot();
    assert.equal(snapshot.ready, true);
    assert.equal(snapshot.pingMs, 42);
    assert.ok(snapshot.readyAt);
});

test("watchdog calls the recovery hook when Discord stays unhealthy", async () => {
    health.attach({ isReady: () => false, ws: { status: Status.Idle, ping: NaN } });
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("watchdog did not fire")), 250);
        health.startWatchdog(() => {
            clearTimeout(timeout);
            resolve();
        }, { intervalMs: 5, graceMs: 15 });
    });
});
