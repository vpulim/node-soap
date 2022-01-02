"use strict";

var fs = require('fs'),
  http = require('http'),
  assert = require('assert'),
  soap = require('..');

var test = {};
test.server = null;
test.authenticate = null;
test.authenticateProxy = function authenticate(security, callback) {
  return test.authenticate(security, callback);
};
test.service = {
  StockQuoteService: {
    StockQuotePort: {
      GetLastTradePrice: function (args, cb, soapHeader) {
        return { price: 19.56 };
      }
    }
  }
};

describe('SOAP Server', function () {
  before(function (done) {
    fs.readFile(__dirname + '/wsdl/strict/stockquote.wsdl', 'utf8', function (err, data) {
      assert.ifError(err);
      test.wsdl = data;
      done();
    });
  });

  beforeEach(function (done) {
    test.server = http.createServer(function (req, res) {
      res.statusCode = 404;
      res.end();
    });

    test.server.listen(15099, null, null, function () {
      test.soapServer = soap.listen(test.server, '/stockquote', test.service, test.wsdl);
      test.soapServer.authenticate = test.authenticateProxy;
      var testSv = test.server.address();
      test.baseUrl = `http://${testSv.address}:${testSv.port}`;

      // windows return 0.0.0.0 as address and that is not valid to use in a request
      if (testSv.address === '0.0.0.0' || testSv.address === '::') {
        test.baseUrl = `http://127.0.0.1:${testSv.port}`;
      }

      done();
    });
  });

  afterEach(function (done) {
    test.server.close(function () {
      test.server = null;
      test.authenticate = null;
      delete test.soapServer;
      test.soapServer = null;
      done();
    });
  });

  it('should succeed on valid synchronous authentication', function (done) {
    test.authenticate = function (security, callback) {
      setTimeout(function delayed() {
        callback(false); // Ignored
      }, 10);
      return true;
    };

    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);

      client.GetLastTradePrice({ tickerSymbol: 'AAPL' }, function (err, result) {
        assert.ifError(err);
        assert.equal(19.56, parseFloat(result.price));
        done();
      });
    });
  });

  it('should succeed on valid asynchronous authentication', function (done) {
    test.authenticate = function (security, callback) {
      setTimeout(function delayed() {
        callback(true);
      }, 10);
      return null; // Ignored
    };

    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);

      client.GetLastTradePrice({ tickerSymbol: 'AAPL' }, function (err, result) {
        assert.ifError(err);
        assert.equal(19.56, parseFloat(result.price));
        done();
      });
    });
  });

  it('should succeed on valid promise authentication', function (done) {
    test.authenticate = function (security) {
      return new Promise((resolve) => {
        setTimeout(function delayed() {
          resolve(true);
        }, 10);
      })
    };

    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);

      client.GetLastTradePrice({ tickerSymbol: 'AAPL' }, function (err, result) {
        assert.ifError(err);
        assert.equal(19.56, parseFloat(result.price));
        done();
      });
    });
  });

  it('should fail on invalid synchronous authentication', function (done) {
    test.authenticate = function (security, callback) {
      setTimeout(function delayed() {
        callback(true); // Ignored
      }, 10);
      return false;
    };

    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);

      client.GetLastTradePrice({ tickerSymbol: 'AAPL' }, function (err, result) {
        assert.ok(err);
        assert.ok(err.root.Envelope.Body.Fault.Code.Value);
        assert.equal(err.root.Envelope.Body.Fault.Code.Value, 'SOAP-ENV:Client');
        assert.ok(err.root.Envelope.Body.Fault.Code.Subcode.Value);
        assert.equal(err.root.Envelope.Body.Fault.Code.Subcode.Value, 'AuthenticationFailure');
        done();
      });
    });
  });

  it('should fail on invalid asynchronous authentication', function (done) {
    test.authenticate = function (security, callback) {
      setTimeout(function delayed() {
        callback(false);
      }, 10);
    };

    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);

      client.GetLastTradePrice({ tickerSymbol: 'AAPL' }, function (err, result) {
        assert.ok(err);
        assert.ok(err.root.Envelope.Body.Fault.Code.Value);
        assert.equal(err.root.Envelope.Body.Fault.Code.Value, 'SOAP-ENV:Client');
        assert.ok(err.root.Envelope.Body.Fault.Code.Subcode.Value);
        assert.equal(err.root.Envelope.Body.Fault.Code.Subcode.Value, 'AuthenticationFailure');
        done();
      });
    });
  });

  it('should fail on invalid promise authentication', function (done) {
    test.authenticate = function (security) {
      return new Promise((resolve) => {
        setTimeout(function delayed() {
          resolve(false);
        }, 10);
      })
    };

    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);

      client.GetLastTradePrice({ tickerSymbol: 'AAPL' }, function (err, result) {
        assert.ok(err);
        assert.ok(err.root.Envelope.Body.Fault.Code.Value);
        assert.equal(err.root.Envelope.Body.Fault.Code.Value, 'SOAP-ENV:Client');
        assert.ok(err.root.Envelope.Body.Fault.Code.Subcode.Value);
        assert.equal(err.root.Envelope.Body.Fault.Code.Subcode.Value, 'AuthenticationFailure');
        done();
      });
    });
  });

  it('should return an internal error on asynchronous authentication returning an error object', function (done) {
    test.authenticate = function (security, callback) {
      setTimeout(function delayed() {
        callback(new Error('test'));
      }, 10);
    };

    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);

      client.GetLastTradePrice({ tickerSymbol: 'AAPL' }, function (err, result) {
        assert.ok(err);
        assert.ok(err.root.Envelope.Body.Fault.Code.Value);
        assert.equal(err.root.Envelope.Body.Fault.Code.Value, 'SOAP-ENV:Server');
        assert.ok(err.root.Envelope.Body.Fault.Code.Subcode.Value);
        assert.equal(err.root.Envelope.Body.Fault.Code.Subcode.Value, 'InternalServerError');
        done();
      });
    });
  });

  it('should return an internal error on promise authentication throwing an error', function (done) {
    test.authenticate = function (security) {
      return new Promise((resolve) => {
        throw new Error('test');
      });
    };

    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);

      client.GetLastTradePrice({ tickerSymbol: 'AAPL' }, function (err, result) {
        assert.ok(err);
        assert.ok(err.root.Envelope.Body.Fault.Code.Value);
        assert.equal(err.root.Envelope.Body.Fault.Code.Value, 'SOAP-ENV:Server');
        assert.ok(err.root.Envelope.Body.Fault.Code.Subcode.Value);
        assert.equal(err.root.Envelope.Body.Fault.Code.Subcode.Value, 'InternalServerError');
        done();
      });
    });
  });
});
