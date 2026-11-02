'use strict';

var fs = require('fs');
var http = require('http');
var zlib = require('zlib');
var assert = require('assert');

var soap = require('..');

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

// 32 MiB of zeros gzips to about 32 KiB: small on the wire, twice the
// listener's 16 MiB cap after decompression, and still well below V8's
// maximum string length, so the unfixed listener buffers the whole body and
// answers with a SOAP fault rather than exiting.
var LARGE_DECOMPRESSED_BYTES = 32 * 1024 * 1024;

function post(port, body, extraHeaders, callback) {
  var headers = {
    'content-type': 'text/xml; charset=utf-8',
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

describe('SOAP Server request limits', function () {
  var server;
  var port;

  before(function (done) {
    server = http.createServer(function (req, res) {});
    soap.listen(server, '/wsdl', service, xml);
    server.listen(0, '127.0.0.1', function () {
      port = server.address().port;
      done();
    });
  });

  after(function (done) {
    server.close(done);
  });

  it('should reject a gzipped body that decompresses past the limit', function (done) {
    var body = zlib.gzipSync(Buffer.alloc(LARGE_DECOMPRESSED_BYTES), { level: 9 });
    post(port, body, { 'content-encoding': 'gzip' }, function (err, res, text) {
      if (err) {
        return done(err);
      }
      assert.strictEqual(res.statusCode, 413);
      assert.strictEqual(text, 'Request body too large');
      done();
    });
  });

  it('should reject a plain body past the limit', function (done) {
    var body = Buffer.alloc(LARGE_DECOMPRESSED_BYTES, 0x20);
    post(port, body, {}, function (err, res, text) {
      if (err) {
        return done(err);
      }
      assert.strictEqual(res.statusCode, 413);
      assert.strictEqual(text, 'Request body too large');
      done();
    });
  });

  it('should answer 400 for a body that is not valid gzip', function (done) {
    post(port, 'this is not a gzip stream', { 'content-encoding': 'gzip' }, function (err, res, text) {
      if (err) {
        return done(err);
      }
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(text, 'Invalid gzip body');
      done();
    });
  });

  it('should still accept a gzipped body under the limit', function (done) {
    var body = zlib.gzipSync(request, { level: 9 });
    post(port, body, { 'content-encoding': 'gzip' }, function (err, res, text) {
      if (err) {
        return done(err);
      }
      assert.strictEqual(res.statusCode, 200);
      assert(text.indexOf('<Response') !== -1);
      done();
    });
  });

  it('should still accept an uncompressed body under the limit', function (done) {
    post(port, request, {}, function (err, res, text) {
      if (err) {
        return done(err);
      }
      assert.strictEqual(res.statusCode, 200);
      assert(text.indexOf('<Response') !== -1);
      done();
    });
  });
});
