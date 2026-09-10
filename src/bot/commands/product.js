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
        switch (interaction.options.getSubcommand()) {
            case "create":
                return require("../subcommands/products/create")(interaction);
            case "delete":
                return require("../subcommands/products/delete")(interaction);
            case "update":
                return require("../subcommands/products/update")(interaction);
            default:
                throw new Error("Unsupported product subcommand");
        }
    },
};
