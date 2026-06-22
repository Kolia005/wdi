const { Interaction, EmbedBuilder } = require("discord.js");

const errEmbed = (desc) => new EmbedBuilder().setTitle("Error").setDescription(desc).setColor("0x2f3136");

/**
 * @param {discord.Client} client
 */
module.exports = exports = (client) => {

    /**
     * @param {Interaction} interaction
     */
    client.on("interactionCreate", async (interaction) => {

        // --- Component interactions: handled persistently (survive bot restarts,
        //     unlike the old in-memory awaitMessageComponent collectors) ---
        if (interaction.isSelectMenu && interaction.isSelectMenu()) {
            try {
                const link = client.commands.get("link");
                if (link && typeof link.handleVerifyMethod === "function" && interaction.customId === link.selectId) {
                    await link.handleVerifyMethod(interaction);
                }
            } catch (e) {
                console.log("[interaction] select handler error:", e);
            }
            return;
        }

        if (!interaction.isChatInputCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            interaction.deferReply().then(async () => {
                try {
                    await command.run(interaction);
                } catch (e) {
                    console.log(`Error in command ${interaction.commandName} (or middleware): ${e}`);
                    try {
                        await interaction.editReply({ embeds: [errEmbed(`An error occurred executing the \`${interaction.commandName}\` command. Please try again later.`)], ephemeral: true });
                    } catch (err) {
                        try {
                            await interaction.channel.send({ embeds: [errEmbed(`An error occurred executing the \`${interaction.commandName}\` command. Please try again later.`)] });
                        } catch (_) { /* channel gone — give up quietly */ }
                    }
                }
            }).catch((e) => {
                console.log(`Could not defer ${interaction.commandName}: ${e}`);
            });
        } catch (err) {
            console.log(err);
            try {
                await interaction.channel.send({ embeds: [errEmbed(`Unknown Command - ID: \`${interaction.commandId}\``)] });
            } catch (_) { /* ignore */ }
        }
    });
};
