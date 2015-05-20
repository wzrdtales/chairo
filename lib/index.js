// Load modules

var Hoek = require('hoek');


// Declare internals

var internals = {};


exports.register = function (server, options, next) {

    return next();
};


exports.register.attributes = {
    pkg: require('../package.json')
};
