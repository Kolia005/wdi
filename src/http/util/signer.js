// Shared Ed25519 signer. Key from env VERIFY_PRIVATE_KEY_PEM (base64 of a pkcs8 PEM).
// The in-game gate verifies with the baked PUBLIC key.
const crypto = require("crypto");

let _key = null, _tried = false;
function key() {
    if (_tried) return _key;
    _tried = true;
    const b64 = process.env.VERIFY_PRIVATE_KEY_PEM;
    if (b64) {
        try { _key = crypto.createPrivateKey(Buffer.from(b64, "base64").toString("utf8")); }
        catch (e) { console.log("[signer] bad VERIFY_PRIVATE_KEY_PEM:", e.message); }
    } else {
        console.log("[signer] no VERIFY_PRIVATE_KEY_PEM set — output will be UNSIGNED");
    }
    return _key;
}

// Ed25519-sign a message string -> base64 sig (null if no key).
function signMessage(str) {
    const k = key();
    if (!k) return null;
    return crypto.sign(null, Buffer.from(str, "utf8"), k).toString("base64");
}

// Sign a payload object -> { v, payload(b64 of the canonical JSON), sig }.
function signPayload(obj) {
    const s = JSON.stringify(obj);
    const sig = signMessage(s);
    return { v: 1, payload: Buffer.from(s, "utf8").toString("base64"), sig: sig || "" };
}

module.exports = { key, signMessage, signPayload };
