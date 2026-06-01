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

async function userLink(interaction, userId, username) {

	let clientRecord = await Client.findOne({
		discord: interaction.user.id
	}).exec();

	if (clientRecord) {
		return await Client.updateOne(
			{
				_id: clientRecord._id
			},
			{
				$set: {
					roblox: userId.toString(),
					discord: interaction.user.id
				}
			}
		)
	}

	let newClient = new Client({
		roblox: userId.toString(),
		discord: interaction.user.id
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
		.setName('link')
		.setDescription('Link your Roblox account'),

	/**
	 * @description Runs the command
	 * @param {Interaction} interaction 
	 */
	run: async (interaction) => {
		let clientRecord = await Client.findOne({
			discord: interaction.user.id
		}).exec();

		const handle1 = (interaction) => {
			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle("Method")
						.setColor("0x2f3136")
						.setDescription("Please select a method to link your Roblox account")
				],
				components: [
					new ActionRowBuilder()
						.addComponents(
							new SelectMenuBuilder()
								.setCustomId("select_verify_method")
								.setPlaceholder("Click to select a verification method")
								.addOptions([
									{
										label: "Bloxlink",
										description: "Use your linked Bloxlink user to verify",
										value: "bloxlink"
									},
									{
										label: "RoVer",
										description: "Use your linked RoVer user to verify",
										value: "rover"
									},
								])
						)]
			}).then((m) => {
				m.awaitMessageComponent({
					filter: (i) => i.customId === "select_verify_method" && i.user.id === interaction.user.id && i.isSelectMenu(),
					time: 60_000 // 60s
				}).then((awaitedInteraction) => {
					awaitedInteraction.deferReply().then(() => {
						switch (awaitedInteraction.values[0]) {
							case "bloxlink":
								axios.get(`https://v3.blox.link/developer/discord/${interaction.user.id}`, { headers: { 'api-key': 'ebe3f95e-9ff1-4f96-b8cc-391b2af10fb8' } }).then(async (response) => {
									if (response.data.user.primaryAccount) {
										const username = await Roblox.getRobloxUsername(response.data.user.primaryAccount);
										await userLink(awaitedInteraction, parseInt(response.data.user.primaryAccount), username);
										return awaitedInteraction.editReply({
											embeds: [
												new EmbedBuilder()
													.setTitle("Success")
													.setColor("0x2f3136")
													.setDescription(`You have been successfully linked to the Roblox user [${username}](https://www.roblox.com/users/${response.data.user.primaryAccount}/profile)`)
											],
										});
									} else {
										return awaitedInteraction.editReply({
											embeds: [
												new EmbedBuilder()
													.setTitle("Error")
													.setColor("0x2f3136")
													.setDescription("Your Discord account isn't linked to Bloxlink")
											],
										});
									}
								}).catch((err) => {
									console.log(err)
									awaitedInteraction.editReply({
										embeds: [
											new EmbedBuilder()
												.setTitle("Error")
												.setColor("0x2f3136")
												.setDescription("An unexpected error occurred. Please try again")
										],
									});
								});
								break;
							case "rover":
								axios.get(`https://registry.rover.link/api/guilds/938335227657478144/discord-to-roblox/${interaction.user.id}`, { headers: { 'Authorization': 'Bearer rvr2g074n82sntmosg40hduwnd1a0t3ahmnx5w0avpmce2xtwt501t9u9n15n0k9zo6r' } }).then(async (response) => {
									const username = await Roblox.getRobloxUsername(response.data.robloxId);
									await userLink(awaitedInteraction, response.data.robloxId, username);
									return awaitedInteraction.editReply({
										embeds: [
											new EmbedBuilder()
												.setTitle("Success")
												.setColor("0x2f3136")
												.setDescription(`You have been successfully linked to the Roblox user [${username}](https://www.roblox.com/users/${response.data.robloxId}/profile)`)
										],
									});
								}).catch((e) => {
									console.log(e)
									if (e.status === 404) {
										return awaitedInteraction.editReply({
											embeds: [
												new EmbedBuilder()
													.setTitle("Error")
													.setColor("0x2f3136")
													.setDescription("Your Discord account isn't linked to RoVer")
											],
										});
									} else {
										awaitedInteraction.editReply({
											embeds: [
												new EmbedBuilder()
													.setTitle("Error")
													.setColor("0x2f3136")
													.setDescription("An unexpected error occurred. Please try again")
											],
										});
									}
								});
								break;
						}
					})
				});
			});
		};

		if (clientRecord) {
			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle("Error")
						.setColor("0x2f3136")
						.setDescription(`You appear to be already linked to [${await Roblox.getRobloxUsername(clientRecord.roblox)}](https://www.roblox.com/users/${clientRecord.roblox}/profile).`)
				],
			}).then((m) => { });
			return;
		}

		return handle1(interaction);
	},
};
