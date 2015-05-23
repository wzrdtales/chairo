// Load modules

var Code = require('code');
var Handlebars = require('handlebars');
var Hapi = require('hapi');
var Lab = require('lab');
var Chairo = require('../');

// Declare internals

var internals = {};


// Test shortcuts

var lab = exports.lab = Lab.script();
var describe = lab.describe;
var it = lab.it;
var expect = Code.expect;


process.setMaxListeners(0);             // Remove warning caused by creating multiple framework instances


describe('register()', function () {

    it('exposes a seneca instance', function (done) {

        var server = new Hapi.Server();
        server.connection();
        server.register({ register: Chairo, options: { log: 'silent' } }, function (err) {

            expect(err).to.not.exist();

            var id = 0;
            server.seneca.add({ generate: 'id' }, function (message, next) {

                return next(null, { id: ++id });
            });

            server.seneca.act({ generate: 'id' }, function (err, result) {

                expect(result).to.deep.equal({ id: 1 });
                done();
            });
        });
    });
});

describe('action()', function () {

    it('maps an action to a server method', function (done) {

        var server = new Hapi.Server();
        server.connection();
        server.register({ register: Chairo, options: { log: 'silent' } }, function (err) {

            expect(err).to.not.exist();

            var id = 0;
            server.seneca.add({ generate: 'id' }, function (message, next) {

                return next(null, { id: ++id });
            });

            server.action('generate', 'generate:id');

            server.methods.generate(function (err, result) {

                expect(result).to.deep.equal({ id: 1 });

                server.methods.generate(function (err, result) {

                    expect(result).to.deep.equal({ id: 2 });
                    done();
                });
            });
        });
    });

    it('maps an action to a server method (cached)', function (done) {

        var server = new Hapi.Server();
        server.connection();
        server.register({ register: Chairo, options: { log: 'silent' } }, function (err) {

            expect(err).to.not.exist();

            var id = 0;
            server.seneca.add({ generate: 'id' }, function (message, next) {

                return next(null, { id: ++id });
            });

            server.action('generate', 'generate:id', { cache: { expiresIn: 1000 } });

            server.start(function () {

                server.methods.generate(function (err, result1) {

                    expect(result1).to.deep.equal({ id: 1 });

                    server.methods.generate(function (err, result2) {

                        expect(result2).to.deep.equal({ id: 1 });
                        done();
                    });
                });
            });
        });
    });

    it('maps an action to a server method (object pattern)', function (done) {

        var server = new Hapi.Server();
        server.connection();
        server.register({ register: Chairo, options: { log: 'silent' } }, function (err) {

            expect(err).to.not.exist();

            server.seneca.add({ generate: 'id' }, function (message, next) {

                return next(null, { id: 1 });
            });

            server.action('generate', { generate: 'id' });

            server.methods.generate(function (err, result) {

                expect(result).to.deep.equal({ id: 1 });
                done();
            });
        });
    });

    it('maps an action to a server method (additions)', function (done) {

        var server = new Hapi.Server();
        server.connection();
        server.register({ register: Chairo, options: { log: 'silent' } }, function (err) {

            expect(err).to.not.exist();

            server.seneca.add({ generate: 'id' }, function (message, next) {

                return next(null, { id: 1, name: message.name });
            });

            server.action('generate', { generate: 'id' });

            server.methods.generate({ name: 'steve' }, function (err, result) {

                expect(result).to.deep.equal({ id: 1, name: 'steve' });
                done();
            });
        });
    });
});

describe('Replies', function () {

    describe('act()', function () {

        it('returns act result', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.register({ register: Chairo, options: { log: 'silent' } }, function (err) {

                expect(err).to.not.exist();

                var id = 0;
                server.seneca.add({ generate: 'id' }, function (message, next) {

                    if (++id === 1) {
                        return next(null, { id: 1 });
                    }

                    return next(new Error('failed'));
                });

                var handler = function (request, reply) {

                    return reply.act({ generate: 'id' });
                };

                server.route({ method: 'GET', path: '/', handler: handler });

                server.inject('/', function (res) {

                    expect(res.statusCode).to.equal(200);
                    expect(res.result).to.deep.equal({ id: 1 });

                    server.inject('/', function (res) {

                        expect(res.statusCode).to.equal(500);
                        done();
                    });
                });
            });
        });
    });

    describe('compose()', function () {

        it('renders view using multiple actions', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.register({ register: Chairo, options: { log: 'silent' } }, function (err) {

                expect(err).to.not.exist();

                server.seneca.add({ generate: 'id' }, function (message, next) {

                    return next(null, { id: 1 });
                });

                server.seneca.add({ record: 'user' }, function (message, next) {

                    return next(null, { name: message.name });
                });

                server.views({
                    engines: { html: require('handlebars') },
                    path: __dirname + '/templates'
                });

                server.route({
                    method: 'GET',
                    path: '/',
                    handler: function (request, reply) {

                        var context = {
                            id$: 'generate:id',
                            user$: { record: 'user', name: 'john' },
                            general: {
                                message: 'hello!'
                            }
                        };

                        return reply.compose('test', context);
                    }
                });

                server.inject('/', function (res) {

                    expect(res.result).to.equal('<div>\r\n    <h1>1</h1>\r\n    <h2>john</h2>\r\n    <h3>hello!</h3>\r\n</div>\r\n');
                    done();
                });
            });
        });

        it('errors on missing action', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.register({ register: Chairo, options: { log: 'silent' } }, function (err) {

                expect(err).to.not.exist();

                server.seneca.add({ generate: 'id' }, function (message, next) {

                    return next(null, { id: 1 });
                });

                server.views({
                    engines: { html: require('handlebars') },
                    path: __dirname + '/templates'
                });

                server.route({
                    method: 'GET',
                    path: '/',
                    handler: function (request, reply) {

                        var context = {
                            id$: 'generate:id',
                            user$: { record: 'user', name: 'john' },
                            general: {
                                message: 'hello!'
                            }
                        };

                        return reply.compose('test', context);
                    }
                });

                server.inject('/', function (res) {

                    expect(res.statusCode).to.equal(500);
                    done();
                });
            });
        });
    });
});

describe('Handlers', function () {

    describe('act()', function () {

        it('replies with act result', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.register({ register: Chairo, options: { log: 'silent' } }, function (err) {

                expect(err).to.not.exist();

                server.seneca.add({ generate: 'id' }, function (message, next) {

                    return next(null, { id: 1 });
                });

                server.route({ method: 'GET', path: '/', handler: { act: { generate: 'id' } } });

                server.inject('/', function (res) {

                    expect(res.statusCode).to.equal(200);
                    expect(res.result).to.deep.equal({ id: 1 });
                    done();
                });
            });
        });

        it('replies with act result (template string)', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.register({ register: Chairo, options: { log: 'silent' } }, function (err) {

                expect(err).to.not.exist();

                server.seneca.add({ generate: 'id' }, function (message, next) {

                    return next(null, { id: 1 });
                });

                server.route({ method: 'GET', path: '/{type}', handler: { act: 'generate:{params.type}' } });

                server.inject('/id', function (res) {

                    expect(res.statusCode).to.equal(200);
                    expect(res.result).to.deep.equal({ id: 1 });
                    done();
                });
            });
        });
    });

    describe('compose()', function () {

        it('renders view using multiple actions', function (done) {

            var server = new Hapi.Server();
            server.connection();
            server.register({ register: Chairo, options: { log: 'silent' } }, function (err) {

                expect(err).to.not.exist();

                server.seneca.add({ generate: 'id' }, function (message, next) {

                    return next(null, { id: 1 });
                });

                server.seneca.add({ record: 'user' }, function (message, next) {

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
                                id$: 'generate:id',
                                user$: { record: 'user', name: 'john' },
                                general: {
                                    message: 'hello!'
                                }
                            }
                        }
                    }
                });

                server.inject('/', function (res) {

                    expect(res.result).to.equal('<div>\r\n    <h1>1</h1>\r\n    <h2>john</h2>\r\n    <h3>hello!</h3>\r\n</div>\r\n');
                    done();
                });
            });
        });
    });
});
