'use strict';

var assert = require('assert');
var fs   = require('fs');
var glob   = require('glob');
var http = require('http');
var path = require('path');
var timekeeper = require('timekeeper');
var jsdiff = require('diff');
require('colors');
var soap = require('../');
var WSSecurity = require('../lib/security').WSSecurity;
var server;
var port;
var tests = glob.sync('./request-response-samples/*', {cwd:__dirname})
  .map(function(node){return path.resolve(__dirname, node);})
  .filter(function(node){return fs.statSync(node).isDirectory();});
var suite = {};

function normalizeWhiteSpace(raw)
{
  var normalized = raw.replace(/\r\n|\r|\n/g, '');  // strip line endings
  normalized = normalized.replace(/\s\s+/g, ' '); // convert whitespace to spaces
  normalized = normalized.replace(/> </g, '><');  // get rid of spaces between elements
  return normalized;
}

var requestContext = {
  //set these two within each test
  expectedRequest:null,
  responseToSend:null,
  doneHandler:null,
  requestHandler:function(req, res){
    var chunks = [];
    req.on('data', function(chunk){
      // ignore eol on sample files.
      chunks.push(chunk.toString().replace(/\r?\n$/m, ''));
    });
    req.on('end', function(){
      if(!requestContext.expectedRequest)return res.end(requestContext.responseToSend);

      var actualRequest = normalizeWhiteSpace(chunks.join(''));
      var expectedRequest = normalizeWhiteSpace(requestContext.expectedRequest);

      if (actualRequest !== expectedRequest) {
        var diff = jsdiff.diffChars(actualRequest, expectedRequest);
        var comparison = '';
        diff.forEach(function(part) {
          var color = 'grey';
          if (part.added) { color = 'green'; }
          if (part.removed) { color = 'red'; }
          comparison += part.value[color];
        });
        console.log(comparison);
      }

      assert.equal(actualRequest, expectedRequest);

      if(!requestContext.responseToSend)return requestContext.doneHandler();
      if(requestContext.responseHttpHeaders){
        for(const headerKey in requestContext.responseHttpHeaders ){
          res.setHeader(headerKey,requestContext.responseHttpHeaders[headerKey]);
        }
      }
      res.end(requestContext.responseToSend);

      requestContext.expectedRequest = null;
      requestContext.responseToSend = null;
    });
  }
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
  var wsdlJSOptionsFile = path.resolve(test, 'wsdl_options.js');
  var responseHttpHeaders = path.resolve(test,'responseHttpHeader.json');
  var attachmentParts = path.resolve(test, "attachmentParts.js");
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
  else if(fs.existsSync(wsdlJSOptionsFile)) wsdlOptions = require(wsdlJSOptionsFile);
  else wsdlOptions = {};


  //responseHttpHeaders
  if(fs.existsSync(responseHttpHeaders))  responseHttpHeaders = require(responseHttpHeaders)
  else responseHttpHeaders = null;

  //attachmentParts
  if(fs.existsSync(attachmentParts))  attachmentParts = require(attachmentParts)
  else attachmentParts = null;

  generateTest(name, methodName, wsdl, headerJSON, securityJSON, requestXML, requestJSON, responseXML, responseJSON, responseSoapHeaderJSON, wsdlOptions, options, responseHttpHeaders, attachmentParts, false);
  generateTest(name, methodName, wsdl, headerJSON, securityJSON, requestXML, requestJSON, responseXML, responseJSON, responseSoapHeaderJSON, wsdlOptions, options, responseHttpHeaders, attachmentParts, true);
});

function generateTest(name, methodName, wsdlPath, headerJSON, securityJSON, requestXML, requestJSON, responseXML, responseJSON, responseSoapHeaderJSON, wsdlOptions, options, responseHttpHeaders, attachmentParts, usePromises){
  var methodCaller = cbCaller;

  if (usePromises) {
    name += ' (promisified)';
    methodName += 'Async';
    methodCaller = promiseCaller;
  }

  suite[name] = function(done){
    if(requestXML) requestContext.expectedRequest = requestXML;
    if(responseXML) requestContext.responseToSend = responseXML;
    requestContext.doneHandler = done;
    requestContext.responseHttpHeaders = responseHttpHeaders;
    soap.createClient(wsdlPath, wsdlOptions, function(err, client){
      if (headerJSON) {
        for (var headerKey in headerJSON) {
          client.addSoapHeader(headerJSON[headerKey], headerKey);
        }
      }
      if (securityJSON && securityJSON.type === 'ws') {
        client.setSecurity(new WSSecurity(securityJSON.username, securityJSON.password, securityJSON.options));
      }

      //throw more meaningful error
      if(typeof client[methodName] !== 'function'){
        throw new Error('method ' + methodName + ' does not exists in wsdl specified in test wsdl: ' + wsdlPath);
      }

      methodCaller(client, methodName, requestJSON, responseJSON, responseSoapHeaderJSON, options, attachmentParts, done);
    }, 'http://localhost:'+port+'/Message/Message.dll?Handler=Default');
  };
}

function cbCaller(client, methodName, requestJSON, responseJSON, responseSoapHeaderJSON, options, attachmentParts, done){
  client[methodName](requestJSON, function(err, json, body, soapHeader){
    if(requestJSON){
      if (err) {
        assert.notEqual('undefined: undefined', err.message);
        assert.deepEqual(err.root, responseJSON);
      } else {
        // assert.deepEqual(json, responseJSON);
        assert.equal(JSON.stringify(typeof json === 'undefined' ? null : json), JSON.stringify(responseJSON));
        if(responseSoapHeaderJSON){
          assert.equal(JSON.stringify(soapHeader), JSON.stringify(responseSoapHeaderJSON));
        }
        if(client.lastReponseAttachments){
          assert.deepEqual(client.lastReponseAttachments.parts,attachmentParts)
        }
      }
    }
    done();
  }, options);
}

function promiseCaller(client, methodName, requestJSON, responseJSON, responseSoapHeaderJSON, options, attachmentParts, done){
  client[methodName](requestJSON).then(function(responseArr){
    const respAttachments = client.lastReponseAttachments;
    var json = responseArr[0];
    var body = responseArr[1];
    var soapHeader = responseArr[2];

    if(requestJSON){
      // assert.deepEqual(json, responseJSON);
      assert.equal(JSON.stringify(typeof json === 'undefined' ? null : json), JSON.stringify(responseJSON));
      if(responseSoapHeaderJSON){
        assert.equal(JSON.stringify(soapHeader), JSON.stringify(responseSoapHeaderJSON));
      }
      if(client.lastReponseAttachments){
        assert.deepEqual(client.lastReponseAttachments.parts,attachmentParts)
      }
    }
  }).catch(function(err) {
    if(requestJSON){
      assert.notEqual('undefined: undefined', err.message);
      assert.deepEqual(err.root, responseJSON);
    }
  }).finally(function() {
    done();
  });
}

describe('Request Response Sampling', function() {
  var origRandom = Math.random;

  before(function(done){
    timekeeper.freeze(Date.parse('2014-10-12T01:02:03Z'));
    Math.random = function() { return 1; };
    server = http.createServer(requestContext.requestHandler);
    server.listen(0, function(e){
      if(e)return done(e);
      port = server.address().port;
      done();
    });
  });

  beforeEach(function(){
    requestContext.expectedRequest = null;
    requestContext.responseToSend = null;
    requestContext.doneHandler = null;
  });

  after(function(){
    timekeeper.reset();
    Math.random = origRandom;
    server.close();
  });

  Object.keys(suite).map(function(key) {
    it(key, suite[key]);
  });
});
