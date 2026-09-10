const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} = require("discord.js");
const { isUsableDownloadUrl, refreshDiscordUrl } = require("./fileDeliver.js");

async function buildGrantMessage(product) {
    const embed = new EmbedBuilder()
        .setTitle("Product Granted")
        .setColor("#2f3136")
        .addFields({ name: "Product", value: `\`${product.name}\``, inline: true })
        .setDescription("You have been granted a product.");

    const freshUrl = await refreshDiscordUrl(product.fileurl);
    if (!isUsableDownloadUrl(freshUrl)) {
        embed.addFields({
            name: "Download",
            value: "No download file is attached yet. Contact an administrator.",
        });
        return { embeds: [embed], components: [] };
    }

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Download")
                    .setURL(freshUrl)
                    .setStyle(ButtonStyle.Link),
            ),
        ],
    };
}

module.exports = { buildGrantMessage };
