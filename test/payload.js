'use strict';

// Load modules

const Code = require('code');
const Hapi = require('hapi');
const Lab = require('lab');
const Chairo = require('../');
const Vision = require('vision');

// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('Handlers', () => {

    it('can access payload in seneca action', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.register([Chairo, Vision], (err) => {

            expect(err).to.not.exist();

            server.seneca.add({ get: 'request' }, (message, next) => {

                expect(message.req$.payload).to.deep.equal({ some: 'data', another: 'data' });
                return next(null, { id: 1 });
            });

            server.route({ method: 'POST', path: '/', handler: { act: { get: 'request' } } });

            server.inject({ method: 'POST', url: '/', payload: { some: 'data', another: 'data' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.deep.equal({ id: 1 });
                server.seneca.close();
                done();
            });
        });
    });


    it('can access query parameters in seneca action', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.register([Chairo, Vision], (err) => {

            expect(err).to.not.exist();

            server.seneca.add({ verify: 'request' }, (message, next) => {

                expect(message.req$.query).to.deep.equal({ some: 'action' });
                return next(null, { id: 1 });
            });

            server.route({ method: 'GET', path: '/route', handler: { act: { verify: 'request' } } });

            server.inject({ method: 'GET', url: '/route?some=action' }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.deep.equal({ id: 1 });
                server.seneca.close();
                done();
            });
        });
    });

    it('load custom web plugin if provided in options', (done) => {

        const web = function () {

            return {
                name: 'web',
                export: function () {},
                exportmap: {
                    hapi: function (server, options, next) {

                        expect(server).to.exist();
                        expect(options).to.exist();
                        expect(options.someOption).to.equal('someValue');
                        server.seneca.close();
                        done();
                    }
                }
            };
        };

        const setupServer = function () {

            const server = new Hapi.Server();
            server.connection();
            server.register([
                {
                    register: Chairo,
                    options: {
                        someOption: 'someValue',
                        web: web
                    }
                }, Vision], (err) => {

                expect(err).to.not.exist();
            });
        };

        setupServer();
    });
});
