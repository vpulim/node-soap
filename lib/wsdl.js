/* 
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

var expat = require('node-expat'),
    inherits = require('util').inherits,
    http = require('./http'),
    fs = require('fs'),
    url = require('url'),
    path = require('path'),
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

function extend(base, obj) {
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            base[key] = obj[key];
        }
    }
    return base;
}

function findKey(obj, val) {
    for (var n in obj) if (obj[n] === val) return n;
}

var Element = function(nsName, attrs) {
    var parts = splitNSName(nsName);

    this.nsName = nsName;
    this.namespace = parts.namespace;
    this.name = parts.name;
    this.children = [];
    this.xmlns = {};
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
Element.prototype.deleteFixedAttrs = function() {
    this.children && this.children.length === 0 && delete this.children;
    this.xmlns && Object.keys(this.xmlns).length === 0 && delete this.xmlns;
    delete this.nsName;
    delete this.namespace;
    delete this.name;
}
Element.prototype.allowedChildren = [];
Element.prototype.startElement= function(stack, nsName, attrs) {
    if (!this.allowedChildren) return;

    var childClass = this.allowedChildren[splitNSName(nsName).name],
        element = null;

    if (childClass) {
        stack.push(new childClass(nsName, attrs));
    }
    else {
        this.unexpected(nsName);
    }

}
Element.prototype.endElement = function(stack, nsName) {    
    if (this.nsName === nsName) {
        if(stack.length < 2 ) return;
        var parent = stack[stack.length - 2];
        if (this !== stack[0]) {
            extend(stack[0].xmlns, this.xmlns);
            // delete this.xmlns;
            parent.children.push(this);
            parent.addChild(this);
        }
        stack.pop();
    }
}
Element.prototype.addChild = function(child) { return; }
Element.prototype.unexpected = function(name) {
    throw new Error('Found unexpected element (' + name + ') inside ' + this.nsName);
}
Element.prototype.description = function(definitions) {
    return this.$name || this.name;
}
Element.prototype.init = function() {};
Element.createSubClass = function() {
    var root = this;
    var subElement = function() {
        root.apply(this, arguments);
        this.init();
    };
    // inherits(subElement, root);
    subElement.prototype.__proto__ = root.prototype;
    return subElement;
}


var ElementElement = Element.createSubClass();
var InputElement = Element.createSubClass();
var OutputElement = Element.createSubClass();
var SimpleTypeElement = Element.createSubClass();
var RestrictionElement = Element.createSubClass();
var EnumerationElement = Element.createSubClass();
var ComplexTypeElement = Element.createSubClass();
var SequenceElement = Element.createSubClass();
var AllElement = Element.createSubClass();
var MessageElement = Element.createSubClass();
var DocumentationElement = Element.createSubClass();

var SchemaElement = Element.createSubClass();
var TypesElement = Element.createSubClass();
var OperationElement = Element.createSubClass();
var PortTypeElement = Element.createSubClass();
var BindingElement = Element.createSubClass();
var PortElement = Element.createSubClass();
var ServiceElement = Element.createSubClass();
var DefinitionsElement = Element.createSubClass();

var ElementTypeMap = {
    types: [TypesElement, 'schema documentation'],
    schema: [SchemaElement, 'element complexType simpleType include import'],
    element: [ElementElement, 'annotation complexType'],
    simpleType: [SimpleTypeElement, 'restriction'],
    restriction: [RestrictionElement, 'enumeration'],
    enumeration: [EnumerationElement, ''],
    complexType: [ComplexTypeElement,  'annotation sequence all'],
    sequence: [SequenceElement, 'element'],
    all: [AllElement, 'element'],
    
    service: [ServiceElement, 'port documentation'],
    port: [PortElement, 'address documentation'],
    binding: [BindingElement, '_binding SecuritySpec operation documentation'],
    portType: [PortTypeElement, 'operation documentation'],
    message: [MessageElement, 'part documentation'],
    operation: [OperationElement, 'documentation input output fault _operation'],
    input : [InputElement, 'body SecuritySpecRef documentation header'],
    output : [OutputElement, 'body SecuritySpecRef documentation header'],
    fault : [Element, '_fault documentation'],
    definitions: [DefinitionsElement, 'types message portType binding service documentation'],
    documentation: [DocumentationElement, '']
};

function mapElementTypes(types) {
    var types = types.split(' ');
    var rtn = {}
    types.forEach(function(type){
        rtn[type.replace(/^_/,'')] = (ElementTypeMap[type] || [Element]) [0];
    });
    return rtn;
}

for(var n in ElementTypeMap) {
    var v = ElementTypeMap[n];
    v[0].prototype.allowedChildren = mapElementTypes(v[1]);
}

MessageElement.prototype.init = function() {
    this.element = null;
    this.parts = null;
}
SchemaElement.prototype.init = function() { 
    this.complexTypes = {};
    this.types = {};
    this.elements = {};
    this.includes = [];
}
TypesElement.prototype.init = function() { 
    this.schemas = {};
}
OperationElement.prototype.init = function() { 
    this.input = null;
    this.output = null;
    this.inputSoap = null;
    this.outputSoap = null;
    this.style = '';
    this.soapAction = '';
}
PortTypeElement.prototype.init = function() { 
    this.methods = {};
}
BindingElement.prototype.init = function() { 
    this.transport = '';
    this.style = '';
    this.methods = {};
}
PortElement.prototype.init = function() { 
    this.location = null;
}
ServiceElement.prototype.init = function() { 
    this.ports = {};
}
DefinitionsElement.prototype.init = function() {
    if (this.name !== 'definitions') this.unexpected(nsName);
    this.messages = {};
    this.portTypes = {};
    this.bindings = {};
    this.services = {};
    this.schemas = {};
}
DocumentationElement.prototype.init = function(){}

SchemaElement.prototype.addChild = function(child) {
    if (child.$name in Primitives) return;
    if (child.name === 'include' || child.name === 'import') {
        var location = child.$schemaLocation || child.$location;
        if (location) {
            this.includes.push({
                namespace: child.$namespace || child.$targetNamespace || this.$targetNamespace,
                location: location
            });            
        }
    }
    else if (child.name === 'complexType') {
        this.complexTypes[child.$name] = child;
    }
    else if (child.name === 'element') {
        this.elements[child.$name] = child;
    }
    else if (child.$name) {
        this.types[child.$name] = child;        
    }
    this.children.pop();
    // child.deleteFixedAttrs();
}
TypesElement.prototype.addChild = function(child) {
    assert(child instanceof SchemaElement);    
    this.schemas[child.$targetNamespace] = child;    
}
InputElement.prototype.addChild = function(child) {
    if (child.name === 'body') {
        this.use = child.$use;
        if (this.use === 'encoded') {
            this.encodingStyle = child.$encodingStyle;
        }
        this.children.pop();
    } 
}
OutputElement.prototype.addChild = function(child) {
    if (child.name === 'body') {
        this.use = child.$use;
        if (this.use === 'encoded') {
            this.encodingStyle = child.$encodingStyle;
        }
        this.children.pop();
    } 
}
OperationElement.prototype.addChild = function(child) {
    if (child.name === 'operation') {
        this.soapAction = child.$soapAction || '';
        this.style = child.$style || '';
        this.children.pop();
    }
}
BindingElement.prototype.addChild = function(child) {
    if (child.name === 'binding') {
        this.transport = child.$transport;
        this.style = child.$style;
        this.children.pop();
    }
}
PortElement.prototype.addChild = function(child) {
    if (child.name === 'address' && typeof(child.$location) !== 'undefined') {
       this.location = child.$location;
    }
}
DefinitionsElement.prototype.addChild = function(child) {
    var self = this;
    if (child instanceof TypesElement) {
        self.schemas = child.schemas;
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
    else if (child instanceof DocumentationElement) {
    }
    else {
        assert(false, "Invalid child type");
    }
    this.children.pop();
}


MessageElement.prototype.postProcess = function(definitions) {
    var part = null, child,
        children = this.children || [];

    for (var i in children) {
        if ((child = children[i]).name === 'part') {
            part = child;
            break;
        }
    }
    if (!part) return;
    if (part.$element) {
        delete this.parts;
        var nsName = splitNSName(part.$element);
        var ns = nsName.namespace;
        this.element = definitions.schemas[definitions.xmlns[ns]].elements[nsName.name];
        this.element.targetNSAlias = ns;
        this.element.targetNamespace = definitions.xmlns[ns];
        this.children.splice(0,1);
    }
    else {
        // rpc encoding
        this.parts = {};
        delete this.element;
        for (var i=0, part; part = this.children[i]; i++) {
            assert(part.name === 'part', 'Expected part element');
            var nsName = splitNSName(part.$type);
            var ns = definitions.xmlns[nsName.namespace];
            var type = nsName.name;
            var schemaDefinition = definitions.schemas[ns];
            if (typeof schemaDefinition !== 'undefined') {
                this.parts[part.$name] = definitions.schemas[ns].types[type] || definitions.schemas[ns].complexTypes[type];
            } else {
                this.parts[part.$name] = part.$type;
            }
            this.parts[part.$name].namespace = nsName.namespace;
            this.parts[part.$name].xmlns = ns;
            this.children.splice(i--,1);
        }
    }
    this.deleteFixedAttrs();
}
OperationElement.prototype.postProcess = function(definitions, tag) {
    var children = this.children;
    for (var i=0, child; child=children[i]; i++) {
        if (child.name !== 'input' && child.name !== 'output') continue;
        if(tag === 'binding') {
            this[child.name] = child;
            children.splice(i--,1);
            continue;
        }
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
        children.splice(i--,1);
    }
    this.deleteFixedAttrs();
}
PortTypeElement.prototype.postProcess = function(definitions) {
    var children = this.children;
    if (typeof children === 'undefined') return;
    for (var i=0, child; child=children[i]; i++) {
        if (child.name != 'operation') continue;
        child.postProcess(definitions, 'portType');
        this.methods[child.$name] = child;
        children.splice(i--,1);
    }
    delete this.$name;
    this.deleteFixedAttrs();
}
BindingElement.prototype.postProcess = function(definitions) {
    var type = splitNSName(this.$type).name,
        portType = definitions.portTypes[type],
        style = this.style,
        children = this.children;
    
    portType.postProcess(definitions);
    this.methods = portType.methods;
    // delete portType.methods; both binding and portType should keep the same set of operations
   
    for (var i=0, child; child=children[i]; i++) {
        if (child.name != 'operation') continue;
        child.postProcess(definitions, 'binding');
        children.splice(i--,1);
        child.style || (child.style = style);
        var method =  this.methods[child.$name];
        method.style = child.style;
        method.soapAction = child.soapAction;
        method.inputSoap = child.input || null;
        method.outputSoap = child.output || null;
        method.inputSoap && method.inputSoap.deleteFixedAttrs();
        method.outputSoap && method.outputSoap.deleteFixedAttrs();
        // delete method.$name; client will use it to make right request for top element name in body
        // method.deleteFixedAttrs(); why ???
    }

    delete this.$name;
    delete this.$type;
    this.deleteFixedAttrs();    
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
            children.splice(i--,1);
        }
    }
    delete this.$name;
    this.deleteFixedAttrs();
}

SimpleTypeElement.prototype.description = function(definitions) {
    var children = this.children;
    for (var i=0, child; child=children[i]; i++) {
        if (child instanceof RestrictionElement)
           return this.$name+"|"+child.description();
    }
    return {};
}

RestrictionElement.prototype.description = function() {
    var base = this.$base ? this.$base+"|" : "";
    return base + this.children.map( function(child) {
       return child.description();
    } ).join(",");
}

EnumerationElement.prototype.description = function() {
   return this.$value;
}

ComplexTypeElement.prototype.description = function(definitions) {
    var children = this.children;
    for (var i=0, child; child=children[i]; i++) {
        if (child instanceof SequenceElement || 
            child instanceof AllElement) {
            return child.description(definitions);
        }
    }
    return {};
}
ElementElement.prototype.description = function(definitions) {
    var element = {},
        name = this.$name,
        schema;
    var maxOccurs = this.$maxOccurs || 1;
    if ((isNaN(maxOccurs) && maxOccurs == 'unbounded') || maxOccurs > 1) {
        name += '[]';
    }
    
    if (this.$type) {
        var typeName = splitNSName(this.$type).name,
            ns = definitions.xmlns[splitNSName(this.$type).namespace],
            schema = definitions.schemas[ns],
            typeElement = schema && ( schema.complexTypes[typeName] || schema.types[typeName] );
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
AllElement.prototype.description =
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
MessageElement.prototype.description = function(definitions) {
    if (this.element) {
        return this.element && this.element.description(definitions);    
    }
    var desc = {};
    desc[this.$name] = this.parts;
    return desc;
}
PortTypeElement.prototype.description = function(definitions) {
    var methods = {};
    for (var name in this.methods) {
        var method = this.methods[name];
        methods[name] = method.description(definitions);
    }
    return methods;
}
OperationElement.prototype.description = function(definitions) {
    var inputDesc = this.input.description(definitions);
    var outputDesc = this.output.description(definitions);
    return {
        input: inputDesc && inputDesc[Object.keys(inputDesc)[0]],
        output: outputDesc && outputDesc[Object.keys(outputDesc)[0]]
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
ServiceElement.prototype.description = function(definitions) {
    var ports = {};
    for (var name in this.ports) {
        var port = this.ports[name];
        ports[name] = port.binding.description(definitions);
    }
    return ports;
}


var WSDL = function(definition, uri, options) {
    var self = this,
        fromFunc;

    this.uri = uri;
    this.callback = function() {};
    this.options = options || {};

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
            self.definitions.deleteFixedAttrs();
            var services = self.services = self.definitions.services ;
            if (services) {
                for (var name in services) {
                    services[name].postProcess(self.definitions);
                }
            }
            var complexTypes = self.definitions.complexTypes;
            if (complexTypes) {
                for (var name in complexTypes) {
                    complexTypes[name].deleteFixedAttrs();
                }
            }

            // for document style, for every binding, prepare input message element name to (methodName, output message element name) mapping
            var bindings = self.definitions.bindings;
            for(var bindingName in bindings) {
                var binding = bindings[bindingName];
                if(binding.style !== 'document') continue;
                var methods = binding.methods;
                var topEls = binding.topElements = {};
                for(var methodName in methods) {
                    var inputName = methods[methodName].input.$name;
                    var outputName = methods[methodName].output.$name;
                    topEls[inputName] = {"methodName": methodName, "outputName": outputName};
                }
            }

            // prepare soap envelope xmlns definition string
            self.xmlnsInEnvelope = self._xmlnsMap();
        
            self.callback(err, self);
        });
        
    })
}

WSDL.prototype.onReady = function(callback) {
    if (callback) this.callback = callback;
}

WSDL.prototype._processNextInclude = function(includes, callback) {
    var self = this,
        include = includes.shift();

    if (!include) return callback()

    var includePath;
    if (!/^http/.test(self.uri) && !/^http/.test(include.location)) {
        includePath = path.resolve(path.dirname(self.uri), include.location);
    } else {
        includePath = url.resolve(self.uri, include.location);
    }

    open_wsdl(includePath, function(err, wsdl) {
        if (err) {
            return callback(err);
        }

        self.definitions.schemas[include.namespace || wsdl.definitions.$targetNamespace] = wsdl.definitions;
        self._processNextInclude(includes, function(err) {
            callback(err);
        })
    });
}

WSDL.prototype.processIncludes = function(callback) {
    var schemas = this.definitions.schemas,
        includes = [];

    for (var ns in schemas) {
        var schema = schemas[ns];
        includes = includes.concat(schema.includes || [])
    }

    this._processNextInclude(includes, callback);
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
        var originalName = name;

        if (!objectName && top.name === 'Body' && name !== 'Fault') {
            var message = self.definitions.messages[name];
            // Support RPC/literal messages where response body contains one element named
            // after the operation + 'Response'. See http://www.w3.org/TR/wsdl#_names
            if (!message) {
               // Determine if this is request or response
               var isInput = false;
               var isOutput = false;
               if ((/Response$/).test(name)) {
                 isOutput = true;
                 name = name.replace(/Response$/, '');
               } else if ((/Request$/).test(name)) {
                 isInput = true;
                 name = name.replace(/Request$/, '');
               } else if ((/Solicit$/).test(name)) {
                 isInput = true;
                 name = name.replace(/Solicit$/, '');
               }
               // Look up the appropriate message as given in the portType's operations
               var portTypes = self.definitions.portTypes;
               var portTypeNames = Object.keys(portTypes);
               // Currently this supports only one portType definition.
               var portType = portTypes[portTypeNames[0]];
               if (isInput) name = portType.methods[name].input.$name;
               else name = portType.methods[name].output.$name;
               message = self.definitions.messages[name];
               // 'cache' this alias to speed future lookups
               self.definitions.messages[originalName] = self.definitions.messages[name];
            }

            topSchema = message.description(self.definitions);
            objectName = originalName;
        }
				
				if(attrs.href) {
					id = attrs.href.substr(1);
					if(!refs[id]) refs[id] = {hrefs:[],obj:null};
					refs[id].hrefs.push({par:top.object,key:name,obj:obj});
				}
				if(id=attrs.id) {
					if(!refs[id]) refs[id] = {hrefs:[],obj:null};
				}

        if (topSchema && topSchema[name+'[]']) name = name + '[]';
        stack.push({name: originalName, object: obj, schema: topSchema && topSchema[name], id:attrs.id});
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
        if (name === 'int' || name === 'integer') {
            value = parseInt(text, 10);
        } else if (name === 'bool' || name === 'boolean') {
            value = text.toLowerCase() === 'true' || text === '1';
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

    // merge obj with href
    var merge = function(href, obj) {
      for (var j in obj) {
        if (obj.hasOwnProperty(j)) {
          href.obj[j] = obj[j];
        }
      }
    };

    // MultiRef support: merge objects instead of replacing
    for(var n in refs) {
      var ref = refs[n];
      for (var i = 0; i < ref.hrefs.length; i++) {
        merge(ref.hrefs[i], ref.obj);
      }
      
    }

    var body = root.Envelope.Body;
    if (body.Fault) {
        throw new Error(body.Fault.faultcode+': '+body.Fault.faultstring+(body.Fault.detail ? ': ' + body.Fault.detail : ''));
    }
    return root.Envelope;
}

WSDL.prototype.objectToDocumentXML = function(name, params, ns, xmlns) {
    var args = {};
    args[name] = params;
    return this.objectToXML(args, null, ns, xmlns, true);
}

WSDL.prototype.objectToRpcXML = function(name, params, namespace, xmlns) {
    var self = this,
        parts = [],
        defs = this.definitions,
        namespace = namespace || findKey(defs.xmlns, xmlns),
        xmlns = xmlns || defs.xmlns[namespace],
        nsAttrName = '_xmlns';
    parts.push(['<',namespace,':',name,'>'].join(''));
    for (var key in params) {
        if (key != nsAttrName) {
            var value = params[key];
            parts.push(['<',key,'>'].join(''));
            parts.push((typeof value==='object')?this.objectToXML(value):xmlEscape(value));            
            parts.push(['</',key,'>'].join(''));
        }
    }
    parts.push(['</',namespace,':',name,'>'].join(''));

    return parts.join('');
}

WSDL.prototype.objectToXML = function(obj, name, namespace, xmlns, first) {
    var self = this,
        parts = [],
        xmlnsAttrib = first ? ' xmlns:'+namespace+'="'+xmlns+'"'+' xmlns="'+xmlns+'"' : '',
        ns = namespace ? namespace + ':' : '';
    
    if (Array.isArray(obj)) {
        for (var i=0, item; item=obj[i]; i++) {
            if (i > 0) {
                parts.push(['</',ns,name,'>'].join(''));
                parts.push(['<',ns,name,xmlnsAttrib,'>'].join(''));
            }
            parts.push(self.objectToXML(item, name, namespace, xmlns));
        }
    }
    else if (typeof obj === 'object') {
        for (var name in obj) {
            var child = obj[name];
            parts.push(['<',ns,name,xmlnsAttrib,'>'].join(''));
            parts.push(self.objectToXML(child, name, namespace, xmlns));
            parts.push(['</',ns,name,'>'].join(''));
        }
    }
    else if (obj !== undefined) {
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
            try {
                top.startElement(stack, nsName, attrs);
            }
            catch(e) {
                if (self.options.strict) {
                    throw e;
                }
                else {
                    stack.push(new Element(nsName, attrs));
                }            
            }
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
}

WSDL.prototype._fromServices = function(services) {
       
}



WSDL.prototype._xmlnsMap = function() {
    var xmlns = this.definitions.xmlns;
    var str = '';
    for (var alias in xmlns) {
        if (alias === '') continue;
        var ns = xmlns[alias];
        switch(ns) {
            case "http://xml.apache.org/xml-soap" : // apachesoap
            case "http://schemas.xmlsoap.org/wsdl/" : // wsdl
            case "http://schemas.xmlsoap.org/wsdl/soap/" : // wsdlsoap
            case "http://schemas.xmlsoap.org/soap/encoding/" : // soapenc
            case "http://www.w3.org/2001/XMLSchema" : // xsd
                continue;
        }
        if (~ns.indexOf('http://schemas.xmlsoap.org/')) continue;
        if (~ns.indexOf('http://www.w3.org/')) continue;
        if (~ns.indexOf('http://xml.apache.org/')) continue;
        str += ' xmlns:' + alias + '="' + ns + '"';
    }
    return str;
}

function open_wsdl(uri, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    request_headers = options.wsdl_headers;
    delete options.wsdl_headers;
    request_options = options.wsdl_options;
    delete options.wsdl_options;

    var wsdl;
    if (!/^http/.test(uri)) {
        fs.readFile(uri, 'utf8',  function (err, definition) {
            if (err) {
                callback(err)
            }
            else {
                wsdl = new WSDL(definition, uri, options);
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
                wsdl = new WSDL(definition, uri, options);
                wsdl.onReady(callback);
            }
            else {
                callback(new Error('Invalid WSDL URL: '+uri + "\n\n\r Code: "+ response.statusCode + "\n\n\r Response Body: " + response.body));
            }
        }, request_headers, request_options);
    }    

    return wsdl;
}

exports.open_wsdl = open_wsdl;
exports.WSDL = WSDL;


