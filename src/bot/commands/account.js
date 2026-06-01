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

const Roblox = require("../../util/Roblox.js");

const Client = require("../../model/Client.js");
const Product = require("../../model/Product.js");
const Purchase = require("../../model/Whitelist.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('account')
        .setDescription('View your account or another user\'s account')
        .addUserOption(option =>
            option.setName('mention')
                .setDescription('The user to view account of')
        ),

    /**
     * @description Runs the command
     * @param {Interaction} interaction 
     */
    run: async (interaction) => {
        let getClient

        if (interaction.options.getUser('mention') !== null) {
            getClient = await Client.findOne({
                discord: interaction.options.getUser('mention').id
            });
        } else {
            getClient = await Client.findOne({
                discord: interaction.user.id
            });
        }

        if (!getClient) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Error")
                        .setColor("0x2f3136")
                        .setDescription("You are not linked with WDI. Please run `/link` to link your account.")
                ],
                ephemeral: true
            });
        }

        let getPurchase = await Purchase.find({
            client: getClient._id
        }).populate('product', '-tree -source').exec();

        let Embed = new EmbedBuilder()
            .setAuthor({ name: `${await Roblox.getRobloxUsername(getClient.roblox)}`, iconURL: `https://www.roblox.com/headshot-thumbnail/image?userId=${getClient.roblox}&width=420&height=420` })
            .setColor("0x2f3136")
            .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${getClient.roblox}&width=420&height=420&format=png`)
            .setDescription(`**Whitelists**\n${getPurchase.length <= 0 ? "No whitelists" : getPurchase.map(p => p.product.name).join("\n")}`)
            .setFooter({
                text: `Profile for ${interaction.options.getUser('mention') === null ? interaction.user.tag : interaction.options.getUser('mention').tag} (${await Roblox.getRobloxUsername(getClient.roblox)} / ${getClient.roblox})`,
                iconURL: interaction.options.getUser('mention') === null ? interaction.user.avatarURL() : interaction.options.getUser('mention').avatarURL()
            })
        await interaction.editReply({
            embeds: [
                Embed
            ],
            components: [
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel('Roblox Profile')
                            .setURL(`https://www.roblox.com/users/${getClient.roblox}/profile`)
                            .setStyle(ButtonStyle.Link),
                    )
            ]
        });
    },
};
