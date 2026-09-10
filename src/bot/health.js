const { Status } = require("discord.js");

let client;
let readyAt = null;
let disconnectedAt = null;
let disconnectReason = null;
let unhealthySince = null;
let watchdog;

function attach(nextClient) {
    client = nextClient;
}

function markReady() {
    readyAt = new Date();
    disconnectedAt = null;
    disconnectReason = null;
    unhealthySince = null;
}

function markDisconnected(reason) {
    disconnectedAt = new Date();
    disconnectReason = reason || "Discord gateway disconnected";
    if (!unhealthySince) unhealthySince = Date.now();
}

function isReady() {
    return Boolean(client && client.isReady() && client.ws.status === Status.Ready);
}

function snapshot() {
    return {
        ready: isReady(),
        gatewayStatus: client ? client.ws.status : null,
        pingMs: client && Number.isFinite(client.ws.ping) ? client.ws.ping : null,
        readyAt: readyAt ? readyAt.toISOString() : null,
        disconnectedAt: disconnectedAt ? disconnectedAt.toISOString() : null,
        disconnectReason,
    };
}

function startWatchdog(onUnhealthy, options = {}) {
    const intervalMs = options.intervalMs || 15000;
    const graceMs = options.graceMs || 90000;
    stopWatchdog();

    watchdog = setInterval(() => {
        if (isReady()) {
            unhealthySince = null;
            return;
        }

        if (!unhealthySince) unhealthySince = Date.now();
        if (Date.now() - unhealthySince >= graceMs) {
            onUnhealthy(snapshot());
        }
    }, intervalMs);
    watchdog.unref();
}

function stopWatchdog() {
    if (watchdog) clearInterval(watchdog);
    watchdog = null;
}

function resetForTests() {
    stopWatchdog();
    client = undefined;
    readyAt = null;
    disconnectedAt = null;
    disconnectReason = null;
    unhealthySince = null;
}

module.exports = {
    attach,
    isReady,
    markDisconnected,
    markReady,
    resetForTests,
    snapshot,
    startWatchdog,
    stopWatchdog,
};
