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
const { refreshDiscordUrl } = require("../../fileDeliver.js");

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

    if (purchaseRecord) {
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

    let purchase = new Purchase({
        product: productRecord._id,
        client: clientRecord._id
    });

    await purchase.save();

    // top up this customer's whitelisted experiences with the new product's assets
    require("../../grantSync.js").afterWhitelistChange(clientRecord._id, "whitelist grant");

    const freshUrl = await refreshDiscordUrl(productRecord.fileurl);

    await interaction.options.getUser('mention').send({
        embeds: [
            new EmbedBuilder()
                .setTitle("Product Granted")
                .setColor("0x2f3136")
                .addFields(
                    { name: 'Product', value: `\`${productRecord.name}\``, inline: true },
                )
                .setDescription("You have been granted a product.")
        ],
        components: [
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Download')
                        .setURL(freshUrl)
                        .setStyle(ButtonStyle.Link),
                )
        ]
    }).then(async () => {
        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("Success")
                    .setColor("0x2f3136")
                    .setDescription("Product given sucessfully.")
            ]
        });
    }).catch((err) => {
        console.log(err)
        interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("Success")
                    .setColor("0x2f3136")
                    .setDescription("Product given sucessfully. However, we were unable to DM the user")
            ]
        });
    });
}