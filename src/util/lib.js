const axios = require("axios");

const MAX_FILE_BYTES = 100 * 1024 * 1024;

function encodeFile(file) {
    if (Buffer.isBuffer(file)) return file.toString("base64");
    if (file instanceof ArrayBuffer) return Buffer.from(file).toString("base64");
    if (ArrayBuffer.isView(file)) return Buffer.from(file.buffer, file.byteOffset, file.byteLength).toString("base64");
    throw new TypeError("Product file must be binary data");
}

const processFile = async (file, uniqueId) => {
    const response = await axios({
        url: `http://localhost:8010/process`,
        method: "post",

        data: {
            uId: uniqueId,
            file: encodeFile(file)
        },

        timeout: 120000,
        maxContentLength: MAX_FILE_BYTES,
        maxBodyLength: MAX_FILE_BYTES * 2
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

        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024,
        maxBodyLength: 1024 * 1024
    });

    return response.data;
}

module.exports = { encodeFile, processFile, getScript }
