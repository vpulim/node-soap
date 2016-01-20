"use strict";

var fs = require('fs'),
    soap = require('..'),
    assert = require('assert'),
    request = require('request'),
    http = require('http'),
    lastReqAddress;

var test = {};
test.server = null;
test.service = {
  TestService: {
    TestServicePort: {
      GetTestMessage: function (args, cb, soapHeader) {
          console.log(args);
          if (args.message === "Hello World! & Hello Me!") {
            console.log("ok");
            return cb({response:"OK"});
          }
          return cb({response:"FAIL"});
        },
    }
  }
};

describe('TestSOAP Server', function() {
  before(function(done) {
    fs.readFile(__dirname + '/wsdl/strict/cdata-test.wsdl', 'utf8', function(err, data) {
      assert.ok(!err);
      test.wsdl = data;
      done();
    });
  });

  beforeEach(function(done) {
    test.server = http.createServer(function(req, res) {
      res.statusCode = 404;
      res.end();
    });

    test.server.listen(15099, null, null, function() {
      test.soapServer = soap.listen(test.server, '/testservice', test.service, test.wsdl);
      test.baseUrl =
        'http://' + test.server.address().address + ":" + test.server.address().port;

      //windows return 0.0.0.0 as address and that is not
      //valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl =
          'http://127.0.0.1:' + test.server.address().port;
      }

      done();
    });
  });

  afterEach(function(done) {
    test.server.close(function() {
      test.server = null;
      delete test.soapServer;
      test.soapServer = null;
      done();
    });
  });


  it('should be running', function(done) {
    request(test.baseUrl, function(err, res, body) {
      assert.ok(!err);
      done();
    });
  });

  it('should return properly encoded CDATA', function(done) {
    soap.createClient(test.baseUrl + '/testservice?wsdl', function(err, client) {
      assert.ok(!err);
      client.GetTestMessage({ message: '<![CDATA[Hello World! & Hello Me!]]>' }, function(err, response, body) {
        console.log(body);
        assert.ok(!err);
        assert.ok(body.match(/<response>OK<\/response>/));
        done();
      });
    });
  });
});
