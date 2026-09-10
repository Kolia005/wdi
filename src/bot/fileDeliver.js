// Refreshes expired Discord CDN attachment URLs on demand so downloads always work.
// Discord signs CDN links with ex/is/hm params that expire; the refresh-urls API re-signs them.
const axios = require("axios");

// small cache so repeated downloads in a short window don't re-hit the API every time
const cache = new Map(); // staleUrl -> { fresh, at }
const TTL = 1000 * 60 * 60 * 20; // 20h (Discord fresh links last ~24h)

function isUsableDownloadUrl(value) {
	if (typeof value !== "string" || !value.trim()) return false;
	try {
		const parsed = new URL(value);
		return parsed.protocol === "https:" || parsed.protocol === "http:";
	} catch (_) {
		return false;
	}
}

async function refreshDiscordUrl(staleUrl) {
	if (!isUsableDownloadUrl(staleUrl)) return null;
	if (!/cdn\.discordapp\.com/.test(staleUrl)) return staleUrl; // not a discord url, pass through
	const hit = cache.get(staleUrl);
	if (hit && Date.now() - hit.at < TTL) return hit.fresh;
	try {
		const token = process.env.TOKEN;
		const r = await axios.post(
			"https://discord.com/api/v10/attachments/refresh-urls",
			{ attachment_urls: [staleUrl] },
			{ headers: { Authorization: "Bot " + token, "Content-Type": "application/json" }, timeout: 10000 }
		);
		const fresh = r.data && r.data.refreshed_urls && r.data.refreshed_urls[0] && r.data.refreshed_urls[0].refreshed;
		if (fresh) {
			cache.set(staleUrl, { fresh, at: Date.now() });
			return fresh;
		}
	} catch (e) {
		console.log("[fileDeliver] refresh failed:", e.message);
	}
	return isUsableDownloadUrl(staleUrl) ? staleUrl : null;
}

module.exports = { isUsableDownloadUrl, refreshDiscordUrl };
