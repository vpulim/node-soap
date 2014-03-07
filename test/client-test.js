"use strict";

var fs = require('fs'),
    soap = require('..'),
    assert = require('assert');

describe('SOAP Client', function() {
  it('should error on invalid host', function(done) {
    soap.createClient('http://localhost:1', function(err, client) {
      assert.ok(err);
      done();
    });
  });
  
  it('should add and clear soap headers', function(done) {
    soap.createClient(__dirname+'/wsdl/default_namespace.wsdl', function(err, client) {
      assert.ok(client);
      assert.ok(!client.getSoapHeaders());

      client.addSoapHeader('header1');
      client.addSoapHeader('header2');

      assert.ok(client.getSoapHeaders().length === 2);
      assert.ok(client.getSoapHeaders()[0] === 'header1');
      assert.ok(client.getSoapHeaders()[1] === 'header2');

      client.clearSoapHeaders();
      assert.ok(!client.getSoapHeaders());
      done();
    });
  });
});
