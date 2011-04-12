var http = require('./http'),
    expat = require('node-expat');

var Client = function(wsdl) {
    this._wsdl = wsdl;
    this._initializeServices();
}

Client.prototype.describe = function() {
    return this._wsdl.describeServices();
}

Client.prototype.setSecurity = function(security) {
    this._security = security;
}

Client.prototype._initializeServices = function() {
    var definitions = this._wsdl.definitions,
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
            callback(null, result);
        })
    }
}

Client.prototype._invoke = function(method, arguments, location, callback) {
    var self = this,
        name = method.$name,
        input = method.input,
        output = method.output,
        defs = this._wsdl.definitions,
        ns = defs.$targetNamespace,
        args = {},
        xml = null,
        headers = {
	        SOAPAction: ((ns.lastIndexOf("/") != ns.length - 1) ? ns + "/" : ns) + name,
	        'Content-Type': "text/xml; charset=utf-8"
	    };

	args[input.element.$name] = arguments;
    xml = "<?xml version=\"1.0\" encoding=\"utf-8\"?>" +
        "<soap:Envelope " + 
            "xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\" " +
            "xmlns:ns0=\""+ns+"\">" +
		    "<soap:Header>" +
		        (self._security ? self._security.toXML() : "") +
		    "</soap:Header>" +
		    "<soap:Body>" +
                Client._toXML(null, args, 'ns0') +
		    "</soap:Body>" +
		"</soap:Envelope>";
	    
	console.log(xml);
	http.request(location, xml, function(err, response) {
	    if (err) {
	        callback(err)
        }
		else {
		    var obj = Client._toObject(response.body, output.description(defs));
		    callback(null, obj);
	    }
	}, headers);
}

Client._toXML = function(name, args, namespace) {
    var parts = [];
    
    if (Array.isArray(args)) {
        for (var i=0, item; item=args[i]; i++) {
            if (i > 0) {
                parts.push(['</',namespace,':',name,'>'].join(''));            
                parts.push(['<',namespace,':',name,'>'].join(''));
            }
            parts.push(Client._toXML(name, item, namespace));
        }
    }
    else if (typeof args === 'object') {
        for (var name in args) {
            parts.push(['<',namespace,':',name,'>'].join(''));
            parts.push(Client._toXML(name, args[name], namespace));
            parts.push(['</',namespace,':',name,'>'].join(''));
        }
    }
    else {
        parts.push(args);
    }
    return parts.join('');
}

Client._toObject = function(xml, schema) {
    var p = new expat.Parser('UTF-8'),
        elementName = Object.keys(schema)[0],
        schema = {Envelope: { Body: schema}},
        stack = [{object: {}, schema: schema}];

    function splitNSName(nsName) {
        var parts = nsName.split(':'),
            namespace = parts.length > 1 ? parts.shift() : null;
        return { namespace: namespace, name: parts[0] };
    }

    p.on('startElement', function(nsName, attrs) {
        var top = stack[stack.length-1],
            topObject = top.object,
            topSchema = top.schema,
            name = splitNSName(nsName).name,
            obj = {};
            
        if (topSchema[name+'[]']) {
            if (!topObject[name]) topObject[name] = [];
            topObject[name].push(obj);
            name = name + '[]';
        }
        else {
            topObject[name] = obj;                        
        }
        stack.push({object: obj, schema: topSchema[name]});
    })
    
    p.on('endElement', function(nsName) {
        var obj = stack.pop().object,
            top = stack[stack.length-1],
            topObject = top.object,
            topSchema = top.schema,
            name = splitNSName(nsName).name;
            
        if (topSchema[name+'[]']) {
            if (!topObject[name]) topObject[name] = [];
            topObject[name].push(obj);
            name = name + '[]';
        }
        else {
            topObject[name] = obj;                        
        }
    })
    
    p.on('text', function(text) {
        var top = stack[stack.length-1];
        top.object = text;
        // TO DO: cast text to a JS type using top.schema
    })
    
    if (!p.parse(xml, false)) {
        throw new Error(p.getError());
    }
    return stack[0].object.Envelope.Body[elementName];
}

exports.Client = Client;