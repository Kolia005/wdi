// Backward-compatible owner resolver for the legacy /wlt endpoint.
// The old implementation called the retired api.roblox.com ProductInfo API.
// Reuse the same modern place -> universe -> creator resolution as /verify
// while keeping /wlt's existing return value and response contract unchanged.
const { resolveOwner } = require("./roblox.js");

module.exports = async function getGameOwner(placeId) {
    const { ownerId } = await resolveOwner(String(placeId || ""), null);
    if (!ownerId) throw new Error("Invalid Place");
    return String(ownerId);
};
