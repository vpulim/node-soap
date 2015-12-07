"use strict";

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
});

fs.readdirSync(__dirname+'/wsdl').forEach(function(file) {
  if (!/.wsdl$/.exec(file)) return;
  wsdlNonStrictTests['should parse and describe '+file] = function(done) {
    soap.createClient(__dirname+'/wsdl/'+file, function(err, client) {
      assert.ok(!err);
      client.describe();
      done();
    });
  };
});

wsdlNonStrictTests['should not parse connection error'] = function(done) {
  soap.createClient(__dirname+'/wsdl/connection/econnrefused.wsdl', function(err, client) {
    assert.ok(/EADDRNOTAVAIL|ECONNREFUSED/.test(err), err);
    done();
  });
};

wsdlNonStrictTests['should catch parse error'] = function(done) {
  soap.createClient(__dirname+'/wsdl/bad.txt', function(err) {
    assert.notEqual(err, null);
    done();
  });
};

wsdlStrictTests['should catch parse error'] = function(done) {
  soap.createClient(__dirname+'/wsdl/bad.txt', {strict: true}, function(err) {
    assert.notEqual(err, null);
    done();
  });
};

wsdlStrictTests['should parse external wsdl'] = function(done) {
  soap.createClient(__dirname+'/wsdl/wsdlImport/main.wsdl', {strict: true}, function(err, client){
    assert.ok(!err);
    assert.deepEqual(Object.keys(client.wsdl.definitions.schemas),
      ['http://example.com/', 'http://schemas.microsoft.com/2003/10/Serialization/Arrays']);
    assert.equal(typeof client.getLatestVersion, 'function');
    done();
  });
};

wsdlStrictTests['should get the parent namespace when parent namespace is empty string'] = function(done) {
  soap.createClient(__dirname+'/wsdl/marketo.wsdl', {strict: true}, function(err, client){
    assert.ok(!err);
    client.getLeadChanges({
        batchSize: 1,
        startPosition: {activityCreatedAt: '2014-04-14T22:03:48.587Z'},
        activityNameFilter: {stringItem: ['Send Email']}
      }, function() {
        done();
      });
  });
};

wsdlStrictTests['should handle element ref'] = function(done) {
  var expectedMsg = '<ns1:fooRq xmlns:ns1="http://example.com/bar/xsd"' +
    ' xmlns="http://example.com/bar/xsd"><bar1:paymentRq' +
    ' xmlns:bar1="http://example.com/bar1/xsd">' +
    '<bar1:bankSvcRq>' +
    '<bar1:requestUID>001</bar1:requestUID></bar1:bankSvcRq>' +
    '</bar1:paymentRq></ns1:fooRq>';
  soap.createClient(__dirname + '/wsdl/elementref/foo.wsdl', {strict: true}, function(err, client) {
    assert.ok(!err);
    client.fooOp({paymentRq: {bankSvcRq: {requestUID: '001'}}}, function(err, result) {
      assert.equal(client.lastMessage, expectedMsg);
      done();
    });
  });
};

wsdlStrictTests['should handle type ref'] = function(done) {
  var expectedMsg = require('./wsdl/typeref/request.xml.js');
  var reqJson = require('./wsdl/typeref/request.json');
  soap.createClient(__dirname + '/wsdl/typeref/order.wsdl', {strict: true}, function(err, client) {
    assert.ok(!err);
    client.order(reqJson, function(err, result) {
      assert.equal(client.lastMessage, expectedMsg);
      done();
    });
  });
};

wsdlStrictTests['should get empty namespace prefix'] = function(done) {
  var expectedMsg = '<ns1:fooRq xmlns:ns1="http://example.com/bar/xsd"' +
    ' xmlns="http://example.com/bar/xsd"><bar1:paymentRq' +
    ' xmlns:bar1="http://example.com/bar1/xsd">' +
    '<bar1:bankSvcRq>' +
    '<requestUID>001</requestUID></bar1:bankSvcRq>' +
    '</bar1:paymentRq></ns1:fooRq>';
  // var expectedMsg = 'gg';

  soap.createClient(__dirname + '/wsdl/elementref/foo.wsdl', {strict: true}, function(err, client) {
    assert.ok(!err);
    client.fooOp({paymentRq: {bankSvcRq: {':requestUID': '001'}}}, function(err, result) {
      assert.equal(client.lastMessage, expectedMsg);
      done();
    });
  });
};

module.exports = {
  'WSDL Parser (strict)': wsdlStrictTests,
  'WSDL Parser (non-strict)': wsdlNonStrictTests
};
