"use strict";

var fs = require('fs'),
    soap = require('..'),
    assert = require('assert'),
    request = require('request'),
    http = require('http');

var test = {};
test.server = null;
test.service = {
  StockQuoteService: {
    StockQuotePort: {
      GetLastTradePrice: function(args) {
        if (args.tickerSymbol === 'trigger error') {
          throw new Error('triggered server error');
        } else {
          return { price: 19.56 };
        }
      }
    }
  }
};

describe('SOAP Server', function() {
  before(function(done) {
    fs.readFile(__dirname + '/wsdl/strict/stockquote.wsdl', 'utf8', function(err, data) {
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
      test.soapServer = soap.listen(test.server, '/stockquote', test.service, test.wsdl);
      test.baseUrl =
        'http://' + test.server.address().address + ":" + test.server.address().port;
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

  it('should 404 on non-WSDL path', function(done) {
    request(test.baseUrl, function(err, res, body) {
      assert.ok(!err);
      assert.equal(res.statusCode, 404);
      done();
    });
  });

  it('should server up WSDL', function(done) {
    request(test.baseUrl + '/stockquote?wsdl', function(err, res, body) {
      assert.ok(!err);
      assert.equal(res.statusCode, 200);
      assert.ok(body.length);
      done();
    });
  });

  it('should return complete client description', function(done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function(err, client) {
      assert.ok(!err);
      var description = client.describe(),
          expected = { input: { tickerSymbol: "string" }, output:{ price: "float" } };
      assert.deepEqual(expected , description.StockQuoteService.StockQuotePort.GetLastTradePrice);
      done();
    });
  });

  it('should return correct results', function(done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function(err, client) {
      assert.ok(!err);
      client.GetLastTradePrice({ tickerSymbol: 'AAPL'}, function(err, result) {
        assert.ok(!err);
        assert.equal(19.56, parseFloat(result.price));
        done();
      });
    });
  });

  it('should include response and body in error object', function(done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function(err, client) {
      assert.ok(!err);
      client.GetLastTradePrice({ tickerSymbol: 'trigger error' }, function(err, response, body) {
        assert.ok(err);
        assert.strictEqual(err.response, response);
        assert.strictEqual(err.body, body);
        done();
      });
    });
  });

// NOTE: this is actually a -client- test
/*
it('should return a valid error if the server stops responding': function(done) {
  soap.createClient(test.baseUrl + '/stockquote?wsdl', function(err, client) {
    assert.ok(!err);
    server.close(function() {
      server = null;
      client.GetLastTradePrice({ tickerSymbol: 'trigger error' }, function(err, response, body) {
        assert.ok(err);
        done();
      });
    });
  });
});
*/

});
