// Load modules

var Code = require('code');
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


describe('register()', function () {

    it('registers the api', function (done) {

        var server = new Hapi.Server();
        server.connection();
        server.register(Chairo, function (err) {

            expect(err).to.not.exist();
            done();
        });
    });
});
