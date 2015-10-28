/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

"use strict";

function getDateString(d) {
  function pad(n) {
    return n < 10 ? '0' + n : n;
  }
  return d.getUTCFullYear() + '-'
    + pad(d.getUTCMonth() + 1) + '-'
    + pad(d.getUTCDate()) + 'T'
    + pad(d.getUTCHours()) + ':'
    + pad(d.getUTCMinutes()) + ':'
    + pad(d.getUTCSeconds()) + 'Z';
}

var url = require('url'),
  compress = null,
  events = require('events'),
  util = require('util'),
  soapUtil = require('./utils'),
  findPrefix = soapUtil.findPrefix,
  sign = soapUtil.sign;

try {
  compress = require("compress");
} catch (error) {
}

var Server = function(server, path, services, wsdl, options) {
  var self = this;

  events.EventEmitter.call(this);

  options = options || {};
  this.path = path;
  this.services = services;
  this.wsdl = wsdl;
  this._signers = [ ];

  if (path[path.length - 1] !== '/')
    path += '/';
  wsdl.onReady(function(err) {
    var listeners = server.listeners('request').slice();

    server.removeAllListeners('request');
    server.addListener('request', function(req, res) {
      if (typeof self.authorizeConnection === 'function') {
        if (!self.authorizeConnection(req.connection.remoteAddress)) {
          res.end();
          return;
        }
      }
      var reqPath = url.parse(req.url).pathname;
      if (reqPath[reqPath.length - 1] !== '/')
        reqPath += '/';
      if (path === reqPath) {
        self._requestListener(req, res);
      } else {
        for (var i = 0, len = listeners.length; i < len; i++) {
          listeners[i].call(this, req, res);
        }
      }
    });
  });

  this._initializeOptions(options);
};
util.inherits(Server, events.EventEmitter);

Server.prototype._initializeOptions = function(options) {
  this.wsdl.options.attributesKey = options.attributesKey || 'attributes';
};

Server.prototype.addSigner = function( signer ) {
  this._signers.push(signer);
};

Server.prototype._requestListener = function(req, res) {
  var self = this;
  if (typeof self.log === 'function') {
    self.log("info", "Handling " + req.method + " on " + req.url);
  }
  if (req.method === 'GET') {
    self._processGET(req,res);
  } else if (req.method === 'POST') {
    self._processPOST(req,res);
  }
  else {
    res.end();
  }
};

Server.prototype._processGET = function(req,res) {
  var self = this;
  var reqParse = url.parse(req.url);
  var reqPath = reqParse.pathname;
  var reqQuery = reqParse.search;

  if (reqQuery && reqQuery.toLowerCase() === '?wsdl') {
    if (typeof self.log === 'function') {
      self.log("info", "Wants the WSDL");
    }
    res.setHeader("Content-Type", "application/xml");
    res.write(self.wsdl.toXML());
  }
  res.end();
};

Server.prototype._processPOST = function(req,res) {
  var self = this, result;
  res.setHeader('Content-Type', req.headers['content-type']);

  function sendError(err){
    var error = err.stack || err;
    res.write(error);
    res.end();
    if (typeof self.log === 'function') {
      self.log("error", error);
    }
  }

  function sendResult(result, statusCode){
    if(statusCode) {
      res.statusCode = statusCode;
    }
    res.write(result);
    res.end();
    if (typeof self.log === 'function') {
      self.log("replied", result);
    }
  }

  function signHandler(result, statusCode, requestOptions) {
    sign(self._signers, result, requestOptions, function(error,result){
      // Try and return the original error first if status was already 
      if(error && !statusCode){
        try{
          return self._sendErrorOrThrow(error,sendResult);
        }catch(error){
          return sendError(error);
        }
      }
      sendResult(result, statusCode);
    });
  }

  function onRequestBody(xml){
    try {
      self._process(xml, req, signHandler);
    }
    catch (err) {
      sendError(err);
    }
  }

  this._readRequestBody(req, onRequestBody);
};

Server.prototype._readRequestBody = function(req, callback) {
  var self = this, chunks = [], gunzip;
  if (compress && req.headers["content-encoding"] === "gzip") {
    gunzip = new compress.Gunzip();
    gunzip.init();
  }
  req.on('data', function(chunk) {
    if (gunzip)
      chunk = gunzip.inflate(chunk, "binary");
    chunks.push(chunk);
  });
  req.on('end', function() {
    var xml = chunks.join('');
    if (gunzip) {
      gunzip.end();
      gunzip = null;
    }
    if (typeof self.log === 'function') {
      self.log("received", xml);
    }
    callback(xml);
  });
};

Server.prototype._process = function(input, req, callback) {
  var self = this,
    pathname = url.parse(req.url).pathname.replace(/\/$/, ''),
    obj = this.wsdl.xmlToObject(input),
    body = obj.Body,
    headers = obj.Header,
    bindings = this.wsdl.definitions.bindings, binding,
    method, methodName,
    serviceName, portName,
    includeTimestamp = obj.Header && obj.Header.Security && obj.Header.Security.Timestamp;

  if (typeof self.authenticate === 'function') {
    if (!obj.Header || !obj.Header.Security) {
      throw new Error('No security header');
    }
    if (!self.authenticate(obj.Header.Security)) {
      throw new Error('Invalid username or password');
    }
  }

  if (typeof self.log === 'function') {
    self.log("info", "Attempting to bind to " + pathname);
  }

  // use port.location and current url to find the right binding
  binding = (function(self) {
    var services = self.wsdl.definitions.services;
    var firstPort;
    var name;
    for (name in services) {
      serviceName = name;
      var service = services[serviceName];
      var ports = service.ports;
      for (name in ports) {
        portName = name;
        var port = ports[portName];
        var portPathname = url.parse(port.location).pathname.replace(/\/$/, '');

        if (typeof self.log === 'function') {
          self.log("info", "Trying " + portName + " from path " + portPathname);
        }

        if (portPathname === pathname)
          return port.binding;

        // The port path is almost always wrong for generated WSDLs
        if (!firstPort) {
          firstPort = port;
        }
      }
    }
    return !firstPort ? void 0 : firstPort.binding;
  })(this);

  if (!binding) {
    throw new Error('Failed to bind to WSDL');
  }

  var options = { };

  try {
    if (binding.style === 'rpc') {
      methodName = Object.keys(body)[0];

      self.emit('request', obj, methodName);
      if (headers)
        self.emit('headers', headers, methodName);

      self._executeMethod(options = {
        serviceName: serviceName,
        portName: portName,
        methodName: methodName,
        outputName: methodName + 'Response',
        args: body[methodName],
        headers: headers,
        style: 'rpc'
      }, req, callback);
    } else {
      var messageElemName = (Object.keys(body)[0] === 'attributes' ? Object.keys(body)[1] : Object.keys(body)[0]);
      var pair = binding.topElements[messageElemName];

      self.emit('request', obj, pair.methodName);
      if (headers)
        self.emit('headers', headers, pair.methodName);

      self._executeMethod(options = {
        serviceName: serviceName,
        portName: portName,
        methodName: pair.methodName,
        outputName: pair.outputName,
        args: body[messageElemName],
        headers: headers,
        style: 'document'
      }, req, callback, includeTimestamp);
    }
  }
  catch (error) {
    this._sendErrorOrThrow(error, includeTimestamp, options, callback);
  }
};

Server.prototype._sendErrorOrThrow = function(error, includeTimestamp, options, callback) {
  var self = this;
  if (error.Fault !== undefined) {
    return self._sendError(error.Fault, callback, includeTimestamp, options);
  }
  throw error;
};

Server.prototype._executeMethod = function(options, req, callback, includeTimestamp) {
  options = options || {};
  var self = this,
    method, body,
    serviceName = options.serviceName,
    portName = options.portName,
    methodName = options.methodName,
    outputName = options.outputName,
    args = options.args,
    style = options.style,
    handled = false;

  try {
    method = this.services[serviceName][portName][methodName];
  } catch (error) {
    return callback(this._envelope('', includeTimestamp), null, options);
  }

  function handleResult(error, result) {
    if (handled)
      return;
    handled = true;

    if (error && error.Fault !== undefined) {
      return self._sendError(error.Fault, callback, includeTimestamp, options);
    }
    else if (result === undefined) {
      // Backward compatibility to support one argument callback style
      result = error;
    }

    if (style === 'rpc') {
      body = self.wsdl.objectToRpcXML(outputName, result, '', self.wsdl.definitions.$targetNamespace);
    } else {
      var element = self.wsdl.definitions.services[serviceName].ports[portName].binding.methods[methodName].output;
      body = self.wsdl.objectToDocumentXML(outputName, result, element.targetNSAlias, element.targetNamespace);
    }
    callback(self._envelope(body, includeTimestamp), null, options);
  }

  if(!self.wsdl.definitions.services[serviceName].ports[portName].binding.methods[methodName].output){
    // no output defined = one-way operation so return empty response
    handled = true;
    callback('', null, options);
  }

  var result = method(args, handleResult, options.headers, req);
  if (typeof result !== 'undefined') {
    handleResult(result);
  }
};

Server.prototype._envelope = function(body, includeTimestamp) {
  var defs = this.wsdl.definitions,
    ns = defs.$targetNamespace,
    encoding = '',
    alias = findPrefix(defs.xmlns, ns);
  var xml = "<?xml version=\"1.0\" encoding=\"utf-8\"?>" +
    "<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\" " +
    encoding +
    this.wsdl.xmlnsInEnvelope + '>';
  if (includeTimestamp) {
    var now = new Date();
    var created = getDateString(now);
    var expires = getDateString(new Date(now.getTime() + (1000 * 600)));

    xml += "<soap:Header>" +
    "  <o:Security soap:mustUnderstand=\"1\" " +
    "xmlns:o=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\" " +
    "xmlns:u=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd\">" +
    "    <u:Timestamp u:Id=\"_0\">" +
    "      <u:Created>" + created + "</u:Created>" +
    "      <u:Expires>" + expires + "</u:Expires>" +
    "    </u:Timestamp>" +
    "  </o:Security>" +
    "</soap:Header>";
  }
  xml += "<soap:Body>" +
    body +
    "</soap:Body>" +
    "</soap:Envelope>";
  return xml;
};

Server.prototype._sendError = function(soapFault, callback, includeTimestamp, requestOptions) {
  var self = this,
    fault;

  var statusCode;
  if(soapFault.statusCode) {
    statusCode = soapFault.statusCode;
    soapFault.statusCode = undefined;
  }

  if (soapFault.faultcode) {
    // Soap 1.1 error style
    // Root element will be prependend with the soap NS
    // It must match the NS defined in the Envelope (set by the _envelope method)
    fault = self.wsdl.objectToDocumentXML("soap:Fault", soapFault, undefined);
  }
  else {
    // Soap 1.2 error style.
    // 3rd param is the NS prepended to all elements
    // It must match the NS defined in the Envelope (set by the _envelope method)
    fault = self.wsdl.objectToDocumentXML("Fault", soapFault, "soap");
  }

  return callback(self._envelope(fault, includeTimestamp), statusCode, requestOptions);
};

exports.Server = Server;
