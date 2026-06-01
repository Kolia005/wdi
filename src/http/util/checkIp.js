const fetch = require("node-fetch");

/**
 * Checks if a given IP is from a Roblox server or local host (::ffff:)
 * @param {String} ip
 * @returns {Promise<Boolean>}
 */
module.exports = exports = (ip) => new Promise((resolve, reject) => {
    if (ip.startsWith("::ffff:")) {
        resolve(true);
    } else {
        fetch(`http://ip-api.com/json/${ip}`).then(r=>r.json()).then((res) => {
            if (Object.hasOwnProperty.bind(res)("org")) {
                resolve(res.org.toLowerCase().match("roblox") != null);
            } else {
                reject("Invalid body");
            }
        }).catch(reject);
    }
});