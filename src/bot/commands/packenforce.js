const { SlashCommandBuilder, Interaction, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const Setting = require("../../model/Setting.js");

const COLOR = "0x2f3136";
const KEY = "packEnforcement";
const embed = (t, d) => new EmbedBuilder().setTitle(t).setColor(COLOR).setDescription(d);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('packenforce')
		.setDescription("Remote toggle for a pack's whitelist enforcement (kill switch for pack-specific features)")
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addStringOption(o => o
			.setName('pack')
			.setDescription('Product/pack name, e.g. US Military Vehicles Pack')
			.setRequired(true))
		.addStringOption(o => o
			.setName('mode')
			.setDescription('Enforcement level')
			.setRequired(true)
			.addChoices(
				{ name: 'full — entitlement + rig-lock (normal)', value: 'full' },
				{ name: 'entitlement — license only, rig-lock OFF', value: 'entitlement' },
				{ name: 'off — disabled for EVERYONE (open)', value: 'off' },
			)),

	/** @param {Interaction} interaction */
	run: async (interaction) => {
		const pack = interaction.options.getString('pack');
		const mode = interaction.options.getString('mode');

		const doc = await Setting.findOne({ key: KEY }).lean();
		const map = (doc && doc.value && typeof doc.value === "object") ? doc.value : {};
		if (mode === 'full') delete map[pack]; else map[pack] = mode; // full = default -> clear override
		await Setting.updateOne({ key: KEY }, { $set: { value: map, updated: new Date() } }, { upsert: true });

		const note = mode === 'off'
			? "\n\n⚠️ **off** — this pack's features are disabled for **everyone**: vehicles run regardless of ownership or rig-binding."
			: mode === 'entitlement'
				? "\n\nLicense check stays; the **rig-lock (fingerprint) is OFF** — legit owners with edited rigs won't be refused."
				: "\n\nNormal enforcement (entitlement + rig-lock).";
		const overrides = Object.keys(map).length
			? Object.entries(map).map(([k, v]) => `• **${k}** → \`${v}\``).join("\n")
			: "*(all packs at full enforcement)*";

		return interaction.editReply({ embeds: [embed("✅ Enforcement updated", `**${pack}** → \`${mode}\`${note}\n\nApplies to every game on its next check.\n\n__Current overrides:__\n${overrides}`)] });
	}
};
