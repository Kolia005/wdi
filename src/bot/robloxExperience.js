// Experience ownership verification + (eventual) Open Cloud mesh-permission granting.
// Verification works today with public Roblox APIs. Granting stays dormant until
// process.env.ROBLOX_OPEN_CLOUD_KEY is set (and products have meshAssetIds).
const axios = require("axios");
const Whitelist = require("../model/Whitelist.js");
const Product = require("../model/Product.js");

const TIMEOUT = 10000;

// Parse a game link / place ID / universe ID -> { placeId, universeId, name, creator:{id,type} }
async function resolveExperience(input) {
	const raw = String(input || "").trim();
	if (!raw) return null;
	let num = null;
	const urlMatch = raw.match(/games\/(\d+)/); // roblox.com/games/<placeId>/...
	if (urlMatch) num = urlMatch[1];
	else if (/^\d+$/.test(raw)) num = raw;
	if (!num) return null;

	let universeId = null, placeId = null;

	// Try as a PLACE id first (what people usually paste)
	try {
		const r = await axios.get(`https://apis.roblox.com/universes/v1/places/${num}/universe`, { timeout: TIMEOUT });
		if (r.data && r.data.universeId) { universeId = String(r.data.universeId); placeId = String(num); }
	} catch (e) { /* not a place */ }

	// Otherwise maybe they pasted a universe id directly
	if (!universeId) {
		try {
			const g = await axios.get(`https://games.roblox.com/v1/games?universeIds=${num}`, { timeout: TIMEOUT });
			if (g.data && g.data.data && g.data.data[0]) universeId = String(num);
		} catch (e) { /* nope */ }
	}
	if (!universeId) return null;

	// universe -> creator
	try {
		const g = await axios.get(`https://games.roblox.com/v1/games?universeIds=${universeId}`, { timeout: TIMEOUT });
		const game = g.data && g.data.data && g.data.data[0];
		if (!game || !game.creator) return null;
		return {
			placeId: placeId || (game.rootPlaceId ? String(game.rootPlaceId) : null),
			universeId,
			name: game.name || "",
			creator: { id: String(game.creator.id), type: game.creator.type } // "User" | "Group"
		};
	} catch (e) { return null; }
}

async function getGroupOwnerId(groupId) {
	try {
		const r = await axios.get(`https://groups.roblox.com/v1/groups/${groupId}`, { timeout: TIMEOUT });
		if (r.data && r.data.owner && r.data.owner.userId) return String(r.data.owner.userId);
	} catch (e) { /* ignore */ }
	return null; // null = ownerless group or lookup failed
}

// Does verified Roblox id `robloxId` own this experience (directly, or via owning its group)?
async function verifyOwnership(creator, robloxId) {
	const rid = String(robloxId);
	if (creator.type === "User") {
		return { owned: creator.id === rid, via: creator.id === rid ? "user" : null };
	}
	if (creator.type === "Group") {
		const ownerId = await getGroupOwnerId(creator.id);
		if (!ownerId) return { owned: false, via: null, note: "ownerless_group" };
		return { owned: ownerId === rid, via: ownerId === rid ? "group" : null };
	}
	return { owned: false, via: null };
}

// Mesh asset IDs this client is entitled to — strictly scoped to products they own.
async function entitledAssetIds(clientId) {
	const wls = await Whitelist.find({ client: clientId }).lean();
	const ids = new Set();
	for (const w of wls) {
		const p = await Product.findById(w.product).lean();
		if (p && Array.isArray(p.meshAssetIds)) p.meshAssetIds.forEach(a => { if (a) ids.add(String(a)); });
	}
	return [...ids];
}

// Grant a universe permission to use the given assets (meshes/audio/etc.), via Roblox Open Cloud.
// Endpoint verified live 2026-06-10: ONE call grants a LIST of assets to ONE universe.
//   PATCH https://apis.roblox.com/asset-permissions-api/v1/assets/permissions
//   body: { subjectType:"Universe", subjectId:"<universeId>", action:"Use", assetIds:[...] }
//   resp: { successAssetIds:[...], errors:[{ assetId, code }] }  (asset ids come back numeric)
// Returns { ok, pending, reason, granted, total, results }.
// Dormant until ROBLOX_OPEN_CLOUD_KEY is set; with no assets configured yet it also stays pending.
const GRANT_BATCH = 50; // no documented batch cap; stay conservative

async function grantUniversePermission(universeId, assetIds) {
	const key = process.env.ROBLOX_OPEN_CLOUD_KEY;
	if (!key) return { ok: false, pending: true, reason: "no_api_key" };
	if (!assetIds || !assetIds.length) return { ok: false, pending: true, reason: "no_assets_configured" };

	const ids = [...new Set(assetIds.map(a => String(a).trim()).filter(Boolean))];
	const results = [];
	for (let i = 0; i < ids.length; i += GRANT_BATCH) {
		const batch = ids.slice(i, i + GRANT_BATCH);
		try {
			const resp = await axios.request({
				method: "patch",
				url: "https://apis.roblox.com/asset-permissions-api/v1/assets/permissions",
				headers: { "x-api-key": key, "content-type": "application/json" },
				data: { subjectType: "Universe", subjectId: String(universeId), action: "Use", assetIds: batch },
				timeout: TIMEOUT
			});
			const okSet = new Set(((resp.data && resp.data.successAssetIds) || []).map(String));
			const errMap = new Map(((resp.data && resp.data.errors) || []).map(e => [String(e.assetId), e.code || "unknown"]));
			for (const id of batch) {
				if (okSet.has(id)) results.push({ assetId: id, ok: true });
				else results.push({ assetId: id, ok: false, error: errMap.get(id) || "not_in_response" });
			}
		} catch (e) {
			const status = (e.response && e.response.status) || e.message;
			for (const id of batch) results.push({ assetId: id, ok: false, error: status });
		}
	}
	const granted = results.filter(r => r.ok).length;
	return { ok: granted === results.length && results.length > 0, pending: false, granted, total: results.length, results };
}

// Launch backfill: apply grants for all previously-verified ("pending") experiences.
async function processPendingGrants() {
	const ExperienceGrant = require("../model/ExperienceGrant.js");
	const pending = await ExperienceGrant.find({ status: "pending" });
	const out = [];
	for (const g of pending) {
		const assetIds = await entitledAssetIds(g.client);
		const res = await grantUniversePermission(g.universeId, assetIds);
		if (res.ok) {
			g.status = "granted"; g.assetIds = assetIds; g.grantedAt = new Date(); await g.save();
			out.push({ universeId: g.universeId, ok: true, granted: res.granted });
		} else {
			out.push({ universeId: g.universeId, ok: false, reason: res.reason || "failed" });
		}
	}
	return out;
}

module.exports = { resolveExperience, getGroupOwnerId, verifyOwnership, entitledAssetIds, grantUniversePermission, processPendingGrants };
