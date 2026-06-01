
/**
 Wraps a function to help deal with express error handling for promises
 @param {Function} fn - the express handler
 @returns {Function} the new express handler
**/
module.exports = exports = (fn) => (req, res, next) => {
    fn(req, res, next).catch(next);
};