'use strict';

var soap = require('..'),
  http = require('http'),
  assert = require('assert');


describe('testing adding header rely on completed xml', () => {
  let server = null;
  let hostname = '127.0.0.1';
  let port = 15099;
  let baseUrl = 'http://' + hostname + ':' + port;
  const envelope = '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'
    + ' xmlns:xsd="http://www.w3.org/2001/XMLSchema"'
    + ' xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'
    + '<soap:Body><Response>Hello</Response></soap:Body></soap:Envelope>';

  before(function (done) {
    server = http.createServer(function (req, res) {
      res.statusCode = 200;
      res.write(envelope, 'utf8');
      res.end();
    }).listen(port, hostname, done);
  });

  after(function (done) {
    server.close();
    server = null;
    done();
  });

  xit('should add header to request, which created from xml before request', function (done) {
    soap.createClient(__dirname + '/wsdl/complex/registration-common.wsdl', function (err, client) {
      if (err) {
        return void done(err);
      }
      assert.ok(client);

      const testHeaderKey = 'testHeader';
      let testHeaderValue;

      client.on('request', (xml) => {
        testHeaderValue = xml;
        client.addHttpHeader(testHeaderKey, xml);
      });

      client.registerUser('', function (err, result) {

        const header = result.request._header;
        const headerKey = header.includes(testHeaderKey);
        const headerValue = header.includes(testHeaderValue);

        assert.equal(headerKey, true);
        assert.equal(headerValue, true);
        done();
      });
    }, baseUrl);
  });
});
