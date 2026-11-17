'use strict';

var buffer = require('buffer');
var fs = require('fs');
var http = require('http');
var zlib = require('zlib');
var assert = require('assert');

var soap = require('..');
var DEFAULT_MAX_REQUEST_BYTES = require('../lib/server').DEFAULT_MAX_REQUEST_BYTES;

var path = 'test/request-response-samples/DefaultNamespace__no_xmlns_prefix_used_for_default_namespace/';
var xml = fs.readFileSync(path + 'soap.wsdl', 'utf8');
var json = fs.readFileSync(path + 'request.json', 'utf8');
var request = fs.readFileSync(path + 'request.xml', 'utf8');

var service = {
  MyService: {
    MyServicePort: {
      DefaultNamespace: function () {
        return JSON.parse(json);
      },
    },
  },
};

// 32 MiB of zeros gzips to about 32 KiB: small on the wire, above the
// listener's 20 MiB default cap after decompression, and still well below
// V8's maximum string length, so the unfixed listener buffers the whole body
// and answers with a SOAP fault rather than exiting.
var LARGE_DECOMPRESSED_BYTES = 32 * 1024 * 1024;

var SOAP11_ENVELOPE_NAMESPACE = 'http://schemas.xmlsoap.org/soap/envelope/';
var SOAP12_ENVELOPE_NAMESPACE = 'http://www.w3.org/2003/05/soap-envelope';
var SOAP_CONTENT_TYPE = 'text/xml; charset=utf-8';

function post(port, body, extraHeaders, callback) {
  var headers = {
    'content-type': SOAP_CONTENT_TYPE,
    'soapaction': '"DefaultNamespace"',
  };
  Object.keys(extraHeaders).forEach(function (name) {
    headers[name] = extraHeaders[name];
  });
  var req = http.request(
    {
      host: '127.0.0.1',
      port: port,
      path: '/wsdl',
      method: 'POST',
      headers: headers,
    },
    function (res) {
      var chunks = [];
      res.on('data', function (chunk) {
        chunks.push(chunk);
      });
      res.on('end', function () {
        callback(null, res, Buffer.concat(chunks).toString());
      });
    },
  );
  req.on('error', function (err) {
    callback(err);
  });
  req.end(body);
}

// Parses the response with the library's own SOAP parser. A fault response
// makes xmlToObject throw, with the parsed envelope on the error.
function parseSoap(wsdl, text) {
  try {
    return { envelope: wsdl.xmlToObject(text) };
  } catch (err) {
    if (err && err.root && err.root.Envelope && err.root.Envelope.Body && err.root.Envelope.Body.Fault) {
      return { fault: err.root.Envelope.Body.Fault };
    }
    throw err;
  }
}

function assertSoapEnvelopeNamespace(text, envelopeNamespace) {
  assert.ok(text.indexOf('xmlns:soap="' + envelopeNamespace + '"') !== -1, 'response should declare the SOAP envelope namespace');
}

function assertSoapFault(wsdl, text, envelopeNamespace, faultcode, faultstring) {
  assertSoapEnvelopeNamespace(text, envelopeNamespace);
  var parsed = parseSoap(wsdl, text);
  assert.ok(parsed.fault, 'response should parse as a SOAP Fault');
  assert.strictEqual(parsed.fault.faultcode, faultcode);
  assert.strictEqual(parsed.fault.faultstring, faultstring);
}

function assertSoapResponse(wsdl, text, envelopeNamespace) {
  assertSoapEnvelopeNamespace(text, envelopeNamespace);
  var parsed = parseSoap(wsdl, text);
  assert.ok(parsed.envelope, 'response should parse as a SOAP Envelope');
  assert.ok(parsed.envelope.Body, 'response should contain a SOAP Body');
  assert.ok(Object.prototype.hasOwnProperty.call(parsed.envelope.Body, 'Response'), 'response should contain the operation response element');
}

// A SOAP request padded with an XML comment so the body is exactly `bytes`
// long. Comments are ignored by the parser, so the request still resolves to
// the service method.
function paddedRequest(bytes) {
  var marker = '</soap:Envelope>';
  var open = '<!--';
  var close = '-->';
  var padding = bytes - Buffer.byteLength(request) - open.length - close.length;
  if (padding < 0) {
    throw new Error('the sample request is already larger than ' + bytes + ' bytes');
  }
  return request.replace(marker, open + 'x'.repeat(padding) + close + marker);
}

// Starts a server with the given soap.listen options and hands back the server
// and its port once the request listener is installed.
function startServer(serverOptions, callback) {
  var server = http.createServer(function (req, res) {});
  serverOptions.callback = function (err) {
    if (err) {
      return callback(err);
    }
    server.listen(0, '127.0.0.1', function () {
      callback(null, server, server.address().port);
    });
  };
  soap.listen(server, serverOptions);
}

describe('SOAP Server request limits', function () {
  var server;
  var port;
  var wsdl;

  before(function (done) {
    wsdl = new soap.WSDL(xml, null, {});
    wsdl.onReady(function (err) {
      if (err) {
        return done(err);
      }
      server = http.createServer(function (req, res) {});
      soap.listen(server, '/wsdl', service, xml);
      server.listen(0, '127.0.0.1', function () {
        port = server.address().port;
        done();
      });
    });
  });

  after(function (done) {
    server.close(done);
  });

  it('should answer a gzipped body that decompresses past the limit with a 413 SOAP fault', function (done) {
    var body = zlib.gzipSync(Buffer.alloc(LARGE_DECOMPRESSED_BYTES), { level: 9 });
    post(port, body, { 'content-encoding': 'gzip' }, function (err, res, text) {
      if (err) {
        return done(err);
      }
      assert.strictEqual(res.statusCode, 413);
      assert.strictEqual(res.headers['content-type'], SOAP_CONTENT_TYPE);
      assertSoapFault(wsdl, text, SOAP11_ENVELOPE_NAMESPACE, 'soap:Client', 'Request body too large');
      done();
    });
  });

  it('should answer a plain body past the limit with a 413 SOAP fault', function (done) {
    var body = Buffer.alloc(LARGE_DECOMPRESSED_BYTES, 0x20);
    post(port, body, {}, function (err, res, text) {
      if (err) {
        return done(err);
      }
      assert.strictEqual(res.statusCode, 413);
      assert.strictEqual(res.headers['content-type'], SOAP_CONTENT_TYPE);
      assertSoapFault(wsdl, text, SOAP11_ENVELOPE_NAMESPACE, 'soap:Client', 'Request body too large');
      done();
    });
  });

  it('should answer a body that is not valid gzip with a 400 SOAP fault', function (done) {
    post(port, 'this is not a gzip stream', { 'content-encoding': 'gzip' }, function (err, res, text) {
      if (err) {
        return done(err);
      }
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.headers['content-type'], SOAP_CONTENT_TYPE);
      assertSoapFault(wsdl, text, SOAP11_ENVELOPE_NAMESPACE, 'soap:Client', 'Invalid gzip body');
      done();
    });
  });

  it('should answer with a SOAP 1.2 fault when the server forces SOAP 1.2 headers', function (done) {
    var soap12Server = http.createServer(function (req, res) {});
    soap.listen(soap12Server, { path: '/wsdl', services: service, xml: xml, forceSoap12Headers: true });
    soap12Server.listen(0, '127.0.0.1', function () {
      post(soap12Server.address().port, 'this is not a gzip stream', { 'content-encoding': 'gzip' }, function (err, res, text) {
        soap12Server.close();
        if (err) {
          return done(err);
        }
        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.headers['content-type'], 'application/soap+xml; charset=utf-8');
        assertSoapEnvelopeNamespace(text, SOAP12_ENVELOPE_NAMESPACE);
        var parsed = parseSoap(wsdl, text);
        assert.ok(parsed.fault, 'response should parse as a SOAP Fault');
        assert.strictEqual(parsed.fault.Code.Value, 'soap:Sender');
        assert.strictEqual(parsed.fault.Reason.Text, 'Invalid gzip body');
        done();
      });
    });
  });

  it('should still accept a gzipped body under the limit', function (done) {
    var body = zlib.gzipSync(request, { level: 9 });
    post(port, body, { 'content-encoding': 'gzip' }, function (err, res, text) {
      if (err) {
        return done(err);
      }
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['content-type'], SOAP_CONTENT_TYPE);
      assertSoapResponse(wsdl, text, SOAP11_ENVELOPE_NAMESPACE);
      done();
    });
  });

  it('should still accept an uncompressed body under the limit', function (done) {
    post(port, request, {}, function (err, res, text) {
      if (err) {
        return done(err);
      }
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['content-type'], SOAP_CONTENT_TYPE);
      assertSoapResponse(wsdl, text, SOAP11_ENVELOPE_NAMESPACE);
      done();
    });
  });
});

describe('SOAP Server request body limit configuration', function () {
  var wsdl;

  before(function (done) {
    wsdl = new soap.WSDL(xml, null, {});
    wsdl.onReady(done);
  });

  it('should default to 20 MiB and reject a body one byte past it', function (done) {
    assert.strictEqual(DEFAULT_MAX_REQUEST_BYTES, 20 * 1024 * 1024);
    startServer({ path: '/wsdl', services: service, xml: xml }, function (err, server, port) {
      if (err) {
        return done(err);
      }
      var body = zlib.gzipSync(paddedRequest(DEFAULT_MAX_REQUEST_BYTES + 1), { level: 9 });
      post(port, body, { 'content-encoding': 'gzip' }, function (err, res, text) {
        server.close();
        if (err) {
          return done(err);
        }
        assert.strictEqual(res.statusCode, 413);
        assert.strictEqual(res.headers['content-type'], SOAP_CONTENT_TYPE);
        assertSoapFault(wsdl, text, SOAP11_ENVELOPE_NAMESPACE, 'soap:Client', 'Request body too large');
        done();
      });
    });
  });

  it('should accept a 19 MiB body on the default limit', function (done) {
    startServer({ path: '/wsdl', services: service, xml: xml }, function (err, server, port) {
      if (err) {
        return done(err);
      }
      var body = zlib.gzipSync(paddedRequest(19 * 1024 * 1024), { level: 9 });
      post(port, body, { 'content-encoding': 'gzip' }, function (err, res, text) {
        server.close();
        if (err) {
          return done(err);
        }
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers['content-type'], SOAP_CONTENT_TYPE);
        assertSoapResponse(wsdl, text, SOAP11_ENVELOPE_NAMESPACE);
        done();
      });
    });
  });

  it('should reject a body past a configured limit below the default', function (done) {
    startServer({ path: '/wsdl', services: service, xml: xml, maxRequestBodyBytes: 64 }, function (err, server, port) {
      if (err) {
        return done(err);
      }
      post(port, request, {}, function (err, res, text) {
        server.close();
        if (err) {
          return done(err);
        }
        assert.strictEqual(res.statusCode, 413);
        assert.strictEqual(res.headers['content-type'], SOAP_CONTENT_TYPE);
        assertSoapFault(wsdl, text, SOAP11_ENVELOPE_NAMESPACE, 'soap:Client', 'Request body too large');
        done();
      });
    });
  });

  it('should accept a body past the default when the configured limit is higher', function (done) {
    startServer({ path: '/wsdl', services: service, xml: xml, maxRequestBodyBytes: 64 * 1024 * 1024 }, function (err, server, port) {
      if (err) {
        return done(err);
      }
      var body = zlib.gzipSync(paddedRequest(LARGE_DECOMPRESSED_BYTES), { level: 9 });
      post(port, body, { 'content-encoding': 'gzip' }, function (err, res, text) {
        server.close();
        if (err) {
          return done(err);
        }
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.headers['content-type'], SOAP_CONTENT_TYPE);
        assertSoapResponse(wsdl, text, SOAP11_ENVELOPE_NAMESPACE);
        done();
      });
    });
  });

  it('should refuse a configured limit above the maximum string length supported by the running Node.js build', function () {
    assert.throws(
      function () {
        soap.listen(
          http.createServer(function (req, res) {}),
          {
            path: '/wsdl',
            services: service,
            xml: xml,
            maxRequestBodyBytes: buffer.constants.MAX_STRING_LENGTH + 1,
          },
        );
      },
      function (err) {
        return err instanceof RangeError && err.message.indexOf(String(buffer.constants.MAX_STRING_LENGTH)) !== -1;
      },
      'a limit above buffer.constants.MAX_STRING_LENGTH should throw a RangeError naming the maximum',
    );
  });

  it('should refuse a limit that is not a positive integer', function () {
    [0, -1, 1.5, '20mb', Infinity].forEach(function (value) {
      assert.throws(
        function () {
          soap.listen(
            http.createServer(function (req, res) {}),
            {
              path: '/wsdl',
              services: service,
              xml: xml,
              maxRequestBodyBytes: value,
            },
          );
        },
        TypeError,
        'maxRequestBodyBytes: ' + String(value),
      );
    });
  });
});
