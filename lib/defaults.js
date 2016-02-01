'use strict';

// Load Modules

const Jsonic = require('jsonic');
const Hoek = require('hoek');

// Internals

const internals = {};

exports.seneca = function (options) {

    return Hoek.applyToDefaults(internals.seneca, options);
};

exports.cache = function (options) {

    return Hoek.applyToDefaults(internals.cache, options);
};

internals.seneca = {
    log: 'silent',
    actcache: {
        active: false
    },
    default_plugins: {
        basic: false,
        web: false,
        cluster: false,
        'mem-store': false,
        repl: false,
        transport: false
    },
    web: false
};

internals.cache = {
    generateKey: function (additions) {

        if (!additions) {
            return '{}';
        }

        if (typeof additions === 'string') {
            additions = Jsonic(additions);
        }

        const keys = Object.keys(additions);
        let result = '';
        for (let i = 0; i < keys.length; ++i) {
            const key = keys[i];
            const value = additions[key];

            if (typeof value === 'object') {
                return null;
            }

            if (i) {
                result = result + ',';
            }

            result = result + encodeURIComponent(key) + ':' + encodeURIComponent(value.toString());
        }
        return result;
    }
};
