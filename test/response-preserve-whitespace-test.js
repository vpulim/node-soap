'use strict';

var request = require('request');
var assert = require('assert');
var http = require('http');
var soap = require('../');
var server;
var port;

describe('Preverse whitespace', function() {
  var wsdl = __dirname + '/wsdl/hello.wsdl';

  before(function(done) {
    server = http.createServer(function(req, res) {
      res.statusCode = 200;
      res.end('"<?xml version=\"1.0\" encoding=\"utf-8\"?><soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\"  xmlns:tns=\"http://www.examples.com/wsdl/HelloService.wsdl\"><soap:Body><tns:sayHelloResponse><tns:greeting> </tns:greeting></tns:sayHelloResponse></soap:Body></soap:Envelope>"');
    }).listen(51515, done);
  });

  after(function() {
    server.close();
  });

  it('preserves leading and trailing whitespace when preserveWhitespace option is true',
    function(done) {
      var url = 'http://' + server.address().address + ':' + server.address().port;

      if (server.address().address === '0.0.0.0' || server.address().address === '::') {
        url = 'http://127.0.0.1:' + server.address().port;
      }

      soap.createClient(
        wsdl,
        {
          endpoint: url,
          disableCache: true, // disable wsdl cache, otherwise 'mocha test/client-response-options-test.js test/response-preserve-whitespace-test.js' will fail.
          preserveWhitespace: true
        },
        function(err, client) {
          if (err) {
            console.log(err);
            throw err;
          }

          client.sayHello(
            {
              firstName: 'hello world'
            },
            function(err, result, rawResponse, soapHeader, rawRequest) {
              if (err) {
                console.log(err);
                throw err;
              }
              assert.equal(' ', result.greeting);
              done();
            }
          );
        }
      );
    });

});
