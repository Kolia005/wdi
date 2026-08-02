const Setting = require("../../model/Setting.js");

const SETTING_KEY = "vehiclePackPolicy";
const ACTIVE_MODES = new Set(["planned", "entitlement", "full"]);
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function cleanName(value, maxLength) {
    if (typeof value !== "string") return "";
    const clean = value.trim().slice(0, maxLength);
    return FORBIDDEN_KEYS.has(clean) ? "" : clean;
}

function sanitizeVehiclePackPolicy(value) {
    const result = {};
    if (!value || typeof value !== "object" || Array.isArray(value)) return result;

    for (const [rawVehicle, rawRule] of Object.entries(value)) {
        const vehicle = cleanName(rawVehicle, 120);
        if (!vehicle || !rawRule || typeof rawRule !== "object" || Array.isArray(rawRule)) continue;

        const pack = cleanName(rawRule.pack, 120);
        const mode = cleanName(rawRule.mode, 24).toLowerCase();
        if (!pack || !ACTIVE_MODES.has(mode)) continue;

        result[vehicle] = { pack, mode };
    }
    return result;
}

async function getVehiclePackPolicy() {
    const doc = await Setting.findOne({ key: SETTING_KEY }).lean();
    return sanitizeVehiclePackPolicy(doc && doc.value);
}

async function setVehiclePackPolicy(vehicleValue, packValue, modeValue) {
    const vehicle = cleanName(vehicleValue, 120);
    const pack = cleanName(packValue, 120);
    const mode = cleanName(modeValue, 24).toLowerCase();

    if (!vehicle) throw new Error("valid vehicle name required");
    if (mode !== "off" && (!pack || !ACTIVE_MODES.has(mode))) {
        throw new Error("pack + mode (planned|entitlement|full|off) required");
    }

    const current = await getVehiclePackPolicy();
    if (mode === "off") delete current[vehicle];
    else current[vehicle] = { pack, mode };

    await Setting.updateOne(
        { key: SETTING_KEY },
        { $set: { value: current, updated: new Date() } },
        { upsert: true }
    );
    return current;
}

module.exports = {
    ACTIVE_MODES,
    SETTING_KEY,
    getVehiclePackPolicy,
    sanitizeVehiclePackPolicy,
    setVehiclePackPolicy,
};
