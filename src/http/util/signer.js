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

// RSA-2048 PKCS1-v1.5/SHA-256 signature (Phase 2b: the in-game gate can verify this asymmetrically,
// so even extracting the client can't forge a universal crack — no private key on the client).
let _rsa = null, _rsaTried = false;
function rsaKey() {
    if (_rsaTried) return _rsa;
    _rsaTried = true;
    const b64 = process.env.VERIFY_RSA_PRIVATE_KEY_PEM;
    if (b64) { try { _rsa = crypto.createPrivateKey(Buffer.from(b64, "base64").toString("utf8")); } catch (e) { console.log("[signer] bad RSA key:", e.message); } }
    return _rsa;
}
function rsaSign(str) {
    const k = rsaKey();
    if (!k) return "";
    return crypto.sign("sha256", Buffer.from(str, "utf8"), k).toString("base64");
}

// HMAC-SHA256 of a string with the shared secret (Phase 2a: the in-game gate verifies this,
// so a faked /verify server can't produce a valid MAC). Key is used verbatim (a hex string).
function hmacHex(str) {
    const secret = process.env.VERIFY_HMAC_SECRET;
    if (!secret) return "";
    return crypto.createHmac("sha256", secret).update(str, "utf8").digest("hex");
}

// Sign a payload object -> { v, payload(b64 of the canonical JSON), sig, hmac }.
// hmac is over the base64 `payload` string (what the client also HMACs).
function signPayload(obj) {
    const s = JSON.stringify(obj);
    const payloadB64 = Buffer.from(s, "utf8").toString("base64");
    return { v: 1, payload: payloadB64, sig: signMessage(s) || "", hmac: hmacHex(payloadB64), rsa: rsaSign(payloadB64) };
}

module.exports = { key, signMessage, signPayload, hmacHex, rsaSign };
