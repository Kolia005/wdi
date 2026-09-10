const {
    ActionRowBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder,
} = require("discord.js");
const Product = require("../../../model/Product.js");

function prompt(description) {
    return new EmbedBuilder().setTitle("Product").setColor("#2f3136").setDescription(description);
}

async function collectMessage(interaction, filter) {
    const messages = await interaction.channel.awaitMessages({
        max: 1,
        filter: (message) => message.author.id === interaction.user.id && filter(message),
        errors: ["time"],
        time: 60000,
    });
    return messages.first();
}

module.exports = async (interaction) => {
    const product = await Product.findOne({ name: interaction.options.getString("productname") }).exec();
    if (!product) {
        return interaction.editReply({
            embeds: [new EmbedBuilder().setTitle("Error").setColor("#2f3136").setDescription("There is no product with that name.")],
            ephemeral: true,
        });
    }

    const message = await interaction.editReply({
        embeds: [prompt("What would you like to change?")],
        components: [
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("product_update")
                    .setPlaceholder("Nothing selected")
                    .addOptions(
                        { label: "Name", description: `Value: ${product.name}`, value: "product_name" },
                        { label: "Description", description: `Value: ${product.description}`, value: "product_description" },
                        { label: "File", description: `Value: ${product.name}.rbxm`, value: "product_file" },
                    ),
            ),
        ],
        fetchReply: true,
    });

    let selection;
    try {
        selection = await message.awaitMessageComponent({
            filter: (component) => component.isStringSelectMenu() && component.user.id === interaction.user.id,
            time: 60000,
        });
    } catch (_) {
        return message.edit({ embeds: [prompt("You did not reply in time.")], components: [] });
    }

    await selection.deferUpdate();
    const choice = selection.values[0];
    const prompts = {
        product_name: "Please specify a new name for this product.",
        product_description: "Please specify a new description for this product.",
        product_file: "Please attach your product file.",
    };
    if (!prompts[choice]) throw new Error(`Unsupported product update choice: ${choice}`);

    await message.edit({ embeds: [prompt(prompts[choice])], components: [] });

    let response;
    try {
        response = await collectMessage(interaction, (nextMessage) => choice !== "product_file" || Boolean(nextMessage.attachments.first()));
    } catch (_) {
        return message.edit({ embeds: [prompt("You did not reply in time.")], components: [] });
    }

    if (choice === "product_name") {
        await Product.updateOne({ _id: product._id }, { $set: { name: response.content } });
    } else if (choice === "product_description") {
        await Product.updateOne({ _id: product._id }, { $set: { description: response.content } });
    } else {
        await Product.updateOne({ _id: product._id }, { $set: { fileurl: response.attachments.first().url } });
    }

    return message.edit({ embeds: [prompt("Product updated successfully.")], components: [] });
};
