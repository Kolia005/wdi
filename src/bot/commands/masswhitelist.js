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

const Client = require("../../model/Client.js");
const Product = require("../../model/Product.js");
const Purchase = require("../../model/Whitelist.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('masswhitelist')
        .setDescription('Assigns a product license to a specific role giving them access')
        .addRoleOption(option => option.setName('role').setDescription('Enter the role that will receive this license.').setRequired(true))
        .addStringOption(option => option.setName('product').setDescription('Enter the name of a product you want to give.').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    /**
     * @description Runs the command
     * @param {Interaction} interaction 
     */
    run: async (interaction) => {
        let productRecord = await Product.findOne({
            name: interaction.options.getString('product')
        }).exec();

        if (!productRecord) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("Error")
                        .setColor("#2f3136")
                        .setDescription("There is no product with that name.")
                ],
                ephemeral: true
            });
        }

        let roleOfUsers = interaction.options.getRole("role");
        await interaction.guild.members.fetch();
        //console.log(roleOfUsers.members.map(m => m.user.tag))
        roleOfUsers.members.forEach(async (member) => {
            let clientRecord = await Client.findOne({
                discord: member.user.id
            }).exec();

            if (clientRecord) {
                let purchaseRecord = await Purchase.findOne({
                    product: productRecord._id,
                    client: clientRecord._id
                }).exec();

                if (!purchaseRecord) {
                    let purchaseModel = new Purchase({
                        product: productRecord._id,
                        client: clientRecord._id
                    });

                    await purchaseModel.save();

                    console.log(`whitelisted ${clientRecord.discord} for ${productRecord.name}`)

                    return await member.send({
                        embeds: [
                            new EmbedBuilder()
                                .setTitle("Product Granted")
                                .setColor("#2f3136")
                                .addFields(
                                    { name: 'Product', value: `\`${productRecord.name}\``, inline: true },
                                )
                                .setDescription("You have been granted a product.")
                        ],
                        components: [
                            new ActionRowBuilder()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setLabel('Download')
                                        .setURL(productRecord.fileurl)
                                        .setStyle(ButtonStyle.Link),
                                )
                        ]
                    }).then(async () => { }).catch(async () => { });
                }
            };
        });


        return await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("Success")
                    .setColor("#2f3136")
                    .setDescription(`You have successfully mass whitelisted ${roleOfUsers.members.size} users!`)
            ]
        })
    },
};
