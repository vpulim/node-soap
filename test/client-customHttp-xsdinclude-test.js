'use strict';

var soap = require('..'),
  assert = require('assert'),
  httpClient = require('../lib/http.js').HttpClient,
  util = require('util'),
  events = require('events'),
  createSocketStream = require('./_socketStream');

it('should allow customization of httpClient, the wsdl file, and associated data download should pass through it', function (done) {
  //Make a custom http agent to use streams instead of a real net socket
  function CustomAgent(options, wsdl, xsd) {
    var self = this;
    events.EventEmitter.call(this);
    self.requests = [];
    self.maxSockets = 1;
    self.wsdlStream = wsdl;
    self.xsdStream = xsd;
    self.options = options || {};
    self.proxyOptions = {};
  }

  util.inherits(CustomAgent, events.EventEmitter);

  CustomAgent.prototype.addRequest = function (req, options) {
    if (/\?xsd$/.test(req.path)) {
      req.onSocket(this.xsdStream);
    } else {
      req.onSocket(this.wsdlStream);
    }
  };

  //Custom httpClient
  class MyHttpClient extends httpClient {
    constructor(options, wsdlSocket, xsdSocket) {
      super(options);

      // axios needs this since 1.13.2
      if (wsdlSocket && typeof wsdlSocket?.setTimeout !== 'function') {
        wsdlSocket.setTimeout = function () {};
      }
      if (xsdSocket && typeof xsdSocket?.setTimeout !== 'function') {
        xsdSocket.setTimeout = function () {};
      }

      this.agent = new CustomAgent(options, wsdlSocket, xsdSocket);
    }
  }

  MyHttpClient.prototype.request = function (rurl, data, callback, exheaders, exoptions) {
    var self = this;
    var options = self.buildRequest(rurl, data, exheaders, exoptions);
    //Specify agent to use
    options.httpAgent = this.agent;
    var headers = options.headers;
    var req = self._request(options).then(
      function (res) {
        res.data = self.handleResponse(req, res, res.data);
        callback(null, res, res.data);
        if (headers.Connection !== 'keep-alive') {
          res.request.end(data);
        }
      },
      (err) => {
        return callback(err);
      },
    );
    return req;
  };

  var httpCustomClient = new MyHttpClient({}, createSocketStream(__dirname + '/wsdl/xsdinclude/xsd_include_http.wsdl'), createSocketStream(__dirname + '/wsdl/xsdinclude/types.xsd'));
  var url = 'http://localhost:50000/Dummy.asmx?wsdl';
  soap.createClient(url, { httpClient: httpCustomClient }, function (err, client) {
    assert.ok(client);
    assert.ifError(err);
    assert.equal(client.httpClient, httpCustomClient);
    var description = client.describe();
    assert.deepEqual(client.describe(), {
      DummyService: {
        DummyPortType: {
          Dummy: {
            input: {
              ID: 'IdType|xs:string|pattern',
              Name: 'NameType|xs:string|minLength,maxLength',
            },
            output: {
              Result: 'dummy:DummyList',
            },
          },
        },
      },
    });
    done();
  });
});
