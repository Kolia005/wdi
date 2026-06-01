const assert = require("assert");
const axios = require("axios");

module.exports = {

    /**
     * @description Gets a user's Roblox username
     * @param {Number} userId A Roblox user id
     * @returns {String} The Roblox username
     */
    getRobloxUsername: async (userId) => {
        assert(userId, "The userId must be a number");

        // api.roblox.com was retired by Roblox; use the current users endpoint.
        const response = await axios.get(`https://users.roblox.com/v1/users/${userId}`);

        if (response.data && response.data.name) {
            return response.data.name;
        } else {
            throw new Error("Invalid Roblox response or invalid user id");
        }
    },

}
