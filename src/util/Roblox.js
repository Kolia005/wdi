const assert = require("assert");
const axios = require("axios");

module.exports = {

    /**
     * @description Gets you users Roblox Username
     * @param {Number} userId A Roblox user id
     * @returns {String} The Roblox username
     */
    getRobloxUsername: async (userId) => {
        assert(userId, "The userId must be a number");

        const response = await axios.get(`https://api.roblox.com/users/${userId}`);

        if (response.data.Username) {
            return response.data.Username;
        } else {
            throw new Error("Invalid Roblox response or invalid user id");
        }
    },

}