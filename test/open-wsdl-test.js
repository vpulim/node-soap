'use strict';

var assert = require('assert'),
    soap = require('..');

describe('open_wsdl', function (next) {
    var wsdl = 'test/wsdl/strict/EVacSyncService_SPClient.wsdl';
    var testText = 'Test keepText';

    it('should keep text if keepText option is true', function (next) {
        soap.open_wsdl(wsdl, {keepText: true}, function (err, data) {
            assert.ok(!err);
            assert.ok(data.xml.indexOf(testText) >= 0);
            assert.ok(JSON.stringify(data.definitions).indexOf(testText) >= 0);
            next();
        })
    })

    it('should not keep text if keepText option is false', function (next) {
        soap.open_wsdl(wsdl, {keepText: false}, function (err, data) {
            assert.ok(!err);
            assert.ok(data.xml.indexOf(testText) >= 0);
            assert.ok(JSON.stringify(data.definitions).indexOf(testText) < 0);
            next();
        })
    })
})
