const axios = require("axios");
const btoa = require("btoa");

const processFile = async (file, uniqueId) => {
    const response = await axios({
        url: `http://localhost:8010/process`,
        method: "post",

        data: {
            uId: uniqueId,
            file: btoa(file)
        },

        maxContentLength: 10000000000000,
        maxBodyLength: 100000000000000
    });

    return response.data;
};

const getScript = async (fileId, placeId, jobId) => {
    const response = await axios({
        url: `http://localhost:8010/generate`,
        method: "post",

        data: {
            scriptId: fileId,
            placeId,
            jobId
        },

        maxContentLength: 10000000000000,
        maxBodyLength: 100000000000000
    });

    return response.data;
}

module.exports = { processFile, getScript }