const express = require("express");

/**
 * Validates an express body
 * @param {express.Request} req
 * @param {Array<String>} body
 * @returns {Boolean} Indicates if the body is valid
 */
module.exports = exports = (req, body) => {
    let isValid = true;

    body.forEach((element) => {
        if (!Object.hasOwnProperty.bind(req.body)(element)) {
            isValid = false;
        }
    });

    return isValid;
};