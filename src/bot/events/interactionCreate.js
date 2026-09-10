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
        if (interaction.isAnySelectMenu()) {
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
            await interaction.deferReply();
            await command.run(interaction);
        } catch (err) {
            console.error(`[interaction] ${interaction.commandName} failed:`, err);
            try {
                const payload = {
                    embeds: [errEmbed(`An error occurred executing the \`${interaction.commandName}\` command. Please try again later.`)],
                    ephemeral: true,
                };
                if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
                else await interaction.reply(payload);
            } catch (replyError) {
                console.error(`[interaction] unable to report ${interaction.commandName} failure:`, replyError);
            }
        }
    });
};
