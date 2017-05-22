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

var argsScheme = {
  "ChaveIdentificacao": "s:string",
  "ListaDeClientes": {
    "DadosClientes[]": {
      "EMail": "s:string",
      "CPFouCNPJ": "s:string",
      "Codigo": "s:string",
    }
  }
};

var args = {
  "ChaveIdentificacao": "xxxxx-xxxxx-xxxxx-xxxxx-xxxxx",
  "ListaDeClientes": {
    "DadosClientes": {
      "EMail": "alanmarcell@live.com",
      "CPFouCNPJ": "00000000000",
      "Codigo": "9999"
    }
  }
};


describe('Method args sequence', function () {

  it('check if method required sequence args', function (done) {
    soap.createClient(__dirname + '/wsdl/rpcexample.wsdl', {
      suffix: '',
      options: {}
    }, function (err, client) {
      assert.ok(client);
      assert.ok(client._isSequenceRequired('pullFile') === false);

      soap.createClient(__dirname + '/wsdl/sequnceexmple.wsdl', {
        suffix: '',
        options: {}
      }, function (err, client) {
        assert.ok(client);
        assert.ok(client._isSequenceRequired('pullFile') === true);
        done();
      });
    });
  });

  it('check sort args on sequence required method', function (done) {
    soap.createClient(__dirname + '/wsdl/sequnceexmple.wsdl', {
      suffix: '',
      options: {}
    }, function (err, client) {
      assert.ok(client);
      var sequencedMethodRequest = client._setSequenceArgs(client._getArgsScheme('pullFile'), notSequencedRequest);
      assert.ok(JSON.stringify(sequencedMethodRequest) === JSON.stringify(sequencedRequest));
      done();
    });
  });

  it('should run setSequence ignoring brackets', function (done) {
    soap.createClient(__dirname + '/wsdl/sequnceexmple.wsdl', {
      suffix: '',
      options: {}
    }, function (err, client) {
      assert.ok(client);
      var sequencedMethodRequest = client._setSequenceArgs(argsScheme, args);
      assert.ok(JSON.stringify(sequencedMethodRequest.ListaDeClientes) === JSON.stringify(args.ListaDeClientes))
      done();
    });
  });
});
