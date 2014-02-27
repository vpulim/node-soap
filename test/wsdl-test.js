var fs = require('fs'),
    soap = require('..'),
    assert = require('assert');

var wsdlStrictTests = {},
    wsdlNonStrictTests = {};

fs.readdirSync(__dirname+'/wsdl/strict').forEach(function(file) {
    if (!/.wsdl$/.exec(file)) return;
    wsdlStrictTests['should parse and describe '+file] = function(done) {
        soap.createClient(__dirname+'/wsdl/strict/'+file, {strict: true}, function(err, client) {
            assert.ok(!err);
            client.describe();
            done();
        });
    };
})

fs.readdirSync(__dirname+'/wsdl').forEach(function(file) {
    if (!/.wsdl$/.exec(file)) return;
    wsdlNonStrictTests['should parse and describe '+file] = function(done) {
        soap.createClient(__dirname+'/wsdl/'+file, function(err, client) {
            assert.ok(!err);
            client.describe();
            done();
        });
    };
})

wsdlNonStrictTests['should not parse connection error'] = function(done) {
    soap.createClient(__dirname+'/wsdl/connection/econnrefused.wsdl', function(err, client) {
        assert.ok(/EADDRNOTAVAIL|ECONNREFUSED/.test(err), err);
        done();
    });
};

module.exports = {
    'WSDL Parser (strict)': wsdlStrictTests,
    'WSDL Parser (non-strict)': wsdlNonStrictTests
}
