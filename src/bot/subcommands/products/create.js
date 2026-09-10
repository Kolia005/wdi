const { EmbedBuilder } = require("discord.js");
const axios = require("axios");
const Product = require("../../../model/Product.js");
const lib = require("../../../util/lib.js");

function embed(title, description) {
    return new EmbedBuilder().setTitle(title).setColor("#2f3136").setDescription(description);
}

async function collect(interaction, filter = () => true) {
    const messages = await interaction.channel.awaitMessages({
        max: 1,
        filter: (message) => message.author.id === interaction.user.id && filter(message),
        errors: ["time"],
        time: 60000,
    });
    return messages.first();
}

module.exports = async (interaction) => {
    let prompt = await interaction.editReply({
        embeds: [embed("Product", "Please specify the name of the product.")],
        fetchReply: true,
    });

    let nameMessage;
    let descriptionMessage;
    let fileMessage;
    try {
        nameMessage = await collect(interaction);
        prompt = await nameMessage.reply({
            embeds: [embed("Product", "Please specify the product description.")],
            fetchReply: true,
        });
        descriptionMessage = await collect(interaction);
        prompt = await descriptionMessage.reply({
            embeds: [embed("Product", "Please upload the product file.")],
            fetchReply: true,
        });
        fileMessage = await collect(interaction, (message) => Boolean(message.attachments.first()));
    } catch (_) {
        return prompt.edit({ embeds: [embed("Error", "You did not reply in time.")] });
    }

    const attachment = fileMessage.attachments.first();
    const extension = String(attachment.name || "").split(".").pop().toLowerCase();
    if (!["rbxm", "rbxmx", "rbxl", "rbxlx"].includes(extension)) {
        return fileMessage.reply({ content: "Invalid file type." });
    }

    const progress = await fileMessage.reply("Please wait while the product is processed.");
    let product;
    let completed = false;
    try {
        const response = await axios.get(attachment.url, {
            responseType: "arraybuffer",
            timeout: 30000,
            maxContentLength: 100 * 1024 * 1024,
        });

        product = await Product.create({
            name: nameMessage.content,
            description: descriptionMessage.content,
        });

        const result = await lib.processFile(response.data, product._id);
        if (!result || result.statusCode !== 200 || !result.file) {
            await Product.deleteOne({ _id: product._id });
            return progress.edit({ content: "The file could not be processed. It may be corrupt." });
        }

        await Product.updateOne(
            { _id: product._id },
            { $set: { file: { format: extension, contents: result.file } } },
        );
        completed = true;
        return progress.edit({
            content: "Product created successfully.",
            files: [{
                attachment: Buffer.from(result.file, "base64"),
                name: `${product.name}.${extension}`,
                description: "A WDI product file",
            }],
        });
    } catch (error) {
        if (product && !completed) await Product.deleteOne({ _id: product._id }).catch(() => {});
        console.error("[product:create] failed:", error);
        return progress.edit({ content: "An unexpected error occurred while creating the product." });
    }
};
