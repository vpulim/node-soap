'use strict';

var fs = require('fs'),
    soap = require('..'),
    assert = require('assert');

var wsdlStrictTests = {},
    wsdlNonStrictTests = {};

fs.readdirSync(__dirname+'/wsdl/strict').forEach(function(file) {
    if (!/.wsdl$/.exec(file)) return;
    wsdlStrictTests['should parse '+file] = function(done) {
        this.timeout(10000);
        soap.createClient(__dirname+'/wsdl/strict/'+file, {strict: true}, function(err, client) {
            assert.ok(!err);
            done();
        });
    };
});

fs.readdirSync(__dirname+'/wsdl').forEach(function(file) {
    if (!/.wsdl$/.exec(file)) return;
    wsdlNonStrictTests['should parse '+file] = function(done) {
        soap.createClient(__dirname+'/wsdl/'+file, function(err, client) {
            assert.ok(!err);
            done();
        });
    };
});

module.exports = {
    'WSDL Parser (strict)': wsdlStrictTests,
    'WSDL Parser (non-strict)': wsdlNonStrictTests
};
