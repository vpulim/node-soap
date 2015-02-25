/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

function findKey(obj, val) {
    for (var n in obj) if (obj[n] === val) return n;
}

var url = require('url'),
    compress = null;

try { compress = require("compress"); } catch(e) {}

var Server = function(server, path, services, wsdl) {
    var self = this,
        listeners = server.listeners('request');

    this.services = services;
    this.wsdl = wsdl;

    // Not sure why you are adding a trailing slash?
    //if (path[path.length-1] != '/') path += '/';
    wsdl.onReady(function(err) {

        // GET request
        server.get(path, function(req, res){
            var search = url.parse(req.url).search;
            if (search && search.toLowerCase() === '?wsdl') {
                res.setHeader("Content-Type", "application/xml");
                res.write(self.wsdl.toXML());
            }
            res.end();
        });

        // POST request
        server.post(path, function(req, res){
          if(wsdl.options.debug) console.log(process.pid, Date.now(), path);
            res.setHeader('Content-Type', req.headers['content-type']);
            var chunks = [], gunzip;
            if (compress && req.headers["content-encoding"] == "gzip") {
                gunzip = new compress.Gunzip;
                gunzip.init();
            }
            req.on('data', function(chunk) {
                if(wsdl.options.debug) console.log(process.pid, Date.now(), 'data');
                if (gunzip) chunk = gunzip.inflate(chunk, "binary");
                chunks.push(chunk);
            })
            req.on('end', function() {
                if(wsdl.options.debug) console.log(process.pid, Date.now(), 'end');
                var xml = chunks.join(''), result;
                xml = xml.replace(/[\x00-\x1F]/g,'');
                if (gunzip) {
                    gunzip.end();
                    gunzip = null
                }
                try {
                    self._process(xml, req.url, function(result) {
                        if(wsdl.options.debug) console.log(process.pid, Date.now(), 'write');
                        res.write(result);
                        res.end();
                        if (typeof self.log === 'function') {
                          self.log("received", xml);
                          self.log("replied", result);
                        }
                    });
                }
                catch(err) {
                    err = err.stack || err;
                    res.write(err);
                    res.end();
                    if (typeof self.log === 'function') {
                      self.log("error", err);
                    }
                }
            });
        });

        // Leaving this block of original code in because I am not sure
        // what the authorizeConnection is doing...
        //
        // server.removeAllListeners('request');
        // server.addListener('request', function(req, res) {
        //     if (typeof self.authorizeConnection === 'function') {
        //       if (!self.authorizeConnection(req.connection.remoteAddress)) {
        //         res.end();
        //         return;
        //       }
        //     }
        //     var reqPath = url.parse(req.url).pathname;
        //     if (reqPath[reqPath.length-1] != '/') reqPath += '/';
        //     if (path === reqPath) {
        //         self._requestListener(req, res);
        //     }
        //     else {
        //         for (var i = 0, len = listeners.length; i < len; i++){
        //           listeners[i].call(this, req, res);
        //         }
        //     }
        // });
    })
}

Server.prototype._process = function(input, URL, callback) {
    var self = this,
        pathname = url.parse(URL).pathname.replace(/\/$/,''),
        obj = this.wsdl.xmlToObject(input),
        body = obj.Body,
        bindings = this.wsdl.definitions.bindings, binding,
        methods, method, methodName,
        serviceName, portName;

    if (typeof self.authenticate === 'function') {
      if (obj.Header == null || obj.Header.Security == null) {
        throw new Error('No security header');
      }
      if (!self.authenticate(obj.Header.Security)) {
        throw new Error('Invalid username or password');
      }
    }

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
            methodName = Object.keys(body)[0];
            self._executeMethod({
                serviceName: serviceName,
                portName: portName,
                methodName: methodName,
                outputName: methodName + 'Response',
                args: body[methodName],
                style: 'rpc'
            }, callback);
        } else {
            var messageElemName = Object.keys(body)[0];
            var pair = binding.topElements[messageElemName];
            self._executeMethod({
                serviceName: serviceName,
                portName: portName,
                methodName: pair.methodName,
                outputName: pair.outputName,
                args: body[messageElemName],
                style: 'document'
            }, callback);
        }
}

Server.prototype._executeMethod = function(options, callback) {
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
    } catch(e) {
        return callback(this._envelope(''));
    }

    function handleResult(result) {
        if (handled) return;
        handled = true;


        if(style==='rpc') {
            body = self.wsdl.objectToRpcXML(outputName, result, '', self.wsdl.definitions.$targetNamespace);
        } else {
            var element = self.wsdl.definitions.services[serviceName].ports[portName].binding.methods[methodName].output;
            body = self.wsdl.objectToDocumentXML(outputName, result, '', element.targetNamespace);
        }
        callback(self._envelope(body));
    }

    var result = method(args, handleResult);
    if (typeof result !== 'undefined') {
        handleResult(result);
    }
}

Server.prototype._envelope = function(body) {
    var defs = this.wsdl.definitions,
        ns = defs.$targetNamespace,
        encoding = '',
        alias = findKey(defs.xmlns, ns);

    var xml =
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
            "<soapenv:Envelope " +
            "xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\" " +
            "xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" " +
            "xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">" +
            "<soapenv:Body>" +
                body +
            "</soapenv:Body>" +
        "</soapenv:Envelope>";
    return xml;

}

exports.Server = Server;
