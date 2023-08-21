"use strict";

var fs = require('fs'),
  soap = require('..'),
  https = require('https'),
  constants = require('constants'),
  assert = require('assert');

var test = {};
test.service = {
  StockQuoteService: {
    StockQuotePort: {
      GetLastTradePrice: function (args) {
        if (args.tickerSymbol === 'trigger error') {
          throw new Error('triggered server error');
        } else {
          return { price: 19.56 };
        }
      }
    }
  }
};

test.sslOptions = {
  key: fs.readFileSync(__dirname + '/certs/agent2-key.pem'),
  cert: fs.readFileSync(__dirname + '/certs/agent2-cert.pem')
};

describe('SOAP Client(SSL)', function () {
  before(function (done) {
    fs.readFile(__dirname + '/wsdl/strict/stockquote.wsdl', 'utf8', function (err, data) {
      assert.ifError(err);
      test.wsdl = data;
      done();
    });
  });

  beforeEach(function (done) {
    test.server = https.createServer(test.sslOptions, function (req, res) {
      res.statusCode = 404;
      res.end();
    }).listen(51515, function () {
      var testSv = test.server.address();
      test.soapServer = soap.listen(test.server, '/stockquote', test.service, test.wsdl);
      test.baseUrl = `https://${testSv.address}:${testSv.port}`;

      if (testSv.address === '0.0.0.0' || testSv.address === '::') {
        test.baseUrl = 'https://127.0.0.1:' + testSv.port;
      }
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

  it('should connect to an SSL server', function (done) {
    soap.createClient(__dirname + '/wsdl/strict/stockquote.wsdl', function (err, client) {
      assert.ifError(err);
      client.setEndpoint(test.baseUrl + '/stockquote');
      client.setSecurity({
        addOptions: function (options) {
          options.cert = test.sslOptions.cert;
          options.key = test.sslOptions.key;
          options.rejectUnauthorized = false;
          options.secureOptions = constants.SSL_OP_NO_TLSv1_2;
          options.strictSSL = false;
          options.agent = new https.Agent(options);
        },
        toXML: function () { return ''; }
      });

      client.GetLastTradePrice({ tickerSymbol: 'AAPL' }, function (err, result) {
        if (err.code == 'CERT_HAS_EXPIRED' || err.code == 'DEPTH_ZERO_SELF_SIGNED_CERT') {
          done();
        } else {
          assert.ifError(err);
          assert.equal(19.56, parseFloat(result.price));
          done();
        }
      });
    });
  });

});
