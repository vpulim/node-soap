/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */
 
function findKey(obj, val) {
    for (var n in obj) if (obj[n] === val) return n;
}

var assert = require('assert')
  , url = require('url')
  , req = require('request')
  , streams = require('morestreams');

var Client = function(wsdl, endpoint) {
    this.wsdl = wsdl;
    this._initializeServices(endpoint);
}

Client.prototype.setEndpoint = function(endpoint) {
    this.endpoint = endpoint;
    this._initializeServices(endpoint);
}

Client.prototype.describe = function() {
    var types = this.wsdl.definitions.types;
    return this.wsdl.describeServices();
}

Client.prototype.setSecurity = function(security) {
    this.security = security;
}

Client.prototype.setSOAPAction = function(SOAPAction) {
    this.SOAPAction = SOAPAction;
}

Client.prototype._initializeServices = function(endpoint) {
    var definitions = this.wsdl.definitions,
        services = definitions.services;
    for (var name in services) {
        this[name] = this._defineService(services[name], endpoint);
    }
}

Client.prototype._defineService = function(service, endpoint) {
    var ports = service.ports,
        def = {};
    for (var name in ports) {
        def[name] = this._definePort(ports[name], endpoint ? endpoint : ports[name].location);
    }
    return def;
}

Client.prototype._definePort = function(port, endpoint) {
    var location = endpoint,
        binding = port.binding,
        methods = binding.methods,
        def = {};
    for (var name in methods) {
        def[name] = this._defineMethod(methods[name], location);
        if (!this[name]) this[name] = def[name];
    }
    return def;
}

Client.prototype._defineMethod = function(method, location) {
    var self = this;
    return function(args, callback) {
        if (typeof args === 'function') {
            callback = args;
            args = {};
        }
        self._invoke(method, args, location, function(error, result, raw) {
            callback(error, result, raw);
        })
    }
}

Client.prototype._invoke = function(method, arguments, location, callback) {
    var self = this
      , curl = url.parse(location)
      , name = method.$name
      , input = method.input
      , output = method.output
      , style = method.style
      , defs = this.wsdl.definitions
      , ns = defs.$targetNamespace
      , encoding = ''
      , message = ''
      , xml = null
      , headers = {
            "User-Agent": "node-soap/0.2.0"
          , "Accept" : "text/html,application/xhtml+xml,application/xml"
          , "Accept-Encoding": "none"
          , "Accept-Charset": "utf-8"
          , "Connection": "close"
          , SOAPAction: this.SOAPAction ? this.SOAPAction(ns, name) : (((ns.lastIndexOf("/") != ns.length - 1) ? ns + "/" : ns) + name)
          , 'Content-Type': "text/xml; charset=utf-8"
          , 'Host' : curl.hostname
        }
      , options = {}
      , alias = findKey(defs.xmlns, ns)
      , stream = new streams.BufferedStream()
      , endSOAP = function () {
          stream.write("</soap:Body>" +
            "</soap:Envelope>"
          );
          stream.end();
        };

    // Allow the security object to add headers
    if (self.security && self.security.addHeaders)
        self.security.addHeaders(headers);
    if (self.security && self.security.addOptions)
        self.security.addOptions(options);

    // TODO: Add some parameter that'll buffer the whole SOAP request, count the length and set Content-Length to it
    // -- That can be done by not piping stream to request, and instead save all incoming data of stream into a variable (message)
    // -- which will buffer up the whole request. When the whole message is completed (on 'end'), count the length and set 
    // -- the "Content-Length" header to it, as well as write all the buffered up data (message) to request.
    // headers["Content-Length"] = Buffer.byteLength(xml, 'utf8');

    reqOptions = {
          uri: curl
        , method: 'POST'
        , headers: headers
      };

    var request = req(reqOptions, function(err, response, body) {
          if (err) {
              callback(err);
          } else {
              try {
                  var obj = self.wsdl.xmlToObject(body);
              } catch (error) {
                  return callback(error, response, body);
              }
              var result = obj.Body[output.$name];
              // RPC/literal response body may contain element named after the method + 'Response'
              // This doesn't necessarily equal the ouput message name. See WSDL 1.1 Section 2.4.5
              if(!result) {
                 result = obj.Body[name + 'Response'];
              }
              callback(null, result, body);
          }
      });

    request.on('error', function (err) {
      callback(err);
    });

    // Use a Buffered stream for input and pipe it to request instead of directly writing data to request
    stream.pipe(request);

    if (input.parts) {
      assert.ok(!style || style == 'rpc', 'invalid message definition for document style binding');
      (method.inputSoap === 'encoded') && (encoding = 'soap:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" ');
    } else if (typeof(arguments) !== 'string') {
      assert.ok(!style || style == 'document', 'invalid message definition for rpc style binding');
    }

    // Write SOAP Header
    stream.write("<soap:Envelope " + 
      "xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\" " +
      encoding +
      this.wsdl.xmlnsInEnvelope + '>' +
      "<soap:Header>" +
          (self.security ? self.security.toXML() : "") +
      "</soap:Header>" +
      "<soap:Body>"
    );

    // Get and write SOAP Body
    if (input.parts) {
      message = self.wsdl.objectToRpcXML(name, arguments, alias, ns, stream, endSOAP);
    } else if (typeof(arguments) === 'string') {
      stream.write(arguments);
      endSOAP();
    } else {
      self.wsdl.objectToDocumentXML(input.$name, arguments, input.targetNSAlias, stream, endSOAP);
      return;
    }
}

exports.Client = Client;
