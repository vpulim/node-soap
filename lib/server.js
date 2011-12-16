/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

var url = require('url'),
    compress = null;

try { compress = require("compress"); } catch(e) {}

var Server = function(server, path, services, wsdl) {
    var self = this,
        listeners = server.listeners('request');
                
    this.services = services;
    this.wsdl = wsdl;

    if (path[path.length-1] != '/') path += '/';
    wsdl.onReady(function(err) {
        server.removeAllListeners('request');
        server.addListener('request', function(req, res) {
            var reqPath = url.parse(req.url).pathname;
            if (reqPath[reqPath.length-1] != '/') reqPath += '/';
            if (path === reqPath) {
                self._requestListener(req, res);
            }
            else {
                for (var i = 0, len = listeners.length; i < len; i++){
                  listeners[i].call(this, req, res);
                }            
            }
        });        
    })
}

Server.prototype._requestListener = function(req, res) {
    var self = this;
    if (req.method === 'GET') {
        var search = url.parse(req.url).search;
        if (search && search.toLowerCase() === '?wsdl') {
            res.setHeader("Content-Type", "application/xml");
            res.write(self.wsdl.toXML());
        }
        res.end();
    }
    else if (req.method === 'POST') {
        var chunks = [], gunzip;
        if (compress && req.headers["content-encoding"] == "gzip") {
    	    gunzip = new compress.Gunzip;    
            gunzip.init();
        }
        req.on('data', function(chunk) {
            if (gunzip) chunk = gunzip.inflate(chunk, "binary");
            chunks.push(chunk);
        })
        req.on('end', function() {
            var xml = chunks.join(''), result;
            if (gunzip) {
                gunzip.end();
                gunzip = null
            }
            try {
                result = self._process(xml);                
            }
            catch (err) {
                result = err.stack;
            }
            res.write(result);
            res.end();
        });
    }
    else {
        res.end();
    }    
}

Server.prototype._process = function(input) {
    var self = this,
        obj = this.wsdl.xmlToObject(input),
        messageName = Object.keys(obj)[0],
        args = obj[messageName],
        portTypes = this.wsdl.definitions.portTypes;

    for (var portName in portTypes) {
        var portType = portTypes[portName];
        var methods = portType.methods;
        for (var methodName in methods) {
            var method = methods[methodName];
            if (method.input.$name == messageName) {
                return self._executeMethod(methodName, method.output.$name, args);
            }
        }
    }
    return '';
}

Server.prototype._executeMethod = function(methodName, outputName, args) {
    var services = this.services;
    for (var serviceName in services) {
        var service = services[serviceName];
        for (var portName in service) {
            var port = service[portName];
            var method = port[methodName];
            if (method) {
                var body = this.wsdl.objectToDocumentXML(outputName, method(args))
                return this._envelope(body);
            }
        }
    }
    return this._envelope();
}

Server.prototype._envelope = function(body) {
    var xml = "<?xml version=\"1.0\" encoding=\"utf-8\"?>" +
            "<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">" +
                "<soap:Body>" +
                    body +
                "</soap:Body>" +
            "</soap:Envelope>";

    return xml;
}

exports.Server = Server;