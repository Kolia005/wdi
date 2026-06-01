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
	ApplicationCommandOptionType
} = require("discord.js");
const axios = require("axios");

const Utils = require("../../util/Utils.js");
const Roblox = require("../../util/Roblox.js");

const Client = require("../../model/Client.js");
const Whitelist = require("../../model/Whitelist.js");

async function userLink(interaction) {

	let clientRecord = await Client.findOne({
		discord: interaction.user.id
	}).exec();

	if (!clientRecord) {
		return false
	}

    await Whitelist.deleteMany({ client: clientRecord._id });
    await Client.deleteOne({ _id: clientRecord._id });
	
    return true
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('unlink')
		.setDescription('Unlink your account'),

	/**
	 * @description Runs the command
	 * @param {Interaction} interaction 
	 */
	run: async (interaction) => {
        let test = await userLink(interaction);

        if (!test) {
            return await interaction.editReply({ content: "your not even linked!" })
        }

        await interaction.editReply({ content: "your now not linked!!" })
	},
};
