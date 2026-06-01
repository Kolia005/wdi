const { Client, GatewayIntentBits, PermissionsBitField, Partials, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { Routes } = require('discord-api-types/v9');
const { REST } = require('@discordjs/rest');
const path = require("path");
const fs = require("fs");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
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
    ]
});
client.commands = new Collection();

/**
 * @description Loads all available commands
 */
function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        try {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            client.commands.set(command.data.name, command);
            console.log(`Loaded command '${command.data.name}.js'`);
        } catch (err) {
            console.log(err);
        }
    }
}

/**
 * @description Loads all slash commands
 */
function deployCommands() {
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const slashCommand = path.join(commandsPath, file);
        const command = require(slashCommand);
        commands.push(command.data.toJSON());
    }

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    rest.put(Routes.applicationGuildCommands(client.user.id, process.env.GUILD), { body: commands }).then(() => {
        console.log('Successfully registered application commands.')
    }).catch((err) => {
        console.log(err)
    });
}

/**
 * @description Loads event scripts
 */
function loadEvents() {
    var startupFolder = path.join(__dirname, "events");
    fs.readdir(startupFolder, (err, files) => {
        if (err) {
            console.log("Unable to read event folder")
            botErrorLog("Read Error", err.message);
        } else {
            files.forEach((file) => {
                if (file.length >= 4) {
                    if (file.substring(file.length - 3) === ".js") {
                        try {
                            let module = require(path.resolve(`${__dirname}/events/${file}`))(client);
                            console.log(`Loaded event '${file}'`)
                        } catch (e) {
                            console.log(e)
                            console.log(`Unbale to load event '${file}'`);
                        }
                    }
                }
            });
        }
    });
}

client.once("ready", () => {
    console.log("Connected to Discord");

    client.user.setActivity(
        "for purchases",
        {
            type: "WATCHING",
        }
    )
});

module.exports = () => {
    client.login(process.env.TOKEN).then(() => {
        deployCommands();
        loadCommands();
        loadEvents();
    }).catch((err) => {
        console.log(err)
    });
};