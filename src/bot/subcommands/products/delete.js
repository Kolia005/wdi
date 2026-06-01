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

    let Embed = new EmbedBuilder()
        .setTitle("Deletion")
        .setDescription("Are you sure you want to delete your product?\n\n*It will delete all purchases and product content from you're group.*")
        .setColor("0x2f3136");
    await interaction.editReply({
        embeds: [
            Embed
        ],
        components: [
            new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('delete_accept')
                        .setLabel('Yes')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('delete_decline')
                        .setLabel('No')
                        .setStyle(ButtonStyle.Danger),
                )
        ]
    }).then((m) => {
        m.awaitMessageComponent({
            filter: (i) => i.user.id === interaction.user.id && i.isButton(),
            time: 60_000 // 60s
        }).then(async (awaitedInteraction) => {
            if (awaitedInteraction.customId === 'delete_accept') {
                await awaitedInteraction.deferReply().then(async () => {
                    await Purchase.deleteMany({
                        product: productRecord._id
                    });

                    await Product.deleteOne({
                        _id: productRecord._id
                    });

                    let Embed = new EmbedBuilder()
                        .setTitle("Deleted")
                        .setDescription("Your product has been deleted.")
                        .setColor("0x2f3136");
                    return await awaitedInteraction.editReply({
                        embeds: [
                            Embed
                        ],
                    });
                });
                return;
            } else if (awaitedInteraction.customId === 'delete_decline') {
                await awaitedInteraction.deferReply().then(async () => {
                    let Embed = new EmbedBuilder()
                        .setTitle("Error")
                        .setDescription("You have cancelled the deletion.")
                        .setColor("0x2f3136");
                    return await awaitedInteraction.editReply({
                        embeds: [
                            Embed
                        ],
                    });
                });
                return;
            }
        }).catch((e) => { console.log(e) });
    });
}