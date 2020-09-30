'use strict';

var fs = require('fs');
var soap = require('..');
var assert = require('assert');

var http = require('http');
var zlib = require('zlib');

var path =
  'test/request-response-samples/DefaultNamespace__no_xmlns_prefix_used_for_default_namespace/';

var wsdl = path + 'soap.wsdl';

var xml = fs.readFileSync(path + '/soap.wsdl', 'utf8');
var json = fs.readFileSync(path + '/request.json', 'utf8');
var request = fs.readFileSync(path + '/request.xml', 'utf8');
var response = fs.readFileSync(path + '/response.xml', 'utf8');

var service = {
  MyService: {
    MyServicePort: {
      DefaultNamespace: function (args) {
        return JSON.parse(json);
      },
    },
  },
};

describe('SOAP Server', function () {
  // This test sends two requests and checks the responses for equality. The
  // first request is sent through a soap client. The second request sends the
  // same request in gzipped format.
  var server = http.createServer(function (req, res) {});

  before(function () {
    server.listen(8000);
    soap.listen(server, '/wsdl', service, xml);
  });

  after(function () {
    server.close();
  });

  it('should properly handle compression', function (done) {
    var clientResponse, gzipResponse;

    // If both arguments are defined, check if they are equal and exit the test.
    var check = function (a, b) {
      if (a && b) {
        try {
          assert(a === b);
          done();
        } catch (e) {
          done(e);
        }
      }
    };

    soap.createClient(
      wsdl,
      {
        endpoint: 'http://localhost:8000/wsdl',
      },
      function (error, client) {
        try {
          assert(!error);
        } catch (e) {
          done(e);
        }
        client.DefaultNamespace(json, function (error, response) {
          try {
            assert(!error);
          } catch (e) {
            done(e);
          }
          clientResponse = client.lastResponse;
          check(clientResponse, gzipResponse);
        });
      },
    );

    var gzip = zlib.createGzip();

    // Construct a request with the appropriate headers.
    gzip.pipe(
      http.request(
        {
          host: 'localhost',
          path: '/wsdl',
          port: 8000,
          method: 'POST',
          headers: {
            'content-type': 'text/xml; charset=utf-8',
            'content-encoding': 'gzip',
            soapaction: '"DefaultNamespace"',
          },
        },
        function (res) {
          var body = '';
          res.on('data', function (data) {
            // Parse the response body.
            body += data;
          });
          res.on('end', function () {
            gzipResponse = body;
            check(clientResponse, gzipResponse);
            // Don't forget to close the server.
          });
        },
      ),
    );

    // Send the request body through the gzip stream to the server.
    gzip.end(request);
  });
});
