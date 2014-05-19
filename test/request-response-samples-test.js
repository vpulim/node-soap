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
  var nameParts = path.basename(test).split('__');
  var name = nameParts[1].replace(/_/g, ' ');
  var methodName = nameParts[0];
  var wsdl = path.resolve(test, 'soap.wsdl');
  var requestJSON = require(path.resolve(test, 'request.json'));
  var requestXML = ""+fs.readFileSync(path.resolve(test, 'request.xml'));
  var responseJSON = null;
  if (fs.existsSync(path.resolve(test, 'response.json'))) {
    responseJSON = require(path.resolve(test, 'response.json'));
  } else {
    // assume testing error condition if response.json not found
    responseJSON = require(path.resolve(test, 'error_response.json'));
  }
  var responseXML = ""+fs.readFileSync(path.resolve(test, 'response.xml'));
  fs.readFile(path.resolve(name, 'namespace_prefix'), function (err, file) {
    var attributesNamespace = '';
    if (file) {
      attributesNamespace = file.trim();
    }
    generateTest(name, methodName, wsdl, requestXML, requestJSON, responseXML, responseJSON, attributesNamespace);
  });
});

function generateTest(name, methodName, wsdlPath, requestXML, requestJSON, responseXML, responseJSON, attributesNamespace){
  suite[name] = function(done){
    requestContext.expectedRequest = requestXML;
    requestContext.responseToSend = responseXML;
    soap.createClient(wsdlPath, function(err, client){
      client.setAttributesNamespace(attributesNamespace);
      client[methodName](requestJSON, function(err, json, body){
        if (err) {
          assert.deepEqual(err.root, responseJSON);
        } else {
          assert.deepEqual(json, responseJSON);
        }
        assert.deepEqual(body, responseXML);
        done();
      });
    }, 'http://localhost:'+port+'/Message/Message.dll?Handler=Default');
  };
}
