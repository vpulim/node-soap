/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */
 
function findKey(obj, val) {
    for (var n in obj) if (obj[n] === val) return n;
}

var http = require('./http'),
    assert = require('assert'),
    url = require('url');

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
        headers = {
            SOAPAction: this.SOAPAction ? this.SOAPAction(ns, name) : (((ns.lastIndexOf("/") != ns.length - 1) ? ns + "/" : ns) + name),
            'Content-Type': "text/xml; charset=utf-8"
        },
        options = {},
        alias = findKey(defs.xmlns, ns);
    
    // Allow the security object to add headers
    if (self.security && self.security.addHeaders)
        self.security.addHeaders(headers);
    if (self.security && self.security.addOptions)
        self.security.addOptions(options);
        
    if (input.parts) {
        assert.ok(!style || style == 'rpc', 'invalid message definition for document style binding');
        message = self.wsdl.objectToRpcXML(name, arguments, alias, ns);
        (method.inputSoap === 'encoded') && (encoding = 'soap:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" ');
    }
    else {
        assert.ok(!style || style == 'document', 'invalid message definition for rpc style binding');
        message = self.wsdl.objectToDocumentXML(input.$name, arguments, input.targetNSAlias, input.targetNamespace);
    }
    xml = "<soap:Envelope " + 
            "xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\" " +
            encoding +
            this.wsdl.xmlnsInEnvelope + '>' +
            "<soap:Header>" +
                (self.security ? self.security.toXML() : "") +
            "</soap:Header>" +
            "<soap:Body>" +
                message +
            "</soap:Body>" +
        "</soap:Envelope>";
    self.logger_req && self.logger_req(xml);
    
    http.request(location, xml, function(err, response, body) {
        if (err) {
            callback(err);
        }
        else {
            self.logger_res && self.logger_res(body);
            try {
                var obj = self.wsdl.xmlToObject(body);
            }
            catch (error) {
                return callback(error, null, body);
            }
            callback(null, obj[output.$name], body);
        }
    }, headers, options);
}

exports.Client = Client;
