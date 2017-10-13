'use strict';

var fs = require('fs'),
    soap = require('..'),
    http = require('http'),
    assert = require('assert'),
  duplexer = require('duplexer'),
  req = require('request'),
  httpClient = require('../lib/http.js'),
 // stream = require('stream'),
  stream = require('readable-stream'),
  util = require('util'),
  events = require('events'),
  semver = require('semver'),
  should = require('should');

it('should allow customization of httpClient and the wsdl file download should pass through it', function(done) {
  
//Make a custom http agent to use streams instead on net socket
  function CustomAgent(options, socket){
    var self = this;
    events.EventEmitter.call(this);
    self.requests = [];
    self.maxSockets = 1;
    self.proxyStream = socket;
    self.options = options || {};
    self.proxyOptions = {};
  }
  
  util.inherits(CustomAgent, events.EventEmitter);
    
  CustomAgent.prototype.addRequest = function(req, options) {
    req.onSocket(this.proxyStream);
  };

  //Create a duplex stream 
    
  var httpReqStream = new stream.PassThrough();
  var httpResStream = new stream.PassThrough();
  var socketStream = duplexer(httpReqStream, httpResStream);

  // Node 4.x requires cork/uncork
  socketStream.cork = function() {
  };

  socketStream.uncork = function() {
  };

  socketStream.destroy = function() {
  };

  //Custom httpClient  
  function MyHttpClient (options, socket){
    httpClient.call(this,options);
    this.agent = new CustomAgent(options, socket);
  }
    
  util.inherits(MyHttpClient, httpClient);
    
  MyHttpClient.prototype.request = function(rurl, data, callback, exheaders, exoptions) {
    var self = this;
    var options = self.buildRequest(rurl, data, exheaders, exoptions);
    //Specify agent to use
    options.agent = this.agent;
    var headers = options.headers;
    var req = self._request(options, function(err, res, body) {
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
  
  var wsdl = fs.readFileSync('./test/wsdl/default_namespace.wsdl').toString('utf8');
  //Should be able to read from stream the request 
  httpReqStream.once('readable', function readRequest() {
    var chunk = httpReqStream.read();
    should.exist(chunk);
    
    //This is for compatibility with old node releases <= 0.10
    //Hackish
    if(semver.lt(process.version, '0.11.0'))
    {
      socketStream.on('data', function(data) {
        socketStream.ondata(data,0,1984);
      });
    }
    //Now write the response with the wsdl
    var state = httpResStream.write('HTTP/1.1 200 OK\r\nContent-Type: text/xml; charset=utf-8\r\nContent-Length: 1904\r\n\r\n'+wsdl);
  });

  var httpCustomClient = new MyHttpClient({}, socketStream);
  var url = 'http://localhost:50000/Platform.asmx?wsdl';
  soap.createClient(url,
    {httpClient: httpCustomClient},
    function(err, client) {
      assert.ok(client);
      assert.ifError(err);
      assert.equal(client.httpClient, httpCustomClient);
      var description = (client.describe());
      assert.deepEqual(client.describe(), {
        MyService: {
          MyServicePort: {
            MyOperation: {
              input: {
              },
              output: {
              }
            }
          }
        }
      });
      done();
    });
});
