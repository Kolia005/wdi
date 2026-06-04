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

/**
 * Links (or relinks) the interacting Discord user to a Roblox id.
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
async function userLink(interaction, userId) {
	const robloxId = userId.toString();

	let clientRecord = await Client.findOne({
		discord: interaction.user.id
	}).exec();

	// If the target Roblox id already belongs to a DIFFERENT Discord user, block it.
	let robloxOwner = await Client.findOne({ roblox: robloxId }).exec();
	if (robloxOwner && robloxOwner.discord && robloxOwner.discord !== interaction.user.id) {
		return { ok: false, reason: "roblox_taken" };
	}

	try {
		if (robloxOwner) {
			await Client.updateOne({ _id: robloxOwner._id }, { $set: { discord: interaction.user.id } });
			return { ok: true };
		}

		if (clientRecord) {
			await Client.updateOne(
				{ _id: clientRecord._id },
				{ $set: { roblox: robloxId, discord: interaction.user.id } }
			);
			return { ok: true };
		}

		const newClient = new Client({
			roblox: robloxId,
			discord: interaction.user.id
		});
		await newClient.save();
		return { ok: true };
	} catch (err) {
		console.log(err);
		return { ok: false, reason: "error" };
	}
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
									if (response.data.user && response.data.user.primaryAccount) {
										const robloxId = response.data.user.primaryAccount;
										const result = await userLink(awaitedInteraction, parseInt(robloxId));
										if (!result.ok) {
											return awaitedInteraction.editReply({
												embeds: [
													new EmbedBuilder()
														.setTitle("Error")
														.setColor("0x2f3136")
														.setDescription(result.reason === "roblox_taken"
															? "That Roblox account is already linked to a different Discord user."
															: "An unexpected error occurred while linking. Please try again.")
												],
											});
										}
										const username = await Roblox.getRobloxUsername(robloxId).catch(() => robloxId);
										return awaitedInteraction.editReply({
											embeds: [
												new EmbedBuilder()
													.setTitle("Success")
													.setColor("0x2f3136")
													.setDescription(`You have been successfully linked to the Roblox user [${username}](https://www.roblox.com/users/${robloxId}/profile)`)
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
									const robloxId = response.data.robloxId;
									const result = await userLink(awaitedInteraction, robloxId);
									if (!result.ok) {
										return awaitedInteraction.editReply({
											embeds: [
												new EmbedBuilder()
													.setTitle("Error")
													.setColor("0x2f3136")
													.setDescription(result.reason === "roblox_taken"
														? "That Roblox account is already linked to a different Discord user."
														: "An unexpected error occurred while linking. Please try again.")
											],
										});
									}
									const username = await Roblox.getRobloxUsername(robloxId).catch(() => robloxId);
									return awaitedInteraction.editReply({
										embeds: [
											new EmbedBuilder()
												.setTitle("Success")
												.setColor("0x2f3136")
												.setDescription(`You have been successfully linked to the Roblox user [${username}](https://www.roblox.com/users/${robloxId}/profile)`)
										],
									});
								}).catch((e) => {
									console.log(e)
									if (e.response && e.response.status === 404) {
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
			const username = await Roblox.getRobloxUsername(clientRecord.roblox).catch(() => clientRecord.roblox);
			interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle("Error")
						.setColor("0x2f3136")
						.setDescription(`You appear to be already linked to [${username}](https://www.roblox.com/users/${clientRecord.roblox}/profile).`)
				],
			}).then((m) => { });
			return;
		}

		return handle1(interaction);
	},
};
