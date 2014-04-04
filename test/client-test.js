"use strict";

var fs = require('fs'),
    soap = require('..'),
    http = require('http'),
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

  it('should issue async callback for cached wsdl', function(done) {
    var called = false;
    soap.createClient(__dirname+'/wsdl/default_namespace.wsdl', function(err, client) {
      assert.ok(client);
      assert.ok(!err);
      called = true;
      done();
    });
    assert(!called);
  });
  
  describe('Extra headers in request and last response', function() {
    var server = null;
    var hostname = '127.0.0.1';
    var port = 15099;
    var baseUrl = 'http://' + hostname + ":" + port;
    
    before(function(done) {
      server = http.createServer(function (req, res) {
        var status_value = (req.headers["test-header"] === 'test') ? 'pass' : 'fail';

        res.setHeader('status', status_value);
        res.statusCode = 200;
        res.write(JSON.stringify({tempResponse: "temp"}), 'utf8');
        res.end();
      }).listen(port, hostname, done);
    });

    after(function(done) {
      server.close();
      server = null;
      done();
    });
    
    it('should have the correct extra header in the request', function(done) {
      soap.createClient(__dirname+'/wsdl/default_namespace.wsdl', function(err, client) {
        assert.ok(client);
        assert.ok(!err);
        
        client.MyOperation({}, function(err, result) {
          assert.ok(result);
          assert.ok(client.lastResponseHeaders);
          assert.equal(client.lastResponseHeaders.status, 'pass');
          
          done();
        }, null, {"test-header": 'test'});
      }, baseUrl);
    });
    
    it('should have the wrong extra header in the request', function(done) {
      soap.createClient(__dirname+'/wsdl/default_namespace.wsdl', function(err, client) {
        assert.ok(client);
        assert.ok(!err);
        
        client.MyOperation({}, function(err, result) {
          assert.ok(result);
          assert.ok(client.lastResponseHeaders);
          assert.equal(client.lastResponseHeaders.status, 'fail');
          
          done();
        }, null, {"test-header": 'testBad'});
      }, baseUrl);
    });
    
    it('should have lastResponse and lastResponseHeaders after the call', function(done) {
      soap.createClient(__dirname+'/wsdl/default_namespace.wsdl', function(err, client) {
        assert.ok(client);
        assert.ok(!err);
        
        client.MyOperation({}, function(err, result) {
          assert.ok(result);
          assert.ok(client.lastResponse);
          assert.ok(client.lastResponseHeaders);
          
          done();
        }, null, {"test-header": 'test'});
      }, baseUrl);
    });

  });

  
  it('should add soap headers', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', function (err, client) {
            assert.ok(client);
            assert.ok(!client.getSoapHeaders());
            var soapheader = {
              "esnext": false,
              "moz": true,
              "boss": true,
              "node": true,
              "validthis": true,
              "globals": {
                "EventEmitter": true,
                "Promise": true
              }
            };
            client.addSoapHeader(soapheader);
            assert.ok(client.getSoapHeaders()[0] === '<esnext>false</esnext><moz>true</moz><boss>true</boss><node>true</node><validthis>true</validthis><globals><EventEmitter>true</EventEmitter><Promise>true</Promise></globals>');
            done();
          });
      });
  
});
