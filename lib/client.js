/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

"use strict";


var HttpClient = require('./http'),
  assert = require('assert'),
  events = require('events'),
  util = require('util'),
  debug = require('debug')('node-soap'),
  findPrefix = require('./utils').findPrefix,
  _ = require('lodash'),
  concatStream = require('concat-stream'),
  BluebirdPromise = require("bluebird"),
  uuid4 = require('uuid/v4');

var nonIdentifierChars = /[^a-z$_0-9]/i;

var Client = function(wsdl, endpoint, options) {
  events.EventEmitter.call(this);
  options = options || {};
  this.wsdl = wsdl;
  this._initializeOptions(options);
  this._initializeServices(endpoint);
  this.httpClient = options.httpClient || new HttpClient(options);
  var promiseOptions = { multiArgs: true };
  if (options.overridePromiseSuffix) {
    promiseOptions.suffix = options.overridePromiseSuffix;
  }
  BluebirdPromise.promisifyAll(this, promiseOptions);
};
util.inherits(Client, events.EventEmitter);

Client.prototype.addSoapHeader = function(soapHeader, name, namespace, xmlns) {
  if (!this.soapHeaders) {
    this.soapHeaders = [];
  }
  if (typeof soapHeader === 'object') {
    soapHeader = this.wsdl.objectToXML(soapHeader, name, namespace, xmlns, true);
  }
  return this.soapHeaders.push(soapHeader) - 1;
};

Client.prototype.changeSoapHeader = function(index, soapHeader, name, namespace, xmlns) {
  if (!this.soapHeaders) {
    this.soapHeaders = [];
  }
  if (typeof soapHeader === 'object') {
    soapHeader = this.wsdl.objectToXML(soapHeader, name, namespace, xmlns, true);
  }
  this.soapHeaders[index] = soapHeader;
};

Client.prototype.getSoapHeaders = function() {
  return this.soapHeaders;
};

Client.prototype.clearSoapHeaders = function() {
  this.soapHeaders = null;
};

Client.prototype.addHttpHeader = function(name, value) {
  if (!this.httpHeaders) {
    this.httpHeaders = {};
  }
  this.httpHeaders[name] = value;
};

Client.prototype.getHttpHeaders = function() {
  return this.httpHeaders;
};

Client.prototype.clearHttpHeaders = function() {
  this.httpHeaders = {};
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
  this.securities = [];
  this.securities.push(security);
};

Client.prototype.appendSecurity = function(security) {
  if (!this.securities) this.securities = [];
  this.securities.push(security);
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
  this.streamAllowed = options.stream;
  this.normalizeNames = options.normalizeNames;
  this.wsdl.options.attributesKey = options.attributesKey || 'attributes';
  this.wsdl.options.envelopeKey = options.envelopeKey || 'soap';
  this.wsdl.options.preserveWhitespace = !!options.preserveWhitespace;
  if(options.ignoredNamespaces !== undefined) {
    if(options.ignoredNamespaces.override !== undefined) {
      if(options.ignoredNamespaces.override === true) {
        if(options.ignoredNamespaces.namespaces !== undefined) {
          this.wsdl.options.ignoredNamespaces = options.ignoredNamespaces.namespaces;
        }
      }
    }
  }
  if(options.overrideRootElement !== undefined) {
    this.wsdl.options.overrideRootElement = options.overrideRootElement;
  }
  this.wsdl.options.forceSoap12Headers = !!options.forceSoap12Headers;
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
    var methodName = this.normalizeNames ? name.replace(nonIdentifierChars, '_') : name;
    this[methodName] = def[name];
  }
  return def;
};

Client.prototype._defineMethod = function(method, location) {
  var self = this;
  var temp;
  return function(args, callback, options, extraHeaders) {
    if (typeof args === 'function') {
      callback = args;
      args = {};
    } else if (typeof options === 'function') {
      temp = callback;
      callback = options;
      options = temp;
    } else if (typeof extraHeaders === 'function') {
      temp = callback;
      callback = extraHeaders;
      extraHeaders = options;
      options = temp;
    }
    self._invoke(method, args, location, function(error, result, rawResponse, soapHeader, rawRequest) {
      callback(error, result, rawResponse, soapHeader, rawRequest);
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
    envelopeKey = this.wsdl.options.envelopeKey,
    ns = defs.$targetNamespace,
    encoding = '',
    message = '',
    xml = null,
    req = null,
    soapAction,
    alias = findPrefix(defs.xmlns, ns),
    headers = {
      "Content-Type": "text/xml; charset=utf-8"
    },
    xmlnsSoap = "xmlns:" + envelopeKey + "=\"http://schemas.xmlsoap.org/soap/envelope/\"";

  if (this.wsdl.options.forceSoap12Headers) {
    headers["Content-Type"] = "application/soap+xml; charset=utf-8";
    xmlnsSoap = "xmlns:" + envelopeKey + "=\"http://www.w3.org/2003/05/soap-envelope\"";
  }

  if (this.SOAPAction) {
    soapAction = this.SOAPAction;
  } else if (method.soapAction !== undefined && method.soapAction !== null) {
    soapAction = method.soapAction;
  } else {
    soapAction = ((ns.lastIndexOf("/") !== ns.length - 1) ? ns + "/" : ns) + name;
  }

  if (!this.wsdl.options.forceSoap12Headers) {
    headers.SOAPAction = '"' + soapAction + '"';
  }

  options = options || {};

  //Add extra headers
  for (var header in this.httpHeaders ) { headers[header] = this.httpHeaders[header];  }
  for (var attr in extraHeaders) { headers[attr] = extraHeaders[attr]; }

  var idx, security;
  // generate securities
  if (self.securities) {
    for(idx in self.securities) {
      security = self.securities[idx];
      if(security.addHeaders) {
        security.addHeaders(headers);
      }

      if(security.addOptions) {
        security.addOptions(options);
      }

      if(security.postProcess) {
        if(!self.bodyAttributes) self.bodyAttributes = [];
        self.bodyAttributes.push(' Id="_0"');
      } else {
        if(!self.soapHeaders) self.soapHeaders = [];
        self.soapHeaders.push(security.toXML());
      }
    }
  }
  if ((style === 'rpc')&& ( ( input.parts || input.name==="element" ) || args === null) ) {
    assert.ok(!style || style === 'rpc', 'invalid message definition for document style binding');
    message = self.wsdl.objectToRpcXML(name, args, alias, ns,(input.name!=="element" ));
    (method.inputSoap === 'encoded') && (encoding = 'soap:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" ');
  } else {
    assert.ok(!style || style === 'document', 'invalid message definition for rpc style binding');
    // pass `input.$lookupType` if `input.$type` could not be found
    message = self.wsdl.objectToDocumentXML(input.$name, args, input.targetNSAlias, input.targetNamespace, (input.$type || input.$lookupType));
  }

  xml = "<?xml version=\"1.0\" encoding=\"utf-8\"?>" +
    "<" + envelopeKey + ":Envelope " +
    xmlnsSoap + " " +
    "xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" " +
    encoding +
    this.wsdl.xmlnsInEnvelope + '>' +
    ((self.soapHeaders) ?
        (
          "<" + envelopeKey + ":Header>" +
          (self.soapHeaders ? self.soapHeaders.join("\n") : "") +
          "</" + envelopeKey + ":Header>"
        )
        :
        ''
    ) +
    "<" + envelopeKey + ":Body" +
    (self.bodyAttributes ? self.bodyAttributes.join(' ') : '') +
    ">" +
    message +
    "</" + envelopeKey + ":Body>" +
    "</" + envelopeKey + ":Envelope>";

  if (self.securities) {
    for (idx in self.securities) {
      security = self.securities[idx];
      if(security.postProcess) {
        xml = security.postProcess(xml, envelopeKey);
      }
    }
  }


  if(options && options.postProcess){
    xml = options.postProcess(xml);
  }

  self.lastMessage = message;
  self.lastRequest = xml;
  self.lastEndpoint = location;

  var eid = options.exchangeId || uuid4();

  self.emit('message', message, eid);
  self.emit('request', xml, eid);

  var tryJSONparse = function(body) {
    try {
      return JSON.parse(body);
    }
    catch(err) {
      return undefined;
    }
  };

  if (this.streamAllowed && typeof self.httpClient.requestStream === 'function') {
    callback = _.once(callback);
    var startTime = Date.now();
    req = self.httpClient.requestStream(location, xml, headers, options, self);
    self.lastRequestHeaders = req.headers;
    var onError = function onError(err) {
      self.lastResponse = null;
      self.lastResponseHeaders = null;
      self.lastElapsedTime = null;
      self.emit('response', null, null, eid);

      callback(err, undefined, undefined, undefined, xml);
    };
    req.on('error', onError);
    req.on('response', function (response) {
      response.on('error', onError);

      // When the output element cannot be looked up in the wsdl, play it safe and
      // don't stream
      if(response.statusCode !== 200 || !output || !output.$lookupTypes) {
        response.pipe(concatStream({encoding: 'string'}, function (body) {
          self.lastResponse = body;
          self.lastResponseHeaders = response && response.headers;
          self.lastElapsedTime = Date.now() - startTime;
          self.emit('response', body, response, eid);

          return parseSync(body, response);

        }));
        return;
      }

      self.wsdl.xmlToObject(response, function (error, obj) {
        self.lastResponse = response;
        self.lastResponseHeaders = response && response.headers;
        self.lastElapsedTime = Date.now() - startTime;
        self.emit('response', '<stream>', response, eid);

        if (error) {
          error.response = response;
          error.body = '<stream>';
          self.emit('soapError', error, eid);
          return callback(error, response, undefined, undefined, xml);
        }

        return finish(obj, '<stream>', response);
      });
    });
    return;
  }

  req = self.httpClient.request(location, xml, function(err, response, body) {
    self.lastResponse = body;
    self.lastResponseHeaders = response && response.headers;
    self.lastElapsedTime = response && response.elapsedTime;
    self.emit('response', body, response, eid);

    if (err) {
      callback(err, undefined, undefined, undefined, xml);
    } else {
      return parseSync(body, response);
    }
  }, headers, options, self);

  function parseSync(body, response) {
    var obj;
    try {
      obj = self.wsdl.xmlToObject(body);
    } catch (error) {
      //  When the output element cannot be looked up in the wsdl and the body is JSON
      //  instead of sending the error, we pass the body in the response.
      if(!output || !output.$lookupTypes) {
        debug('Response element is not present. Unable to convert response xml to json.');
        //  If the response is JSON then return it as-is.
        var json = _.isObject(body) ? body : tryJSONparse(body);
        if (json) {
          return callback(null, response, json, undefined, xml);
        }
      }
      error.response = response;
      error.body = body;
      self.emit('soapError', error, eid);
      return callback(error, response, body, undefined, xml);
    }
    return finish(obj, body, response);
  }

  function finish(obj, body, response) {
    var result;

    if (!output){
      // one-way, no output expected
      return callback(null, null, body, obj.Header, xml);
    }

    // If it's not HTML and Soap Body is empty
    if (!obj.html && !obj.Body) {
      return callback(null, obj, body, obj.Header);
    }

    if( typeof obj.Body !== 'object' ) {
      var error = new Error('Cannot parse response');
      error.response = response;
      error.body = body;
      return callback(error, obj, body, undefined, xml);
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

    callback(null, result, body, obj.Header, xml);
  }

  // Added mostly for testability, but possibly useful for debugging
  if(req && req.headers) //fixes an issue when req or req.headers is indefined
    self.lastRequestHeaders = req.headers;
};

exports.Client = Client;
