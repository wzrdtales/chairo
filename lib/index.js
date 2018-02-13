'use strict';

// Load modules

const Hoek = require('hoek');
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
    toolkit: {},
    handlers: {}
};

module.exports = {
    register: async (server, options) => {

        const settings = Hoek.applyToDefaults(internals.defaults, options);

        const hasSeneca =
            settings.seneca && typeof settings.seneca.use === 'function';
        const seneca = hasSeneca ? settings.seneca : Seneca(settings);

        seneca.use('seneca-as-promised');

        // need to wait for plugins to initialize at this point
        await new Promise((resolve) => {

            seneca.ready(() => {

                resolve();
            });
        });

        server.decorate('server', 'seneca', seneca);
        server.decorate('server', 'action', internals.action(server));

        server.decorate('request', 'seneca', internals.request(seneca), {
            apply: true
        });

        server.decorate('toolkit', 'act', internals.toolkit.act);
        server.decorate('toolkit', 'compose', internals.toolkit.compose);

        server.decorate('handler', 'act', internals.handlers.act);
        server.decorate('handler', 'compose', internals.handlers.compose);
        server.events.on('stop', () => {

            seneca.close();
        });
    },

    pkg: require('../package.json')
};

internals.action = function (server) {

    return function (name, pattern, options) {

        Schema.action(options, 'Invalid Action Schema'); // Allow only cache option

        if (typeof pattern === 'string') {
            pattern = Jsonic(pattern);
        }

        const method = function (additions) {

            if (additions) {
                return server.seneca.actAsync(
                    Hoek.applyToDefaults(
                        pattern,
                        typeof additions === 'string'
                            ? Jsonic(additions)
                            : additions
                    )
                );
            }

            return server.seneca.actAsync(pattern);
        };

        if (options && options.cache) {
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

            result =
                result +
                encodeURIComponent(key) +
                ':' +
                encodeURIComponent(value.toString());
        }
        return result;
    }
};

internals.request = function (seneca) {

    return (request) => {

        return seneca.delegate({
            req$: request,
            tx$: seneca.root.idgen()
        });
    };
};

internals.toolkit.act = function (pattern) {

    return this.request.seneca.actAsync(pattern).then((result) => {

        return this.response(result);
    });
};

internals.toolkit.compose = function (template, context, options) {

    const composed = Hoek.clone(context);
    const actions = composed.$resolve ? Object.keys(composed.$resolve) : [];
    const seneca = this.request.seneca;
    const each = (action) => {

        return seneca.actAsync(composed.$resolve[action]).then((result) => {

            const source = { result };
            const tpl = {};
            tpl[action] = 'result';
            Hoek.merge(composed, Hoek.transform(source, tpl));
        });
    };

    return Promise.all(actions.map((action) => each(action))).then(() => {

        return this.view(template, composed, options);
    });
};

internals.handlers.act = function (route, options) {

    return function (request, h) {

        let pattern = options;
        if (typeof pattern === 'string') {
            const context = {
                params: request.params,
                query: request.query,
                payload: request.payload
            };

            pattern = Hoek.reachTemplate(context, pattern);
        }

        return h.act(pattern);
    };
};

internals.handlers.compose = function (route, options) {

    Schema.compose(
        options,
        'Invalid compose handler options (' + route.path + ')'
    );

    return function (request, h) {

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

        return h.compose(options.template, context, options.options);
    };
};
