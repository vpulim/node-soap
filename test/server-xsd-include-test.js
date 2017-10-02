"use strict";

var fs = require('fs'),
  soap = require('..'),
  http = require('http'),
  assert = require('assert'),
  events = require('events'),
  finalHandler = require('finalhandler'),
  serveStatic = require('serve-static');

var test = {};

test.service = {
  StockQuoteService: {
    StockQuotePort: {
      GetLastTradePrice: function (args) {
        if (args.tickerSymbol === 'trigger error') {
          throw new Error('triggered server error');
        } else {
          return {price: 19.56};
        }
      }
    }
  }
};

describe('SOAP Server(XSD include)', function () {
  before(function (done) {
    fs.readFile(__dirname + '/wsdl/strict/stockquote-url.wsdl', 'utf8', function (err, data) {
      assert.ifError(err);
      test.wsdl = data;
      done();
    });
  });
  
  beforeEach(function (done) {
    var serve = serveStatic("./test/wsdl/strict");
    test.server = http.createServer(function (req, res) {
      var done = finalHandler(req, res);
      serve(req, res, done);
    }).listen(51515, null, null, function () {
      var pathOrOptions = '/stockquote-url';
      test.soapServer = soap.listen(test.server, pathOrOptions, test.service, test.wsdl);
      
      test.baseUrl = 'http://' + test.server.address().address + ':' + test.server.address().port;
      
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl = 'http://127.0.0.1:' + test.server.address().port;
      }
      
      assert.ok(test.soapServer);
      done();
    });
  });
  
  afterEach(function (done) {
    test.server.close(function () {
      test.server = null;
      delete test.soapServer;
      test.soapServer = null;
      done();
    });
  });
  
  
  it('should allow `http` in `schemaLocation` attribute in `xsd:include` tag', function (done) {
    var url = __dirname + '/wsdl/strict/stockquote-url.wsdl';
    
    soap.createClient(url, function (err, client) {
      assert.ifError(err);
      assert.ok(client);
      done();
    });
  });
  
});
