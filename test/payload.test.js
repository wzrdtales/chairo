'use strict';

// Load modules

const Code = require('code');
const Hapi = require('hapi');
const Lab = require('lab');
const Chairo = require('../');

// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


process.setMaxListeners(0);             // Remove warning caused by creating multiple framework instances


describe('Handlers', () => {

    it('can access payload in seneca action', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.register([{ register: Chairo }, require('vision')], (err) => {

            expect(err).to.not.exist();

            server.seneca.add( { get: 'request' }, (message, next) => {

                expect(message.req$.payload).to.deep.equal({ some: 'data', another: 'data' });
                return next(null, { id: 1 });
            });

            server.route({ method: 'POST', path: '/', handler: { act: { get: 'request' } } });

            server.inject( { method: 'POST', url: '/', payload: { some: 'data', another: 'data' } }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.deep.equal({ id: 1 });
                done();
            });
        });
    });


    it('can access query parameters in seneca action', (done) => {

        const server = new Hapi.Server();
        server.connection();
        server.register([{ register: Chairo }, require('vision')], (err) => {

            expect(err).to.not.exist();

            server.seneca.add( { verify: 'request' }, (message, next) => {

                expect(message.req$.query).to.deep.equal({ some: 'action' });
                return next(null, { id: 1 });
            });

            server.route({ method: 'GET', path: '/route', handler: { act: { verify: 'request' } } });

            server.inject( { method: 'GET', url: '/route?some=action' }, (res) => {

                expect(res.statusCode).to.equal(200);
                expect(res.result).to.deep.equal({ id: 1 });
                done();
            });
        });
    });

});
