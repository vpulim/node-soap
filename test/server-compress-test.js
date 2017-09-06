'use strict';

var fs = require('fs');
var soap = require('..');
var assert = require('assert');

var http = require('http');
var zlib = require('zlib');

var path = 'test/request-response-samples/DefaultNamespace__no_xmlns_prefix_used_for_default_namespace/';

var wsdl = path + 'soap.wsdl'

var xml = fs.readFileSync(path + '/soap.wsdl', 'utf8');
var request = fs.readFileSync(path + '/request.xml', 'utf8');
var json = fs.readFileSync(path + '/response.json', 'utf8');
var response = fs.readFileSync(path + '/response.xml', 'utf8');


var service = {
  MyService: {
    MyServicePort: {
      DefaultNamespace: function (args) {
        return JSON.parse(json);
      }
    }
  }
};

describe('SOAP Server', function () {
  it('should properly handle compression', function (done) {
    //http server example
    var server = http.createServer(function (req, res) {});
    var clientResponse, gunzipResponse;
    var count = 0;

    var check = function (a, b) {
      count += 1;

      if (a && b) {
        assert(a === b);
      }

      if (count === 2) {
        done();
      }
    }

    server.listen(8000);
    soap.listen(server, '/wsdl', service, xml);

    soap.createClient(wsdl, {
      endpoint: 'http://localhost:8000/wsdl'
    }, function (error, client) {
      assert(!error);
      client.DefaultNamespace({}, function (error, response) {
        assert(!error);
        clientResponse = client.lastResponse;
        check(clientResponse, gunzipResponse);
      });
    });

    var gzip = zlib.createGzip();

    gzip.pipe(http.request({
      host: 'localhost',
      path: '/wsdl',
      port: 8000,
      method: 'POST',
      headers: {
        'content-type': 'text/xml; charset=utf-8',
        'content-encoding': 'gzip',
        'soapaction': '"DefaultNamespace"'
      }
    }, function (res) {
      var body = '';
      res.on('data', function (data) {
        body += data;
      });
      res.on('end', function () {
        gunzipResponse = body;
        check(clientResponse, gunzipResponse);
        server.close();
      });
    }));

    gzip.end(request);
  });
});
