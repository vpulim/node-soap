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
  , streams = require('morestreams')
  , XMLStream = require('xml-stream');

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
        return self._invoke(method, args, location, callback);
    }
}

Client.prototype._invoke = function(method, args, location, callback) {
    var self = this
      , curl = url.parse(location)
      , name = method.$name
      , input = method.input
      , output = method.output
      , style = method.style
      , defs = self.wsdl.definitions
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
          , SOAPAction: self.SOAPAction ? self.SOAPAction(ns, name) : (((ns.lastIndexOf("/") != ns.length - 1) ? ns + "/" : ns) + name)
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

    if(typeof callback !== 'undefined') {
      var request = req(reqOptions, function(err, response, body) {
              if (err) {
                  callback(err);
              } else {
                  require('fs').writeFileSync('/media/HTPC/web/sovren/test3.test', body);
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
    } else {
      var request = req(reqOptions);
    }

    // Stream response of request straight to XMLStream
    // TODO: Rewrite to piping (or will it be weird since we are already piping the unprocessed indata to request?) when XMLStream is a "true" Stream object (a first draft can be found here: https://github.com/cjblomqvist/xml-stream/tree/stream)
    var xmlstream = new XMLStream(request);

    // Any input or output errors on the request object must throw error to xmlstream
    request.on('error', function (err) {
      xmlstream.emit('error', err);
    });

    // Use a Buffered stream for input and pipe it to request instead of directly writing data to request
    stream.pipe(request);

    if (input.parts) {
      assert.ok(!style || style == 'rpc', 'invalid message definition for document style binding');
      (method.inputSoap === 'encoded') && (encoding = 'soap:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" ');
    } else if (typeof(args) !== 'string') {
      assert.ok(!style || style == 'document', 'invalid message definition for rpc style binding');
    }

    // Return request before starting to write data
    process.nextTick(function () {
      // Write SOAP Header
      stream.write("<soap:Envelope " + 
        "xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\" " +
        encoding +
        self.wsdl.xmlnsInEnvelope + '>' +
        "<soap:Header>" +
            (self.security ? self.security.toXML() : "") +
        "</soap:Header>" +
        "<soap:Body>"
      );

      // Get and write SOAP Body
      if (input.parts) {
        message = self.wsdl.objectToRpcXML(name, args, alias, ns, stream, endSOAP);
      } else if (typeof(args) === 'string') {
        stream.write(args);
        endSOAP();
      } else {
        self.wsdl.objectToDocumentXML(input.$name, args, input.targetNSAlias, stream, endSOAP);
      }
    });

    // Setup error handling of response parsing
    // TODO: Fix namespace handling
    xmlstream.on('endElement: soap:Envelope > soap:Body > Fault', function (Fault) {
      xmlstream.emit('error', new Error(Fault.faultcode+': '+Fault.faultstring+(Fault.detail ? ': ' + Fault.detail : '')));
    });

    return xmlstream;
}

exports.Client = Client;
