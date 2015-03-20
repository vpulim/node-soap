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
      GetLastTradePrice: function(args, cb, soapHeader) {
        if (soapHeader)
          return { price: soapHeader.SomeToken };
        if (args.tickerSymbol === 'trigger error') {
          throw new Error('triggered server error');
        } else if (args.tickerSymbol === 'SOAP Fault') {
          throw {
            Fault: {
              Code: {
                Value: "soap:Sender",
                Subcode: { value: "rpc:BadArguments" }
              },
              Reason: { Text: "Processing Error" }
            }
          };
        } else {
          return { price: 19.56 };
        }
      },

      SetTradePrice: function(args, cb, soapHeader) {
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

  it('should handle headers in request', function(done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function(err, client) {
      assert.ok(!err);
      client.addSoapHeader('<SomeToken>123.45</SomeToken>');
      client.GetLastTradePrice({ tickerSymbol: 'AAPL'}, function(err, result) {
        assert.ok(!err);
        assert.equal(123.45, parseFloat(result.price));
        done();
      });
    });
  });

  it('should return security timestamp in response', function(done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function(err, client) {
      assert.ok(!err);
      client.addSoapHeader('<Security><Timestamp><Created>2015-02-23T12:00:00.000Z</Created><Expires>2015-02-23T12:05:00.000Z</Expires></Timestamp></Security>');
      client.GetLastTradePrice({ tickerSymbol: 'AAPL'}, function(err, result, raw, soapHeader) {
        assert.ok(!err);
        assert.ok(soapHeader && soapHeader.Security && soapHeader.Security.Timestamp);
        done();
      });
    });
  });

  it('should emit \'request\' event', function(done) {
    test.soapServer.on('request', function requestManager(request, methodName) {
      assert.equal(methodName, 'GetLastTradePrice');
      done();
    });
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function(err, client) {
      assert.ok(!err);
      client.GetLastTradePrice({ tickerSymbol: 'AAPL'}, function() {});
    });
  });

  it('should emit \'headers\' event', function(done) {
    test.soapServer.on('headers', function headersManager(headers, methodName) {
      assert.equal(methodName, 'GetLastTradePrice');
      headers.SomeToken = 0;
    });
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function(err, client) {
      assert.ok(!err);
      client.addSoapHeader('<SomeToken>123.45</SomeToken>');
      client.GetLastTradePrice({ tickerSymbol: 'AAPL'}, function(err, result) {
        assert.ok(!err);
        assert.equal(0, parseFloat(result.price));
        done();
      });
    });
  });

  it('should not emit the \'headers\' event when there are no headers', function(done) {
    test.soapServer.on('headers', function headersManager(headers, methodName) {
      assert.ok(false);
    });
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function(err, client) {
      assert.ok(!err);
      client.GetLastTradePrice({ tickerSymbol: 'AAPL'}, function(err, result) {
        assert.ok(!err);
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

  it('should return SOAP Fault body', function(done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function(err, client) {
      assert.ok(!err);
      client.GetLastTradePrice({ tickerSymbol: 'SOAP Fault' }, function(err, response, body) {
        assert.ok(err);
        var fault = err.root.Envelope.Body.Fault;
        assert.equal(fault.Code.Value, "soap:Sender");
        assert.equal(fault.Reason.Text, "Processing Error");
        done();
      });
    });
  });

  it('should return SOAP Fault thrown from \'headers\' event handler', function(done) {
    test.soapServer.on('headers', function headersManager() {
      throw {
        Fault: {
          Code: {
            Value: "soap:Sender",
            Subcode: { value: "rpc:BadArguments" }
          },
          Reason: { Text: "Processing Error" }
        }
      };
    });
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function(err, client) {
      client.addSoapHeader('<SomeToken>0.0</SomeToken>');
      client.GetLastTradePrice({ tickerSymbol: 'AAPL'}, function(err, result) {
        assert.ok(err);
        assert.ok(err.root.Envelope.Body.Fault);
        done();
      });
    });
  });

  it('should accept attributes as a string on the body element', function(done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function(err, client) {
      assert.ok(!err);
      client.addBodyAttribute('xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" wsu:Id="######################"');
      client.GetLastTradePrice({ tickerSymbol: 'AAPL' }, function(err, response, body) {
        assert.ok(!err);
        done();
      });
    });
  });

  it('should accept attributes as an object on the body element', function(done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function(err, client) {
      assert.ok(!err);
      var attributes = { 'xmlns:wsu': 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd', 'wsu:Id': '######################' };
      client.addBodyAttribute(attributes);
      client.GetLastTradePrice({ tickerSymbol: 'AAPL' }, function(err, response, body) {
        assert.ok(!err);
        done();
      });
    });
  });

  it('should handle one-way operations', function(done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function(err, client) {
      assert.ok(!err);
      client.SetTradePrice({ tickerSymbol: 'GOOG', price: 575.33 }, function(err, result) {
        assert.ok(!err);
        assert.equal(result,null);
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
