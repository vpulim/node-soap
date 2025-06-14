"use strict";

const { default: axios } = require('axios');
const { log } = require('console');

var fs = require('fs'),
  soap = require('..'),
  assert = require('assert'),
  http = require('http'),
  lastReqAddress;

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

describe('SOAP Server with Options', function () {
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

    done();
  });

  afterEach(function (done) {
    test.server.close(function () {
      test.server = null;
      delete test.soapServer;
      test.soapServer = null;
      done();
    });
  });

  it('should start server with callback in options parameter', function (done) {
    test.server.listen(15099, null, null, function () {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        uri: __dirname + '/wsdl/strict/',
        escapeXML: false,
        callback: function (err) {
          assert.ifError(err);
          done();
        }
      }, test.service, test.wsdl);
    });
  });

  it('should start server with callback as normal parameter', function (done) {
    test.server.listen(15099, null, null, function () {
      test.soapServer = soap.listen(
        test.server,
        "/stockquote",
        test.service,
        test.wsdl,
        function (err) {
          assert.ifError(err);
          done();
        }
      );
    });
  });

  it('should be running with escapeXML false', function (done) {
    test.server.listen(15099, null, null, function () {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        uri: __dirname + '/wsdl/strict/',
        escapeXML: false
      }, test.service, test.wsdl);
      test.baseUrl = 'http://' + test.server.address().address + ":" + test.server.address().port;

      // windows return 0.0.0.0 as address and that is not valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl = 'http://127.0.0.1:' + test.server.address().port;
      }
      axios.get(test.baseUrl + "/stockquote").then(res => {
        assert.equal(res.status, 200);
        done()
      }).catch(err => {
        assert.ifError(err);
      });
    });
  });

  it('should be running  with escapeXML true', function (done) {
    test.server.listen(15099, null, null, function () {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        uri: __dirname + '/wsdl/strict/',
        escapeXML: true
      }, test.service, test.wsdl);
      test.baseUrl =
        'http://' + test.server.address().address + ":" + test.server.address().port;

      // windows return 0.0.0.0 as address and that is not valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl =
          'http://127.0.0.1:' + test.server.address().port;
      }
      axios.get(test.baseUrl + "/stockquote").then(res => {
        assert.equal(res.status, 200);
        done()
      }).catch(err => {
        assert.ifError(err);
      });
    });
  });


  it('should escapeXML in response body', function (done) {
    var responseData = '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://example.com/stockquote.wsdl" xmlns:xsd1="http://example.com/stockquote.xsd"><soap:Body><xsd1:TradePrice xmlns:xsd1="http://example.com/stockquote.xsd">&lt;S:Envelope xmlns:S=&quot;http://schemas.xmlsoap.org/soap/envelope/&quot;&gt;&lt;S:Body&gt;&lt;ns3:UpdateProfileResponse xmlns:ns3=&quot;http://www.bigdatacollect.or/Name/Types&quot; xmlns=&quot;http://www.bigdatacollect.or/Common/Types&quot;&gt;&lt;ns3:Result resultStatusFlag=&quot;SUCCESS&quot;&gt;&lt;IDs&gt;&lt;UniqueID source=&quot;TESTSOURCE&quot;&gt;100&lt;/UniqueID&gt;&lt;/IDs&gt;&lt;/ns3:Result&gt;&lt;/ns3:UpdateProfileResponse&gt;&lt;/S:Body&gt;&lt;/S:Envelope&gt;</xsd1:TradePrice></soap:Body></soap:Envelope>';
    test.server.listen(15099, null, null, function () {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        uri: __dirname + '/wsdl/strict/',
        escapeXML: true
      }, test.service, test.wsdl);
      test.baseUrl = 'http://' + test.server.address().address + ":" + test.server.address().port;

      // windows return 0.0.0.0 as address and that is not valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl = 'http://127.0.0.1:' + test.server.address().port;
      }

      soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
        assert.ifError(err);
        client.GetLastTradePrice({ tickerSymbol: 'xml response' }, function (err, response, body) {
          assert.ifError(err);
          assert.strictEqual(body, responseData);
          done();
        });
      });
    });
  });

  it('should not escapeXML response in body', function (done) {
    var responseData = '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://example.com/stockquote.wsdl" xmlns:xsd1="http://example.com/stockquote.xsd"><soap:Body><xsd1:TradePrice xmlns:xsd1="http://example.com/stockquote.xsd"><S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns3:UpdateProfileResponse xmlns:ns3="http://www.bigdatacollect.or/Name/Types" xmlns="http://www.bigdatacollect.or/Common/Types"><ns3:Result resultStatusFlag="SUCCESS"><IDs><UniqueID source="TESTSOURCE">100</UniqueID></IDs></ns3:Result></ns3:UpdateProfileResponse></S:Body></S:Envelope></xsd1:TradePrice></soap:Body></soap:Envelope>';
    test.server.listen(15099, null, null, function () {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        uri: __dirname + '/wsdl/strict/',
        escapeXML: false
      }, test.service, test.wsdl);
      test.baseUrl = 'http://' + test.server.address().address + ":" + test.server.address().port;

      // windows return 0.0.0.0 as address and that is not valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl = 'http://127.0.0.1:' + test.server.address().port;
      }

      soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
        assert.ifError(err);
        client.GetLastTradePrice({ tickerSymbol: 'xml response' }, function (err, response, body) {
          assert.ifError(err);
          assert.strictEqual(body, responseData);
          done();
        });
      });
    });
  });

  it('should disclose error stack in server response', function (done) {
    test.server.listen(15099, null, null, function () {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        uri: __dirname + '/wsdl/strict/',
        escapeXML: false
      }, test.service, test.wsdl);
      test.baseUrl = 'http://' + test.server.address().address + ":" + test.server.address().port;

      // windows return 0.0.0.0 as address and that is not valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl = 'http://127.0.0.1:' + test.server.address().port;
      }

      axios.post(
        test.baseUrl + '/stockquote?wsdl',
        '<soapenv:Envelope' +
        ' xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"' +
        ' xmlns:soap="http://service.applicationsnet.com/soap/">' +
        '  <soapenv:Header/>' +
        '  <soapenv:Body>' +
        '    <soap:WrongTag/>' +
        '  </soapenv:Body>' +
        '</soapenv:Envelope>',
        {
          headers: { 'Content-Type': 'text/xml' }
        }).then(res => {
          // should not go this path, will fail by timeout
        }).catch(err => {
          assert.equal(err.response.status, 500);
          assert.ok(err.response.data.indexOf('\n    at') !== -1);
          done();
        })
    });
  });

  it('should not disclose error stack in server response', function (done) {
    test.server.listen(15099, null, null, function () {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        uri: __dirname + '/wsdl/strict/',
        escapeXML: false,
        suppressStack: true
      }, test.service, test.wsdl);
      test.baseUrl = 'http://' + test.server.address().address + ":" + test.server.address().port;

      // windows return 0.0.0.0 as address and that is not valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl = 'http://127.0.0.1:' + test.server.address().port;
      }

      axios.post(
        test.baseUrl + '/stockquote?wsdl',
        '<soapenv:Envelope' +
        ' xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"' +
        ' xmlns:soap="http://service.applicationsnet.com/soap/">' +
        '  <soapenv:Header/>' +
        '  <soapenv:Body>' +
        '    <soap:WrongTag/>' +
        '  </soapenv:Body>' +
        '</soapenv:Envelope>',
        {
          headers: { 'Content-Type': 'text/xml' }
        }).then(res => {
          // should not go this path, will fail by timeout
        }).catch(err => {
          assert.equal(err.response.status, 500);
          assert.equal(err.response.data.indexOf('\n    at'), -1);
          done();
        })
    });
  });

  it('should return soap fault in server response', function (done) {
    test.server.listen(15099, null, null, function () {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        uri: __dirname + '/wsdl/strict/',
        escapeXML: false,
        returnFault: true
      }, test.service, test.wsdl);
      test.baseUrl = 'http://' + test.server.address().address + ":" + test.server.address().port;

      // windows return 0.0.0.0 as address and that is not valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl = 'http://127.0.0.1:' + test.server.address().port;
      }

      axios.post(
        test.baseUrl + '/stockquote?wsdl',
        {
          body: '<soapenv:Envelope' +
            ' xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"' +
            ' xmlns:soap="http://service.applicationsnet.com/soap/">' +
            '  <soapenv:Header/>' +
            '  <soapenv:Body>' +
            '    <soap:WrongTag/>' +
            '  </soapenv:Body>' +
            '</soapenv:Envelope>',
          headers: { 'Content-Type': 'text/xml' }
        }, function (err, res, body) {
          assert.ifError(err);
          assert.equal(res.statusCode, 500);
          assert.ok(body.match(/<faultcode>.*<\/faultcode>/g),
            "Invalid XML");
          done();
        }
      );
      axios.post(
        test.baseUrl + '/stockquote?wsdl',
        '<soapenv:Envelope' +
        ' xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"' +
        ' xmlns:soap="http://service.applicationsnet.com/soap/">' +
        '  <soapenv:Header/>' +
        '  <soapenv:Body>' +
        '    <soap:WrongTag/>' +
        '  </soapenv:Body>' +
        '</soapenv:Envelope>',
        {
          headers: { 'Content-Type': 'text/xml' }
        }).then(res => {
          // should not go this path, will fail by timeout
        }).catch(err => {
          assert.equal(err.response.status, 500);
          assert.ok(err.response.data.match(/<faultcode>.*<\/faultcode>/g),
            "Invalid XML");
          done();
        })
    });
  });
  it('should not return a SOAP 12 envelope when headers are not forced', function (done) {
    test.server.listen(15099, null, null, function () {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        uri: __dirname + '/wsdl/strict/',
        forceSoap12Headers: false
      }, test.service, test.wsdl);
      test.baseUrl = 'http://' + test.server.address().address + ":" + test.server.address().port;

      // windows return 0.0.0.0 as address and that is not valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl = 'http://127.0.0.1:' + test.server.address().port;
      }
      axios.post(
        test.baseUrl + '/stockquote',
        '<soapenv:Envelope' +
        ' xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"' +
        ' xmlns:soap="http://service.applicationsnet.com/soap/">' +
        '  <soapenv:Header/>' +
        '  <soapenv:Body>' +
        '</soapenv:Envelope>',
        {
          headers: { 'Content-Type': 'text/xml' }
        }
      ).then(res => {
        // should not go this path, will fail by timeout
      }).catch(err => {
        assert.ok(
          err.response.data.indexOf('xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"') > -1
        )
        done();
      })
    });
  });
  it('should return a SOAP 12 envelope when headers are forced', function (done) {
    test.server.listen(15099, null, null, function () {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        uri: __dirname + '/wsdl/strict/',
        forceSoap12Headers: true
      }, test.service, test.wsdl);
      test.baseUrl = 'http://' + test.server.address().address + ":" + test.server.address().port;

      // windows return 0.0.0.0 as address and that is not valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl = 'http://127.0.0.1:' + test.server.address().port;
      }
      axios.post(
        test.baseUrl + '/stockquote',
        '<soapenv:Envelope' +
        ' xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"' +
        ' xmlns:soap="http://service.applicationsnet.com/soap/">' +
        '  <soapenv:Header/>' +
        '  <soapenv:Body>' +
        '</soapenv:Envelope>',
        {
          headers: { 'Content-Type': 'text/xml' }
        }
      ).then(res => {
        // should not go this path, will fail by timeout
      }).catch(err => {
        assert.ok(
          err.response.data.indexOf('xmlns:soap="http://www.w3.org/2003/05/soap-envelope"') > -1
        )
        done();
      })
    });
  });

  it('should return configured statusCode on one-way operations', function (done) {
    test.server.listen(15099, null, null, function () {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        oneWay: {
          responseCode: 202
        }
      }, test.service, test.wsdl);
      test.baseUrl = 'http://' + test.server.address().address + ":" + test.server.address().port;

      // windows return 0.0.0.0 as address and that is not valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl = 'http://127.0.0.1:' + test.server.address().port;
      }

      soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
        assert.ifError(err);
        client.on('response', function (xml, response) {
          assert.equal(response.status, 202);
          done();
        });

        client.SetTradePrice({ tickerSymbol: 'GOOG' }, function (err, result, body) {
          assert.ifError(err);
          assert.equal(result, null);
          assert.equal(body, '');
        });
      });
    });
  });
  it('should return empty body on one-way operations if configured', function (done) {
    var responseData = '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://example.com/stockquote.wsdl" xmlns:xsd1="http://example.com/stockquote.xsd"><soap:Body/></soap:Envelope>';
    test.server.listen(15099, null, null, function () {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        oneWay: {
          emptyBody: true
        }
      }, test.service, test.wsdl);
      test.baseUrl = 'http://' + test.server.address().address + ":" + test.server.address().port;

      // windows return 0.0.0.0 as address and that is not valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl = 'http://127.0.0.1:' + test.server.address().port;
      }

      soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
        assert.ifError(err);
        client.SetTradePrice({ tickerSymbol: 'GOOG' }, function (err, result, body) {
          assert.ifError(err);
          assert.strictEqual(body, responseData);
          done();
        });
      });
    });
  });
  it('should use chunked transfer encoding by default', function (done) {
    test.server.listen(15099, null, null, function () {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
      }, test.service, test.wsdl);
      test.baseUrl = 'http://' + test.server.address().address + ":" + test.server.address().port;

      // windows return 0.0.0.0 as address and that is not valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl = 'http://127.0.0.1:' + test.server.address().port;
      }

      soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
        assert.ifError(err);

        client.on('response', function (body, response, eid) {
          var headers = response.headers;
          assert.strictEqual(headers['transfer-encoding'], 'chunked');
          assert.equal(headers['content-length'], undefined);
        })

        client.SetTradePrice({ tickerSymbol: 'GOOG' }, function (err, result, body) {
          assert.ifError(err);
          done();
        });
      });
    });
  });
  it('should use chunked transfer encoding when enabled in options', function (done) {
    test.server.listen(15099, null, null, function () {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        enableChunkedEncoding: true,
      }, test.service, test.wsdl);
      test.baseUrl = 'http://' + test.server.address().address + ":" + test.server.address().port;

      // windows return 0.0.0.0 as address and that is not valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl = 'http://127.0.0.1:' + test.server.address().port;
      }

      soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
        assert.ifError(err);

        client.on('response', function (body, response, eid) {
          var headers = response.headers;
          assert.strictEqual(headers['transfer-encoding'], 'chunked');
          assert.equal(headers['content-length'], undefined);
        })

        client.SetTradePrice({ tickerSymbol: 'GOOG' }, function (err, result, body) {
          assert.ifError(err);
          done();
        });
      });
    });
  });
  it('should not use chunked transfer encoding when disabled in options', function (done) {
    test.server.listen(15099, null, null, function () {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        enableChunkedEncoding: false,
      }, test.service, test.wsdl);
      test.baseUrl = 'http://' + test.server.address().address + ":" + test.server.address().port;

      // windows return 0.0.0.0 as address and that is not valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl = 'http://127.0.0.1:' + test.server.address().port;
      }

      soap.createClient(test.baseUrl + '/stockquote?wsdl', function (err, client) {
        assert.ifError(err);

        client.on('response', function (body, response, eid) {
          var headers = response.headers;
          assert.notEqual(headers['content-length'], undefined);
          assert.equal(headers['transfer-encoding'], undefined);
        })

        client.SetTradePrice({ tickerSymbol: 'GOOG' }, function (err, result, body) {
          assert.ifError(err);
          done();
        });
      });
    });
  });

  it('should accept regex as path', function (done) {
    test.server.listen(15099, null, null, function () {
      test.soapServer = soap.listen(test.server, {
        path: /test\/.*/,
        services: test.service,
        xml: test.wsdl
      }, test.service, test.wsdl);

      soap.createClient(test.baseUrl + '/test/te?wsdl', function (err, client) {
        assert.ifError(err);
      });

      soap.createClient(test.baseUrl + '/teste/az?wsdl', function (err, client) {
        assert.notStrictEqual(err, null);
        done()
      });
    });
  });

  it('should return soapenv as envelope key when it is set to soapenv', function (done) {
    test.server.listen(15099, null, null, function () {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        uri: __dirname + '/wsdl/strict/',
        envelopeKey: 'soapenv'
      }, test.service, test.wsdl);
      test.baseUrl = 'http://' + test.server.address().address + ":" + test.server.address().port;

      //windows return 0.0.0.0 as address and that is not
      //valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl = 'http://127.0.0.1:' + test.server.address().port;
      }
      // console.log(test.baseUrl);
      axios.post(
        test.baseUrl + '/stockquote',
        '<soapenv:Envelope' +
        ' xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"' +
        ' xmlns:soap="http://service.applicationsnet.com/soap/">' +
        '  <soapenv:Header/>' +
        '  <soapenv:Body/>' +
        '</soapenv:Envelope>'
      ).then(res => {
        assert.ok(res.data.indexOf('soapenv:Envelope') > -1);
        done();
      }).catch(err => {
        throw err;
      });
    });
  });

  it('should return soap as envelope key by default', function (done) {
    test.server.listen(15099, null, null, function () {
      test.soapServer = soap.listen(test.server, {
        path: '/stockquote',
        services: test.service,
        xml: test.wsdl,
        uri: __dirname + '/wsdl/strict/',
        forceSoap12Headers: true
      }, test.service, test.wsdl);
      test.baseUrl = 'http://' + test.server.address().address + ":" + test.server.address().port;

      //windows return 0.0.0.0 as address and that is not
      //valid to use in a request
      if (test.server.address().address === '0.0.0.0' || test.server.address().address === '::') {
        test.baseUrl = 'http://127.0.0.1:' + test.server.address().port;
      }
      // console.log(test.baseUrl);
      axios.post(
        test.baseUrl + '/stockquote',
        '<soapenv:Envelope' +
        ' xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"' +
        ' xmlns:soap="http://service.applicationsnet.com/soap/">' +
        '  <soapenv:Header/>' +
        '  <soapenv:Body>' +
        '</soapenv:Envelope>'
      ).then(res => {
        assert.ok(res.data.indexOf('soap:Envelope') > -1);
        done();
      }).catch(err => {
        throw err;
      });
    });
  });

});
