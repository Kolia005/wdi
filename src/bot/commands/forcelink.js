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

/**
 * Links a Discord user to a Roblox id.
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
async function userLink(robloxId, discordId) {
	// Already linked to this Discord user?
	let existingByDiscord = await Client.findOne({ discord: discordId }).exec();
	if (existingByDiscord) {
		return { ok: false, reason: "discord_linked" };
	}

	// Roblox id already claimed by someone else? (roblox is a unique index)
	let existingByRoblox = await Client.findOne({ roblox: robloxId.toString() }).exec();
	if (existingByRoblox && existingByRoblox.discord && existingByRoblox.discord !== discordId) {
		return { ok: false, reason: "roblox_taken" };
	}

	try {
		if (existingByRoblox) {
			await Client.updateOne({ _id: existingByRoblox._id }, { $set: { discord: discordId } });
			return { ok: true };
		}

		const newClient = new Client({
			roblox: robloxId.toString(),
			discord: discordId
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
		const robloxId = interaction.options.getString("robloxid");
		const mention = interaction.options.getUser("mention");

		const result = await userLink(robloxId, mention.id);

		if (!result.ok) {
			const messages = {
				discord_linked: `<@${mention.id}> is already linked to a Roblox account. Use \`/unlink\` first if you want to relink them.`,
				roblox_taken: `Roblox id \`${robloxId}\` is already linked to another Discord user.`,
				error: "An unexpected error occurred while linking. Please try again."
			};
			return await interaction.editReply({ content: messages[result.reason] || messages.error });
		}

		await interaction.editReply({ content: `Successfully force-linked <@${mention.id}> to Roblox id \`${robloxId}\`.` })
	},
};
