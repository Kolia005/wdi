const {
	SlashCommandBuilder,
	Interaction,
	EmbedBuilder,
	PermissionFlagsBits
} = require("discord.js");

const Client = require("../../model/Client.js");
const Whitelist = require("../../model/Whitelist.js");
const ExperienceGrant = require("../../model/ExperienceGrant.js");
const { resolveExperience, verifyOwnership, grantUniversePermission } = require("../robloxExperience.js");
const grantSync = require("../grantSync.js");

const COLOR = "0x2f3136";
const embed = (t, d) => new EmbedBuilder().setTitle(t).setDescription(d).setColor(COLOR);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('whitelistexperience')
		.setDescription('Grant your purchased products mesh access to one of your Roblox experiences')
		// LAUNCH: remove the next line to open this to all customers (it's admin-only for now).
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addStringOption(o => o
			.setName('experience')
			.setDescription('Your game link, place ID, or universe ID')
			.setRequired(true)),

	/**
	 * @param {Interaction} interaction
	 */
	run: async (interaction) => {
		const input = interaction.options.getString('experience');

		// 1) caller must be linked (verified Roblox identity)
		const client = await Client.findOne({ discord: interaction.user.id });
		if (!client) {
			return interaction.editReply({ embeds: [embed("Not linked", "You need to `/link` your Roblox account first, then run this again.")] });
		}

		// 2) caller must own at least one product
		const wlCount = await Whitelist.countDocuments({ client: client._id });
		if (!wlCount) {
			return interaction.editReply({ embeds: [embed("No products", "You don't own any products yet — nothing to grant. Buy a product first.")] });
		}

		// 3) resolve the experience
		const exp = await resolveExperience(input);
		if (!exp) {
			return interaction.editReply({ embeds: [embed("Couldn't find that experience", "Give me a valid **game link**, **place ID**, or **universe ID**.")] });
		}

		// 4) verify they actually own it (directly, or own the group that owns it)
		const own = await verifyOwnership(exp.creator, client.roblox);
		if (!own.owned) {
			let why = "you don't own it, and you don't own the group that owns it";
			if (own.note === "ownerless_group") why = "it's owned by a group with no owner, so I can't verify it's yours";
			return interaction.editReply({ embeds: [embed("Not your experience", `Can't whitelist **${exp.name || exp.universeId}** — ${why}.\n\nYou can only whitelist experiences you own (or whose group you own).`)] });
		}

		const viaTxt = own.via === "group" ? " (verified via the group you own)" : "";

		// 5) meshes scoped to their purchases + the global sound library
		const assetIds = await grantSync.fullEntitlement(client._id);

		// 6) attempt the grant (dormant until the Open Cloud key + mesh IDs exist)
		let result;
		try {
			result = await grantUniversePermission(exp.universeId, assetIds);
		} catch (e) {
			console.log("[whitelistexperience] grant error:", e.message);
			result = { ok: false, pending: false, reason: "error" };
		}

		// 7) record it (idempotent per client+universe)
		await ExperienceGrant.findOneAndUpdate(
			{ client: client._id, universeId: exp.universeId },
			{
				$set: {
					client: client._id,
					robloxId: client.roblox,
					placeId: exp.placeId,
					universeId: exp.universeId,
					creatorId: exp.creator.id,
					creatorType: exp.creator.type,
					ownedVia: own.via,
					assetIds: result.ok ? assetIds : [],
					status: result.ok ? "granted" : (result.reason === "error" ? "failed" : "pending"),
					grantedAt: result.ok ? new Date() : undefined
				}
			},
			{ upsert: true, new: true }
		);

		// churn watch: one customer whitelisting under multiple different groups
		grantSync.checkCrossGroup(client._id).catch(() => {});

		// 8) reply
		if (result.ok) {
			return interaction.editReply({ embeds: [embed("✅ Whitelisted", `Your **${wlCount}** product(s) + the sound library now load in **${exp.name || exp.universeId}**${viaTxt}.`)] });
		}
		if (result.reason === "error") {
			return interaction.editReply({ embeds: [embed("Saved — grant needs a retry", `Confirmed you own **${exp.name || exp.universeId}**${viaTxt}, but the grant hit an error. It's saved and we'll re-apply it. No action needed from you.`)] });
		}
		// pending: no API key yet, or no mesh IDs configured yet
		return interaction.editReply({ embeds: [embed("✅ Verified & saved", `Confirmed you own **${exp.name || exp.universeId}**${viaTxt} and own **${wlCount}** product(s).\n\nMesh access for this experience is **saved and will activate when the feature goes live** — you don't need to do anything else.`)] });
	}
};
