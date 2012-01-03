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
                result = self._process(xml, req.url);
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

Server.prototype._process = function(input,URL) {
		var pathname = url.parse(URL).pathname.replace(/\/$/,'');
    var self = this,
        obj = this.wsdl.xmlToObject(input),
				bindings = this.wsdl.definitions.bindings, binding, 
				methods, method, methodName;
		
		if(Object.keys(bindings).length===1) {
			for(var n in bindings) {
				binding = bindings[n];
				break;
			}
		} else {
   		// use port.location and current url to find the right binding
			binding = (function(self){
				var services = self.wsdl.definitions.services;
				for(var serviceName in services ) {
					var service = services[serviceName];
					var ports = service.ports;
					for(var portName in ports) {
						var port = ports[portName];
						var portPathname = url.parse(port.location).pathname.replace(/\/$/,'');
						if(portPathname===pathname) 
							return port.binding;
					}
				}
				// if no port.location match, will search for all ports all operations
			})(this);
		}
		methods = binding.methods;
		if(binding.style === 'rpc') {
			methodName = Object.keys(obj)[0];
			method = methods[methodName];
			var messageName = Object.keys(obj[methodName])[0];
			return self._executeMethod(methodName, methodName+'Response', obj[methodName][messageName]);
			
		} else {
			var messageName = Object.keys(obj)[0];
	    for (methodName in methods) {
	        method = methods[methodName];
	        if (method.input.$name === messageName) {
	            return self._executeMethod(methodName, method.output.$name, obj[messageName]);
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
                var body = this.wsdl.objectToDocumentXML(outputName, method(args));
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