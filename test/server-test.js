"use strict";

var fs = require('fs'),
  http = require('http'),
  assert = require('assert'),
  axios = require('axios'),
  soap = require('..'),
  path = require('path');

var request = axios.default.create();
var lastReqAddress;
var test = {};

test.server = null;
test.service = {
  StockQuoteService: {
    StockQuotePort: {
      GetLastTradePrice: function (args, cb, soapHeader) {
        if (soapHeader)
          return { price: soapHeader.SomeToken };
        if (args.tickerSymbol === 'trigger error') {
          throw new Error('triggered server error');
        } else if (args.tickerSymbol === 'Async') {
          return cb({ price: 19.56 });
        } else if (args.tickerSymbol === 'Promise Error') {
          return new Promise((resolve, reject) => {
            reject(new Error('triggered server error'));
          });
        } else if (args.tickerSymbol === 'Promise') {
          return new Promise((resolve) => {
            resolve({ price: 13.76 });
          });
        } else if (args.tickerSymbol === 'SOAP Fault v1.2') {
          throw {
            Fault: {
              Code: {
                Value: "soap:Sender",
                Subcode: { value: "rpc:BadArguments" }
              },
              Reason: { Text: "Processing Error" }
            }
          };
        } else if (args.tickerSymbol === 'SOAP Fault v1.1') {
          throw {
            Fault: {
              faultcode: "soap:Client.BadArguments",
              faultstring: "Error while processing arguments"
            }
          };
        } else {
          return { price: 19.56, tax: -1.23, other: 20.001 };
        }
      },

      SetTradePrice: function (args, cb, soapHeader) {
      },

      IsValidPrice: function (args, cb, soapHeader, req) {
        lastReqAddress = req.connection.remoteAddress;

        var validationError = {
          Fault: {
            Code: {
              Value: "soap:Sender",
              Subcode: { value: "rpc:BadArguments" }
            },
            Reason: { Text: "Processing Error" },
            statusCode: 500
          }
        };

        var isValidPrice = function () {
          var price = args.price;
          if (isNaN(price) || (price === ' ')) {
            return cb(validationError);
          }

          price = parseInt(price, 10);
          var validPrice = (price > 0 && price < Math.pow(10, 5));
          return cb(null, { valid: validPrice });
        };

        setTimeout(isValidPrice, 10);
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
      var testSv = test.server.address();
      test.soapServer = soap.listen(test.server, '/stockquote', test.service, test.wsdl);
      test.baseUrl = `http://${testSv.address}:${testSv.port}`;

      // windows return 0.0.0.0 as address and that is not valid to use in a request
      if (testSv.address === '0.0.0.0' || testSv.address === '::') {
        test.baseUrl = `http://127.0.0.1:${test.server.address().port}`;
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


  it('should add and clear response soap headers', function (done) {
    assert.ok(!test.soapServer.getSoapHeaders());

    var i1 = test.soapServer.addSoapHeader('about-to-change-1');
    var i2 = test.soapServer.addSoapHeader('about-to-change-2');

    assert.ok(i1 === 0);
    assert.ok(i2 === 1);
    assert.ok(test.soapServer.getSoapHeaders().length === 2);

    test.soapServer.changeSoapHeader(0, 'header1');
    test.soapServer.changeSoapHeader(1, 'header2');
    assert.ok(test.soapServer.getSoapHeaders()[0] === 'header1');
    assert.ok(test.soapServer.getSoapHeaders()[1] === 'header2');

    test.soapServer.clearSoapHeaders();
    assert.ok(!test.soapServer.getSoapHeaders());
    done();
  });

  it('should return predefined headers in response', function (done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      var clientArgs = { tickerSymbol: 'AAPL' };

      assert.ifError(err);
      test.soapServer.addSoapHeader('<header1>ONE</header1>');
      test.soapServer.changeSoapHeader(1, { header2: 'TWO' });
      test.soapServer.addSoapHeader(function () { return { header3: 'THREE' }; });

      client.addSoapHeader({ headerFromClient: 'FOUR' });
      test.soapServer.changeSoapHeader(3, function (methodName, args, headers, req) {
        assert.equal(methodName, 'GetLastTradePrice');
        assert.deepEqual(clientArgs, args);
        assert.deepEqual(headers, { headerFromClient: 'FOUR' });
        return { header4: headers.headerFromClient };
      });

      client.GetLastTradePrice(clientArgs, function (err, result, raw, headers) {
        assert.ifError(err);
        assert.deepEqual(headers, {
          header1: 'ONE',
          header2: 'TWO',
          header3: 'THREE',
          header4: 'FOUR'
        });
        done();
      });
    });
  });

  it('should be running', function (done) {
    request(test.baseUrl).then(function (res) {
      done();
    }, function (err) {
      assert.ok(err);
      done();
    });
  });

  it('should 404 on non-WSDL path', function (done) {
    request(test.baseUrl).then(function (res) { }, function (err) {
      assert.ok(err);
      assert.equal(err.response.status, 404);
      done();
    });
  });

  it('should 500 on wrong message', function (done) {
    request({
      url: test.baseUrl + '/stockquote?wsdl',
      method: 'post',
      data: '<soapenv:Envelope' +
        ' xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"' +
        ' xmlns:soap="http://service.applicationsnet.com/soap/">' +
        '  <soapenv:Header/>' +
        '  <soapenv:Body>' +
        '    <soap:WrongTag/>' +
        '  </soapenv:Body>' +
        '</soapenv:Envelope>',
      headers: { 'Content-Type': 'text/xml' }
    }).then(function (res) { }, function (err) {
      assert.ok(err);
      assert.equal(err.response.status, 500);
      assert.ok(err.response.data.length);
      done();
    });
  });

  it('should 500 on empty message and undefined Content-Type', function (done) {
    request({
      url: test.baseUrl + '/stockquote?wsdl',
      method: 'post',
      data: '',
      // headers: { 'Content-Type': undefined }
    }).then(function (res) { }, function (err) {
      assert.ok(err);
      assert.equal(err.response.status, 500);
      assert.ok(err.response.data.length);
      done();
    });
  });

  it('should 500 on missing tag message', function (done) {
    request({
      url: test.baseUrl + '/stockquote?wsdl',
      method: 'post',
      data: '<soapenv:Envelope' +
        ' xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"' +
        ' xmlns:soap="http://service.applicationsnet.com/soap/">' +
        '  <soapenv:Header/>' +
        '  <soapenv:Body>' +
        '</soapenv:Envelope>',
      headers: { 'Content-Type': 'text/xml' }
    }).then(function (res) { }, function (err) {
      assert.ok(err);
      assert.equal(err.response.status, 500);
      assert.ok(err.response.data.length);
      done();
    });
  });

  it('should server up WSDL', function (done) {
    request(test.baseUrl + '/stockquote?wsdl').then(function (res) {
      assert.ok(res);
      assert.equal(res.status, 200);
      assert.ok(res.data.length);
      done();
    });
  });

  it('should return complete client description', function (done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);
      var description = client.describe();
      var expected = { input: { tickerSymbol: "string" }, output: { price: "float", tax: "double", other: "decimal" } };
      assert.deepEqual(expected, description.StockQuoteService.StockQuotePort.GetLastTradePrice);
      done();
    });
  });

  it('should return correct results', function (done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);
      client.GetLastTradePrice({ tickerSymbol: 'AAPL' }, function (err, result) {
        assert.ifError(err);
        assert.strictEqual(19.56, result.price); // float
        assert.strictEqual(-1.23, result.tax); // double
        assert.strictEqual(20.001, result.other); // decimal
        done();
      });
    });
  });

  it('should return correct async results (single argument callback style)', function (done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);
      client.GetLastTradePrice({ tickerSymbol: 'Async' }, function (err, result) {
        assert.ifError(err);
        assert.strictEqual(19.56, result.price);
        done();
      });
    });
  });

  it('should return correct async results (double argument callback style)', function (done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);
      client.IsValidPrice({ price: 50000 }, function (err, result) {
        assert.ifError(err);
        assert.equal(true, !!(result.valid));
        done();
      });
    });
  });

  it('should return correct result when called without SOAPAction header', function(done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);
      // this clears the SOAPAction header
      client.addHttpHeader('SOAPAction', '');
      client.IsValidPrice({ price: 50000 }, function (err, result) {
        assert.ifError(err);
        assert.equal(true, !!(result.valid));
        done();
      });
    });
  });

  it('should support Promise return result', function (done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);
      client.GetLastTradePrice({ tickerSymbol: 'Promise' }, function (err, result) {
        assert.ifError(err);
        assert.strictEqual(13.76, result.price);
        done();
      });
    });
  });

  it('should support Promise rejection (error)', function (done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);
      client.GetLastTradePrice({ tickerSymbol: 'Promise Error' }, function (err, response, body) {
        assert.ok(err);
        // what happens here (error and response ????)
        // assert.strictEqual(err.response, response);
        // assert.strictEqual(err.body, body);
        done();
      });
    });
  });

  it('should pass the original req to async methods', function (done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);
      client.IsValidPrice({ price: 50000 }, function (err, result) {
        // One of these should match, depending on the network configuration of the host
        var localhostAddresses = [
          '127.0.0.1',
          '::ffff:127.0.0.1',
          '::1'
        ];
        assert.notEqual(localhostAddresses.indexOf(lastReqAddress), -1);
        done();
      });
    });
  });

  it('should return correct async errors', function (done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);
      client.IsValidPrice({ price: "invalid_price" }, function (err, result) {
        assert.ok(err);
        assert.ok(err.root.Envelope.Body.Fault);
        assert.equal(err.response.status, 500);
        done();
      });
    });
  });

  it('should handle headers in request', function (done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);
      client.addSoapHeader('<SomeToken>123.45</SomeToken>');
      client.GetLastTradePrice({ tickerSymbol: 'AAPL' }, function (err, result) {
        assert.ifError(err);
        assert.strictEqual(123.45, result.price);
        done();
      });
    });
  });

  it('should return security timestamp in response', function (done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);
      client.addSoapHeader('<Security><Timestamp><Created>2015-02-23T12:00:00.000Z</Created><Expires>2015-02-23T12:05:00.000Z</Expires></Timestamp></Security>');
      client.GetLastTradePrice({ tickerSymbol: 'AAPL' }, function (err, result, raw, soapHeader) {
        assert.ifError(err);
        assert.ok(soapHeader && soapHeader.Security && soapHeader.Security.Timestamp);
        done();
      });
    });
  });

  it('should emit \'request\' event', function (done) {
    test.soapServer.on('request', function requestManager(request, methodName) {
      assert.equal(methodName, 'GetLastTradePrice');
      done();
    });
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);
      client.GetLastTradePrice({ tickerSymbol: 'AAPL' }, function () { });
    });
  });

  it('should emit \'response\' event', function (done) {
    test.soapServer.on('response', function requestManager(request, methodName) {
      assert.equal(methodName, 'GetLastTradePrice');
      done();
    });
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);
      client.GetLastTradePrice({ tickerSymbol: 'AAPL' }, function () { });
    });
  });

  it('should emit \'headers\' event', function (done) {
    test.soapServer.on('headers', function headersManager(headers, methodName) {
      assert.equal(methodName, 'GetLastTradePrice');
      headers.SomeToken = 0;
    });
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);
      client.addSoapHeader('<SomeToken>123.45</SomeToken>');
      client.GetLastTradePrice({ tickerSymbol: 'AAPL' }, function (err, result) {
        assert.ifError(err);
        assert.strictEqual(0, result.price);
        done();
      });
    });
  });

  it('should not emit the \'headers\' event when there are no headers', function (done) {
    test.soapServer.on('headers', function headersManager(headers, methodName) {
      assert.ok(false);
    });
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);
      client.GetLastTradePrice({ tickerSymbol: 'AAPL' }, function (err, result) {
        assert.ifError(err);
        done();
      });
    });
  });

  it('should include response and body in error object', function (done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);
      client.GetLastTradePrice({ tickerSymbol: 'trigger error' }, function (err, response, body) {
        assert.ok(err);
        // what happens here (error and response ????)
        // assert.strictEqual(err.response, response);
        // assert.strictEqual(err.body, body);
        done();
      });
    });
  });

  it('should return SOAP Fault body for SOAP 1.2', function (done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);
      client.GetLastTradePrice({ tickerSymbol: 'SOAP Fault v1.2' }, function (err, response, body) {
        assert.ok(err);
        var fault = err.root.Envelope.Body.Fault;
        assert.equal(err.message, fault.faultcode + ': ' + fault.faultstring);
        assert.equal(fault.Code.Value, "soap:Sender");
        assert.equal(fault.Reason.Text, "Processing Error");
        // Verify namespace on elements set according to fault spec 1.2
        assert.ok(body.match(/<soap:Code>.*<\/soap:Code>/g),
          "Body should contain Code-element with namespace");
        assert.ok(body.match(/<soap:Reason>.*<\/soap:Reason>/g),
          "Body should contain Reason-element with namespace");
        assert.equal(err.response.status, 200);
        done();
      });
    });
  });

  it('should return SOAP Fault body for SOAP 1.1', function (done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);
      client.GetLastTradePrice({ tickerSymbol: 'SOAP Fault v1.1' }, function (err, response, body) {
        assert.ok(err);
        var fault = err.root.Envelope.Body.Fault;
        assert.equal(err.message, fault.faultcode + ': ' + fault.faultstring);
        assert.equal(fault.faultcode, "soap:Client.BadArguments");
        assert.equal(fault.faultstring, "Error while processing arguments");
        // Verify namespace on elements set according to fault spec 1.1
        assert.ok(body.match(/<faultcode>.*<\/faultcode>/g),
          "Body should contain faultcode-element without namespace");
        assert.ok(body.match(/<faultstring>.*<\/faultstring>/g),
          "Body should contain faultstring-element without namespace");
        done();
      });
    });
  });

  it('should return SOAP Fault thrown from \'headers\' event handler', function (done) {
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
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      client.addSoapHeader('<SomeToken>0.0</SomeToken>');
      client.GetLastTradePrice({ tickerSymbol: 'AAPL' }, function (err, result) {
        assert.ok(err);
        assert.ok(err.root.Envelope.Body.Fault);
        done();
      });
    });
  });

  it('should accept attributes as a string on the body element', function (done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);
      client.addBodyAttribute('xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" wsu:Id="######################"');
      client.GetLastTradePrice({ tickerSymbol: 'AAPL' }, function (err, response, body) {
        assert.ifError(err);
        done();
      });
    });
  });

  it('should accept attributes as an object on the body element', function (done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);
      var attributes = { 'xmlns:wsu': 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd', 'wsu:Id': '######################' };
      client.addBodyAttribute(attributes);
      client.GetLastTradePrice({ tickerSymbol: 'AAPL' }, function (err, response, body) {
        assert.ifError(err);
        done();
      });
    });
  });

  it('should handle one-way operations', function (done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
      assert.ifError(err);
      client.SetTradePrice({ tickerSymbol: 'GOOG', price: 575.33 }, function (err, result) {
        assert.ifError(err);
        assert.equal(result, null);
        done();
      });
    });
  });

  it('should return correct result for attributes in complextTypeElement', function(done) {
    soap.createClient(path.resolve(__dirname, 'wsdl', 'fileWithAttributes.xsd'), function (err, client) {
      assert.ifError(err);
      let description = client.describe();

      assert.deepEqual(description.StockQuoteService.StockQuotePort.GetLastTradePrice.input.$attributes, {
        AttributeInOne: "s:boolean",
        AttributeInTwo: "s:boolean"
      });
      assert.deepEqual(description.StockQuoteService.StockQuotePort.GetLastTradePrice.output.$attributes, {
        AttributeOut: "s:boolean"
      });

      assert.deepEqual(Object.keys(description.StockQuoteService.StockQuotePort.GetLastTradePrice.input), ['tickerSymbol', '$attributes']);
      assert.deepEqual(Object.keys(description.StockQuoteService.StockQuotePort.GetLastTradePrice.output), ['$attributes']);
      done();
    });
  });

  // NOTE: this is actually a -client- test
  /*
  it('should return a valid error if the server stops responding': function(done) {
    soap.createClient(test.baseUrl + '/stockquote?wsdl', function(err, client) {
      assert.ifError(err);
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
