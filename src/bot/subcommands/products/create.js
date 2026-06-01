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
const axios = require("axios");

const Product = require("../../../model/Product.js");
const lib = require("../../../util/lib.js");

/**
 * A command
 * @param {Interaction} interaction
 */
module.exports = async (interaction) => {
    interaction.editReply({
        embeds: [
            new EmbedBuilder()
                .setTitle("Product")
                .setColor("0x2f3136")
                .setDescription("Please specifiy the name of the product.")
        ],
        fetchReply: true
    }).then((m) => {
        interaction.channel.awaitMessages({ max: 1, filter: (m) => m.author.id === interaction.user.id, errors: ["time"], time: 60000 }).then(async (collected) => {
            const collectedName = await collected.first().content;
            if (!collectedName) return;

            collected.first().reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Product")
                        .setColor("0x2f3136")
                        .setDescription("Please specify the product description.")
                ],
                fetchReply: true
            }).then((m) => {
                m.channel.awaitMessages({ max: 1, filter: (m) => m.author.id === interaction.user.id, errors: ["time"], time: 60000 }).then(async (collected) => {
                    const collectedDescription = await collected.first().content;
                    if (!collectedDescription) return;

                    collected.first().reply({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle("Product")
                                .setColor("0x2f3136")
                                .setDescription("Please upload the product file.")
                        ],
                        fetchReply: true
                    }).then((m) => {
                        m.channel.awaitMessages({ max: 1, filter: (m) => m.author.id === interaction.user.id && m.attachments.first(), errors: ["time"], time: 60000 }).then(async (collected) => {
                            const collectedFile = collected.first().attachments.first();
                            const fileExtension = collectedFile.url.split(".").at(-1).toLowerCase();

                            if (["rbxm", "rbxmx", "rbxl", "rbxlx"].includes(fileExtension)) {
                                m.reply("Please wait. This may take a while").then((m) => {
                                    axios({ url: collectedFile.url, responseType: "stream" }).then(async (response) => {
                                        console.log(response.data.file)
                                        // create group record
                                        const productRecord = new Product({
                                            name: collectedName,
                                            description: collectedDescription,
                                        });

                                        // save record
                                        await productRecord.save();

                                        // send to helper
                                        lib.processFile(response.data, productRecord._id).then(async (res) => {
                                            if (res.statusCode == 200) {
                                                // everything is ok!
                                                // response.file is a base64-encoded string reperesentation of the modified file
                                                await Product.updateOne(
                                                    {
                                                        _id: productRecord._id,
                                                    },
                                                    {
                                                        $set: {
                                                            file: {
                                                                format: fileExtension,
                                                                contents: res.file,
                                                            },
                                                        },
                                                    }
                                                )
                                                // send message
                                                m.edit({ content: "Product created successfully", files: [{ attachment: Buffer.from(res.file, "base64"), name: `${productRecord.name}.${fileExtension}`, description: "A WDI product file" }] });
                                            } else {
                                                // something went wrong! see response.message
                                                m.edit({ content: "An unexpected error occurred. Is the file corrupt?" });
                                            }
                                        }).catch((e) => {
                                            // unexpected error
                                            m.edit({ content: "An unexpected error occurred" });
                                        });
                                    }).catch(() => {
                                        m.reply({ content: "An unexpected error occurred" });
                                    });
                                });
                            } else {
                                m.reply({ content: "Invalid file type" });
                            }
                        }).catch(() => {
                            return m.edit({
                                embeds: [
                                    new EmbedBuilder()
                                        .setTitle("Error")
                                        .setColor("0x2f3136")
                                        .setDescription("You did not reply in time.")
                                ]
                            });
                        });
                    });
                }).catch(() => {
                    return m.edit({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle("Error")
                                .setColor("0x2f3136")
                                .setDescription("You did not reply in time.")
                        ]
                    });
                });
            });
        }).catch(() => {
            return m.edit({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Error")
                        .setColor("0x2f3136")
                        .setDescription("You did not reply in time.")
                ]
            });
        });
    });
}