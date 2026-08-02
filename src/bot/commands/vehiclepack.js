const { SlashCommandBuilder, Interaction, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { setVehiclePackPolicy } = require("../../http/util/vehiclePackPolicy.js");

const COLOR = "0x2f3136";
const embed = (title, description) => new EmbedBuilder().setTitle(title).setColor(COLOR).setDescription(description);

module.exports = {
	data: new SlashCommandBuilder()
		.setName("vehiclepack")
		.setDescription("Remotely assign a released AVCS vehicle to a product pack")
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addStringOption(option => option
			.setName("vehicle")
			.setDescription("Exact AVCSTemplateName, e.g. Leopard 2A7V")
			.setRequired(true))
		.addStringOption(option => option
			.setName("mode")
			.setDescription("Remote vehicle policy")
			.setRequired(true)
			.addChoices(
				{ name: "planned — record only; do not restrict yet", value: "planned" },
				{ name: "entitlement — require ownership of the pack", value: "entitlement" },
				{ name: "full — require ownership and a signed rig", value: "full" },
				{ name: "off — remove the remote assignment", value: "off" },
			))
		.addStringOption(option => option
			.setName("pack")
			.setDescription("Required except for off, e.g. German Military Vehicles Pack")
			.setRequired(false)),

	/** @param {Interaction} interaction */
	run: async (interaction) => {
		const vehicle = interaction.options.getString("vehicle");
		const mode = interaction.options.getString("mode");
		const pack = interaction.options.getString("pack") || "";

		if (mode !== "off" && !pack.trim()) {
			return interaction.editReply({
				embeds: [embed("Missing pack", "The `pack` option is required for `planned`, `entitlement`, and `full`.")],
			});
		}

		try {
			const policy = await setVehiclePackPolicy(vehicle, pack, mode);
			const current = Object.keys(policy).length
				? Object.entries(policy).map(([name, rule]) => `• **${name}** → **${rule.pack}** \`${rule.mode}\``).join("\n")
				: "*(no remote vehicle assignments)*";
			const behavior = mode === "planned"
				? "Recorded only. The vehicle remains usable under its current licensing rules."
				: mode === "entitlement"
					? "The vehicle now requires ownership of the selected pack."
					: mode === "full"
						? "The vehicle now requires pack ownership and a valid signed-rig fingerprint."
						: "The remote assignment was removed; the vehicle follows its authored package rules.";

			return interaction.editReply({
				embeds: [embed(
					"Vehicle pack policy updated",
					`**${vehicle}** → \`${mode}\`${mode === "off" ? "" : ` under **${pack}**`}\n\n${behavior}\n\nUpdated Whitelist builds apply this within two minutes; compatibility builds apply it when a new game server starts.\n\n__Current assignments:__\n${current}`
				)],
			});
		} catch (error) {
			return interaction.editReply({ embeds: [embed("Policy update failed", String(error.message || error))] });
		}
	},
};
