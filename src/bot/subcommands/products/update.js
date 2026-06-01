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

const Product = require("../../../model/Product.js");

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

    await interaction.editReply({
        embeds: [
            new EmbedBuilder()
                .setTitle("Product")
                .setColor("0x2f3136")
                .setDescription("What would you like to change?")
        ],
        components: [
            new ActionRowBuilder()
                .addComponents(
                    new SelectMenuBuilder()
                        .setCustomId('product_update')
                        .setPlaceholder('Nothing selected')
                        .addOptions(
                            {
                                label: 'Name',
                                description: `Value: ${productRecord.name}`,
                                value: 'product_name',
                            },
                            {
                                label: 'Description',
                                description: `Value: ${productRecord.description}`,
                                value: 'product_description',
                            },
                            {
                                label: 'File',
                                description: `Value: ${productRecord.name}.rbxm`,
                                value: 'product_file',
                            },
                        ),
                )
        ],
        fetchReply: true
    }).then((msg) => {
        msg.awaitMessageComponent({ filter: (i) => i.isSelectMenu() && i.user.id === interaction.user.id, time: 60_000 }).then((btn) => {
            if (btn.customId === "product_update") {
                btn.values.forEach((customId) => {
                    switch (customId) {
                        case "product_name":
                            msg.edit({
                                embeds: [
                                    new EmbedBuilder()
                                        .setTitle("Product")
                                        .setColor("0x2f3136")
                                        .setDescription("Please specify a new name for this product.")
                                ], components: []
                            }).then(() => {
                                interaction.channel.awaitMessages({ max: 1, filter: (m) => m.author.id === interaction.user.id, errors: ["time"], time: 60000 }).then(async (collected) => {
                                    if (await collected.first().content) {
                                        // write to database
                                        await Product.updateOne(
                                            {
                                                _id: productRecord._id
                                            },
                                            {
                                                $set: {
                                                    name: await collected.first().content
                                                }
                                            }
                                        );

                                        await msg.edit({
                                            embeds: [
                                                new EmbedBuilder()
                                                    .setTitle("Product")
                                                    .setColor("0x2f3136")
                                                    .setDescription("Product updated successfully")
                                            ]
                                        });
                                    }
                                }).catch(() => {
                                    msg.edit({
                                        embeds: [
                                            new EmbedBuilder()
                                                .setTitle("Product")
                                                .setColor("0x2f3136")
                                                .setDescription("You did not reply in time.")
                                        ]
                                    });
                                });
                            });
                            break;
                        case "product_description":
                            msg.edit({
                                embeds: [
                                    new EmbedBuilder()
                                        .setTitle("Product")
                                        .setColor("0x2f3136")
                                        .setDescription("Please specify a new description for this product.")
                                ], components: []
                            }).then(() => {
                                interaction.channel.awaitMessages({ max: 1, filter: (m) => m.author.id === interaction.user.id, errors: ["time"], time: 60000 }).then(async (collected) => {
                                    if (await collected.first().content) {
                                        // write to database
                                        await Product.updateOne(
                                            {
                                                _id: productRecord._id
                                            },
                                            {
                                                $set: {
                                                    description: await collected.first().content
                                                }
                                            }
                                        );

                                        await msg.edit({
                                            embeds: [
                                                new EmbedBuilder()
                                                    .setTitle("Product")
                                                    .setColor("0x2f3136")
                                                    .setDescription("Product updated successfully")
                                            ]
                                        });
                                    }
                                }).catch(() => {
                                    msg.edit({
                                        embeds: [
                                            new EmbedBuilder()
                                                .setTitle("Product")
                                                .setColor("0x2f3136")
                                                .setDescription("You did not reply in time.")
                                        ]
                                    });
                                });
                            });
                            break;
                        case "product_file":
                            msg.edit({
                                embeds: [
                                    new EmbedBuilder()
                                        .setTitle("Product")
                                        .setColor("0x2f3136")
                                        .setDescription("Please attach your product file.")
                                ], components: []
                            }).then(() => {
                                interaction.channel.awaitMessages({ max: 1, filter: (m) => m.author.id === interaction.user.id && m.attachments.first(), errors: ["time"], time: 60000 }).then(async (collected) => {
                                    if (await collected.first().attachments.first()) {
                                        // write to database
                                        await Product.updateOne(
                                            {
                                                _id: productRecord._id
                                            },
                                            {
                                                $set: {
                                                    fileurl: await collected.first().attachments.first().url
                                                }
                                            }
                                        );

                                        await msg.edit({
                                            embeds: [
                                                new EmbedBuilder()
                                                    .setTitle("Product")
                                                    .setColor("0x2f3136")
                                                    .setDescription("Product updated successfully")
                                            ]
                                        });
                                    }
                                }).catch(() => {
                                    msg.edit({
                                        embeds: [
                                            new EmbedBuilder()
                                                .setTitle("Product")
                                                .setColor("0x2f3136")
                                                .setDescription("You did not reply in time.")
                                        ]
                                    });
                                });
                            });
                            break;
                    }
                });
            };
        });
    });
}