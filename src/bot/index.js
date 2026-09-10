const {
    ActivityType,
    Client,
    Collection,
    Events,
    GatewayIntentBits,
    Partials,
    REST,
    Routes,
} = require("discord.js");
const path = require("path");
const fs = require("fs");
const messaging = require("./messaging.js");
const grantSync = require("./grantSync.js");
const transferService = require("./transferService.js");
const health = require("./health.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.MessageContent,
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember,
        Partials.Reaction,
    ],
});

client.commands = new Collection();
health.attach(client);

function loadCommands() {
    const commandsPath = path.join(__dirname, "commands");
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if (!command.data || typeof command.run !== "function") {
            throw new Error(`Invalid command module: ${file}`);
        }
        client.commands.set(command.data.name, command);
        console.log(`Loaded command '${command.data.name}.js'`);
    }
}

function loadEvents() {
    const eventsPath = path.join(__dirname, "events");
    const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith(".js"));

    for (const file of eventFiles) {
        require(path.join(eventsPath, file))(client);
        console.log(`Loaded event '${file}'`);
    }
}

async function deployCommands() {
    const commands = client.commands.map((command) => command.data.toJSON());
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    await rest.put(
        Routes.applicationGuildCommands(client.user.id, process.env.GUILD),
        { body: commands },
    );
    console.log("Successfully registered application commands.");
}

client.once(Events.ClientReady, async (readyClient) => {
    health.markReady();
    console.log(`Connected to Discord as ${readyClient.user.tag}`);

    messaging.setClient(client);
    await messaging.bindGuild();
    grantSync.setClient(client);
    if (process.env.ASSET_PERMISSION_GRANTS_ENABLED === "true") grantSync.start();
    transferService.startRecovery();

    readyClient.user.setActivity("for purchases", { type: ActivityType.Watching });
    await deployCommands();
});

client.on(Events.ShardDisconnect, (event, shardId) => {
    health.markDisconnected(`Shard ${shardId} disconnected with code ${event.code}`);
    console.warn(`[discord] shard ${shardId} disconnected (code ${event.code})`);
});
client.on(Events.ShardReconnecting, (shardId) => {
    health.markDisconnected(`Shard ${shardId} reconnecting`);
    console.warn(`[discord] shard ${shardId} reconnecting`);
});
client.on(Events.ShardResume, (shardId, replayedEvents) => {
    health.markReady();
    console.log(`[discord] shard ${shardId} resumed (${replayedEvents} replayed events)`);
});
client.on(Events.ShardReady, (shardId) => {
    health.markReady();
    console.log(`[discord] shard ${shardId} ready`);
});
client.on(Events.Error, (error) => console.error("[discord:error]", error));
client.on(Events.Warn, (warning) => console.warn("[discord:warn]", warning));
client.on(Events.Invalidated, () => {
    throw new Error("Discord session invalidated");
});

async function start() {
    if (!process.env.TOKEN) throw new Error("TOKEN is required");
    if (!process.env.GUILD) throw new Error("GUILD is required");

    loadCommands();
    loadEvents();
    health.startWatchdog((state) => {
        console.error("[discord] gateway remained unhealthy past the grace period", state);
        process.exit(1);
    });

    await client.login(process.env.TOKEN);
}

async function stop() {
    health.stopWatchdog();
    if (typeof messaging.stop === "function") messaging.stop();
    if (typeof grantSync.stop === "function") grantSync.stop();
    client.destroy();
}

module.exports = {
    getHealth: health.snapshot,
    start,
    stop,
};
