/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

var expat = require('node-expat'),
    inherits = require('util').inherits,
    http = require('./http'),
    fs = require('fs'),
    url = require('url'),
    assert = require('assert').ok;

var Primitives = {
    string: 1, boolean: 1, decimal: 1, float: 1, double: 1,
    anyType: 1, byte: 1, int: 1, long: 1, short: 1, 
    unsignedByte: 1, unsignedInt: 1, unsignedLong: 1, unsignedShort: 1,
    duration: 0, dateTime: 0, time: 0, date: 0,
    gYearMonth: 0, gYear: 0, gMonthDay: 0, gDay: 0, gMonth: 0, 
    hexBinary: 0, base64Binary: 0, anyURI: 0, QName: 0, NOTATION: 0
};

function splitNSName(nsName) {
    var i = (nsName != null) ? nsName.indexOf(':') : -1;
    return i < 0 ? {namespace:null,name:nsName} : {namespace:nsName.substring(0, i), name:nsName.substring(i+1)};
}

function xmlEscape(obj) {
    if (typeof(obj) === 'string') {
        return obj
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')        
    }

    return obj;
}

var trimLeft = /^[\s\xA0]+/;
var trimRight = /[\s\xA0]+$/;

function trim(text) {
    return text.replace(trimLeft, '').replace(trimRight, '');
}

var Element = function(nsName, attrs, parent) {
    var parts = splitNSName(nsName);

    this.nsName = nsName;
    this.namespace = parts.namespace;
    this.name = parts.name;
    this.attrs = attrs;
    this.children = [];
    this.parent = parent;
    this.xmlns = {}
    for (var key in attrs) {
        var match = /^xmlns:?(.*)$/.exec(key);
        if (match) {
            this.xmlns[match[1]] = attrs[key];
        }
        else {
            this['$'+key] = attrs[key];        
        }
    }
}

Element.prototype.allowedChildren = null;
Element.prototype.startElement= function(stack, nsName, attrs) {
    if (!this.allowedChildren) return;

    var childClass = this.allowedChildren()[splitNSName(nsName).name],
        element = null;

    if (childClass) {
        stack.push(new childClass(nsName, attrs, this));
    }
    else {
        // this.unexpected(nsName);
    }
}
Element.prototype.endElement = function(stack, nsName) {    
    if (this.nsName === nsName) {
        var parent = this.parent;
        if (parent) {
            parent.children.push(this);
            parent.addChild(this);
        };
        stack.pop();
    }
}
Element.prototype.addChild = function(child) { }
Element.prototype.unexpected = function(name) {
    throw new Error('Found unexpected element (' + name + ') inside ' + this.nsName);
}
Element.prototype.description = function(definitions) {
    return this.$name || this.name;
}

var SimpleTypeElement = function() { Element.apply(this, arguments); }
inherits(SimpleTypeElement, Element);

var ComplexTypeElement = function() { Element.apply(this, arguments); }
inherits(ComplexTypeElement, Element);
ComplexTypeElement.prototype.allowedChildren = function() { 
    return { 
        annotation: Element,
        sequence: SequenceElement 
    };
}
ComplexTypeElement.prototype.description = function(definitions) {
    var children = this.children;
    for (var i=0, child; child=children[i]; i++) {
        if (child instanceof SequenceElement)
            return child.description(definitions);
    }
    return {};
}

var ElementElement = function() { Element.apply(this, arguments); }
inherits(ElementElement, Element);
ElementElement.prototype.allowedChildren = function() { 
    return { 
        annotation: Element,
        complexType: ComplexTypeElement 
    };
}
ElementElement.prototype.description = function(definitions) {
    var element = {},
        name = this.$name;
    if (this.$minOccurs !== this.$maxOccurs) {
        name += '[]';
    }
    
    if (this.$type) {
        var typeName = splitNSName(this.$type).name,
            typeElement = definitions.complexTypes[typeName] || definitions.types[typeName];
        if (typeElement && !(typeName in Primitives)) {
            element[name] = typeElement.description(definitions);                            
        }
        else
            element[name] = this.$type;
    }
    else {
        var children = this.children;
        element[name] = {};
        for (var i=0, child; child=children[i]; i++) {
            if (child instanceof ComplexTypeElement)
                element[name] = child.description(definitions);
        }
    }
    return element;
}

var SequenceElement = function() { Element.apply(this, arguments); }
inherits(SequenceElement, Element);
SequenceElement.prototype.allowedChildren = function() { 
    return { 
        element: ElementElement
    };
}
SequenceElement.prototype.description = function(definitions) {
    var children = this.children;
    var sequence = {};
    for (var i=0, child; child=children[i]; i++) {
        var description = child.description(definitions);
        for (var key in description) {
            sequence[key] = description[key];
        }
    }
    return sequence;
}

var SchemaElement = function() { 
    Element.apply(this, arguments); 
    this.complexTypes = {};
    this.types = {};
    this.includes = [];
}
inherits(SchemaElement, Element);
SchemaElement.prototype.allowedChildren = function() { 
    return {
        element: ElementElement,
        complexType: ComplexTypeElement,
        simpleType: SimpleTypeElement,
        include: Element,
        import: Element
    }
}
SchemaElement.prototype.addChild = function(child) {
    if (child.$name in Primitives) return;
    if (child.name === 'include' || child.name === 'import') {
        this.includes.push(child.$schemaLocation);
    }
    else if (child.name === 'complexType') {
        this.complexTypes[child.$name] = child;
    }
    else if (child.$name) {
        this.types[child.$name] = child;        
    }
}

function extend(base, obj) {
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            base[key] = obj[key];
        }
    }
    return base;
}

var TypesElement = function() { 
    Element.apply(this, arguments);
    this.complexTypes = {};
    this.types = {};
    this.includes = [];
}
inherits(TypesElement, Element);
TypesElement.prototype.allowedChildren = function() { 
    return { schema: SchemaElement };
}
TypesElement.prototype.addChild = function(child) {
    assert(child instanceof SchemaElement);
    extend(this.complexTypes, child.complexTypes);
    extend(this.types, child.types);
    extend(this.includes, child.includes);
}

var MessageElement = function() { 
    Element.apply(this, arguments); 
    this.element = null;
    this.parts = null;
}
inherits(MessageElement, Element);
MessageElement.prototype.allowedChildren = function() { 
    return { part: Element };
}
MessageElement.prototype.postProcess = function(definitions) {
    var part = this.children[0];
    if (!part) return;

    assert(part.name === 'part', 'Expected part element');
    if (part.$element) {
        var nsName = splitNSName(part.$element)
        this.element = definitions.types[nsName.name];
        this.ns = nsName.namespace;
    }
    else {
        // rpc encoding
        this.parts = {};
        for (var i=0, part; part = this.children[i]; i++) {
            assert(part.name === 'part', 'Expected part element');
            this.parts[part.$name] = part.$type;
        }
    }
}
MessageElement.prototype.description = function(definitions) {
    if (this.element) {
        return this.element && this.element.description(definitions);    
    }
    var desc = {};
    desc[this.$name] = this.parts;
    return desc;
}

var OperationElement = function() { 
    Element.apply(this, arguments);
    this.input = null;
    this.output = null; 
}
inherits(OperationElement, Element);
OperationElement.prototype.allowedChildren = function() { 
    return { 
        documentation: Element,
        input: Element,
        output: Element,
        operation: Element
    };
}
OperationElement.prototype.postProcess = function(definitions) {
    var children = this.children;
    for (var i=0, child; child=children[i]; i++) {
        if (child.name !== 'input' && child.name !== 'output') continue;
        var messageName = splitNSName(child.$message).name;
        var message = definitions.messages[messageName]
        message.postProcess(definitions);
        if (message.element) {
            definitions.messages[message.element.$name] = message
            this[child.name] = message.element;
        }
        else {
            this[child.name] = message;
        }
    }
}
OperationElement.prototype.description = function(definitions) {
    var inputDesc = this.input.description(definitions);
    var outputDesc = this.output.description(definitions);
    return {
        input: inputDesc && inputDesc[Object.keys(inputDesc)[0]],
        output: outputDesc && outputDesc[Object.keys(outputDesc)[0]]
    }
}

var PortTypeElement = function() { 
    Element.apply(this, arguments); 
    this.methods = {};
}
inherits(PortTypeElement, Element);
PortTypeElement.prototype.allowedChildren = function() { 
    return { operation: OperationElement };
}
PortTypeElement.prototype.postProcess = function(definitions) {
    var children = this.children;        
    for (var i=0, child; child=children[i]; i++) {
        if (child.name != 'operation') continue;
        child.postProcess(definitions);
        this.methods[child.$name] = child;
    }
}
PortTypeElement.prototype.description = function(definitions) {
    var methods = {};
    for (var name in this.methods) {
        var method = this.methods[name];
        methods[name] = method.description(definitions);
    }
    return methods;
}

var BindingElement = function() { 
    Element.apply(this, arguments); 
    this.transport = null;
    this.style = null;
    this.methods = {};
}
inherits(BindingElement, Element);
BindingElement.prototype.allowedChildren = function() { 
    return { 
        binding: Element,
        SecuritySpec: Element,
        operation: Element
    };
}
BindingElement.prototype.addChild = function(child) {
    if (child.name === 'binding') {
       this.transport = child.$transport;
       this.style = child.$style;
    }
}
BindingElement.prototype.postProcess = function(definitions) {
    var type = splitNSName(this.$type).name,
        portType = definitions.portTypes[type],
        style = this.style;

    portType.postProcess(definitions);
    this.methods = portType.methods;
    for (var name in this.methods) {
        this.methods[name].style = style;
    }
}
BindingElement.prototype.description = function(definitions) {
    var methods = {};
    for (var name in this.methods) {
        var method = this.methods[name];
        methods[name] = method.description(definitions);
    }
    return methods;
}

var PortElement = function() { 
    Element.apply(this, arguments); 
    this.location = null;
}
inherits(PortElement, Element);

PortElement.prototype.allowedChildren = function() { 
    return { address: Element };
}
PortElement.prototype.addChild = function(child) {
    if (child.name === 'address') {
       this.location = child.$location;
    }
}

var ServiceElement = function() { 
    Element.apply(this, arguments); 
    this.ports = {};
}
inherits(ServiceElement, Element);
ServiceElement.prototype.allowedChildren = function() { 
    return { 
        port: PortElement,
        documentation: Element
    };
}
ServiceElement.prototype.postProcess = function(definitions) {
    var children = this.children,
        bindings = definitions.bindings;
    for (var i=0, child; child=children[i]; i++) {
        if (child.name != 'port') continue;
        var bindingName = splitNSName(child.$binding).name;
        var binding = bindings[bindingName];
        if (binding) {
            binding.postProcess(definitions);
            this.ports[child.$name] = {
                location: child.location,
                binding: binding
            }
        }
    }
}
ServiceElement.prototype.description = function(definitions) {
    var ports = {};
    for (var name in this.ports) {
        var port = this.ports[name];
        ports[name] = port.binding.description(definitions);
    }
    return ports;
}

var DefinitionsElement = function() {
    Element.apply(this, arguments);
    if (this.name !== 'definitions') this.unexpected(nsName);
    this.complexTypes = {};
    this.types = {};
    this.messages = {};
    this.portTypes = {};
    this.bindings = {};
    this.services = {};
}
inherits(DefinitionsElement, Element);

DefinitionsElement.prototype.allowedChildren = function() {
    return {
        types: TypesElement,
        message: MessageElement,
        portType: PortTypeElement,
        binding: BindingElement,
        service: ServiceElement
    };
}
DefinitionsElement.prototype.addChild = function(child) {
    var self = this;
    if (child instanceof TypesElement) {
        self.complexTypes = child.complexTypes;
        self.types = child.types;
        self.includes = child.includes;
    }
    else if (child instanceof MessageElement) {
        self.messages[child.$name] = child;
    }
    else if (child instanceof PortTypeElement) {
        self.portTypes[child.$name] = child;
    }
    else if (child instanceof BindingElement) {
        if (child.transport === 'http://schemas.xmlsoap.org/soap/http' ||
            child.transport === 'http://www.w3.org/2003/05/soap/bindings/HTTP/')
            self.bindings[child.$name] = child;
    }
    else if (child instanceof ServiceElement) {
        self.services[child.$name] = child;
    }
    else {
        assert(false, "Invalid child type");
    }
}

var WSDL = function(definition, uri) {
    var self = this,
        fromFunc;

    this.uri = uri;
    this.callback = function() {};

    if (typeof definition === 'string') {
        fromFunc = this._fromXML;
    }
    else if (typeof definition === 'object') {
        fromFunc = this._fromServices;
    }
    else {
        throw new Error('WSDL constructor takes either an XML string or service definition');
    }

    process.nextTick(function() {
        fromFunc.call(self, definition);
        self.processIncludes(function(err) {
            var services = self.services = self.definitions.services ;
            if (services) {
                for (var name in services) {
                    services[name].postProcess(self.definitions);
                }
            }
            self.callback(err, self);
        });
        var bindings = self.definitions.bindings;
        for(var bindingName in bindings) {
            var binding = bindings[bindingName];
            if(binding.style !== 'document') continue;
            var methods = binding.methods;
            var topEls = binding.topElements = {};
            for(methodName in methods) {
                var inputName = methods[methodName].input.$name;
                var outputName = methods[methodName].output.$name;
                topEls[inputName] = {"methodName": methodName, "outputName": outputName};
            }
        }
    })
}

WSDL.prototype.onReady = function(callback) {
    if (callback) this.callback = callback;
}

WSDL.prototype.processIncludes = function(callback) {
    var self = this,
        uri = this.definitions && this.definitions.includes.shift();

    if (!uri) {
        callback(null, this);
        return;
    }

    open_wsdl(url.resolve(self.uri, uri), function(err, wsdl) {
        for (var name in wsdl.definitions.complexTypes) {
            self.definitions.complexTypes[name] = wsdl.definitions.complexTypes[name];
        }
        for (var name in wsdl.definitions.types) {
            self.definitions.types[name] = wsdl.definitions.types[name];
        }
        self.processIncludes(function(err, wsdl) {
            callback(err, wsdl);
        })
    });
}

WSDL.prototype.describeServices = function() {
    var services = {};
    for (var name in this.services) {
        var service = this.services[name];
        services[name] = service.description(this.definitions);
    }
    return services;
}

WSDL.prototype.toXML = function() {
    return this.xml || '';
}

WSDL.prototype.xmlToObject = function(xml) {
    var self = this,
        p = new expat.Parser('UTF-8'),
        objectName = null,
        root = {},
        schema = { 
            Envelope: { 
                Header: {                                                                                                                                                              
                        Security: {                                                                                                                                                    
                            UsernameToken: {                                                                                                                                           
                                Username: 'string',                                                                                                                                    
                                Password: 'string' }}},    
                Body: { 
                    Fault: { faultcode: 'string', faultstring: 'string', detail: 'string' }}}},        
        stack = [{name: null, object: root, schema: schema}];
   
    var refs = {}, id; // {id:{hrefs:[],obj:}, ...}

    p.on('startElement', function(nsName, attrs) {
        var name = splitNSName(nsName).name,
            top = stack[stack.length-1],
            topSchema = top.schema,
            obj = {};
        if (!objectName && top.name === 'Body' && name !== 'Fault') {
            var message = self.definitions.messages[name];
						if(!message) {
							// or name = name + "Request directly"
							var portTypes = self.definitions.portTypes;
							for(var n in portTypes) {
								var portType = portTypes[n];
								break;
							}
							message = self.definitions.messages[portType.methods[name].input.$name];
						}
            topSchema = message.description(self.definitions);
            objectName = name;
        }
				
				if(attrs.href) {
					id = attrs.href.substr(1);
					if(!refs[id]) refs[id] = {hrefs:[],obj:null};
					refs[id].hrefs.push({par:top.object,key:name});
				}
				if(id=attrs.id) {
					if(!refs[id]) refs[id] = {hrefs:[],obj:null};
				}

        if (topSchema && topSchema[name+'[]']) name = name + '[]';
        stack.push({name: name, object: obj, schema: topSchema && topSchema[name], id:attrs.id});
    })
    
    p.on('endElement', function(nsName) {
        var cur = stack.pop(),
						obj = cur.object,
            top = stack[stack.length-1],
            topObject = top.object,
            topSchema = top.schema,
            name = splitNSName(nsName).name;
            
        if (topSchema && topSchema[name+'[]']) {
            if (!topObject[name]) topObject[name] = [];
            topObject[name].push(obj);
        }
        else if (name in topObject) {
            if (!Array.isArray(topObject[name])) {
                topObject[name] = [topObject[name]];
            }
            
            topObject[name].push(obj);
        }
        else {
            topObject[name] = obj;                        
        }
				
				if(cur.id) {			
					refs[cur.id].obj = obj;
				}
    })
    
    p.on('text', function(text) {
        text = trim(text);
        if (!text.length) return;

        var top = stack[stack.length-1];
        var name = splitNSName(top.schema).name,
            value;
        if (name === 'int') {
            value = parseInt(text, 10);
        } else if (name === 'dateTime') {
            value = new Date(text);
        } else {
            // handle string or other types
            if (typeof top.object !== 'string') {
                value = text;
            } else {
                value = top.object + text;
            }
        }
        top.object = value;
    });
        
    if (!p.parse(xml, false)) {
        throw new Error(p.getError());
    }
		
		for(var n in refs) {
			var ref = refs[n];
			var obj = ref.obj;
			ref.hrefs.forEach(function(href) {
				href.par[href.key] = obj;
			});
		}
		
    var body = root.Envelope.Body;
    if (body.Fault) {
        throw new Error(body.Fault.faultcode+': '+body.Fault.faultstring+(body.Fault.detail ? ': ' + body.Fault.detail : ''));
    }
    return body;
}

WSDL.prototype.objectToDocumentXML = function(name, params) {
    var args = {}, ns, xmlns;
    args[name] = params;
    var message = this.definitions.messages[name];
    if (message && message.ns) {
        ns = message.ns;
        xmlns = this.definitions.xmlns[ns];
    }
    return this.objectToXML(args, null, ns, xmlns);
}

WSDL.prototype.objectToRpcXML = function(name, params, namespace) {
    var self = this,
        parts = [],
        namespace = namespace || 'ns0',
        xmlns = xmlns || '',
        nsAttrName = '_xmlns';

    parts.push(['<','ns0:',name,' xmlns:ns0="',namespace,'">'].join(''));
    for (var key in params) {
        if (key != nsAttrName) {
            var value = params[key];
            parts.push(['<',key,'>'].join(''));
            parts.push((typeof value==='object')?this.objectToXML(value):xmlEscape(value));            
            parts.push(['</',key,'>'].join(''));
        }
    }
    parts.push(['</','ns0:',name,'>'].join(''));

    return parts.join('');
}

WSDL.prototype.objectToXML = function(obj, name, namespace, xmlns) {
    var self = this,
        parts = [],
        xmlnsAttrib = xmlns ? ' xmlns:'+namespace+'="'+xmlns+'"'+' xmlns="'+xmlns+'"' : '',
        ns = namespace ? namespace + ':' : '';
    
    if (Array.isArray(obj)) {
        for (var i=0, item; item=obj[i]; i++) {
            if (i > 0) {
                parts.push(['</',ns,name,'>'].join(''));
                parts.push(['<',ns,name,xmlnsAttrib,'>'].join(''));
            }
            parts.push(self.objectToXML(item, name));
        }
    }
    else if (typeof obj === 'object') {
        for (var name in obj) {
            var child = obj[name];
            parts.push(['<',ns,name,xmlnsAttrib,'>'].join(''));
            parts.push(self.objectToXML(child, name));
            parts.push(['</',ns,name,'>'].join(''));
        }
    }
    else if (obj) {
        parts.push(xmlEscape(obj));
    }
    return parts.join('');
}

WSDL.prototype._parse = function(xml)
{
    var self = this,
        p = new expat.Parser('UTF-8'),
        stack = [],
        root = null;
    
    p.on('startElement', function(nsName, attrs) {
        var top = stack[stack.length - 1];
        if (top) {
            top.startElement(stack, nsName, attrs);
        }
        else {
            var name = splitNSName(nsName).name;
            if (name === 'definitions') {
                root = new DefinitionsElement(nsName, attrs);
            }
            else if (name === 'schema') {
                root = new SchemaElement(nsName, attrs);
            }
            else {
                throw new Error('Unexpected root element of WSDL or include');
            }
            stack.push(root);
        }
    })
    
    p.on('endElement', function(name) {
        var top = stack[stack.length - 1];
        assert(top, 'Unmatched close tag: ' + name);

        top.endElement(stack, name);
    })
    
    if (!p.parse(xml, false)) {
        throw new Error(p.getError());
    }
    
    return root;
}

WSDL.prototype._fromXML = function(xml) {
    this.definitions = this._parse(xml);
    this.xml = xml;

		// mark the style(document|rpc)
		var bindings = this.definitions.bindings;
		for(var n in bindings) {
			this.style = bindings[n].style;
			break;
		}
}

WSDL.prototype._fromServices = function(services) {
       
}

function open_wsdl(uri, callback) {
    var wsdl;
    if (!/^http/.test(uri)) {
        fs.readFile(uri, 'utf8',  function (err, definition) {
            if (err) {
                callback(err)
            }
            else {
                wsdl = new WSDL(definition, uri);
                wsdl.onReady(callback);
            }
        })
    }
    else {        
        http.request(uri, null /* options */, function (err, response, definition) {
            if (err) {
                callback(err);
            }
            else if (response && response.statusCode == 200) {
                wsdl = new WSDL(definition, uri);
                wsdl.onReady(callback);
            }
            else {
                callback(new Error('Invalid WSDL URL: '+uri))
            }
        });   
    }    

    return wsdl;
}

exports.open_wsdl = open_wsdl;
exports.WSDL = WSDL;
