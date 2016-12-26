"use strict";

var fs = require('fs'),
    soap = require('..'),
    assert = require('assert'),
    request = require('request'),
    http = require('http'),
    lastReqAddress;

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
        } else if (args.tickerSymbol === 'Async') {
          return cb({ price: 19.56 });
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
        } else if (args.tickerSymbol === 'xml response') {
          return '<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns3:UpdateProfileResponse xmlns:ns3="http://www.bigdatacollect.or/Name/Types" xmlns="http://www.bigdatacollect.or/Common/Types"><ns3:Result resultStatusFlag="SUCCESS"><IDs><UniqueID source="TESTSOURCE">100</UniqueID></IDs></ns3:Result></ns3:UpdateProfileResponse></S:Body></S:Envelope>';
        } else {
          return { price: 19.56 };
        }
      },

      SetTradePrice: function(args, cb, soapHeader) {
      },

      IsValidPrice: function(args, cb, soapHeader, req) {
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

        var isValidPrice = function() {
          var price = args.price;
          if(isNaN(price) || (price === ' ')) {
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

describe('SOAP Server with Options', function() {
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

    done();
  });

  afterEach(function(done) {
    test.server.close(function() {
      test.server = null;
      delete test.soapServer;
      test.soapServer = null;
      done();
    });
  });

  it('should be running with escapeXML false', function(done) {
    test.server.listen(15099, null, null, function() {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        uri: __dirname + '/wsdl/strict/',
        escapeXML: false
      }, test.service, test.wsdl);
      test.baseUrl = 'http://' + test.server.address().address + ":" + test.server.address().port;

      //windows return 0.0.0.0 as address and that is not
      //valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl = 'http://127.0.0.1:' + test.server.address().port;
      }
      // console.log(test.baseUrl);
      request(test.baseUrl, function(err, res, body) {
        assert.ok(!err);
        console.log(body);
        done();
      });
    });
  });

  it('should be running  with escapeXML true', function(done) {
    test.server.listen(15099, null, null, function() {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        uri: __dirname + '/wsdl/strict/',
        escapeXML: true
      }, test.service, test.wsdl);
      test.baseUrl =
        'http://' + test.server.address().address + ":" + test.server.address().port;

      //windows return 0.0.0.0 as address and that is not
      //valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl =
          'http://127.0.0.1:' + test.server.address().port;
      }
      request(test.baseUrl, function(err, res, body) {
        assert.ok(!err);
        console.log(body);
        done();
      });
    });
  });


  it('should escapeXML in response body', function(done) {
    var responseData = '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://example.com/stockquote.wsdl" xmlns:xsd1="http://example.com/stockquote.xsd"><soap:Body><xsd1:TradePrice xmlns:xsd1="http://example.com/stockquote.xsd">&lt;S:Envelope xmlns:S=&quot;http://schemas.xmlsoap.org/soap/envelope/&quot;&gt;&lt;S:Body&gt;&lt;ns3:UpdateProfileResponse xmlns:ns3=&quot;http://www.bigdatacollect.or/Name/Types&quot; xmlns=&quot;http://www.bigdatacollect.or/Common/Types&quot;&gt;&lt;ns3:Result resultStatusFlag=&quot;SUCCESS&quot;&gt;&lt;IDs&gt;&lt;UniqueID source=&quot;TESTSOURCE&quot;&gt;100&lt;/UniqueID&gt;&lt;/IDs&gt;&lt;/ns3:Result&gt;&lt;/ns3:UpdateProfileResponse&gt;&lt;/S:Body&gt;&lt;/S:Envelope&gt;</xsd1:TradePrice></soap:Body></soap:Envelope>';
    test.server.listen(15099, null, null, function() {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        uri: __dirname + '/wsdl/strict/',
        escapeXML: true
      }, test.service, test.wsdl);
      test.baseUrl = 'http://' + test.server.address().address + ":" + test.server.address().port;

      //windows return 0.0.0.0 as address and that is not
      //valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl = 'http://127.0.0.1:' + test.server.address().port;
      }

      soap.createClient(test.baseUrl + '/stockquote?wsdl', function(err, client) {
        assert.ok(!err);
        client.GetLastTradePrice({ tickerSymbol: 'xml response' }, function(err, response, body) {
          assert.ok(!err);
          assert.strictEqual(body, responseData);
          done();
        });
      });
    });
  });

  it('should not escapeXML response in body', function(done) {
    var responseData = '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://example.com/stockquote.wsdl" xmlns:xsd1="http://example.com/stockquote.xsd"><soap:Body><xsd1:TradePrice xmlns:xsd1="http://example.com/stockquote.xsd"><S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns3:UpdateProfileResponse xmlns:ns3="http://www.bigdatacollect.or/Name/Types" xmlns="http://www.bigdatacollect.or/Common/Types"><ns3:Result resultStatusFlag="SUCCESS"><IDs><UniqueID source="TESTSOURCE">100</UniqueID></IDs></ns3:Result></ns3:UpdateProfileResponse></S:Body></S:Envelope></xsd1:TradePrice></soap:Body></soap:Envelope>';
    test.server.listen(15099, null, null, function() {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        uri: __dirname + '/wsdl/strict/',
        escapeXML: false
      }, test.service, test.wsdl);
      test.baseUrl = 'http://' + test.server.address().address + ":" + test.server.address().port;

      //windows return 0.0.0.0 as address and that is not
      //valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl = 'http://127.0.0.1:' + test.server.address().port;
      }

      soap.createClient(test.baseUrl + '/stockquote?wsdl', function(err, client) {
        assert.ok(!err);
        client.GetLastTradePrice({ tickerSymbol: 'xml response' }, function(err, response, body) {
          assert.ok(!err);
          assert.strictEqual(body, responseData);
          done();
        });
      });
    });
  });

  it('should disclose error stack in server response', function(done) {
    test.server.listen(15099, null, null, function() {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        uri: __dirname + '/wsdl/strict/',
        escapeXML: false
      }, test.service, test.wsdl);
      test.baseUrl = 'http://' + test.server.address().address + ":" + test.server.address().port;

      //windows return 0.0.0.0 as address and that is not
      //valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl = 'http://127.0.0.1:' + test.server.address().port;
      }

      request.post({
        url: test.baseUrl + '/stockquote?wsdl',
        body : '<soapenv:Envelope' +
                    ' xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"' +
                    ' xmlns:soap="http://service.applicationsnet.com/soap/">' +
                '  <soapenv:Header/>' +
                '  <soapenv:Body>' +
                '    <soap:WrongTag/>' +
                '  </soapenv:Body>' +
                '</soapenv:Envelope>',
        headers: {'Content-Type': 'text/xml'}
      }, function(err, res, body) {
        assert.ok(!err);
        assert.equal(res.statusCode, 500);
        assert.ok(body.indexOf('\n    at') !== -1);
        done();
      }
      );
    });
  });

  it('should not disclose error stack in server response', function(done) {
    test.server.listen(15099, null, null, function() {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        uri: __dirname + '/wsdl/strict/',
        escapeXML: false,
        suppressStack: true
      }, test.service, test.wsdl);
      test.baseUrl = 'http://' + test.server.address().address + ":" + test.server.address().port;

      //windows return 0.0.0.0 as address and that is not
      //valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl = 'http://127.0.0.1:' + test.server.address().port;
      }

      request.post({
        url: test.baseUrl + '/stockquote?wsdl',
        body : '<soapenv:Envelope' +
                    ' xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"' +
                    ' xmlns:soap="http://service.applicationsnet.com/soap/">' +
                '  <soapenv:Header/>' +
                '  <soapenv:Body>' +
                '    <soap:WrongTag/>' +
                '  </soapenv:Body>' +
                '</soapenv:Envelope>',
        headers: {'Content-Type': 'text/xml'}
      }, function(err, res, body) {
        assert.ok(!err);
        assert.equal(res.statusCode, 500);
        assert.equal(body.indexOf('\n    at'), -1);
        done();
      }
      );
    });
  });
});
