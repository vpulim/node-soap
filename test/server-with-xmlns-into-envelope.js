'use strict';

var fs = require('fs');
var http = require('http');
var assert = require('assert');
var finalHandler = require('finalhandler');
var serveStatic = require('serve-static');
var soap = require('..');

var WSDL_URL = __dirname + '/wsdl/strict/stockquote-url.wsdl';
var CHARSET = 'utf8';
var service = {
  StockQuoteService: {
    StockQuotePort: {
      GetLastTradePrice: function (args) {
        if (args.tickerSymbol === 'trigger error') {
          throw new Error('triggered server error');
        } else {
          return { price: 19.56 };
        }
      },
    },
  },
};

function createSoapServer(server, options) {
  options = options || {};
  var soapServer = soap.listen(server, options);
  assert.ok(soapServer);
  return soapServer;
}

describe('SOAP Server (xmlns into envelope)', function () {
  var serve = serveStatic('./test/wsdl/strict');

  it('should include `soap wsdl` xmlns into envelope', function (done) {
    var httpServer = http.createServer(function (req, res) {
      var done = finalHandler(req, res);
      serve(req, res, done);
    }).listen(51515);
    var xmlnsIntoEnvelope = [
      'soap',
      'wsdl',
    ];
    var options = {
      path: '/stockquote-url',
      services: service,
      xml: fs.readFileSync(WSDL_URL, CHARSET),
      xmlnsIntoEnvelope: xmlnsIntoEnvelope,
    };
    createSoapServer(httpServer, options);
    soap.createClient(WSDL_URL, options, function (err, client) {
      assert.ifError(err);
      assert.ok(client);
      var xmlnsInEnvelope = client.wsdl.xmlnsInEnvelope;
      while (xmlnsIntoEnvelope.length) {
        var containsXmlsns = xmlnsInEnvelope.indexOf(':' + xmlnsIntoEnvelope.pop() + '=') > -1;
        assert.ok(containsXmlsns);
      }

      httpServer.close(function () {
        done();
      });
    });
  });
});
