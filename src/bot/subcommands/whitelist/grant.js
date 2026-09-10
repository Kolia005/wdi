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
const { buildGrantMessage } = require("../../productDelivery.js");

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

    const grantResult = await Purchase.updateOne({
        product: productRecord._id,
        client: clientRecord._id
    }, {
        $setOnInsert: { created: new Date() }
    }, { upsert: true }).exec();

    if (!grantResult.upsertedId && grantResult.upsertedCount !== 1) {
        return interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("Error")
                    .setColor("0x2f3136")
                    .setDescription("This user already has this product whitelisted.")
            ],
            ephemeral: true
        });
    }

    if (process.env.ASSET_PERMISSION_GRANTS_ENABLED === "true") {
        require("../../grantSync.js").afterWhitelistChange(clientRecord._id, "whitelist grant");
    }

    try {
        const message = await buildGrantMessage(productRecord);
        await interaction.options.getUser('mention').send(message);
        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("Success")
                    .setColor("0x2f3136")
                    .setDescription("Product given sucessfully.")
            ]
        });
    } catch (err) {
        console.log("Unable to DM granted product:", err)
        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("Success")
                    .setColor("0x2f3136")
                    .setDescription("Product given sucessfully. However, we were unable to DM the user")
            ]
        });
    }
}
