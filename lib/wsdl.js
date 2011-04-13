var expat = require('node-expat'),
    inherits = require('util').inherits,
    assert = require('assert').ok;

var Primitives = {
    string: 1, boolean: 1, decimal: 1, float: 1, double: 1,
    duration: 0, dateTime: 0, time: 0, date: 0,
    gYearMonth: 0, gYear: 0, gMonthDay: 0, gDay: 0, gMonth: 0, 
    hexBinary: 0, base64Binary: 0, anyURI: 0, QName: 0, NOTATION: 0
};

function splitNSName(nsName) {
    var parts = nsName.split(':'),
        namespace = parts.length > 1 ? parts.shift() : null;
    return { namespace: namespace, name: parts[0] };
}


var Element = function(nsName, attrs, parent) {
    var parts = splitNSName(nsName);

    this.nsName = nsName;
    this.namespace = parts.namespace;
    this.name = parts.name;
    this.attrs = attrs;
    this.children = [];
    this.parent = parent;
    for (var key in attrs) {
        this['$'+key] = attrs[key];
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
        this.unexpected(nsName);
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
            typeElement = definitions.types[typeName];
        if (typeElement) {
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
    this.types = {};
}
inherits(SchemaElement, Element);
SchemaElement.prototype.allowedChildren = function() { 
    return {
        element: ElementElement,
        complexType: ComplexTypeElement,
        simpleType: SimpleTypeElement,
        import: Element
    }
}
SchemaElement.prototype.addChild = function(child) {
    if (child.$name in Primitives) return;
    this.types[child.$name] = child;
}

var TypesElement = function() { 
    Element.apply(this, arguments);
    this.types = {};
}
inherits(TypesElement, Element);
TypesElement.prototype.allowedChildren = function() { 
    return { schema: SchemaElement };
}
TypesElement.prototype.addChild = function(child) {
    assert(child instanceof SchemaElement);
    this.types = child.types;
}

var MessageElement = function() { 
    Element.apply(this, arguments); 
    this.element = null;
}
inherits(MessageElement, Element);
MessageElement.prototype.allowedChildren = function() { 
    return { part: Element };
}
MessageElement.prototype.postProcess = function(definitions) {
    var part = this.children[0];
    assert(part.name === 'part', 'Expected part element');
    var name = splitNSName(part.$element).name;
    this.element = definitions.types[name];
}
MessageElement.prototype.description = function(definitions) {
    return this.element && this.element.description(definitions);
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
        this[child.name] = message;
    }
}
OperationElement.prototype.description = function(definitions) {
    var inputDesc = this.input.description(definitions),
        outputDesc = this.output.description(definitions);
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
    }
}
BindingElement.prototype.postProcess = function(definitions) {
    var type = splitNSName(this.$type).name,
        portType = definitions.portTypes[type];

    portType.postProcess(definitions);
    this.methods = portType.methods;
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
        self.types = child.types;
    }
    else if (child instanceof MessageElement) {
        self.messages[child.$name] = child;
    }
    else if (child instanceof PortTypeElement) {
        self.portTypes[child.$name] = child;
    }
    else if (child instanceof BindingElement) {
        if (child.transport === 'http://schemas.xmlsoap.org/soap/http')
            self.bindings[child.$name] = child;
    }
    else if (child instanceof ServiceElement) {
        self.services[child.$name] = child;
    }
    else {
        assert(false, "Invalid child type");
    }
}

var WSDL = function(definition) {
    if (typeof definition === 'string') {
        this._fromXML(definition);
    }
    else if (typeof definition === 'object') {
        this._fromServices(definition);
    }
    else {
        throw new Error('WSDL constructor takes either an XML string or service definition');
    }
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
                Body: { 
                    Fault: { faultcode: 'string', faultstring: 'string' }}}},        
        stack = [{name: null, object: root, schema: schema}];
        

    p.on('startElement', function(nsName, attrs) {
        var name = splitNSName(nsName).name,
            top = stack[stack.length-1],
            topSchema = top.schema,
            obj = {};

        if (!objectName && top.name === 'Body' && name !== 'Fault') {
            var message = self.definitions.messages[name];
            topSchema = message.description(self.definitions);
            objectName = name;
        }
            
        if (topSchema && topSchema[name+'[]']) name = name + '[]';
        stack.push({name: name, object: obj, schema: topSchema && topSchema[name]});
    })
    
    p.on('endElement', function(nsName) {
        var obj = stack.pop().object,
            top = stack[stack.length-1],
            topObject = top.object,
            topSchema = top.schema,
            name = splitNSName(nsName).name;
            
        if (topSchema && topSchema[name+'[]']) {
            if (!topObject[name]) topObject[name] = [];
            topObject[name].push(obj);
        }
        else {
            topObject[name] = obj;                        
        }
    })
    
    p.on('text', function(text) {
        text = text.trim();
        if (!text.length) return;

        var top = stack[stack.length-1];
        top.object = text;
        // TO DO: cast text to a JS type using top.schema
    })
    
    if (!p.parse(xml, false)) {
        throw new Error(p.getError());
    }
    var body = root.Envelope.Body;
    if (body.Fault) {
        throw new Error(body.Fault.faultcode+': '+body.Fault.faultstring);
    }
    return body;
}

WSDL.prototype.objectToXML = function(obj, namespace, name) {
    var self = this,
        parts = [],
        namespace = namespace || 'ns0';
    
    if (Array.isArray(obj)) {
        for (var i=0, item; item=obj[i]; i++) {
            if (i > 0) {
                parts.push(['</',namespace,':',name,'>'].join(''));            
                parts.push(['<',namespace,':',name,'>'].join(''));
            }
            parts.push(self.objectToXML(item, namespace, name));
        }
    }
    else if (typeof obj === 'object') {
        for (var name in obj) {
            parts.push(['<',namespace,':',name,'>'].join(''));
            parts.push(self.objectToXML(obj[name], namespace, name));
            parts.push(['</',namespace,':',name,'>'].join(''));
        }
    }
    else if (obj) {
        parts.push(obj);
    }
    return parts.join('');
}

WSDL.prototype._parse = function(xml)
{
    var self = this,
        p = new expat.Parser('UTF-8'),
        stack = [],
        definitions = null;
    
    p.on('startElement', function(name, attrs) {
        var top = stack[stack.length - 1];
        
        if (top) {
            top.startElement(stack, name, attrs);
        }
        else {
            definitions = new DefinitionsElement(name, attrs);
            stack.push(definitions);
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
    
    return definitions;
}

WSDL.prototype._fromXML = function(xml) {
    this.definitions = this._parse(xml);
    this.xml = xml;

    var services = this.services = this.definitions.services;
    for (var name in services) {
        services[name].postProcess(this.definitions);
    }    
}

WSDL.prototype._fromServices = function(services) {
       
}

exports.WSDL = WSDL;
