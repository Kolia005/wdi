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

    let purchaseRecord = await Purchase.find({
        product: productRecord._id,
    }).populate("client").exec();

    console.log(purchaseRecord)
    let embed = new EmbedBuilder()
        .setColor("0x2f3136")
        .setTitle(`Current Whitelists Of ${productRecord.name}`)
        .setDescription(`**Whitelists**\n${purchaseRecord.length <= 0 ? "No whitelists" : purchaseRecord.map(p => `<@${p.client.discord}> (${p.client.roblox})`).join("\n")}`)
    interaction.editReply({
        embeds: [embed]
    });
}