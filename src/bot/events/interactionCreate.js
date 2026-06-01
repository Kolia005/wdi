const { Interaction, EmbedBuilder } = require("discord.js");

/**
 * @param {discord.Client} client
 */
module.exports = exports = (client) => {

    /**
     * @param {Interaction} interaction
     */
    client.on("interactionCreate", async (interaction) => {
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
                        await interaction.editReply({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle("Error")
                                    .setDescription(`An error occurred executing the \`${interaction.commandName}\` command. Please try again later.`)
                                    .setColor("0x2f3136")
                            ],
                            ephemeral: true
                        });
                    } catch (err) {
                        await interaction.channel.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle("Error")
                                    .setDescription(`An error occurred executing the \`${interaction.commandName}\` command. Please try again later.`)
                                    .setColor("0x2f3136")
                            ]
                        });
                    }
                }
            });
        } catch (err) {
            console.log(err);
            await interaction.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Error")
                        .setDescription(`Unknown Command - ID: \`${interaction.commandId}\``)
                        .setColor("0x2f3136")
                ]
            });
        }
    });
};