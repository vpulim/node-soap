'use strict';

var soap = require('..'),
  http = require('http'),
  assert = require('assert'),
  req = require('request'),
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
  function MyHttpClient(options, wsdlSocket, xsdSocket) {
    httpClient.call(this, options);
    this.agent = new CustomAgent(options, wsdlSocket, xsdSocket);
  }

  util.inherits(MyHttpClient, httpClient);

  MyHttpClient.prototype.request = function (
    rurl,
    data,
    callback,
    exheaders,
    exoptions
  ) {
    var self = this;
    var options = self.buildRequest(rurl, data, exheaders, exoptions);
    //Specify agent to use
    options.agent = this.agent;
    var headers = options.headers;
    var req = self._request(options, function (err, res, body) {
      if (err) {
        return callback(err);
      }
      body = self.handleResponse(req, res, body);
      callback(null, res, body);
    });
    if (headers.Connection !== 'keep-alive') {
      req.end(data);
    }
    return req;
  };

  var httpCustomClient = new MyHttpClient(
    {},
    createSocketStream(
      __dirname + '/wsdl/xsdinclude/xsd_include_http.wsdl',
      2708
    ),
    createSocketStream(__dirname + '/wsdl/xsdinclude/types.xsd', 982)
  );
  var url = 'http://localhost:50000/Dummy.asmx?wsdl';
  soap.createClient(url, { httpClient: httpCustomClient }, function (
    err,
    client
  ) {
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
