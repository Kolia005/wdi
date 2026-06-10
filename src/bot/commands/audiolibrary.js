const {
	SlashCommandBuilder,
	Interaction,
	EmbedBuilder,
	PermissionFlagsBits
} = require("discord.js");

const grantSync = require("../grantSync.js");

const COLOR = "0x2f3136";
const embed = (t, d) => new EmbedBuilder().setTitle(t).setDescription(d).setColor(COLOR);

function sample(arr, n) {
	if (!arr.length) return "*(empty)*";
	const shown = arr.slice(0, n).map(id => "`" + id + "`").join(", ");
	return arr.length > n ? `${shown} …and ${arr.length - n} more` : shown;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('audiolibrary')
		.setDescription('Manage the global sound library — every customer with any product gets ALL of these audios')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addStringOption(o => o
			.setName('action')
			.setDescription('What to do with the audio list')
			.setRequired(true)
			.addChoices(
				{ name: 'show', value: 'show' },
				{ name: 'add', value: 'add' },
				{ name: 'replace', value: 'replace' },
				{ name: 'clear', value: 'clear' },
			))
		.addStringOption(o => o
			.setName('ids')
			.setDescription('Audio asset IDs (any separator — spaces, commas, newlines all fine)')
			.setRequired(false))
		.addBooleanOption(o => o
			.setName('resync')
			.setDescription('Push the change to all whitelisted experiences right away (default: true)')
			.setRequired(false)),

	/**
	 * @param {Interaction} interaction
	 */
	run: async (interaction) => {
		const action = interaction.options.getString('action');
		const idsInput = interaction.options.getString('ids') || "";
		const resync = interaction.options.getBoolean('resync') !== false; // default true

		const current = await grantSync.getGlobalAudioIds();

		if (action === 'show') {
			return interaction.editReply({ embeds: [embed("Global sound library", `**${current.length}** audio ID(s).\n${sample(current, 15)}`)] });
		}

		let next;
		if (action === 'clear') {
			next = [];
		} else {
			const parsed = grantSync.parseIds(idsInput);
			if (!parsed.length) {
				return interaction.editReply({ embeds: [embed("No IDs given", "Paste the audio asset IDs in the `ids` option — any separator works.")] });
			}
			next = action === 'replace' ? parsed : [...new Set([...current, ...parsed])];
		}

		const saved = await grantSync.setGlobalAudioIds(next);
		let out = `Library: ${current.length} → **${saved.length}** audio ID(s).\n${sample(saved, 10)}`;

		if (resync && saved.length > current.length) {
			const sum = await grantSync.resyncAll("audiolibrary");
			out += `\n\nResync: **${sum.total}** whitelisted experience(s), **${sum.granted}** new asset grant(s) applied`;
			if (sum.newlyFlagged) out += `, ⚠️ **${sum.newlyFlagged}** flagged (drift — check your DMs)`;
			out += ".";
		}

		return interaction.editReply({ embeds: [embed("✅ Sound library updated", out)] });
	}
};
