'use strict';

var soap = require('..'),
  assert = require('assert');

describe('SOAP Client', function () {
  var options = {
    attributesKey: '$attributes',
    namespaceArrayElements: false,
    wsdl_options: {
      fixedPath: true,
    },
  };

  it('should ignore relative paths from wsdl imports and use a single fixed directory', function (done) {
    soap.createClient(__dirname + '/wsdl/fixedPath/netsuite.wsdl', options, function (err, client) {
      assert.ok(client);
      assert.ifError(err);

      assert.ok(client.wsdl.options.wsdl_options.fixedPath === true);
      done();
    });
  });
});
