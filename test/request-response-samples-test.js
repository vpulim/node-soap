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
    if(!requestContext.expectedRequest)return res.end(requestContext.responseToSend);
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
  var requestJSON = path.resolve(test, 'request.json');
  var requestXML = path.resolve(test, 'request.xml');
  var responseJSON = path.resolve(test, 'response.json');
  var responseJSONError = path.resolve(test, 'error_response.json');
  var responseXML = path.resolve(test, 'response.xml');

  //response JSON is optional
  if (fs.existsSync(responseJSON))responseJSON = require(responseJSON);
  else if(fs.existsSync(responseJSONError))responseJSON = require(responseJSONError);
  else responseJSON = null;

  //requestXML is optional
  if(fs.existsSync(requestXML))requestXML = ""+fs.readFileSync(requestXML);
  else requestXML = null;

  //responseJSON is required as node-soap will expect a request object anyway
  requestJSON = require(requestJSON);

  //responseXML is required, as node-soap needs something to handle.
  responseXML = ""+fs.readFileSync(responseXML);

  generateTest(name, methodName, wsdl, requestXML, requestJSON, responseXML, responseJSON);
});

function generateTest(name, methodName, wsdlPath, requestXML, requestJSON, responseXML, responseJSON){
  suite[name] = function(done){
    if(requestXML)requestContext.expectedRequest = requestXML;
    requestContext.responseToSend = responseXML;
    soap.createClient(wsdlPath, function(err, client){
      client[methodName](requestJSON, function(err, json, body){
        if(requestJSON){
          if (err) {
            assert.deepEqual(err.root, responseJSON);
          } else {
            assert.deepEqual(json, responseJSON);
          }
        }
        if(responseXML) {
          assert.deepEqual(body, responseXML);
        }
        done();
      });
    }, 'http://localhost:'+port+'/Message/Message.dll?Handler=Default');
  };
}
