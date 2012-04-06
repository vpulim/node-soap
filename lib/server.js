/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

require('fibers');
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
        res.setHeader('Content-Type', req.headers['content-type']);
        //res.setHeader("Content-Type","application/soap+xml");
        //res.setHeader("Encoding","utf-8");
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
            self.logger_req && self.logger_req(xml,res,req);
            if (gunzip) {
                gunzip.end();
                gunzip = null
            }
            Fiber(function() {
            try {
                result = self._process(xml, req.url);
                self.logger_res && self.logger_res(result,res,req);
            }
            catch (err) {
                result = err.stack;
            }
            res.write(result);
            res.end();
            }).run();
        });
    }
    else {
        res.end();
    }    
}

Server.prototype._process = function(input,URL) {
		var pathname = url.parse(URL).pathname.replace(/\/$/,'');
    var self = this,
        obj = this.wsdl.xmlToObject(input),
				bindings = this.wsdl.definitions.bindings, binding, 
				methods, method, methodName;
	var serviceName, portName;
		
   	// use port.location and current url to find the right binding
	binding = (function(self){
		var services = self.wsdl.definitions.services;
		for(serviceName in services ) {
			var service = services[serviceName];
			var ports = service.ports;
			for(portName in ports) {
				var port = ports[portName];
				var portPathname = url.parse(port.location).pathname.replace(/\/$/,'');
				if(portPathname===pathname) 
					return port.binding;
			}
		}
    })(this);

		methods = binding.methods;
		if(binding.style === 'rpc') {
			methodName = Object.keys(obj)[0];
			return self._executeMethod(serviceName, portName, methodName, methodName+'Response', obj[methodName], 'rpc');
		} else {
			var messageElemName = Object.keys(obj)[0];
			var pair = binding.topElements[messageElemName];
    	    return self._executeMethod(serviceName, portName, pair.methodName, pair.outputName, obj[messageElemName], 'document');
		}
		
    return '';
}

Server.prototype._executeMethod = function(serviceName, portName, methodName, outputName, args, style) {
    var method, body;
    try {
        method = this.services[serviceName][portName][methodName];
    } catch(e) {
        return this._envelope(body);
    }
    if(style==='rpc') {
        body = this.wsdl.objectToRpcXML(outputName, method(args), '', this.wsdl.definitions.$targetNamespace);
    } else {
        body = this.wsdl.objectToDocumentXML(outputName, method(args));
    }
    return this._envelope(body);
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