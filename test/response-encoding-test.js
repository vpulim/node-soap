'use strict';

var assert = require('assert');
var http = require('http');
var soap = require('../lib/soap');
var server;

describe('Preserve data encoding from endpoint response', function () {
  var wsdl = __dirname + '/wsdl/hello.wsdl';
  var expectedString = "àáÁÉÈÀçãü";
  var xml = `<?xml version=\"1.0\" encoding=\"iso-8859-1\"?><soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\"  xmlns:tns=\"http://www.examples.com/wsdl/HelloService.wsdl\"><soap:Body><tns:sayHelloResponse>${expectedString}</tns:sayHelloResponse></soap:Body></soap:Envelope>`;
  var xmlEncoded = Buffer.from(
    xml,
    "binary"
  );

  before(function (done) {
    server = http.createServer(function (req, res) {
      res.statusCode = 200;
      res.end(xmlEncoded);
    }).listen(51515, done);
  });

  after(function () {
    server.close();
  });

  it('Should read special characters with enconding option with success',
    function (done) {
      var url = 'http://' + server.address().address + ':' + server.address().port;

      if (server.address().address === '0.0.0.0' || server.address().address === '::') {
        url = 'http://127.0.0.1:' + server.address().port;
      }

      soap.createClient(
        wsdl,
        {
          endpoint: url,
          disableCache: true, // disable wsdl cache, otherwise 'mocha test/client-response-options-test.js test/response-preserve-whitespace-test.js' will fail.
          parseReponseAttachments: true,
          encoding: 'latin1',
        },
        function (err, client) {
          if (err) {
            console.log(err);
            throw err;
          }

          client.sayHello(
            {
              firstName: 'hello world'
            },
            function (err, result, rawResponse, soapHeader, rawRequest) {
              if (err) {
                console.log(err);
                throw err;
              }

              assert.strictEqual(expectedString, result);
              done();
            }
          );
        }
      );
    });

  it('Should read special characters with enconding option with error',
    function (done) {
      var url = 'http://' + server.address().address + ':' + server.address().port;

      if (server.address().address === '0.0.0.0' || server.address().address === '::') {
        url = 'http://127.0.0.1:' + server.address().port;
      }

      soap.createClient(
        wsdl,
        {
          endpoint: url,
          disableCache: true, // disable wsdl cache, otherwise 'mocha test/client-response-options-test.js test/response-preserve-whitespace-test.js' will fail.
          parseReponseAttachments: true,
        },
        function (err, client) {
          if (err) {
            console.log(err);
            throw err;
          }

          client.sayHello(
            {
              firstName: 'hello world'
            },
            function (err, result, rawResponse, soapHeader, rawRequest) {
              if (err) {
                console.log(err);
                throw err;
              }
              assert.strictEqual('���������', result);
              done();
            }
          );
        }
      );
    });

});
