var expat = require('node-expat'),
    http = require('http'),
    https = require('https'),
    _url = require('url'),
    compress = null;
    
try { compress = require("compress"); } catch(e) {}

var VERSION = "0.1";

function httpRequest(rurl, data, callback, exheaders) {
    var curl = _url.parse(rurl);
	var secure = curl.protocol == 'https:';
	var host = curl.hostname;
	var port = parseInt(curl.port || secure ? 443 : 80);
	var path = [curl.pathname || '/', curl.search || '', curl.hash || ''].join('');
	var method = data ? "POST" : "GET";
	var headers = {
		"User-Agent": "node-soap/" + VERSION,
		"Accept" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Encoding": compress ? "gzip,deflate" : "none",
        "Accept-Charset": "utf-8",
        "Connection": "close",
		"Host" : host
	};

	if (typeof data == 'string') {
		headers["Content-Length"] = data.length;
		headers["Content-Type"] = "application/x-www-form-urlencoded";
	}
    
    exheaders = exheaders || {};
    for (attr in exheaders) { headers[attr] = exheaders[attr]; }		
	
    var options = {
        host: host,
        port: port,
        method: method,
        path: path,
        headers: headers,
        agent: false
    };

    var request = (secure ? https : http).request(options);
    request.on('response', function(res) {            
        var chunks = [], gunzip;
        if (compress && res.headers["content-encoding"] == "gzip") {
    	    gunzip = new compress.Gunzip;    
            gunzip.init();
        }
        res.setEncoding(res.headers["content-encoding"] == "gzip" ? "binary" : "utf8");
        res.on('data', function(chunk) {
            if (gunzip) chunk = gunzip.inflate(chunk, "binary");
            chunks.push(chunk);
        });
        res.on('end', function() {
            res.body = chunks.join('');
            if (gunzip) {
                gunzip.end();
                gunzip = null
            }
            callback(null, res);
        });
        res.on('error', callback);
    });
    request.on('error', callback);
    request.end(data);
}

function Parameters(params) {
	this._params = params;
}

Parameters._serialize = function(o)
{
    var s = "";
    switch(typeof(o))
    {
        case "string":
            s += o.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); break;
        case "number":
        case "boolean":
            s += o.toString(); break;
        case "object":
            // Date
            if(o.constructor.toString().indexOf("function Date()") > -1)
            {
        
                var year = o.getFullYear().toString();
                var month = (o.getMonth() + 1).toString(); month = (month.length == 1) ? "0" + month : month;
                var date = o.getDate().toString(); date = (date.length == 1) ? "0" + date : date;
                var hours = o.getHours().toString(); hours = (hours.length == 1) ? "0" + hours : hours;
                var minutes = o.getMinutes().toString(); minutes = (minutes.length == 1) ? "0" + minutes : minutes;
                var seconds = o.getSeconds().toString(); seconds = (seconds.length == 1) ? "0" + seconds : seconds;
                var milliseconds = o.getMilliseconds().toString();
                var tzminutes = Math.abs(o.getTimezoneOffset());
                var tzhours = 0;
                while(tzminutes >= 60)
                {
                    tzhours++;
                    tzminutes -= 60;
                }
                tzminutes = (tzminutes.toString().length == 1) ? "0" + tzminutes.toString() : tzminutes.toString();
                tzhours = (tzhours.toString().length == 1) ? "0" + tzhours.toString() : tzhours.toString();
                var timezone = ((o.getTimezoneOffset() < 0) ? "+" : "-") + tzhours + ":" + tzminutes;
                s += year + "-" + month + "-" + date + "T" + hours + ":" + minutes + ":" + seconds + "." + milliseconds + timezone;
            }
            // Array
            else if(o.constructor.toString().indexOf("function Array()") > -1)
            {
                for(var p in o)
                {
                    if(!isNaN(p))   // linear array
                    {
                        (/function\s+(\w*)\s*\(/ig).exec(o[p].constructor.toString());
                        var type = RegExp.$1;
                        switch(type)
                        {
                            case "":
                                type = typeof(o[p]);
                            case "String":
                                type = "string"; break;
                            case "Number":
                                type = "int"; break;
                            case "Boolean":
                                type = "bool"; break;
                            case "Date":
                                type = "DateTime"; break;
                        }
                        s += "<" + type + ">" + Parameters._serialize(o[p]) + "</" + type + ">"
                    }
                    else    // associative array
                        s += "<" + p + ">" + Parameters._serialize(o[p]) + "</" + p + ">"
                }
            }
            // Object or custom function
            else
                for(var p in o)
                    s += "<" + p + ">" + Parameters._serialize(o[p]) + "</" + p + ">";
            break;
        default:
            break;
    }
    return s;
}
Parameters.prototype.toXML = function() {
	var xml = "";
	var params = this._params;
	for(var name in params) {
	    var type = typeof(params[name])
	    if (type === 'string' || type === "number" || type === "boolean" || type === "object") {
            xml += "<" + name + ">" + Parameters._serialize(params[name]) + "</" + name + ">";
        }
	}
	return xml;	    
}

function WSSecurity(username, password) {
	this._username = username;
	this._password = password;    
}

WSSecurity.prototype.toXML = function() {
    return  "<wsse:Security xmlns:wsse=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\">" +
	        "<wsse:UsernameToken>" +
	        "<wsse:Username>"+this._username+"</wsse:Username>" + 
	        "<wsse:Password>"+this._password+"</wsse:Password>" +
	        "</wsse:UsernameToken>" +
	        "</wsse:Security>"
}

function WSDL(url, dom) {
    var namespace = dom.documentElement.attributes["targetNamespace"];
    if (namespace == undefined) {
        namespace = dom.documentElement.attributes.getNamedItem("targetNamespace").nodeValue;
    }
    else {
        namespace = namespace.value;
    }
    this._namespace = namespace;

	var types = {};
	var operations = {};
	var elements = dom.getElementsByTagName("element");	     
	for (var i=0, el; el=elements[i]; i++) {
		if(el.attributes["name"] != null && el.attributes["type"] != null)
			types[el.attributes["name"].value] = el.attributes["type"].value;
	}
	this._types = types;

	elements = dom.getElementsByTagName("operation");	     
	for (var i=0, el; el=elements[i]; i++) {
		if(el.attributes["name"] != null)
			operations[el.attributes["name"].value] = 1;
	}
	this._operations = Object.keys(operations);
	
	this._url = url;
}

WSDL.prototype.url = function() { return this._url; }
WSDL.prototype.namespace = function() { return this._namespace; }
WSDL.prototype.typeOf = function(elementname) { return this._types[elementname] || ""; }
WSDL.prototype.operations = function() { return this._operations; }

function loadWsdl(url, callback)
{
	httpRequest(url + "?wsdl", null, function(err, response) {
    	callback(err, response && new WSDL(url, toDOM(response.body)));
	});
}

function SOAPClient(wsdl) {
    var self = this;
    
    self._wsdl = wsdl;
    
    var ops = wsdl.operations();
	for (var i=0, op; op=ops[i]; i++) {
	    self[op] = function(op) {
	        return function(args, callback) {
    	        if (callback == undefined) {
    	            callback = args;
    	            args = {};
    	        }
    	        self.invoke(op, new Parameters(args), callback);
    	    }    	    
	    }(op);
	}	
}

SOAPClient.prototype.setSecurity = function(security) {
    this._security = security;    
}

SOAPClient.prototype.invoke = function(method, parameters, callback)
{
	this._sendSoapRequest(method, parameters, callback);
}

SOAPClient.prototype._sendSoapRequest = function(method, parameters, callback)
{
	// get namespace
	var self = this;
	var ns = self._wsdl.namespace();
	// build SOAP request
	var sr = 
				"<?xml version=\"1.0\" encoding=\"utf-8\"?>" +
				"<soap:Envelope " +
				"xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" " +
				"xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" " +				
				"xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">" +
				"<soap:Header>" +
				(self._security ? self._security.toXML() : "") +
				"</soap:Header>" +
				"<soap:Body>" +
				"<" + method + "Request xmlns=\"" + ns + "\">" +
				parameters.toXML() +
				"</" + method + "Request></soap:Body></soap:Envelope>";
	// send request
	var headers = {
	    SOAPAction: ((ns.lastIndexOf("/") != ns.length - 1) ? ns + "/" : ns) + method,
	    'Content-Type': "text/xml; charset=utf-8"
	};
	httpRequest(this._wsdl.url(), sr, function(err, response) {
	    if (err) callback(err)
		else self._onSendSoapRequest(method, callback, response);	    
	}, headers);
}

SOAPClient.prototype._onSendSoapRequest = function(method, callback, response) 
{
    var self = this;
    var dom = toDOM(response.body);
	var o = null;
	var nd = dom.getElementsByTagName(method + "Response");
	if(nd.length == 0) 
        nd = dom.getElementsByTagName("return");	// PHP web Service?
	if(nd.length == 0) {
        if(dom.getElementsByTagName("faultcode").length > 0)
        {
            callback(new Error('(500) ' + dom.getElementsByTagName("faultstring")[0].childNodes[0].nodeValue));
            return
        }
    }
    else 
        o = self._soapresult2object(nd[0]);		
    callback(null, o);
}
SOAPClient.prototype._soapresult2object = function(node)
{
    return this._node2object(node);
}
SOAPClient.prototype._node2object = function(node)
{
	// null node
	if(node == null)
		return null;
	// text node
	if(node.nodeType == 3 || node.nodeType == 4)
		return this._extractValue(node);
	// leaf node
	if (node.childNodes.length == 1 && (node.childNodes[0].nodeType == 3 || node.childNodes[0].nodeType == 4))
		return this._node2object(node.childNodes[0]);
	var isarray = this._wsdl.typeOf(node.nodeName).toLowerCase().indexOf("arrayof") != -1;
	// object node
	if(!isarray)
	{
		var obj = null;
		if(node.hasChildNodes())
			obj = new Object();
		for(var i = 0; i < node.childNodes.length; i++)
		{
			var p = this._node2object(node.childNodes[i]);
			var nodeName = node.childNodes[i].nodeName
			if (nodeName in obj) {
				var value = obj[nodeName]
				if (value instanceof Array) {
					obj[nodeName].push(p)
				}
				else {
					obj[nodeName] = [value, p]
				}
			}
			else				
				obj[nodeName] = p;
		}
		return obj;
	}
	// list node
	else
	{
		// create node ref
		var l = new Array();
		for(var i = 0; i < node.childNodes.length; i++)
			l[l.length] = this._node2object(node.childNodes[i]);
		return l;
	}
	return null;
}
SOAPClient.prototype._extractValue = function(node)
{
	var value = node.nodeValue;
	switch(this._wsdl.typeOf(node.parentNode.nodeName).toLowerCase())
	{
		default:
		case "s:string":			
			return (value != null) ? value + "" : "";
		case "s:boolean":
			return value + "" == "true";
		case "s:int":
		case "s:long":
			return (value != null) ? parseInt(value + "", 10) : 0;
		case "s:double":
			return (value != null) ? parseFloat(value + "") : 0;
		case "s:datetime":
			if(value == null)
				return null;
			else
			{
				value = value + "";
				value = value.substring(0, (value.lastIndexOf(".") == -1 ? value.length : value.lastIndexOf(".")));
				value = value.replace(/T/gi," ");
				value = value.replace(/-/gi,"/");
				var d = new Date();
				d.setTime(Date.parse(value));										
				return d;				
			}
	}
}

var ELEMENT_NODE = 1;
var ATTRIBUTE_NODE = 2;
var TEXT_NODE = 3;
var CDATA_SECTION_NODE = 4;
var DOCUMENT_NODE = 9;

function toDOM(text)
{
    var p = new expat.Parser('UTF-8');
    var root = null
    var stack = [];
    var self = this;
    var tagMap = {}
    
    function addNode(name, attrs, type, value) {
        var s = stack.length ? stack[stack.length-1] : null;
		
		if (name) {
			name = name.split(':')
			name = name[name.length-1]
		}
		
        var node = {
            nodeName: name || '#text',
            nodeType: type,
            nodeValue: value || null,
            attributes: null,
            childNodes: [],
            parentNode: s,
            hasChildNodes: function() { return this.childNodes.length > 0}
        };

        if (s && s.nodeType == ELEMENT_NODE)
            s.childNodes.push(node);

        if (attrs) {
            var attributes = {}
            for (var k in attrs) {
                attributes[k] = {
                    name: k,
                    value: attrs[k],
                    ownerElement: node
                }
            }            
            node.attributes = attributes
        }

        if (type == ELEMENT_NODE) {
            stack.push(node);                         
            if (name in tagMap) {
                tagMap[name].push(node)
            }
            else {
                tagMap[name] = [node]
            }
        }
    }
    
    p.on('startElement', function(name, attrs) {
        addNode(name, attrs, ELEMENT_NODE);
    })
    
    p.on('endElement', function(name) {
        var obj = stack.pop();
        if (!stack.length) 
            root = obj;
    })
    
    p.on('text', function(text) {
        addNode('#text', null, TEXT_NODE, text);
    })
    
    if (!p.parse(text, false)) {
        throw new Error(p.getError());
    }
    
    return {
        nodeName: '#document',
        nodeType: DOCUMENT_NODE,
        documentElement: root,
        getElementsByTagName: function(tagName) { return tagMap[tagName] || [] }
    };
}

exports.getClient = function(url, callback) {
	loadWsdl(url, function(err, wsdl) {
	    try {
            callback(err, wsdl && new SOAPClient(wsdl));	    	        
	    }
	    catch(e) {
	        callback(e);
	    }
	});    
}

exports.WSSecurity = WSSecurity;
