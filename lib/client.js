/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

"use strict";

function findKey(obj, val) {
  for (var n in obj)
    if (obj[n] === val)
      return n;
}

var http = require('./http'),
  assert = require('assert'),
  url = require('url');

var Client = function(wsdl, endpoint, options) {
  options = options || {};
  this.wsdl = wsdl;
  this._initializeOptions(options);
  this._initializeServices(endpoint);
};

Client.prototype.addSoapHeader = function(soapHeader, name, namespace, xmlns) {
  if (!this.soapHeaders) {
    this.soapHeaders = [];
  }
  if (typeof soapHeader === 'object') {
    soapHeader = this.wsdl.objectToXML(soapHeader, name, namespace, xmlns, true);
  }
  this.soapHeaders.push(soapHeader);
};

Client.prototype.getSoapHeaders = function() {
  return this.soapHeaders;
};

Client.prototype.clearSoapHeaders = function() {
  this.soapHeaders = null;
};

Client.prototype.setEndpoint = function(endpoint) {
  this.endpoint = endpoint;
  this._initializeServices(endpoint);
};

Client.prototype.describe = function() {
  var types = this.wsdl.definitions.types;
  return this.wsdl.describeServices();
};

Client.prototype.setSecurity = function(security) {
  this.security = security;
};

Client.prototype.setSOAPAction = function(SOAPAction) {
  this.SOAPAction = SOAPAction;
};

Client.prototype._initializeServices = function(endpoint) {
  var definitions = this.wsdl.definitions,
    services = definitions.services;
  for (var name in services) {
    this[name] = this._defineService(services[name], endpoint);
  }
};

Client.prototype._initializeOptions = function(options) {
  this.wsdl.options.attributesKey = options.attributesKey || 'attributes';
  this._options = options;
};

Client.prototype._defineService = function(service, endpoint) {
  var ports = service.ports,
    def = {};
  for (var name in ports) {
    def[name] = this._definePort(ports[name], endpoint ? endpoint : ports[name].location);
  }
  return def;
};

Client.prototype._definePort = function(port, endpoint) {
  var location = endpoint,
    binding = port.binding,
    methods = binding.methods,
    def = {};
  for (var name in methods) {
    def[name] = this._defineMethod(methods[name], location);
    this[name] = def[name];
  }
  return def;
};

Client.prototype._defineMethod = function(method, location) {
  var self = this;
  return function(args, callback, options, extraHeaders) {
    if (typeof args === 'function') {
      callback = args;
      args = {};
    }
    self._invoke(method, args, location, function(error, result, raw) {
      callback(error, result, raw);
    }, options, extraHeaders);
  };
};

Client.prototype._invoke = function(method, args, location, callback, options, extraHeaders) {
  var self = this,
    name = method.$name,
    input = method.input,
    output = method.output,
    style = method.style,
    defs = this.wsdl.definitions,
    ns = defs.$targetNamespace,
    encoding = '',
    message = '',
    xml = null,
    req = null,
    soapAction = this.SOAPAction ? this.SOAPAction(ns, name) : (method.soapAction || (((ns.lastIndexOf("/") !== ns.length - 1) ? ns + "/" : ns) + name)),
    headers = this._options.soap12 ? {
      'Content-Type': 'application/soap+xml;charset=UTF-8;action="' + soapAction + '"'
    } : {
      SOAPAction: '"' + soapAction + '"',
      'Content-Type': "text/xml; charset=utf-8"
    },
    alias = findKey(defs.xmlns, ns);

  options = options || {};

  //Add extra headers
  for (var attr in extraHeaders) { headers[attr] = extraHeaders[attr]; }

  // Allow the security object to add headers
  if (self.security && self.security.addHeaders)
    self.security.addHeaders(headers);
  if (self.security && self.security.addOptions)
    self.security.addOptions(options);

  if (input.parts) {
    assert.ok(!style || style === 'rpc', 'invalid message definition for document style binding');
    message = self.wsdl.objectToRpcXML(name, args, alias, ns);
    (method.inputSoap === 'encoded') && (encoding = 'soap:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" ');
  } else if (typeof (args) === 'string') {
    message = args;
  } else {
    assert.ok(!style || style === 'document', 'invalid message definition for rpc style binding');
    // pass `input.$lookupType` if `input.$type` could not be found
    message = self.wsdl.objectToDocumentXML(input.$name, args, input.targetNSAlias, input.targetNamespace, (input.$type || input.$lookupType));
  }
  xml = "<soap:Envelope " +
    "xmlns:soap=\"http://" +
    (this._options.soap12 ? "www.w3.org/2003/05/soap-envelope" : "schemas.xmlsoap.org/soap/envelope/") +
    "\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" " +
    encoding +
    this.wsdl.xmlnsInEnvelope + '>' +
    "<soap:Header>" +
    (self.soapHeaders ? self.soapHeaders.join("\n") : "") +
    (self.security ? self.security.toXML() : "") +
    "</soap:Header>" +
    "<soap:Body>" +
    message +
    "</soap:Body>" +
    "</soap:Envelope>";

  self.lastMessage = message;
  self.lastRequest = xml;

  req = http.request(location, xml, function(err, response, body) {
    var result;
    var obj;
    self.lastResponse = body;
    self.lastResponseHeaders = response && response.headers;

    if (err) {
      callback(err);
    } else if (response.statusCode !== 200) {
      callback(new Error('Invalid response: ' + response.statusCode + '\nBody: ' + body));
    } else {
      try {
        obj = self.wsdl.xmlToObject(body);
      } catch (error) {
        error.response = response;
        error.body = body;
        return callback(error, response, body);
      }

      result = obj.Body[output.$name];
      // RPC/literal response body may contain elements with added suffixes I.E.
      // 'Response', or 'Output', or 'Out'
      // This doesn't necessarily equal the ouput message name. See WSDL 1.1 Section 2.4.5
      if(!result){
        result = obj.Body[output.$name.replace(/(?:Out(?:put)?|Response)$/, '')];
      }
      if (!result) {
        ['Response', 'Out', 'Output'].forEach(function (term) {
          if (obj.Body.hasOwnProperty(name + term)) {
            return result = obj.Body[name + term];
          }
        });
      }

      callback(null, result, body);
    }
  }, headers, options);

  // Added mostly for testability, but possibly useful for debugging
  self.lastRequestHeaders = req.headers;
};

exports.Client = Client;
