var fs = require('fs'),
    soap = require('..'),
    assert = require('assert');

module.exports = {
    'SOAP Client': {
        'should error on invalid host': function(done) {
            soap.createClient('http://localhost:123', function(err, client) {
                assert.ok(err);
                done();
            });
        },
    }
}
