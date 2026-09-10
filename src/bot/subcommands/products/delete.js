const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} = require("discord.js");
const Product = require("../../../model/Product.js");
const Purchase = require("../../../model/Whitelist.js");

function embed(title, description) {
    return new EmbedBuilder().setTitle(title).setDescription(description).setColor("#2f3136");
}

module.exports = async (interaction) => {
    const product = await Product.findOne({ name: interaction.options.getString("productname") }).exec();
    if (!product) {
        return interaction.editReply({
            embeds: [embed("Error", "There is no product with that name.")],
            ephemeral: true,
        });
    }

    const message = await interaction.editReply({
        embeds: [embed("Deletion", "Are you sure you want to delete this product?\n\n*This also deletes every purchase for it.*")],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("delete_accept").setLabel("Yes").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId("delete_decline").setLabel("No").setStyle(ButtonStyle.Danger),
            ),
        ],
        fetchReply: true,
    });

    let confirmation;
    try {
        confirmation = await message.awaitMessageComponent({
            filter: (component) => component.user.id === interaction.user.id && component.isButton(),
            time: 60000,
        });
    } catch (_) {
        return interaction.editReply({ embeds: [embed("Deletion expired", "No changes were made.")], components: [] });
    }

    await confirmation.deferUpdate();
    if (confirmation.customId === "delete_decline") {
        return interaction.editReply({ embeds: [embed("Cancelled", "The product was not deleted.")], components: [] });
    }

    await Purchase.deleteMany({ product: product._id });
    await Product.deleteOne({ _id: product._id });
    return interaction.editReply({ embeds: [embed("Deleted", "The product and its purchases have been deleted.")], components: [] });
};
