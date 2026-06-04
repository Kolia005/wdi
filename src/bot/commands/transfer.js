const {
	SlashCommandBuilder,
	Interaction,
	ActionRowBuilder,
	ButtonBuilder,
	EmbedBuilder,
	ButtonStyle,
	PermissionFlagsBits
} = require("discord.js");

const Client = require("../../model/Client.js");
const Whitelist = require("../../model/Whitelist.js");
const Product = require("../../model/Product.js");
const Roblox = require("../../util/Roblox.js");
const { resolveRobloxId } = require("../wixPurchase.js");

const COLOR = "0x2f3136";
const embed = (title, desc) => new EmbedBuilder().setTitle(title).setDescription(desc).setColor(COLOR);

// Get a client's whitelists with product names attached.
async function whitelistsWithNames(clientId) {
	const wls = await Whitelist.find({ client: clientId }).lean();
	const out = [];
	for (const w of wls) {
		const p = await Product.findById(w.product).lean();
		out.push({ _id: w._id, product: w.product, name: p ? p.name : "(unknown product)" });
	}
	return out;
}

function listProducts(arr) {
	if (!arr.length) return "*(none)*";
	const shown = arr.slice(0, 25).map(w => "• " + w.name).join("\n");
	return arr.length > 25 ? shown + `\n…and ${arr.length - 25} more` : shown;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('transfer')
		.setDescription("Move ALL of a customer's whitelists to a different Roblox account")
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addStringOption(o => o
			.setName('to')
			.setDescription('NEW Roblox account to move everything TO (ID or username)')
			.setRequired(true))
		.addUserOption(o => o
			.setName('user')
			.setDescription('FROM: the customer’s Discord (use this OR roblox)')
			.setRequired(false))
		.addStringOption(o => o
			.setName('roblox')
			.setDescription('FROM: the customer’s current Roblox account, ID or username (use this OR user)')
			.setRequired(false)),

	/**
	 * @param {Interaction} interaction
	 */
	run: async (interaction) => {
		const toInput = interaction.options.getString('to');
		const fromUser = interaction.options.getUser('user');
		const fromRoblox = interaction.options.getString('roblox');

		// --- exactly one source ---
		if ((fromUser && fromRoblox) || (!fromUser && !fromRoblox)) {
			return interaction.editReply({ embeds: [embed("Transfer — input error", "Give **one** source: either `user` (their Discord) **or** `roblox` (their current Roblox ID/username). Not both, not neither.")] });
		}

		// --- resolve the destination (new) account ---
		const dest = await resolveRobloxId(toInput);
		if (!dest) {
			return interaction.editReply({ embeds: [embed("Transfer — new account not found", `Couldn't find a Roblox account for **${toInput}**. Double-check the ID/username.`)] });
		}

		// --- find the source client ---
		let source = null;
		if (fromUser) {
			source = await Client.findOne({ discord: fromUser.id });
			if (!source) return interaction.editReply({ embeds: [embed("Transfer — source not found", `<@${fromUser.id}> isn't linked to any Roblox account in the system. Use the \`roblox\` option instead if they bought on the website without linking Discord.`)] });
		} else {
			const src = await resolveRobloxId(fromRoblox);
			if (!src) return interaction.editReply({ embeds: [embed("Transfer — source not found", `Couldn't find a Roblox account for **${fromRoblox}**.`)] });
			source = await Client.findOne({ roblox: src.id });
			if (!source) return interaction.editReply({ embeds: [embed("Transfer — nothing to transfer", `Roblox account **${src.name}** (\`${src.id}\`) has no profile or whitelists in the system.`)] });
		}

		if (source.roblox === dest.id) {
			return interaction.editReply({ embeds: [embed("Transfer — same account", `That customer is already on **${dest.name}** (\`${dest.id}\`). Nothing to move.`)] });
		}

		const sourceName = await Roblox.getRobloxUsername(source.roblox).catch(() => source.roblox);
		const sourceWls = await whitelistsWithNames(source._id);

		if (!sourceWls.length && !source.discord) {
			return interaction.editReply({ embeds: [embed("Transfer — nothing to transfer", `**${sourceName}** (\`${source.roblox}\`) has no products and no Discord link — nothing to move.`)] });
		}

		const target = await Client.findOne({ roblox: dest.id });
		const targetWls = target ? await whitelistsWithNames(target._id) : [];
		const conflict = targetWls.length > 0;

		const fromLine = `**${sourceName}** (\`${source.roblox}\`)`;
		const toLine = `**${dest.name}** (\`${dest.id}\`)`;

		let desc = `Move **${sourceWls.length}** product(s):\n${fromLine}  →  ${toLine}`;
		if (source.discord) desc += `\n\nDiscord <@${source.discord}> will follow to the new account.`;
		desc += `\n\n__Products moving:__\n${listProducts(sourceWls)}`;

		let row;
		if (conflict) {
			desc += `\n\n⚠️ **${dest.name}** already owns **${targetWls.length}** product(s):\n${listProducts(targetWls)}`;
			desc += `\n\n**Merge** = keep those **and** add the transferred ones.\n**Overwrite** = replace them with **only** the transferred ones.`;
			row = new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId('tr_merge').setLabel('Merge').setStyle(ButtonStyle.Success),
				new ButtonBuilder().setCustomId('tr_overwrite').setLabel('Overwrite').setStyle(ButtonStyle.Danger),
				new ButtonBuilder().setCustomId('tr_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
			);
		} else {
			row = new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId('tr_confirm').setLabel('Confirm Transfer').setStyle(ButtonStyle.Success),
				new ButtonBuilder().setCustomId('tr_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
			);
		}

		const msg = await interaction.editReply({
			embeds: [embed(conflict ? "Transfer — ⚠️ new account already has products" : "Confirm transfer", desc)],
			components: [row]
		});

		let btn;
		try {
			btn = await msg.awaitMessageComponent({ filter: (i) => i.user.id === interaction.user.id && i.isButton(), time: 60_000 });
		} catch {
			return interaction.editReply({ embeds: [embed("Transfer — timed out", "No response in 60s — cancelled. Nothing changed.")], components: [] });
		}

		if (btn.customId === 'tr_cancel') {
			return btn.update({ embeds: [embed("Transfer cancelled", "Nothing was changed.")], components: [] });
		}

		await btn.update({ embeds: [embed("Transfer — working…", "Moving products, one sec…")], components: [] });

		try {
			const mode = btn.customId; // tr_confirm | tr_merge | tr_overwrite
			let moved = 0, skipped = 0, removedFromTarget = 0;
			let discordNote = "";

			if (!target) {
				// Simplest case: reassign the source client's Roblox id. All whitelists + the Discord link ride along.
				await Client.updateOne({ _id: source._id }, { $set: { roblox: dest.id } });
				moved = sourceWls.length;
				if (source.discord) discordNote = `Discord <@${source.discord}> is now linked to ${toLine}.`;
			} else {
				// Target account already exists as its own client. Move whitelists across.
				if (mode === 'tr_overwrite') {
					const del = await Whitelist.deleteMany({ client: target._id });
					removedFromTarget = del.deletedCount || 0;
				}
				const have = new Set((mode === 'tr_overwrite' ? [] : targetWls).map(w => String(w.product)));
				for (const w of sourceWls) {
					if (have.has(String(w.product))) {
						await Whitelist.deleteOne({ _id: w._id }); // target already owns it
						skipped++;
					} else {
						await Whitelist.updateOne({ _id: w._id }, { $set: { client: target._id } });
						have.add(String(w.product));
						moved++;
					}
				}
				// Discord follows to the new account
				if (source.discord) {
					if (!target.discord) {
						await Client.updateOne({ _id: source._id }, { $unset: { discord: 1 } });
						await Client.updateOne({ _id: target._id }, { $set: { discord: source.discord } });
						discordNote = `Discord <@${source.discord}> moved to ${toLine}.`;
					} else if (target.discord === source.discord) {
						discordNote = `Discord <@${source.discord}> was already on the new account.`;
					} else {
						discordNote = `⚠️ The new account was already linked to <@${target.discord}> — left that in place. The customer's Discord <@${source.discord}> is still on the old account; reassign manually if needed.`;
					}
				}
			}

			let out = `✅ Moved **${moved}** product(s) to ${toLine}.`;
			if (removedFromTarget) out += `\nRemoved **${removedFromTarget}** product(s) the new account had before (overwrite).`;
			if (skipped) out += `\nSkipped **${skipped}** the new account already owned.`;
			out += `\n\n${fromLine} no longer has the transferred products.`;
			if (discordNote) out += `\n\n${discordNote}`;

			return interaction.editReply({ embeds: [embed("Transfer complete", out)], components: [] });
		} catch (e) {
			console.log("[transfer] error:", e);
			return interaction.editReply({ embeds: [embed("Transfer — error", "Something went wrong mid-transfer. Changes may be partial — check both accounts before retrying.")], components: [] });
		}
	}
};
