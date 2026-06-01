const {
    SlashCommandBuilder,
    Interaction,
    ActionRowBuilder,
    ContextMenuCommandBuilder,
    SelectMenuBuilder,
    ButtonBuilder,
    EmbedBuilder,
    ButtonStyle,
    ApplicationCommandType,
    ApplicationCommandOptionType,
    GuildMember,
    PermissionFlagsBits
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('This whitelist command')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('grant')
                .setDescription('Grant a whitelist')
                .addStringOption(option =>
                    option.setName('productname')
                        .setDescription('The name of the product')
                        .setRequired(true)
                )
                .addUserOption(option =>
                    option.setName('mention')
                        .setDescription('The user to grant the whitelist to')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Get list of all whitelist users')
                .addStringOption(option =>
                    option.setName('productname')
                        .setDescription('The name of the product')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('revoke')
                .setDescription('Grant a whitelist')
                .addStringOption(option =>
                    option.setName('productname')
                        .setDescription('The name of the product')
                        .setRequired(true)
                )
                .addUserOption(option =>
                    option.setName('mention')
                        .setDescription('The user to grant the whitelist to')
                        .setRequired(true)
                )
        ),

    /**
     * @description Runs the command
     * @param {Interaction} interaction 
     */
    run: async (interaction) => {
        switch (interaction.options._subcommand) {
            case "grant":
                require("../subcommands/whitelist/grant")(interaction);
                break;
            case "list":
                require("../subcommands/whitelist/list")(interaction);
                break;
            case "revoke":
                require("../subcommands/whitelist/revoke")(interaction);
                break;
        }
    },
};
