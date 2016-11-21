'use strict';

// Load modules

const Hoek = require('hoek');
const Items = require('items');
const Jsonic = require('jsonic');
const Seneca = require('seneca');
const Schema = require('./schema');


// Declare internals

const internals = {
    defaults: {
        log: 'silent',
        actcache: {
            active: false
        },
        default_plugins: {
            cluster: false,
            repl: false
        },
        seneca: false
    },
    replies: {},
    handlers: {}
};


exports.register = function (server, options, next) {

    const settings = Hoek.applyToDefaults(internals.defaults, options);

    const hasSeneca = settings.seneca && (typeof settings.seneca.use === 'function');
    const seneca = hasSeneca ? settings.seneca : Seneca(settings);

    server.decorate('server', 'seneca', seneca);
    server.decorate('server', 'action', internals.action(server));

    server.decorate('request', 'seneca', internals.request(seneca), { apply: true });

    server.decorate('reply', 'act', internals.replies.act);
    server.decorate('reply', 'compose', internals.replies.compose);

    server.handler('act', internals.handlers.act);
    server.handler('compose', internals.handlers.compose);

    return next();
};


exports.register.attributes = {
    pkg: require('../package.json')
};


internals.action = function (server) {

    return function (name, pattern, options) {

        Schema.action(options, 'Invalid Action Schema');     // Allow only cache option

        if (typeof pattern === 'string') {
            pattern = Jsonic(pattern);
        }

        const method = function (additions, callback) {

            if (typeof additions === 'function') {
                callback = additions;
                additions = null;
            }

            if (additions) {
                return server.seneca.act(Hoek.applyToDefaults(pattern, typeof additions === 'string' ? Jsonic(additions) : additions), callback);
            }

            return server.seneca.act(pattern, callback);
        };

        if (options &&
            options.cache) {

            const settings = Hoek.applyToDefaults(internals.cache, options);

            return server.method(name, method, settings);
        }

        return server.method(name, method);
    };
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


internals.request = function (seneca) {

    return (request) => {

        return seneca.delegate({
            req$: request,
            tx$:  seneca.root.idgen()
        });
    };
};


internals.replies.act = function (pattern) {

    this.request.seneca.act(pattern, (err, result) => {

        this.response(err || result);
    });
};


internals.replies.compose = function (template, context, options) {

    const composed = Hoek.clone(context);
    const actions = composed.$resolve ? Object.keys(composed.$resolve) : [];
    const seneca = this.request.seneca;
    const each = (action, next) => {

        seneca.act(composed.$resolve[action], (err, result) => {

            if (err) {
                return next(err);
            }

            const source = { result };
            const tpl = {};
            tpl[action] = 'result';
            Hoek.merge(composed, Hoek.transform(source, tpl));

            return next();
        });
    };

    Items.parallel(actions, each, (err) => {

        if (err) {
            return this.response(err);
        }

        return this.view(template, composed, options);
    });
};

internals.handlers.act = function (route, options) {

    return function (request, reply) {

        let pattern = options;
        if (typeof pattern === 'string') {
            const context = {
                params: request.params,
                query: request.query,
                payload: request.payload
            };

            pattern = Hoek.reachTemplate(context, pattern);
        }

        return reply.act(pattern);
    };
};


internals.handlers.compose = function (route, options) {

    Schema.compose(options, 'Invalid compose handler options (' + route.path + ')');

    return function (request, reply) {

        const context = {
            params: request.params,
            payload: request.payload,
            query: request.query,
            pre: request.pre
        };

        const keys = Object.keys(options.context);
        for (let i = 0; i < keys.length; ++i) {
            const key = keys[i];
            context[key] = options.context[key];
        }

        return reply.compose(options.template, context, options.options);
    };
};
