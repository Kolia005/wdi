const axios = require("axios");

/**
 * Encrypt a string
 * @param {String} str 
 * @param {String} key 
 * @returns {Promise<String>}
 */
module.exports = async (str, key) => {
    let num = 0;
    for (let i = 0; i < key.length; i += 1) {
        num += key.charCodeAt(i);
    }

    let encrypted = "";
    for (let i = 0; i < str.length; i += 1) {
        encrypted += `${str.charCodeAt(i) * num}o`;
    }

    return encrypted;
};