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
const { refreshDiscordUrl } = require("../fileDeliver.js");

const Client = require("../../model/Client.js");
const Product = require("../../model/Product.js");
const Purchase = require("../../model/Whitelist.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('retrieve')
        .setDescription('Retrieve your product')
        .addStringOption(option =>
            option.setName('product')
                .setDescription('The product you want to retrieve')
                .setRequired(true)
        ),

    /**
     * @description Runs the command
     * @param {Interaction} interaction 
     */
    run: async (interaction) => {
        let getClient = await Client.findOne({
                discord: interaction.user.id
            });

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
        
        let getPP = await Product.findOne({
                name: interaction.options.getString("product")
            }).exec();

        if (!getPP) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Error")
                        .setColor("0x2f3136")
                        .setDescription("This product does not exist.")
                ],
                ephemeral: true
            });
        }

        let getPurchase = await Purchase.findOne({
            client: getClient._id,
            product: getPP._id
        }).populate('product', '-tree -source').exec();
        
        

        if (!getPurchase) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Error")
                        .setColor("0x2f3136")
                        .setDescription("You dont own product.")
                ],
                ephemeral: true
            });
        }

        const freshUrl = await refreshDiscordUrl(getPP.fileurl);
        await interaction.user.send(`${freshUrl}`)
        await interaction.editReply("check your dms");
    },
};
