import fs from 'fs';
import assert from 'assert';
import * as soap from '../lib/soap.js';

const testRequest =
  '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd1="http://example.com/stockquote.xsd">' +
  '  <soapenv:Header/>' +
  '  <soapenv:Body>' +
  '    <xsd1:TradePriceRequest>' +
  '      <tickerSymbol>APPL</tickerSymbol>' +
  '    </xsd1:TradePriceRequest>' +
  '  </soapenv:Body>' +
  '</soapenv:Envelope>';

describe('SOAP Serverless Mode', function () {
  var wsdl;

  before(function (done) {
    fs.readFile(process.cwd() + '/test/wsdl/strict/stockquote.wsdl', 'utf8', function (err, data) {
      assert.ifError(err);
      wsdl = data;
      done();
    });
  });

  it('should process raw SOAP XML and return raw SOAP XML response', async function () {
    var service = {
      StockQuoteService: {
        StockQuotePort: {
          GetLastTradePrice: function (args) {
            return { price: 19.56, tax: -1.23, other: 20.001 };
          },
        },
      },
    };

    var server = await soap.createServerless({
      path: '/stockquote',
      services: service,
      xml: wsdl,
    });

    var response = await server.processRequest(testRequest, {
      url: '/stockquote',
      headers: {
        'content-type': 'text/xml',
      },
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.headers, {
      'content-type': 'text/xml',
    });
    assert.strictEqual(
      response.body,
      '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://example.com/stockquote.wsdl" xmlns:xsd1="http://example.com/stockquote.xsd"><soap:Body><xsd1:TradePrice xmlns:xsd1="http://example.com/stockquote.xsd"><price>19.56</price><tax>-1.23</tax><other>20.001</other></xsd1:TradePrice></soap:Body></soap:Envelope>',
    );
  });

  it('should return SOAP fault payload and 500 status for server error', async function () {
    var service = {
      StockQuoteService: {
        StockQuotePort: {
          GetLastTradePrice: function (args) {
            throw new Error('triggered server error');
          },
        },
      },
    };

    var server = await soap.createServerless({
      path: '/stockquote',
      services: service,
      xml: wsdl,
    });

    var response = await server.processRequest(testRequest, {
      url: '/stockquote',
      headers: {
        'content-type': 'text/xml',
      },
    });

    assert.strictEqual(response.statusCode, 500);
    assert.strictEqual(
      response.body,
      '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://example.com/stockquote.wsdl" xmlns:xsd1="http://example.com/stockquote.xsd"><soap:Body><soap:Fault><soap:Code><soap:Value>SOAP-ENV:Server</soap:Value><soap:Subcode><soap:Value>InternalServerError</soap:Value></soap:Subcode></soap:Code><soap:Reason><soap:Text>Error: triggered server error</soap:Text></soap:Reason></soap:Fault></soap:Body></soap:Envelope>',
    );
  });
});
