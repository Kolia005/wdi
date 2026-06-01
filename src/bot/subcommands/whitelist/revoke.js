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

const Client = require("../../../model/Client.js");
const Product = require("../../../model/Product.js");
const Purchase = require("../../../model/Whitelist.js");

/**
 * A command
 * @param {Interaction} interaction 
 */
module.exports = async (interaction) => {
    let clientRecord = await Client.findOne({
        discord: interaction.options.getUser('mention').id
    }).exec();

    if (!clientRecord) {
        return interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("Error")
                    .setColor("0x2f3136")
                    .setDescription("Client is not linked with eStore.")
            ],
            ephemeral: true
        });
    }

    let productRecord = await Product.findOne({
        name: interaction.options.getString('productname')
    }).exec();

    if (!productRecord) {
        return interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("Error")
                    .setColor("0x2f3136")
                    .setDescription("There is no product with that name.")
            ],
            ephemeral: true
        });
    }

    let purchaseRecord = await Purchase.findOne({
        product: productRecord._id,
        client: clientRecord._id
    }).exec();

    if (!purchaseRecord) {
        return interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("Error")
                    .setColor("0x2f3136")
                    .setDescription("Client does not have a whitelist for this product.")
            ],
            ephemeral: true
        });
    }

    await Purchase.deleteOne({
        _id: purchaseRecord._id
    }).exec();

    await interaction.editReply({
        embeds: [
            new EmbedBuilder()
                .setTitle("Success")
                .setColor("0x2f3136")
                .setDescription("Product revoked sucessfully.")
        ]
    }); 
}
