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

wsdlNonStrictTests['should parse complex json object'] = function(done) {
  soap.createClient(__dirname+'/wsdl/complexJson.wsdl', function(err, client) {
    assert.ok(!err);
    var args = {
        "AdminOperation": {
            "CreateUser": {
                "User": {
                    "Name": "name",
                    "Password": "password"
                  },
                  "IgnoreDup":""
                }
              }
            };

    client.administrate(args, function(err, result) {
      var lastMsg = client.lastRequest;
      //console.log(lastMsg.indexOf("undefined") > -1);
      //console.log(lastMsg);
      assert.notEqual((lastMsg.indexOf("undefined") > -1), true);

    });

    done();
  });
};

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
  soap.createClient(__dirname+'/wsdl/bad.txt', function(err) {
    assert.notEqual(err, null);
    done();
  });
};

module.exports = {
  'WSDL Parser (strict)': wsdlStrictTests,
  'WSDL Parser (non-strict)': wsdlNonStrictTests
};
