'use strict';

// Load Modules

const Joi = require('joi');
const Hoek = require('hoek');

// Declare internals

const internals = {};

exports.apply = function (type, options, message) {

    const result = Joi.validate(options, internals[type]);
    Hoek.assert(!result.error, 'Invalid', type, 'options', message ? '(' + message + ')' : '', result.error && result.error.annotate());
    return result.value;
};

internals.action =  Joi.object({
    cache: Joi.object(),
    generateKey: Joi.func()
});

internals.compose = Joi.object({
    template: Joi.string().required(),
    context: Joi.object().required(),
    options: Joi.object()
});
