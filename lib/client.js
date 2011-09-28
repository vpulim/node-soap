/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

var http = require('./http');

var Client = function(wsdl) {
    this.wsdl = wsdl;
    this._initializeServices();
}

Client.prototype.describe = function() {
    return this.wsdl.describeServices();
}

Client.prototype.setSecurity = function(security) {
    this.security = security;
}

Client.prototype._initializeServices = function() {
    var definitions = this.wsdl.definitions,
        services = definitions.services;
    for (var name in services) {
        this[name] = this._defineService(services[name]);
    }
}

Client.prototype._defineService = function(service) {
    var ports = service.ports,
        def = {};
    for (var name in ports) {
        def[name] = this._definePort(ports[name]);
    }
    return def;
}

Client.prototype._definePort = function(port) {
    var location = port.location,
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
        self._invoke(method, args, location, function(error, result) {
            callback(error, result);
        })
    }
}

Client.prototype._invoke = function(method, arguments, location, callback) {
    var self = this,
        name = method.$name,
        input = method.input,
        output = method.output,
        defs = this.wsdl.definitions,
        ns = defs.$targetNamespace,
        args = {},
        xml = null,
        headers = {
            SOAPAction: ((ns.lastIndexOf("/") != ns.length - 1) ? ns + "/" : ns) + name,
            'Content-Type': "text/xml; charset=utf-8"
        };
        options = {};
    
    // Allow the security object a change to add headers
    if (self.security && self.security.addHeaders)
        self.security.addHeaders(headers);
    if (self.security && self.security.addOptions)
        self.security.addOptions(options);

    if (input.element) {
        args[input.element.$name] = arguments;
    }
    xml = "<?xml version=\"1.0\" encoding=\"utf-8\"?>" +
        "<soap:Envelope " + 
            "xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\" " +
            "xmlns:ns0=\""+ns+"\">" +
            "<soap:Header>" +
                (self.security ? self.security.toXML() : "") +
            "</soap:Header>" +
            "<soap:Body>" +
                self.wsdl.objectToXML(args) +
            "</soap:Body>" +
        "</soap:Envelope>";
	    
    http.request(location, xml, function(err, response, body) {
        if (err) {
            callback(err);
        }
        else {
            try {
                var obj = self.wsdl.xmlToObject(body);
                callback(null, obj[output.$name]);
            }
            catch (error) {
                callback(error);
            }
        }
    }, headers, options);
}

exports.Client = Client;
