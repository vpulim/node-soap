"use strict";

var assert = require('assert');
var fs   = require('fs');
var glob   = require('glob');
var http = require('http');
var path = require('path');
var soap = require('../');
var server;
var port;
var endpoint;
var tests = glob.sync('./request-response-samples/*', {cwd:__dirname})
  .map(function(node){return path.resolve(__dirname, node);})
  .filter(function(node){return fs.statSync(node).isDirectory();});
var suite = {};

var requestContext = {
  //set these two within each test
  expectedRequest:null,
  responseToSend:null,
  requestHandler:function(req, res){
    var chunks = [];
    req.on('data', function(chunk){
      chunks.push(chunk);
    });
    req.on('end', function(){
      assert.equal(chunks.join(''), requestContext.expectedRequest);
      res.end(requestContext.responseToSend);
      requestContext.expectedRequest = null;
      requestContext.responseToSend = null;
    });
  }
};

module.exports = {
  before:function(done){
    server = http.createServer(requestContext.requestHandler);
    server.listen(0, function(e){
      if(e)return done(e);
      port = server.address().port;
      done();
    });
  },
  after:function(){
    server.close();
  },
  'Request Response Sampling':suite
};

tests.forEach(function(test){
  var name = path.basename(test);
  var wsdl = path.resolve(test, 'soap.wsdl');
  var requestJSON = require(path.resolve(test, 'request.json'));
  var requestXML = ""+fs.readFileSync(path.resolve(test, 'request.xml'));
  var responseJSON = require(path.resolve(test, 'response.json'));
  var responseXML = ""+fs.readFileSync(path.resolve(test, 'response.xml'));

  generateTest(name, wsdl, requestXML, requestJSON, responseXML, responseJSON);
});

function generateTest(name, wsdlPath, requestXML, requestJSON, responseXML, responseJSON){
  suite[name] = function(done){
    requestContext.expectedRequest = requestXML;
    requestContext.responseToSend = responseXML;
    soap.createClient(wsdlPath, function(err, client){
      client.Message(requestJSON, function(err, json, body){
        assert.deepEqual(json, responseJSON);
        assert.deepEqual(body, responseXML);
        done();
      });
    }, 'http://localhost:'+port+'/Message/Message.dll?Handler=Default');
  };
}
