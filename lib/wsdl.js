var expat = require('node-expat'),
    inherits = require('util').inherits,
    assert = require('assert').ok;

var Element = function(nsName, attrs, parent) {
    var parts = Element.splitNSName(nsName);

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
Element.splitNSName = function(nsName) {
    var parts = nsName.split(':'),
        namespace = parts.length > 1 ? parts.shift() : null;
        
    return { namespace: namespace, name: parts[0] };
}
Element.prototype.allowedChildren = null;
Element.prototype.startElement= function(stack, nsName, attrs) {
    if (!this.allowedChildren) return;

    var childClass = this.allowedChildren()[Element.splitNSName(nsName).name],
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

var ElementElement = function() { Element.apply(this, arguments); }
inherits(ElementElement, Element);
ElementElement.prototype.allowedChildren = function() { 
    return { 
        annotation: Element,
        complexType: ComplexTypeElement 
    };
}

var SequenceElement = function() { Element.apply(this, arguments); }
inherits(SequenceElement, Element);
SequenceElement.prototype.allowedChildren = function() { 
    return { 
        element: Element
    };
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
        simpleType: SimpleTypeElement
    }
}
SchemaElement.prototype.addChild = function(child) {
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

var MessageElement = function() { Element.apply(this, arguments); }
inherits(MessageElement, Element);
MessageElement.prototype.allowedChildren = function() { 
    return { part: Element };
}

var OperationElement = function() { Element.apply(this, arguments); }
inherits(OperationElement, Element);
OperationElement.prototype.allowedChildren = function() { 
    return { 
        documentation: Element,
        input: Element,
        output: Element,
        operation: Element
    };
}

var PortTypeElement = function() { Element.apply(this, arguments); }
inherits(PortTypeElement, Element);
PortTypeElement.prototype.allowedChildren = function() { 
    return { operation: OperationElement };
}

var BindingElement = function() { Element.apply(this, arguments); }
inherits(BindingElement, Element);
BindingElement.prototype.allowedChildren = function() { 
    return { 
        binding: Element,
        SecuritySpec: Element,
        operation: OperationElement
    };
}

var ServiceElement = function() { Element.apply(this, arguments); }
inherits(ServiceElement, Element);
ServiceElement.prototype.allowedChildren = function() { 
    return { 
        port: Element,
        documentation: Element
    };
}

var DefinitionsElement = function() {
    Element.apply(this, arguments);
    if (this.name !== 'definitions') this.unexpected(nsName);
    this.types = {};
    this.messages = {};
    this.ports = {};
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
        self.ports[child.$name] = child;
    }
    else if (child instanceof BindingElement) {
        self.bindings[child.$name] = child;
    }
    else if (child instanceof ServiceElement) {
        self.services[child.$name] = child;
    }
    else {
        assert(false, "Invalid child type");
    }
}

var WSDL = function(xml) {
    this.definitions = parse(xml);
    this.services = {};
}

WSDL.prototype.getTypes = function() {
    return this.definitions.types;
}

WSDL.prototype.getServices = function() {
    
}

WSDL.prototype.parse = function(xml)
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

exports.WSDL = WSDL;

if (process.argv[1] === __filename) {
    var xml = require('fs').readFileSync(process.argv[2], 'utf8');
    var wsdl = new WSDL(xml);
    // console.log(wsdl.definitions.children[0].children[0].children[0].children[0].children)
    console.log(wsdl.getTypes())
}