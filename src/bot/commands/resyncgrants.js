const {
	SlashCommandBuilder,
	Interaction,
	EmbedBuilder,
	PermissionFlagsBits
} = require("discord.js");

const Client = require("../../model/Client.js");
const ExperienceGrant = require("../../model/ExperienceGrant.js");
const grantSync = require("../grantSync.js");
const { resolveRobloxId } = require("../wixPurchase.js");

const COLOR = "0x2f3136";
const embed = (t, d) => new EmbedBuilder().setTitle(t).setDescription(d).setColor(COLOR);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('resyncgrants')
		.setDescription('Re-check all whitelisted experiences: ownership drift + top-up missing asset grants')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addUserOption(o => o
			.setName('user')
			.setDescription('Only this customer (Discord)')
			.setRequired(false))
		.addStringOption(o => o
			.setName('roblox')
			.setDescription('Only this customer (Roblox ID or username)')
			.setRequired(false)),

	/**
	 * @param {Interaction} interaction
	 */
	run: async (interaction) => {
		const user = interaction.options.getUser('user');
		const roblox = interaction.options.getString('roblox');

		let scope = "all customers";
		let sum;

		if (user || roblox) {
			let client = null;
			if (user) {
				client = await Client.findOne({ discord: user.id });
				if (!client) return interaction.editReply({ embeds: [embed("Not found", `<@${user.id}> isn't linked to any profile.`)] });
				scope = `<@${user.id}>`;
			} else {
				const rb = await resolveRobloxId(roblox);
				if (!rb) return interaction.editReply({ embeds: [embed("Not found", `Couldn't find a Roblox account for **${roblox}**.`)] });
				client = await Client.findOne({ roblox: rb.id });
				if (!client) return interaction.editReply({ embeds: [embed("Not found", `**${rb.name}** (\`${rb.id}\`) has no profile in the system.`)] });
				scope = `**${rb.name}** (\`${rb.id}\`)`;
			}
			sum = await grantSync.resyncClient(client._id, "resyncgrants");
		} else {
			sum = await grantSync.resyncAll("resyncgrants");
		}

		if (!sum.total) {
			return interaction.editReply({ embeds: [embed("Resync — nothing to do", `No whitelisted experiences recorded for ${scope}.`)] });
		}

		let out =
			`Scope: ${scope}\n` +
			`Experiences checked: **${sum.total}**\n` +
			`New asset grants applied: **${sum.granted}**\n` +
			`Still pending (no assets configured): **${sum.pendingLeft}**\n` +
			`Flagged for ownership drift: **${sum.flagged}**` + (sum.newlyFlagged ? ` (⚠️ **${sum.newlyFlagged}** new — check your DMs)` : "");

		const flagged = await ExperienceGrant.find({ flagged: true }).limit(10).lean();
		if (flagged.length) {
			out += "\n\n__Currently flagged:__\n" + flagged.map(g => `• universe \`${g.universeId}\` — ${g.flagReason || "?"}`).join("\n");
		}

		return interaction.editReply({ embeds: [embed("✅ Resync complete", out)] });
	}
};
