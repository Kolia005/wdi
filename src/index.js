require("dotenv").config();
const mongoose = require("mongoose");
const startHttp = require("./http");
const bot = require("./bot");

let shuttingDown = false;

function fatal(kind, error) {
    const rendered = error && error.stack ? error.stack : error;
    console.error(`[${kind}]`, rendered);

    if (shuttingDown) return;
    shuttingDown = true;
    // Let the log flush, then let PM2 replace the unhealthy process.
    setTimeout(() => process.exit(1), 250).unref();
}

process.on("unhandledRejection", (reason) => fatal("unhandledRejection", reason));
process.on("uncaughtException", (error) => fatal("uncaughtException", error));

async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; shutting down`);

    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();

    try {
        await bot.stop();
        await mongoose.disconnect();
        clearTimeout(timeout);
        process.exit(0);
    } catch (error) {
        fatal("shutdown", error);
    }
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

async function main() {
    await mongoose.connect(process.env.DB_URI);
    console.log("Connected to MongoDB");
    startHttp();
    await bot.start();
}

main().catch((error) => fatal("startup", error));
