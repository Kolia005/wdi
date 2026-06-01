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
        .setName('product')
        .setDescription('This product command')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a product')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a product')
                .addStringOption(option =>
                    option.setName('productname')
                        .setDescription('The name of the product')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('update')
                .setDescription('Update a product')
                .addStringOption(option =>
                    option.setName('productname')
                        .setDescription('The name of the product')
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
                require("../subcommands/products/grant")(interaction);
                break;
            case "revoke":
                require("../subcommands/products/revoke")(interaction);
                break;
            case "create":
                require("../subcommands/products/create")(interaction);
                break;
            case "delete":
                require("../subcommands/products/delete")(interaction);
                break;
            case "transfer":
                require("../subcommands/products/transfer")(interaction);
                break;
            case "update":
                require("../subcommands/products/update")(interaction);
                break;
        }
    },
};
