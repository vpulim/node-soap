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

var HttpClient = require('./http'),
  assert = require('assert'),
  events = require('events'),
  util = require('util'),
  debug = require('debug')('node-soap'),
  url = require('url'),
  _ = require('lodash');

var Client = function(wsdl, endpoint, options) {
  events.EventEmitter.call(this);

  options = options || {};
  this.wsdl = wsdl;
  this._initializeOptions(options);
  this._initializeServices(endpoint);
  this.httpClient = options.httpClient || new HttpClient(options);
};
util.inherits(Client, events.EventEmitter);

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

Client.prototype.addBodyAttribute = function(bodyAttribute, name, namespace, xmlns) {
  if (!this.bodyAttributes) {
    this.bodyAttributes = [];
  }
  if (typeof bodyAttribute === 'object') {
    var composition = '';
    Object.getOwnPropertyNames(bodyAttribute).forEach(function(prop, idx, array) {
      composition += ' ' + prop + '="' + bodyAttribute[prop] + '"';
    });
    bodyAttribute = composition;
  }
  if (bodyAttribute.substr(0, 1) !== ' ') bodyAttribute = ' ' + bodyAttribute;
  this.bodyAttributes.push(bodyAttribute);
};

Client.prototype.getBodyAttributes = function() {
  return this.bodyAttributes;
};

Client.prototype.clearBodyAttributes = function() {
  this.bodyAttributes = null;
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
    self._invoke(method, args, location, function(error, result, raw, soapHeader) {
      callback(error, result, raw, soapHeader);
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
    soapAction,
    alias = findKey(defs.xmlns, ns),
    headers = {
      'Content-Type': "text/xml; charset=utf-8"
    };

  if (this.SOAPAction) {
    soapAction = this.SOAPAction;
  } else if (method.soapAction !== undefined && method.soapAction !== null) {
    soapAction = method.soapAction;
  } else {
    soapAction = ((ns.lastIndexOf("/") !== ns.length - 1) ? ns + "/" : ns) + name;
  }

  headers.SOAPAction = '"' + soapAction + '"';

  options = options || {};

  //Add extra headers
  for (var attr in extraHeaders) { headers[attr] = extraHeaders[attr]; }

  // Allow the security object to add headers
  if (self.security && self.security.addHeaders)
    self.security.addHeaders(headers);
  if (self.security && self.security.addOptions)
    self.security.addOptions(options);

  if (input.parts || args === null) {
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
    "xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\" " +
    "xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" " +
    encoding +
    this.wsdl.xmlnsInEnvelope + '>' +
    ((self.soapHeaders || self.security) ?
      (
        "<soap:Header>" +
        (self.soapHeaders ? self.soapHeaders.join("\n") : "") +
        (self.security ? self.security.toXML() : "") +
        "</soap:Header>"
      )
      :
        ''
      ) +
    "<soap:Body" +
    (self.bodyAttributes ? self.bodyAttributes.join(' ') : '') +
    ">" +
    message +
    "</soap:Body>" +
    "</soap:Envelope>";

  self.lastMessage = message;
  self.lastRequest = xml;
  self.lastEndpoint = location;

  self.emit('message', message);
  self.emit('request', xml);

  var tryJSONparse = function(body) {
    try {
      return JSON.parse(body);
    }
    catch(err) {
      return undefined;
    }
  };

  req = self.httpClient.request(location, xml, function(err, response, body) {
    var result;
    var obj;
    self.lastResponse = body;
    self.lastResponseHeaders = response && response.headers;
    self.emit('response', body);

    if (err) {
      callback(err);
    } else {

      try {
        obj = self.wsdl.xmlToObject(body);
      } catch (error) {
        //  When the output element cannot be looked up in the wsdl and the body is JSON
        //  instead of sending the error, we pass the body in the response.
        if(!output.$lookupTypes) {
          debug('Response element is not present. Unable to convert response xml to json.');
          //  If the response is JSON then return it as-is.
          var json = _.isObject(body) ? body : tryJSONparse(body);
          if (json) {
            return callback(null, response, json);
          }
        }
        error.response = response;
        error.body = body;
        self.emit('soapError', error);
        return callback(error, response, body);
      }

      if (!output){
        // one-way, no output expected
        return callback(null, null, body, obj.Header);
      }

      if( typeof obj.Body !== 'object' ) {
        var error = new Error('Cannot parse response');
        error.response = response;
        error.body = body;
        return callback(error, obj, body);
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

      callback(null, result, body, obj.Header);
    }
  }, headers, options, self);

  // Added mostly for testability, but possibly useful for debugging
  self.lastRequestHeaders = req.headers;
};

exports.Client = Client;
