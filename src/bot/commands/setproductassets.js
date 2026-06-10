const {
	SlashCommandBuilder,
	Interaction,
	EmbedBuilder,
	PermissionFlagsBits
} = require("discord.js");

const Product = require("../../model/Product.js");
const Whitelist = require("../../model/Whitelist.js");
const grantSync = require("../grantSync.js");

const COLOR = "0x2f3136";
const embed = (t, d) => new EmbedBuilder().setTitle(t).setDescription(d).setColor(COLOR);

function sample(arr, n) {
	if (!arr.length) return "*(none)*";
	const shown = arr.slice(0, n).map(id => "`" + id + "`").join(", ");
	return arr.length > n ? `${shown} …and ${arr.length - n} more` : shown;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setproductassets')
		.setDescription("Attach a product's protected Roblox asset IDs (meshes/textures) for experience whitelisting")
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addStringOption(o => o
			.setName('product')
			.setDescription('Product name (as in the store)')
			.setRequired(true))
		.addStringOption(o => o
			.setName('action')
			.setDescription('What to do with the ID list')
			.setRequired(true)
			.addChoices(
				{ name: 'show', value: 'show' },
				{ name: 'add', value: 'add' },
				{ name: 'replace', value: 'replace' },
				{ name: 'clear', value: 'clear' },
			))
		.addStringOption(o => o
			.setName('ids')
			.setDescription('Asset IDs (any separator — spaces, commas, newlines all fine)')
			.setRequired(false))
		.addBooleanOption(o => o
			.setName('resync')
			.setDescription('Re-grant owners\' whitelisted experiences right away (default: true)')
			.setRequired(false)),

	/**
	 * @param {Interaction} interaction
	 */
	run: async (interaction) => {
		const name = interaction.options.getString('product');
		const action = interaction.options.getString('action');
		const idsInput = interaction.options.getString('ids') || "";
		const resync = interaction.options.getBoolean('resync') !== false; // default true

		let product = await Product.findOne({ name }).exec();
		if (!product) product = await Product.findOne({ name: new RegExp("^" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i") }).exec();
		if (!product) {
			const near = await Product.find({ name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }).limit(5).lean();
			const hint = near.length ? "\n\nClose matches:\n" + near.map(p => "• " + p.name).join("\n") : "";
			return interaction.editReply({ embeds: [embed("Product not found", `No product named **${name}**.${hint}`)] });
		}

		const current = (product.meshAssetIds || []).map(String);

		if (action === 'show') {
			return interaction.editReply({ embeds: [embed(`${product.name} — protected assets`, `**${current.length}** asset ID(s) attached.\n${sample(current, 15)}`)] });
		}

		let next = current;
		if (action === 'clear') {
			next = [];
		} else {
			const parsed = grantSync.parseIds(idsInput);
			if (!parsed.length) {
				return interaction.editReply({ embeds: [embed("No IDs given", "Paste the asset IDs in the `ids` option — any separator works.")] });
			}
			next = action === 'replace' ? parsed : [...new Set([...current, ...parsed])];
		}

		await Product.updateOne({ _id: product._id }, { $set: { meshAssetIds: next } });

		let out = `**${product.name}**: ${current.length} → **${next.length}** asset ID(s).\n${sample(next, 10)}`;

		if (resync && next.length > current.length) {
			const clientIds = await Whitelist.find({ product: product._id }).distinct("client");
			const sum = { total: 0, granted: 0, newlyFlagged: 0 };
			for (const cid of clientIds) {
				const r = await grantSync.resyncClient(cid, "setproductassets");
				sum.total += r.total; sum.granted += r.granted; sum.newlyFlagged += r.newlyFlagged;
			}
			out += `\n\nResync: **${clientIds.length}** owner(s), **${sum.total}** whitelisted experience(s), **${sum.granted}** new asset grant(s) applied`;
			if (sum.newlyFlagged) out += `, ⚠️ **${sum.newlyFlagged}** flagged (drift — check your DMs)`;
			out += ".";
		}

		return interaction.editReply({ embeds: [embed("✅ Product assets updated", out)] });
	}
};
