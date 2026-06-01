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
	PermissionFlagsBits
} = require("discord.js");
const axios = require("axios");

const Utils = require("../../util/Utils.js");
const Roblox = require("../../util/Roblox.js");

const Client = require("../../model/Client.js");
const Whitelist = require("../../model/Whitelist.js");

async function userLink(interaction, bo, di) {

	let clientRecord = await Client.findOne({
		discord: di
	}).exec();

	if (clientRecord) {
		return false
	}

	let newClient = new Client({
		roblox: bo,
		discord: di
	});

	await newClient.save().then(() => {
		return true
	}).catch(err => {
		console.log(err)
		return false
	});
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('forcelink')
		.setDescription('Forcelink anyone you wish')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addStringOption(option =>
			option.setName('robloxid')
				.setDescription('The roblox id')
				.setRequired(true)
		)
		.addUserOption(option =>
			option.setName('mention')
				.setDescription('The user to forcelink')
				.setRequired(true)
		),

	/**
	 * @description Runs the command
	 * @param {Interaction} interaction 
	 */
	run: async (interaction) => {
		let test = await userLink(interaction, interaction.options.getString("robloxid"), interaction.options.getUser("mention").id);

		if (!test) {
			return await interaction.editReply({ content: "user is already linked bozo!" })
		}

		await interaction.editReply({ content: `damn you forcelinked <@${interaction.options.getUser("mention").id}>` })
	},
};
