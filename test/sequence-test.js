'use strict';

var fs = require('fs'),
  soap = require('..'),
  http = require('http'),
  assert = require('assert'),
  _ = require('lodash'),
  sinon = require('sinon'),
  wsdl = require('../lib/wsdl');

var sequencedRequest = {
  'url': 'https://github.com',
  'fileName': 'qwe.txt',
  'fileMode': 1,
  'forceOverwrite': true,
  'username': 'qwert',
  'password': 'qwerty',
  'base64EncodedCallback': '123'
};

var notSequencedRequest = {
  'password': 'qwerty',
  'base64EncodedCallback': '123',
  'username': 'qwert',
  'forceOverwrite': true,
  'fileMode': 1,
  'fileName': 'qwe.txt',
  'url': 'https://github.com'
};

describe('Method args sequence', function() {

  it('check if method required sequence args', function(done) {
    soap.createClient(__dirname + '/wsdl/rpcexample.wsdl', {suffix: '', useSequence: true}, function(err, client) {
      assert.ok(client);
      assert.ok(client._isSequenceRequired('pullFile') === false);

      soap.createClient(__dirname + '/wsdl/sequnceexmple.wsdl', {suffix: '', useSequence: true}, function(err, client) {
        assert.ok(client);
        assert.ok(client._isSequenceRequired('pullFile') === true);
        done();
      });
    });
  });

  it('check sort args on sequence required method', function(done) {
    soap.createClient(__dirname + '/wsdl/sequnceexmple.wsdl', {suffix: '', useSequence: true}, function(err, client) {
      assert.ok(client);
      var sequencedMethodRequest = client._setSequenceArgs(client._getArgsScheme('pullFile'), notSequencedRequest);
      assert.ok(JSON.stringify(sequencedMethodRequest) === JSON.stringify(sequencedRequest));
      done();
    });
  });

});
