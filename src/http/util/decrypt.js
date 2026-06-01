const axios = require("axios");

/**
 * Decrypt a string
 * @param {String} str 
 * @param {String} key 
 * @returns {Promise<String>}
 */
module.exports = async (str, key) => {
    let num = 0;
    for (let i = 0; i < key.length; i += 1) {
        num += key.charCodeAt(i);
    }

    let decrypted = "";
    const values = str.split("o");

    for (let i = 0; i < values.length; i += 1) {
        if (Number(values[i])) {
            decrypted += String.fromCharCode(Number(values[i]) / num);
        }
    }

    return decrypted;
};