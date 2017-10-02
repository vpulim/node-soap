'use strict';

var fs = require('fs'),
    soap = require('..'),
    http = require('http'),
    assert = require('assert');

describe('SOAP Client', function() {
  var options = {
    'ignoredNamespaces': {
      'namespaces': ['ignoreThisNS'],
      'override': true
    },
    'overrideRootElement': {
      'namespace': 'tns'
    },
    'overridePromiseSuffix': 'Test',
    'request': 'customRequest'
  };

  it('should set WSDL options to those specified in createClient', function(done) {
    soap.createClient(__dirname+'/wsdl/json_response.wsdl', options, function(err, client) {
      assert.ok(client);
      assert.ifError(err);

      assert.ok(client.wsdl.options.ignoredNamespaces[0] === 'ignoreThisNS');
      assert.ok(client.wsdl.options.overrideRootElement.namespace === 'tns');
      assert.ok(typeof client.MyOperationTest === 'function');
      assert.ok(client.wsdl.options.request, "customRequest");
      done();
    });
  });
});
