'use strict';

// Load modules

const Code = require('code');
const Hapi = require('hapi');
const Lab = require('lab');
const Seneca = require('seneca');
const Vision = require('vision');
const Chairo = require('../');
const Sinon = require('sinon');

// Declare internals

const internals = {};

// Test shortcuts

const lab = (exports.lab = Lab.script());
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;

process.setMaxListeners(0); // Remove warning caused by creating multiple framework instances

describe('register()', () => {

    it('exposes a seneca instance', async (done) => {

        const server = new Hapi.Server();
        await server.register({ plugin: Chairo }).catch((err) => {

            expect(err).to.not.exist();
        });

        let id = 0;
        server.seneca.add({ generate: 'id' }, (message, next) => {

            return next(null, { id: ++id });
        });

        const result = await new Promise((resolve, reject) => {

            server.seneca.act({ generate: 'id' }, (err, res) => {

                if (err) {
                    return reject(err);
                }

                return resolve(res);
            });
        }).catch((err) => {

            expect(err).to.not.exist();
        });

        expect(result).to.equal({ id: 1 });
    });

    it('uses passed in seneca instance if provided', async (done) => {

        const seneca = new Seneca({ log: 'silent' });
        const server = new Hapi.Server();
        await server
            .register({ plugin: Chairo, options: { seneca } })
            .catch((err) => {

                expect(err).to.not.exist();
            });

        expect(server.seneca.id).to.equal(seneca.id);
    });

    it('registers to stop event, to stop seneca', async () => {

        const seneca = new Seneca({ log: 'silent' });
        Sinon.spy(seneca, 'close');
        const server = new Hapi.Server();
        await server
            .register({ plugin: Chairo, options: { seneca } })
            .catch((err) => {

                expect(err).to.not.exist();
            });

        await server.stop();
        expect(seneca.close.calledOnce).to.equal(true);
    });
});

describe('action()', () => {

    it('maps an action to a server method', async (done) => {

        const server = new Hapi.Server();
        await server.register({ plugin: Chairo }).catch((err) => {

            expect(err).to.not.exist();
        });

        let id = 0;
        server.seneca.add({ generate: 'id' }, (message, next) => {

            return next(null, { id: ++id });
        });

        server.action('generate', 'generate:id');

        const result = await server.methods.generate().catch((err) => {

            expect(err).to.not.exist();
        });

        expect(result).to.equal({ id: 1 });

        const result2 = await server.methods.generate().catch((err) => {

            expect(err).to.not.exist();
        });

        expect(result2).to.equal({ id: 2 });
    });

    it('maps an action to a server method (cached)', async (done) => {

        const server = new Hapi.Server();
        await server.register({ plugin: Chairo }).catch((err) => {

            expect(err).to.not.exist();
        });

        let id = 0;
        server.seneca.add({ generate: 'id' }, (message, next) => {

            return next(null, { id: ++id });
        });

        server.action('generate', 'generate:id', {
            cache: { expiresIn: 1000, generateTimeout: 3000 }
        });

        await server.start();

        const result1 = await server.methods.generate().catch((err) => {

            expect(err).to.not.exist();
        });

        expect(result1).to.equal({ id: 1 });

        const result2 = await server.methods.generate().catch((err) => {

            expect(err).to.not.exist();
        });

        expect(result2).to.equal({ id: 1 });
    });

    it('throws an exception for invalid cache options', async (done) => {

        const server = new Hapi.Server();
        await server.register({ plugin: Chairo }).catch((err) => {

            expect(err).to.not.exist();
        });

        let id = 0;
        server.seneca.add({ generate: 'id' }, (message, next) => {

            return next(null, { id: ++id });
        });

        const incorrect = function () {

            server.action('generate', 'generate:id', []);
        };

        expect(incorrect).to.throw(Error);
    });

    it('maps an action to a server method (cached with custom generateKey)', async (done) => {

        const server = new Hapi.Server();
        await server.register({ plugin: Chairo }).catch((err) => {

            expect(err).to.not.exist();
        });

        server.seneca.add({ generate: 'id' }, (message, next) => {

            return next(null, {
                result:
                    message.samples.readings.values[0] *
                    message.samples.readings.values[1]
            });
        });

        server.action(
            'generate',
            { generate: 'id' },
            {
                cache: { expiresIn: 1000, generateTimeout: 3000 },
                generateKey: (message) => {

                    return (
                        'id' +
                        message.samples.readings.values[0] +
                        ':' +
                        message.samples.readings.values[1]
                    );
                }
            }
        );

        await server.start();

        const result1 = await server.methods
            .generate({ samples: { readings: { values: [2, 3] } } })
            .catch((err) => {

                expect(err).to.not.exist();
            });

        expect(result1).to.equal({ result: 6 });

        const result2 = await server.methods
            .generate({ samples: { readings: { values: [2, 3] } } })
            .catch((err) => {

                expect(err).to.not.exist();
            });

        expect(result2).to.equal({ result: 6 });
    });

    it('maps an action to a server method (object pattern)', async (done) => {

        const server = new Hapi.Server();
        await server.register({ plugin: Chairo }).catch((err) => {

            expect(err).to.not.exist();
        });

        server.seneca.add({ generate: 'id' }, (message, next) => {

            return next(null, { id: 1 });
        });

        server.action('generate', { generate: 'id' });

        const result = await server.methods.generate().catch((err) => {

            expect(err).to.not.exist();
        });

        expect(result).to.equal({ id: 1 });
    });

    it('maps an action to a server method (additions)', async (done) => {

        const server = new Hapi.Server();
        await server.register({ plugin: Chairo }).catch((err) => {

            expect(err).to.not.exist();
        });

        server.seneca.add({ generate: 'id' }, (message, next) => {

            return next(null, { id: 1, name: message.name });
        });

        server.action('generate', { generate: 'id' });

        const result = await server.methods
            .generate('name:steve')
            .catch((err) => {

                expect(err).to.not.exist();
            });

        expect(result).to.equal({ id: 1, name: 'steve' });
    });

    it('maps an action to a server method (object additions)', async (done) => {

        const server = new Hapi.Server();
        await server.register({ plugin: Chairo }).catch((err) => {

            expect(err).to.not.exist();
        });

        server.seneca.add({ generate: 'id' }, (message, next) => {

            return next(null, { id: 1, name: message.name });
        });

        server.action('generate', { generate: 'id' });

        const result = await server.methods
            .generate({ name: 'steve' })
            .catch((err) => {

                expect(err).to.not.exist();
            });

        expect(result).to.equal({ id: 1, name: 'steve' });
    });

    it('maps an action to a server method (cached additions)', async (done) => {

        const server = new Hapi.Server();
        await server.register({ plugin: Chairo }).catch((err) => {

            expect(err).to.not.exist();
        });

        let id = 0;
        server.seneca.add({ generate: 'id' }, (message, next) => {

            return next(null, { id: ++id, name: message.name });
        });

        server.action('generate', 'generate:id', {
            cache: { expiresIn: 1000, generateTimeout: 3000 }
        });

        await server.start();

        const result1 = await server.methods
            .generate('name:steve')
            .catch((err) => {

                expect(err).to.not.exist();
            });

        expect(result1.id).to.equal(1);

        const result2 = await server.methods
            .generate('name:steve')
            .catch((err) => {

                expect(err).to.not.exist();
            });

        expect(result2.id).to.equal(1);
    });

    it('maps an action to a server method (cached object additions)', async (done) => {

        const server = new Hapi.Server();
        await server.register({ plugin: Chairo }).catch((err) => {

            expect(err).to.not.exist();
        });

        let id = 0;
        server.seneca.add({ generate: 'id' }, (message, next) => {

            return next(null, { id: ++id, name: message.name });
        });

        server.action('generate', 'generate:id', {
            cache: { expiresIn: 1000, generateTimeout: 3000 }
        });

        await server.start();

        const result1 = await server.methods
            .generate({ name: 'steve' })
            .catch((err) => {

                expect(err).to.not.exist();
            });

        expect(result1.id).to.equal(1);

        const result2 = await server.methods
            .generate({ name: 'steve' })
            .catch((err) => {

                expect(err).to.not.exist();
            });

        expect(result2.id).to.equal(1);
    });

    it('maps an action to a server method (cached object additions with multiple keys)', async (done) => {

        const server = new Hapi.Server();
        await server.register({ plugin: Chairo }).catch((err) => {

            expect(err).to.not.exist();
        });

        let id = 0;
        server.seneca.add({ generate: 'id' }, (message, next) => {

            return next(null, {
                id: ++id,
                name: message.pre + message.name
            });
        });

        server.action('generate', 'generate:id', {
            cache: { expiresIn: 1000, generateTimeout: 3000 }
        });

        await server.start();

        const result1 = await server.methods
            .generate({ name: 'steve', pre: 'mr' })
            .catch((err) => {

                expect(err).to.not.exist();
            });

        expect(result1.id).to.equal(1);

        const result2 = await server.methods
            .generate({ name: 'steve', pre: 'mr' })
            .catch((err) => {

                expect(err).to.not.exist();
            });

        expect(result2.id).to.equal(1);
    });

    it('maps an action to a server method (cached additions over both string and object)', async (done) => {

        const server = new Hapi.Server();
        await server.register({ plugin: Chairo }).catch((err) => {

            expect(err).to.not.exist();
        });

        let id = 0;
        server.seneca.add({ generate: 'id' }, (message, next) => {

            return next(null, {
                id: ++id,
                name: message.pre + message.name
            });
        });

        server.action('generate', 'generate:id', {
            cache: { expiresIn: 1000, generateTimeout: 3000 }
        });

        await server.start();

        const result1 = await server.methods
            .generate({ name: 'steve', pre: 'mr' })
            .catch((err) => {

                expect(err).to.not.exist();
            });

        expect(result1.id).to.equal(1);

        const result2 = await server.methods
            .generate('name:steve,pre:mr')
            .catch((err) => {

                expect(err).to.not.exist();
            });

        expect(result2.id).to.equal(1);
    });

    it('does not cache object additions with nested objects', async (done) => {

        const server = new Hapi.Server();
        await server.register({ plugin: Chairo }).catch((err) => {

            expect(err).to.not.exist();
        });

        let id = 0;
        server.seneca.add({ generate: 'id' }, (message, next) => {

            return next(null, { id: ++id });
        });

        server.action('generate', 'generate:id', {
            cache: { expiresIn: 1000, generateTimeout: 3000 }
        });

        await server.start();

        const result = await server.methods
            .generate({ price: { a: 'b' } })
            .catch((err) => {

                expect(err).to.exist();
            });

        expect(result).to.not.exist();
    });
});

describe('Request', () => {

    it('has access to seneca delegate with raw req/res', async (done) => {

        const server = new Hapi.Server();
        await server.register({ plugin: Chairo }).catch((err) => {

            expect(err).to.not.exist();
        });

        const handler = function (request, reply) {

            return request.seneca.fixedargs.req$.url.path;
        };

        server.route({ method: 'GET', path: '/', handler });

        const res = await server.inject('/');

        expect(res.result).to.equal('/');
    });
});

describe('Replies', () => {

    describe('act()', () => {

        it('returns act result', async (done) => {

            const server = new Hapi.Server();
            await server.register({ plugin: Chairo }).catch((err) => {

                expect(err).to.not.exist();
            });

            let id = 0;
            server.seneca.add({ generate: 'id' }, (message, next) => {

                if (++id === 1) {
                    return next(null, { id: 1 });
                }

                return next(new Error('failed'));
            });

            const handler = function (request, reply) {

                return reply.act({ generate: 'id' });
            };

            server.route({ method: 'GET', path: '/', handler });

            const res = await server.inject('/');

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal({ id: 1 });

            const res2 = await server.inject('/');

            expect(res2.statusCode).to.equal(500);
        });
    });

    describe('compose()', () => {

        it('renders view from a template', async (done) => {

            const server = new Hapi.Server();
            await server.register([{ plugin: Chairo }, Vision]).catch((err) => {

                expect(err).to.not.exist();
            });

            server.seneca.add({ generate: 'id' }, (message, next) => {

                return next(null, { id: 1 });
            });

            server.seneca.add({ record: 'user' }, (message, next) => {

                return next(null, { name: message.name });
            });

            server.views({
                engines: { html: require('handlebars') },
                path: __dirname + '/templates'
            });

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, reply) => {

                    const context = {
                        user: {
                            id: {
                                id: 1
                            },
                            name: {
                                name: 'john'
                            }
                        },
                        general: {
                            message: 'hello!'
                        }
                    };

                    return reply.compose('test', context);
                }
            });
            const res = await server.inject('/');

            expect(res.result).to.equal(
                '<div>\n    <h1>1</h1>\n    <h2>john</h2>\n    <h3>hello!</h3>\n</div>\n'
            );
        });

        it('renders view using multiple actions', async (done) => {

            const server = new Hapi.Server();
            await server.register([{ plugin: Chairo }, Vision]).catch((err) => {

                expect(err).to.not.exist();
            });

            server.seneca.add({ generate: 'id' }, (message, next) => {

                return next(null, { id: 1 });
            });

            server.seneca.add({ record: 'user' }, (message, next) => {

                return next(null, { name: message.name });
            });

            server.views({
                engines: { html: require('handlebars') },
                path: __dirname + '/templates'
            });

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, reply) => {

                    const context = {
                        $resolve: {
                            'user.id': 'generate:id',
                            'user.name': { record: 'user', name: 'john' }
                        },
                        general: {
                            message: 'hello!'
                        }
                    };

                    return reply.compose('test', context);
                }
            });

            const res = await server.inject('/');

            expect(res.result).to.equal(
                '<div>\n    <h1>1</h1>\n    <h2>john</h2>\n    <h3>hello!</h3>\n</div>\n'
            );
        });

        it('errors on missing action', async (done) => {

            const server = new Hapi.Server();
            await server.register([{ plugin: Chairo }, Vision]).catch((err) => {

                expect(err).to.not.exist();
            });

            server.seneca.add({ generate: 'id' }, (message, next) => {

                return next(null, { id: 1 });
            });

            server.views({
                engines: { html: require('handlebars') },
                path: __dirname + '/templates'
            });

            server.route({
                method: 'GET',
                path: '/',
                handler: (request, reply) => {

                    const context = {
                        $resolve: {
                            'user.id': 'generate:id',
                            'user.name': { record: 'user', name: 'john' }
                        },
                        general: {
                            message: 'hello!'
                        }
                    };

                    return reply.compose('test', context);
                }
            });

            const res = await server.inject('/');

            expect(res.statusCode).to.equal(500);
        });
    });
});

describe('Handlers', () => {

    describe('act()', () => {

        it('replies with act result', async (done) => {

            const server = new Hapi.Server();
            await server.register([{ plugin: Chairo }, Vision]).catch((err) => {

                expect(err).to.not.exist();
            });

            server.seneca.add({ generate: 'id' }, (message, next) => {

                return next(null, { id: 1 });
            });

            server.route({
                method: 'GET',
                path: '/',
                handler: { act: { generate: 'id' } }
            });

            const res = await server.inject('/');

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal({ id: 1 });
        });

        it('replies with act result (template string)', async (done) => {

            const server = new Hapi.Server();
            await server.register({ plugin: Chairo }).catch((err) => {

                expect(err).to.not.exist();
            });

            server.seneca.add({ generate: 'id' }, (message, next) => {

                return next(null, { id: 1 });
            });

            server.route({
                method: 'GET',
                path: '/{type}',
                handler: { act: 'generate:{params.type}' }
            });

            const res = await server.inject('/id');

            expect(res.statusCode).to.equal(200);
            expect(res.result).to.equal({ id: 1 });
        });
    });

    describe('compose()', () => {

        it('renders view using multiple actions', async (done) => {

            const server = new Hapi.Server();
            await server.register([{ plugin: Chairo }, Vision]).catch((err) => {

                expect(err).to.not.exist();
            });

            server.seneca.add({ generate: 'id' }, (message, next) => {

                return next(null, { id: 1 });
            });

            server.seneca.add({ record: 'user' }, (message, next) => {

                return next(null, { name: message.name });
            });

            server.views({
                engines: { html: require('handlebars') },
                path: __dirname + '/templates'
            });

            server.route({
                method: 'GET',
                path: '/',
                handler: {
                    compose: {
                        template: 'test',
                        context: {
                            $resolve: {
                                'user.id': 'generate:id',
                                'user.name': {
                                    record: 'user',
                                    name: 'john'
                                }
                            },
                            general: {
                                message: 'hello!'
                            }
                        }
                    }
                }
            });

            const res = await server.inject('/');
            expect(res.result).to.equal(
                '<div>\n    <h1>1</h1>\n    <h2>john</h2>\n    <h3>hello!</h3>\n</div>\n'
            );
        });
    });

    it('can access payload in seneca action', async (done) => {

        const server = new Hapi.Server();
        await server.register([Chairo, Vision]).catch((err) => {

            expect(err).to.not.exist();
        });

        server.seneca.add({ get: 'request' }, (message, next) => {

            expect(message.req$.payload).to.equal({
                some: 'data',
                another: 'data'
            });
            return next(null, { id: 1 });
        });

        server.route({
            method: 'POST',
            path: '/',
            handler: { act: { get: 'request' } }
        });

        const res = await server.inject({
            method: 'POST',
            url: '/',
            payload: { some: 'data', another: 'data' }
        });

        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal({ id: 1 });
        server.seneca.close();
    });

    it('can access query parameters in seneca action', async (done) => {

        const server = new Hapi.Server();
        await server.register([Chairo, Vision]).catch((err) => {

            expect(err).to.not.exist();
        });

        server.seneca.add({ verify: 'request' }, (message, next) => {

            expect(message.req$.query.some).to.equal('action');
            return next(null, { id: 1 });
        });

        server.route({
            method: 'GET',
            path: '/route',
            handler: { act: { verify: 'request' } }
        });

        const res = await server.inject({
            method: 'GET',
            url: '/route?some=action'
        });

        expect(res.statusCode).to.equal(200);
        expect(res.result).to.equal({ id: 1 });
        server.seneca.close();
    });
});
