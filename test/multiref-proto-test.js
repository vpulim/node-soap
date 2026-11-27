'use strict';

var assert = require('assert'),
  fs = require('fs'),
  path = require('path'),
  soap = require('..');

describe('WSDL.xmlToObject multiRef ids', () => {
  it('should not pollute Object.prototype when id is __proto__', (done) => {
    var file = path.join(__dirname, 'wsdl', 'multiref-proto.wsdl');
    soap.createClient(file, {}, (err, client) => {
      assert.ifError(err);
      var xml = '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><Ping><a id="__proto__">v</a></Ping></soap:Body></soap:Envelope>';
      try {
        client.wsdl.xmlToObject(xml);
      } catch (e) {
        // parse outcome is not relevant, only the prototype state
      }
      assert.strictEqual(Object.prototype.hasOwnProperty.call(Object.prototype, 'obj'), false);
      done();
    });
  });
});
