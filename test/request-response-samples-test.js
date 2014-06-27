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
  doneHandler:null,
  requestHandler:function(req, res){
    var chunks = [];
    req.on('data', function(chunk){
      chunks.push(chunk);
    });
    req.on('end', function(){
      if(!requestContext.expectedRequest)return res.end(requestContext.responseToSend);
      if(!requestContext.responseToSend)return requestContext.doneHandler();
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
  beforeEach:function(){
    requestContext.expectedRequest = null;
    requestContext.responseToSend = null;
    requestContext.doneHandler = null;
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
  var attributesFile = path.resolve(test, 'attributes_key');
  var options = path.resolve(test, 'options.json');
  var attributesKey = 'attributes';
  //response JSON is optional
  if (fs.existsSync(responseJSON))responseJSON = require(responseJSON);
  else if(fs.existsSync(responseJSONError))responseJSON = require(responseJSONError);
  else responseJSON = null;

  //requestXML is optional
  if(fs.existsSync(requestXML))requestXML = ""+fs.readFileSync(requestXML);
  else requestXML = null;

  //responseXML is optional
  if(fs.existsSync(responseXML))responseXML = ""+fs.readFileSync(responseXML);
  else responseXML = null;

  //responseJSON is required as node-soap will expect a request object anyway
  requestJSON = require(requestJSON);

  //options is optional
  if (fs.existsSync(options))options = require(options);
  else options = {};

  if (fs.existsSync(attributesFile)) attributesKey = fs.readFileSync(attributesFile, 'ascii').trim();

  generateTest(name, methodName, wsdl, requestXML, requestJSON, responseXML, responseJSON, attributesKey, options);
});

function generateTest(name, methodName, wsdlPath, requestXML, requestJSON, responseXML, responseJSON, attributesKey, options){
  suite[name] = function(done){
    if(requestXML)requestContext.expectedRequest = requestXML;
    if(responseXML)requestContext.responseToSend = responseXML;
    requestContext.doneHandler = done;
    soap.createClient(wsdlPath, {attributesKey: attributesKey }, function(err, client){
      client[methodName](requestJSON, function(err, json, body){
        if(requestJSON){
          if (err) {
            assert.deepEqual(err.root, responseJSON);
          } else {
            // assert.deepEqual(json, responseJSON);
            assert.equal(JSON.stringify(json), JSON.stringify(responseJSON));
          }
        }
        if(responseXML && !options.extractEnvelope) {
          assert.deepEqual(body, responseXML);
        }
        done();
      }, options);
    }, 'http://localhost:'+port+'/Message/Message.dll?Handler=Default');
  };
}
