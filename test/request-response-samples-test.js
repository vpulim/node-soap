'use strict';

var assert = require('assert');
var fs   = require('fs');
var glob   = require('glob');
var http = require('http');
var path = require('path');
var timekeeper = require('timekeeper');
var soap = require('../');
var WSSecurity = require('../lib/security/WSSecurity');
var server;
var port;
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

var origRandom = Math.random;
module.exports = {
  before:function(done){
    timekeeper.freeze(Date.parse('2014-10-12T01:02:03Z'));
    Math.random = function() { return 1; };
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
    timekeeper.reset();
    Math.random = origRandom;
    server.close();
  },
  'Request Response Sampling':suite
};

tests.forEach(function(test){
  var nameParts = path.basename(test).split('__');
  var name = nameParts[1].replace(/_/g, ' ');
  var methodName = nameParts[0];
  var wsdl = path.resolve(test, 'soap.wsdl');
  var headerJSON = path.resolve(test, 'header.json');
  var securityJSON = path.resolve(test, 'security.json');
  var requestJSON = path.resolve(test, 'request.json');
  var requestXML = path.resolve(test, 'request.xml');
  var responseJSON = path.resolve(test, 'response.json');
  var responseSoapHeaderJSON = path.resolve(test, 'responseSoapHeader.json');
  var responseJSONError = path.resolve(test, 'error_response.json');
  var responseXML = path.resolve(test, 'response.xml');
  var options = path.resolve(test, 'options.json');
  var wsdlOptionsFile = path.resolve(test, 'wsdl_options.json');
  var wsdlOptions = {};

  //headerJSON is optional
  if(fs.existsSync(headerJSON))headerJSON = require(headerJSON);
  else headerJSON = {};

  //securityJSON is optional
  if(fs.existsSync(securityJSON))securityJSON = require(securityJSON);
  else securityJSON = {};

  //responseJSON is optional
  if (fs.existsSync(responseJSON))responseJSON = require(responseJSON);
  else if(fs.existsSync(responseJSONError))responseJSON = require(responseJSONError);
  else responseJSON = null;

  //responseSoapHeaderJSON is optional
  if (fs.existsSync(responseSoapHeaderJSON))responseSoapHeaderJSON = require(responseSoapHeaderJSON);
  else responseSoapHeaderJSON = null;

  //requestXML is optional
  if(fs.existsSync(requestXML))requestXML = ''+fs.readFileSync(requestXML);
  else requestXML = null;

  //responseXML is optional
  if(fs.existsSync(responseXML))responseXML = ''+fs.readFileSync(responseXML);
  else responseXML = null;

  //requestJSON is required as node-soap will expect a request object anyway
  requestJSON = require(requestJSON);

  //options is optional
  if (fs.existsSync(options))options = require(options);
  else options = {};

  //wsdlOptions is optional
  if(fs.existsSync(wsdlOptionsFile)) wsdlOptions = require(wsdlOptionsFile);
  else wsdlOptions = {};

  generateTest(name, methodName, wsdl, headerJSON, securityJSON, requestXML, requestJSON, responseXML, responseJSON, responseSoapHeaderJSON, wsdlOptions, options);
});

function generateTest(name, methodName, wsdlPath, headerJSON, securityJSON, requestXML, requestJSON, responseXML, responseJSON, responseSoapHeaderJSON, wsdlOptions, options){
  suite[name] = function(done){
    if(requestXML)requestContext.expectedRequest = requestXML;
    if(responseXML)requestContext.responseToSend = responseXML;
    requestContext.doneHandler = done;
    soap.createClient(wsdlPath, wsdlOptions, function(err, client){
      if (headerJSON) {
        for (var headerKey in headerJSON) {
          client.addSoapHeader(headerJSON[headerKey], headerKey);
        }
      }
      if (securityJSON && securityJSON.type === 'ws') {
        client.setSecurity(new WSSecurity(securityJSON.username, securityJSON.password));
      }
      client[methodName](requestJSON, function(err, json, body, soapHeader){
        if(requestJSON){
          if (err) {
            assert.deepEqual(err.root, responseJSON);
          } else {
            // assert.deepEqual(json, responseJSON);
            assert.equal(JSON.stringify(json), JSON.stringify(responseJSON));
            if(responseSoapHeaderJSON){
              assert.equal(JSON.stringify(soapHeader), JSON.stringify(responseSoapHeaderJSON));
            }
          }
        }
        done();
      }, options);
    }, 'http://localhost:'+port+'/Message/Message.dll?Handler=Default');
  };
}
