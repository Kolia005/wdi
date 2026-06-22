const {
	SlashCommandBuilder,
	Interaction,
	ActionRowBuilder,
	SelectMenuBuilder,
	EmbedBuilder,
} = require("discord.js");
const axios = require("axios");

const Roblox = require("../../util/Roblox.js");
const Client = require("../../model/Client.js");

const COLOR = "0x2f3136";
const embed = (title, desc) => new EmbedBuilder().setTitle(title).setColor(COLOR).setDescription(desc);

const SELECT_ID = "select_verify_method";
const GUILD_ID = process.env.GUILD || "938335227657478144";
// Bloxlink moved to their v4 API (the old v3.blox.link host is dead — NXDOMAIN).
// Key comes from env so it can be rotated without a code change; if unset, the
// Bloxlink option cleanly redirects users to RoVer.
const BLOXLINK_API_KEY = process.env.BLOXLINK_API_KEY || "";
const ROVER_TOKEN = "rvr2g074n82sntmosg40hduwnd1a0t3ahmnx5w0avpmce2xtwt501t9u9n15n0k9zo6r";
const HTTP_TIMEOUT = 10000;

/**
 * Links (or relinks) the interacting Discord user to a Roblox id.
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
async function userLink(interaction, userId) {
	const robloxId = userId.toString();

	let clientRecord = await Client.findOne({ discord: interaction.user.id }).exec();

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
		const newClient = new Client({ roblox: robloxId, discord: interaction.user.id });
		await newClient.save();
		return { ok: true };
	} catch (err) {
		console.log("[link] userLink error:", err);
		return { ok: false, reason: "error" };
	}
}

// Persistent handler for the verification-method select menu.
// Registered in interactionCreate.js (routed by customId) so it works across bot
// restarts/redeploys. The previous awaitMessageComponent approach kept an in-memory
// collector that died on every restart -> "interaction failed" for anyone mid-flow.
async function handleVerifyMethod(interaction) {
	// Acknowledge IMMEDIATELY so Discord never shows "interaction failed".
	try {
		await interaction.deferReply({ ephemeral: true });
	} catch (e) {
		console.log("[link] could not defer select interaction:", e.message);
		return;
	}

	// Best-effort: retire the menu so a stale one can't be clicked again.
	if (interaction.message && typeof interaction.message.edit === "function") {
		interaction.message.edit({ components: [] }).catch(() => {});
	}

	try {
		// Already linked? (covers stale/public menus clicked after a link.)
		const existing = await Client.findOne({ discord: interaction.user.id }).exec();
		if (existing) {
			const uname = await Roblox.getRobloxUsername(existing.roblox).catch(() => existing.roblox);
			return interaction.editReply({ embeds: [embed("Already linked", `You're already linked to [${uname}](https://www.roblox.com/users/${existing.roblox}/profile).`)] });
		}

		const method = interaction.values && interaction.values[0];
		let robloxId = null;

		if (method === "bloxlink") {
			if (!BLOXLINK_API_KEY) {
				return interaction.editReply({ embeds: [embed("Bloxlink unavailable", "Bloxlink verification isn't configured right now — please use **RoVer** instead (run `/link` again and pick RoVer).")] });
			}
			let resp;
			try {
				resp = await axios.get(`https://api.blox.link/v4/public/guilds/${GUILD_ID}/discord-to-roblox/${interaction.user.id}`, { headers: { Authorization: BLOXLINK_API_KEY }, timeout: HTTP_TIMEOUT });
			} catch (e) {
				const status = e.response ? e.response.status : null;
				const apiErr = e.response && e.response.data && e.response.data.error;
				if (apiErr === "Unknown Guild") {
					// Bloxlink bot isn't in this server -> the Server API can't work.
					return interaction.editReply({ embeds: [embed("Bloxlink not set up", "Bloxlink isn't connected to this server yet — please use **RoVer** instead (run `/link` again and pick RoVer).")] });
				}
				if (status === 404) {
					return interaction.editReply({ embeds: [embed("Error", "Your Discord account isn't linked to Bloxlink. Link it at <https://blox.link>, or use RoVer.")] });
				}
				console.log("[link] bloxlink v4 error:", status, e.response ? JSON.stringify(e.response.data) : e.message);
				return interaction.editReply({ embeds: [embed("Error", "Couldn't verify via Bloxlink right now. Please try **RoVer** instead.")] });
			}
			// v4 returns { robloxID, resolved:{ roblox:{ id } } }; parse defensively.
			robloxId = (resp.data && (resp.data.robloxID || resp.data.robloxId))
				|| (resp.data && resp.data.resolved && resp.data.resolved.roblox && resp.data.resolved.roblox.id);
			if (!robloxId) {
				return interaction.editReply({ embeds: [embed("Error", "Your Discord account isn't linked to Bloxlink. Link it at <https://blox.link>, or use RoVer.")] });
			}
		} else if (method === "rover") {
			let resp;
			try {
				resp = await axios.get(`https://registry.rover.link/api/guilds/${GUILD_ID}/discord-to-roblox/${interaction.user.id}`, { headers: { Authorization: `Bearer ${ROVER_TOKEN}` }, timeout: HTTP_TIMEOUT });
			} catch (e) {
				if (e.response && e.response.status === 404) {
					return interaction.editReply({ embeds: [embed("Error", "Your Discord account isn't linked to RoVer. Link it at <https://rover.link> first, or use Bloxlink.")] });
				}
				console.log("[link] rover error:", e.response ? e.response.status : e.message);
				return interaction.editReply({ embeds: [embed("Error", "Couldn't reach RoVer right now. Please try again in a moment.")] });
			}
			robloxId = resp.data && resp.data.robloxId;
			if (!robloxId) {
				return interaction.editReply({ embeds: [embed("Error", "Your Discord account isn't linked to RoVer. Link it at <https://rover.link> first, or use Bloxlink.")] });
			}
		} else {
			return interaction.editReply({ embeds: [embed("Error", "Unknown verification method. Please run `/link` again.")] });
		}

		const result = await userLink(interaction, parseInt(robloxId));
		if (!result.ok) {
			return interaction.editReply({ embeds: [embed("Error", result.reason === "roblox_taken"
				? "That Roblox account is already linked to a different Discord user."
				: "An unexpected error occurred while linking. Please try again.")] });
		}
		const username = await Roblox.getRobloxUsername(robloxId).catch(() => robloxId);
		return interaction.editReply({ embeds: [embed("Success", `You have been successfully linked to the Roblox user [${username}](https://www.roblox.com/users/${robloxId}/profile)`)] });
	} catch (e) {
		console.log("[link] verify handler error:", e);
		try { await interaction.editReply({ embeds: [embed("Error", "An unexpected error occurred. Please run `/link` again.")] }); } catch (_) {}
	}
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('link')
		.setDescription('Link your Roblox account'),

	// Exposed so interactionCreate.js can route the select menu to a persistent handler.
	selectId: SELECT_ID,
	handleVerifyMethod,
	userLink,

	/**
	 * @param {Interaction} interaction
	 */
	run: async (interaction) => {
		const clientRecord = await Client.findOne({ discord: interaction.user.id }).exec();
		if (clientRecord) {
			const username = await Roblox.getRobloxUsername(clientRecord.roblox).catch(() => clientRecord.roblox);
			return interaction.editReply({ embeds: [embed("Error", `You appear to be already linked to [${username}](https://www.roblox.com/users/${clientRecord.roblox}/profile).`)] });
		}

		return interaction.editReply({
			embeds: [embed("Method", "Please select a method to link your Roblox account")],
			components: [
				new ActionRowBuilder().addComponents(
					new SelectMenuBuilder()
						.setCustomId(SELECT_ID)
						.setPlaceholder("Click to select a verification method")
						.addOptions([
							{ label: "Bloxlink", description: "Use your linked Bloxlink user to verify", value: "bloxlink" },
							{ label: "RoVer", description: "Use your linked RoVer user to verify", value: "rover" },
						])
				)
			]
		});
	},
};
