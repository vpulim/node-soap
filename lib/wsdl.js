/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 *
 */
/*jshint proto:true*/

"use strict";

var sax = require('sax');
var inherits = require('util').inherits;
var HttpClient = require('./http');
var NamespaceContext = require('./nscontext');
var fs = require('fs');
var url = require('url');
var path = require('path');
var assert = require('assert').ok;
var stripBom = require('strip-bom');
var debug = require('debug')('node-soap');
var _ = require('lodash');
var selectn = require('selectn');
var utils = require('./utils');
var TNS_PREFIX = utils.TNS_PREFIX;
var findPrefix = utils.findPrefix;

var Primitives = {
  string: 1,
  boolean: 1,
  decimal: 1,
  float: 1,
  double: 1,
  anyType: 1,
  byte: 1,
  int: 1,
  long: 1,
  short: 1,
  negativeInteger: 1,
  nonNegativeInteger: 1,
  positiveInteger: 1,
  nonPositiveInteger:1,
  unsignedByte: 1,
  unsignedInt: 1,
  unsignedLong: 1,
  unsignedShort: 1,
  duration: 0,
  dateTime: 0,
  time: 0,
  date: 0,
  gYearMonth: 0,
  gYear: 0,
  gMonthDay: 0,
  gDay: 0,
  gMonth: 0,
  hexBinary: 0,
  base64Binary: 0,
  anyURI: 0,
  QName: 0,
  NOTATION: 0
};

function splitQName(nsName) {
  var i = typeof nsName === 'string' ? nsName.indexOf(':') : -1;
  return i < 0 ? {prefix: TNS_PREFIX, name: nsName} :
  {prefix: nsName.substring(0, i), name: nsName.substring(i + 1)};
}

function xmlEscape(obj) {
  if (typeof (obj) === 'string') {
    if (obj.substr(0,9) === '<![CDATA[' && obj.substr(-3) === "]]>") {
      return obj;
    }
    return obj
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  return obj;
}

var trimLeft = /^[\s\xA0]+/;
var trimRight = /[\s\xA0]+$/;

function trim(text) {
  return text.replace(trimLeft, '').replace(trimRight, '');
}

/**
 * What we want is to copy properties from one object to another one and avoid
 * properties overriding. This way we ensure the 'inheritance' of
 * <xsd:extension base=...> usage.
 *
 * NB: 'Element' (and subtypes) don't have any prototyped properties: there's
 * no need to process a 'hasOwnProperties' call, we should just iterate over the
 * keys.
 */
function extend(base, obj) {
  if(base !== null && typeof base === "object" && obj !== null && typeof obj === "object"){
    Object.keys(obj).forEach(function(key) {
      if(!base.hasOwnProperty(key))
        base[key] = obj[key];
    });
  }
  return base;
}

function deepMerge(destination, source) {
  return _.merge(destination || {}, source, function(a, b) {
      return _.isArray(a) ? a.concat(b) : undefined;
    });
}

var Element = function(nsName, attrs, options) {
  var parts = splitQName(nsName);

  this.nsName = nsName;
  this.prefix = parts.prefix;
  this.name = parts.name;
  this.children = [];
  this.xmlns = {};

  this._initializeOptions(options);

  for (var key in attrs) {
    var match = /^xmlns:?(.*)$/.exec(key);
    if (match) {
      this.xmlns[match[1] ? match[1] : TNS_PREFIX] = attrs[key];
    }
    else {
      if(key === 'value') {
        this[this.valueKey] = attrs[key];
      } else {
        this['$' + key] = attrs[key];
      }
    }
  }
  if (this.$targetNamespace !== undefined) {
    // Add targetNamespace to the mapping
    this.xmlns[TNS_PREFIX] = this.$targetNamespace;
  }
};

Element.prototype._initializeOptions = function (options) {
  if(options) {
    this.valueKey = options.valueKey || '$value';
    this.xmlKey = options.xmlKey || '$xml';
    this.ignoredNamespaces = options.ignoredNamespaces || [];
  } else {
    this.valueKey = '$value';
    this.xmlKey = '$xml';
    this.ignoredNamespaces = [];
  }
};

Element.prototype.deleteFixedAttrs = function() {
  this.children && this.children.length === 0 && delete this.children;
  this.xmlns && Object.keys(this.xmlns).length === 0 && delete this.xmlns;
  delete this.nsName;
  delete this.prefix;
  delete this.name;
};

Element.prototype.allowedChildren = [];

Element.prototype.startElement = function(stack, nsName, attrs, options) {
  if (!this.allowedChildren) {
    return;
  }

  var ChildClass = this.allowedChildren[splitQName(nsName).name],
    element = null;

  if (ChildClass) {
    stack.push(new ChildClass(nsName, attrs, options));
  }
  else {
    this.unexpected(nsName);
  }

};

Element.prototype.endElement = function(stack, nsName) {
  if (this.nsName === nsName) {
    if (stack.length < 2)
      return;
    var parent = stack[stack.length - 2];
    if (this !== stack[0]) {
      extend(stack[0].xmlns, this.xmlns);
      // delete this.xmlns;
      parent.children.push(this);
      parent.addChild(this);
    }
    stack.pop();
  }
};

Element.prototype.addChild = function(child) {
  return;
};

Element.prototype.unexpected = function(name) {
  throw new Error('Found unexpected element (' + name + ') inside ' + this.nsName);
};

Element.prototype.description = function(definitions) {
  return this.$name || this.name;
};

Element.prototype.init = function() {
};

Element.createSubClass = function() {
  var root = this;
  var subElement = function() {
    root.apply(this, arguments);
    this.init();
  };
  // inherits(subElement, root);
  subElement.prototype.__proto__ = root.prototype;
  return subElement;
};


var ElementElement = Element.createSubClass();
var AnyElement = Element.createSubClass();
var InputElement = Element.createSubClass();
var OutputElement = Element.createSubClass();
var SimpleTypeElement = Element.createSubClass();
var RestrictionElement = Element.createSubClass();
var ExtensionElement = Element.createSubClass();
var ChoiceElement = Element.createSubClass();
var EnumerationElement = Element.createSubClass();
var ComplexTypeElement = Element.createSubClass();
var ComplexContentElement = Element.createSubClass();
var SimpleContentElement = Element.createSubClass();
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
  any: [AnyElement, ''],
  simpleType: [SimpleTypeElement, 'restriction'],
  restriction: [RestrictionElement, 'enumeration all choice sequence'],
  extension: [ExtensionElement, 'all sequence choice'],
  choice: [ChoiceElement, 'element sequence choice any'],
    // group: [GroupElement, 'element group'],
  enumeration: [EnumerationElement, ''],
  complexType: [ComplexTypeElement,  'annotation sequence all complexContent simpleContent choice'],
  complexContent: [ComplexContentElement,  'extension'],
  simpleContent: [SimpleContentElement,  'extension'],
  sequence: [SequenceElement, 'element sequence choice any'],
  all: [AllElement, 'element choice'],

  service: [ServiceElement, 'port documentation'],
  port: [PortElement, 'address documentation'],
  binding: [BindingElement, '_binding SecuritySpec operation documentation'],
  portType: [PortTypeElement, 'operation documentation'],
  message: [MessageElement, 'part documentation'],
  operation: [OperationElement, 'documentation input output fault _operation'],
  input: [InputElement, 'body SecuritySpecRef documentation header'],
  output: [OutputElement, 'body SecuritySpecRef documentation header'],
  fault: [Element, '_fault documentation'],
  definitions: [DefinitionsElement, 'types message portType binding service import documentation'],
  documentation: [DocumentationElement, '']
};

function mapElementTypes(types) {
  var rtn = {};
  types = types.split(' ');
  types.forEach(function(type) {
    rtn[type.replace(/^_/, '')] = (ElementTypeMap[type] || [Element]) [0];
  });
  return rtn;
}

for (var n in ElementTypeMap) {
  var v = ElementTypeMap[n];
  v[0].prototype.allowedChildren = mapElementTypes(v[1]);
}

MessageElement.prototype.init = function() {
  this.element = null;
  this.parts = null;
};

SchemaElement.prototype.init = function() {
  this.complexTypes = {};
  this.types = {};
  this.elements = {};
  this.includes = [];
};

TypesElement.prototype.init = function() {
  this.schemas = {};
};

OperationElement.prototype.init = function() {
  this.input = null;
  this.output = null;
  this.inputSoap = null;
  this.outputSoap = null;
  this.style = '';
  this.soapAction = '';
};

PortTypeElement.prototype.init = function() {
  this.methods = {};
};

BindingElement.prototype.init = function() {
  this.transport = '';
  this.style = '';
  this.methods = {};
};

PortElement.prototype.init = function() {
  this.location = null;
};

ServiceElement.prototype.init = function() {
  this.ports = {};
};

DefinitionsElement.prototype.init = function() {
  if (this.name !== 'definitions')this.unexpected(this.nsName);
  this.messages = {};
  this.portTypes = {};
  this.bindings = {};
  this.services = {};
  this.schemas = {};
};

DocumentationElement.prototype.init = function() {
};

SchemaElement.prototype.merge = function(source) {
  assert(source instanceof SchemaElement);
  if (this.$targetNamespace === source.$targetNamespace) {
    _.merge(this.complexTypes, source.complexTypes);
    _.merge(this.types, source.types);
    _.merge(this.elements, source.elements);
    _.merge(this.xmlns, source.xmlns);
  }
  return this;
};


SchemaElement.prototype.addChild = function(child) {
  if (child.$name in Primitives)
    return;
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
};
//fix#325
TypesElement.prototype.addChild = function (child) {
  assert(child instanceof SchemaElement);

  var targetNamespace = child.$targetNamespace;

  if(!this.schemas.hasOwnProperty(targetNamespace)) {
    this.schemas[targetNamespace] = child;
  } else {
    console.error('Target-Namespace "'+ targetNamespace +'" already in use by another Schema!');
  }
};

InputElement.prototype.addChild = function(child) {
  if (child.name === 'body') {
    this.use = child.$use;
    if (this.use === 'encoded') {
      this.encodingStyle = child.$encodingStyle;
    }
    this.children.pop();
  }
};

OutputElement.prototype.addChild = function(child) {
  if (child.name === 'body') {
    this.use = child.$use;
    if (this.use === 'encoded') {
      this.encodingStyle = child.$encodingStyle;
    }
    this.children.pop();
  }
};

OperationElement.prototype.addChild = function(child) {
  if (child.name === 'operation') {
    this.soapAction = child.$soapAction || '';
    this.style = child.$style || '';
    this.children.pop();
  }
};

BindingElement.prototype.addChild = function(child) {
  if (child.name === 'binding') {
    this.transport = child.$transport;
    this.style = child.$style;
    this.children.pop();
  }
};

PortElement.prototype.addChild = function(child) {
  if (child.name === 'address' && typeof (child.$location) !== 'undefined') {
    this.location = child.$location;
  }
};

DefinitionsElement.prototype.addChild = function(child) {
  var self = this;
  if (child instanceof TypesElement) {
    // Merge types.schemas into definitions.schemas
    _.merge(self.schemas, child.schemas);
  }
  else if (child instanceof MessageElement) {
    self.messages[child.$name] = child;
  }
  else if (child.name === 'import') {
    self.schemas[child.$namespace] = new SchemaElement(child.$namespace, {});
    self.schemas[child.$namespace].addChild(child);
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
  this.children.pop();
};

MessageElement.prototype.postProcess = function(definitions) {
  var part = null;
  var child;
  var children = this.children || [];
  var ns;
  var nsName;
  var i;
  var type;

  for (i in children) {
    if ((child = children[i]).name === 'part') {
      part = child;
      break;
    }
  }

  if (!part) {
    return;
  }

  if (part.$element) {
    var lookupTypes = [],
        elementChildren ;

    delete this.parts;

    nsName = splitQName(part.$element);
    ns = nsName.prefix;
    var schema = definitions.schemas[definitions.xmlns[ns]];
    this.element = schema.elements[nsName.name];
    if(!this.element) {
      debug(nsName.name + " is not present in wsdl and cannot be processed correctly.");
      return;
    }
    this.element.targetNSAlias = ns;
    this.element.targetNamespace = definitions.xmlns[ns];

    // set the optional $lookupType to be used within `client#_invoke()` when
    // calling `wsdl#objectToDocumentXML()
    this.element.$lookupType = part.$element;

    elementChildren = this.element.children;

    // get all nested lookup types (only complex types are followed)
    if (elementChildren.length > 0) {
      for (i = 0; i < elementChildren.length; i++) {
        lookupTypes.push(this._getNestedLookupTypeString(elementChildren[i]));
      }
    }

    // if nested lookup types where found, prepare them for furter usage
    if (lookupTypes.length > 0) {
      lookupTypes = lookupTypes.
          join('_').
          split('_').
          filter(function removeEmptyLookupTypes (type) {
            return type !== '^';
          });

      var schemaXmlns = definitions.schemas[this.element.targetNamespace].xmlns;

      for (i = 0; i < lookupTypes.length; i++) {
        lookupTypes[i] = this._createLookupTypeObject(lookupTypes[i], schemaXmlns);
      }
    }

    this.element.$lookupTypes = lookupTypes;

    if (this.element.$type) {
      type = splitQName(this.element.$type);
      var typeNs = schema.xmlns && schema.xmlns[type.prefix] || definitions.xmlns[type.prefix];

      if (typeNs) {
        if (type.name in Primitives) {
            // this.element = this.element.$type;
        }
        else {
          // first check local mapping of ns alias to namespace
          schema = definitions.schemas[typeNs];
          var ctype = schema.complexTypes[type.name] || schema.types[type.name] || schema.elements[type.name];


          if (ctype) {
            this.parts = ctype.description(definitions, schema.xmlns);
          }
        }
      }
    }
    else {
      var method = this.element.description(definitions, schema.xmlns);
      this.parts = method[nsName.name];
    }


    this.children.splice(0, 1);
  } else {
    // rpc encoding
    this.parts = {};
    delete this.element;
    for (i = 0; part = this.children[i]; i++) {
      if (part.name === 'documentation') {
        // <wsdl:documentation can be present under <wsdl:message>
        continue;
      }
      assert(part.name === 'part', 'Expected part element');
      nsName = splitQName(part.$type);
      ns = definitions.xmlns[nsName.prefix];
      type = nsName.name;
      var schemaDefinition = definitions.schemas[ns];
      if (typeof schemaDefinition !== 'undefined') {
        this.parts[part.$name] = definitions.schemas[ns].types[type] || definitions.schemas[ns].complexTypes[type];
      } else {
        this.parts[part.$name] = part.$type;
      }

      if (typeof this.parts[part.$name] === 'object') {
        this.parts[part.$name].prefix = nsName.prefix;
        this.parts[part.$name].xmlns = ns;
      }

      this.children.splice(i--, 1);
    }
  }
  this.deleteFixedAttrs();
};

/**
 * Takes a given namespaced String(for example: 'alias:property') and creates a lookupType
 * object for further use in as first (lookup) `parameterTypeObj` within the `objectToXML`
 * method and provides an entry point for the already existing code in `findChildSchemaObject`.
 *
 * @method _createLookupTypeObject
 * @param {String}            nsString          The NS String (for example "alias:type").
 * @param {Object}            xmlns       The fully parsed `wsdl` definitions object (including all schemas).
 * @returns {Object}
 * @private
 */
MessageElement.prototype._createLookupTypeObject = function (nsString, xmlns) {
  var splittedNSString = splitQName(nsString),
      nsAlias = splittedNSString.prefix,
      splittedName = splittedNSString.name.split('#'),
      type = splittedName[0],
      name = splittedName[1],
      lookupTypeObj = {};

  lookupTypeObj.$namespace = xmlns[nsAlias];
  lookupTypeObj.$type = nsAlias + ':' + type;
  lookupTypeObj.$name = name;

  return lookupTypeObj;
};

/**
 * Iterates through the element and every nested child to find any defined `$type`
 * property and returns it in a underscore ('_') separated String (using '^' as default
 * value if no `$type` property was found).
 *
 * @method _getNestedLookupTypeString
 * @param {Object}            element         The element which (probably) contains nested `$type` values.
 * @returns {String}
 * @private
 */
MessageElement.prototype._getNestedLookupTypeString = function (element) {
  var resolvedType = '^',
      excluded = this.ignoredNamespaces.concat('xs'); // do not process $type values wich start with

  if (element.hasOwnProperty('$type') && typeof element.$type === 'string') {
    if (excluded.indexOf(element.$type.split(':')[0]) === -1) {
      resolvedType += ('_' + element.$type + '#' + element.$name);
    }
  }

  if (element.children.length > 0) {
    var self = this;

    element.children.forEach(function (child) {
      var resolvedChildType = self._getNestedLookupTypeString(child).replace(/\^_/, '');

      if (resolvedChildType && typeof resolvedChildType === 'string') {
        resolvedType += ('_' + resolvedChildType);
      }
    });
  }

  return resolvedType;
};

OperationElement.prototype.postProcess = function(definitions, tag) {
  var children = this.children;
  for (var i = 0, child; child = children[i]; i++) {
    if (child.name !== 'input' && child.name !== 'output')
      continue;
    if (tag === 'binding') {
      this[child.name] = child;
      children.splice(i--, 1);
      continue;
    }
    var messageName = splitQName(child.$message).name;
    var message = definitions.messages[messageName];
    message.postProcess(definitions);
    if (message.element) {
      definitions.messages[message.element.$name] = message;
      this[child.name] = message.element;
    }
    else {
      this[child.name] = message;
    }
    children.splice(i--, 1);
  }
  this.deleteFixedAttrs();
};

PortTypeElement.prototype.postProcess = function(definitions) {
  var children = this.children;
  if (typeof children === 'undefined')
    return;
  for (var i = 0, child; child = children[i]; i++) {
    if (child.name !== 'operation')
      continue;
    child.postProcess(definitions, 'portType');
    this.methods[child.$name] = child;
    children.splice(i--, 1);
  }
  delete this.$name;
  this.deleteFixedAttrs();
};

BindingElement.prototype.postProcess = function(definitions) {
  var type = splitQName(this.$type).name,
    portType = definitions.portTypes[type],
    style = this.style,
    children = this.children;
  if (portType){
    portType.postProcess(definitions);
    this.methods = portType.methods;

    for (var i = 0, child; child = children[i]; i++) {
      if (child.name !== 'operation')
        continue;
      child.postProcess(definitions, 'binding');
      children.splice(i--, 1);
      child.style || (child.style = style);
      var method = this.methods[child.$name];

      if (method) {
        method.style = child.style;
        method.soapAction = child.soapAction;
        method.inputSoap = child.input || null;
        method.outputSoap = child.output || null;
        method.inputSoap && method.inputSoap.deleteFixedAttrs();
        method.outputSoap && method.outputSoap.deleteFixedAttrs();
      }
    }
  }
  delete this.$name;
  delete this.$type;
  this.deleteFixedAttrs();
};

ServiceElement.prototype.postProcess = function(definitions) {
  var children = this.children,
    bindings = definitions.bindings;
  if (children && children.length > 0) {
    for (var i = 0, child; child = children[i]; i++) {
      if (child.name !== 'port')
        continue;
      var bindingName = splitQName(child.$binding).name;
      var binding = bindings[bindingName];
      if (binding) {
        binding.postProcess(definitions);
        this.ports[child.$name] = {
          location: child.location,
          binding: binding
        };
        children.splice(i--, 1);
      }
    }
  }
  delete this.$name;
  this.deleteFixedAttrs();
};


SimpleTypeElement.prototype.description = function(definitions) {
  var children = this.children;
  for (var i = 0, child; child = children[i]; i++) {
    if (child instanceof RestrictionElement)
      return this.$name + "|" + child.description();
  }
  return {};
};

RestrictionElement.prototype.description = function(definitions, xmlns) {
  var children = this.children;
  var desc;
  for (var i=0, child; child=children[i]; i++) {
    if (child instanceof SequenceElement ||
            child instanceof ChoiceElement) {
      desc = child.description(definitions, xmlns);
      break;
    }
  }
  if (desc && this.$base) {
    var type = splitQName(this.$base),
      typeName = type.name,
      ns = xmlns && xmlns[type.prefix] || definitions.xmlns[type.prefix],
      schema = definitions.schemas[ns],
      typeElement = schema && ( schema.complexTypes[typeName] || schema.types[typeName] || schema.elements[typeName] );

    desc.getBase = function() {
      return typeElement.description(definitions, schema.xmlns);
    };
    return desc;
  }

    // then simple element
  var base = this.$base ? this.$base + "|" : "";
  return base + this.children.map(function(child) {
    return child.description();
  }).join(",");
};

ExtensionElement.prototype.description = function(definitions, xmlns) {
  var children = this.children;
  var desc = {};
  for (var i=0, child; child=children[i]; i++) {
    if (child instanceof SequenceElement ||
      child instanceof ChoiceElement) {
      desc = child.description(definitions, xmlns);
    }
  }
  if (this.$base) {
    var type = splitQName(this.$base),
      typeName = type.name,
      ns = xmlns && xmlns[type.prefix] || definitions.xmlns[type.prefix],
      schema = definitions.schemas[ns];

    if (typeName in Primitives) {
      return this.$base;
    }
    else {
      var typeElement = schema && ( schema.complexTypes[typeName] ||
        schema.types[typeName] || schema.elements[typeName] );

      if (typeElement) {
        var base = typeElement.description(definitions, schema.xmlns);
        extend(desc, base);
      }
    }
  }
  return desc;
};

EnumerationElement.prototype.description = function() {
  return this[this.valueKey];
};

ComplexTypeElement.prototype.description = function(definitions, xmlns) {
  var children = this.children || [];
  for (var i=0, child; child=children[i]; i++) {
    if (child instanceof ChoiceElement ||
      child instanceof SequenceElement ||
      child instanceof AllElement ||
      child instanceof SimpleContentElement ||
      child instanceof ComplexContentElement) {

      return child.description(definitions, xmlns);
    }
  }
  return {};
};

ComplexContentElement.prototype.description = function(definitions, xmlns) {
  var children = this.children;
  for (var i = 0, child; child = children[i]; i++) {
    if (child instanceof ExtensionElement) {
      return child.description(definitions, xmlns);
    }
  }
  return {};
};

SimpleContentElement.prototype.description = function(definitions, xmlns) {
  var children = this.children;
  for (var i = 0, child; child = children[i]; i++) {
    if (child instanceof ExtensionElement) {
      return child.description(definitions, xmlns);
    }
  }
  return {};
};

ElementElement.prototype.description = function(definitions, xmlns) {
  var element = {},
    name = this.$name;
  var isMany = !this.$maxOccurs ? false : (isNaN(this.$maxOccurs) ? (this.$maxOccurs === 'unbounded') : (this.$maxOccurs > 1));
  if (this.$minOccurs !== this.$maxOccurs && isMany) {
    name += '[]';
  }

  if (xmlns && xmlns[TNS_PREFIX]) {
    this.$targetNamespace = xmlns[TNS_PREFIX];
  }
  var type = this.$type || this.$ref;
  if (type) {
    type = splitQName(type);
    var typeName = type.name,
      ns = xmlns && xmlns[type.prefix] || definitions.xmlns[type.prefix],
      schema = definitions.schemas[ns],
      typeElement = schema && ( this.$type? schema.complexTypes[typeName] || schema.types[typeName] : schema.elements[typeName] );

    if (ns && definitions.schemas[ns]) {
      xmlns = definitions.schemas[ns].xmlns;
    }

    if (typeElement && !(typeName in Primitives)) {

      if (!(typeName in definitions.descriptions.types)) {

        var elem = {};
        definitions.descriptions.types[typeName] = elem;
        var description = typeElement.description(definitions, xmlns);
        if (typeof description === 'string') {
          elem = description;
        }
        else {
          Object.keys(description).forEach(function (key) {
            elem[key] = description[key];
          });
        }

        if (this.$ref) {
          element = elem;
        }
        else {
          element[name] = elem;
        }

        if (typeof elem === 'object') {
          elem.targetNSAlias = type.prefix;
          elem.targetNamespace = ns;
        }

        definitions.descriptions.types[typeName] = elem;
      }
      else {
        if (this.$ref) {
          element = definitions.descriptions.types[typeName];
        }
        else {
          element[name] = definitions.descriptions.types[typeName];
        }
      }

    }
    else {
      element[name] = this.$type;
    }
  }
  else {
    var children = this.children;
    element[name] = {};
    for (var i = 0, child; child = children[i]; i++) {
      if (child instanceof ComplexTypeElement) {
        element[name] = child.description(definitions, xmlns);
      }
    }
  }
  return element;
};

AllElement.prototype.description =
SequenceElement.prototype.description = function(definitions, xmlns) {
  var children = this.children;
  var sequence = {};
  for (var i = 0, child; child = children[i]; i++) {
    if (child instanceof AnyElement) {
      continue;
    }
    var description = child.description(definitions, xmlns);
    for (var key in description) {
      sequence[key] = description[key];
    }
  }
  return sequence;
};

ChoiceElement.prototype.description = function(definitions, xmlns) {
  var children = this.children;
  var choice = {};
  for (var i=0, child; child=children[i]; i++) {
    var description = child.description(definitions, xmlns);
    for (var key in description) {
      choice[key] = description[key];
    }
  }
  return choice;
};

MessageElement.prototype.description = function(definitions) {
  if (this.element) {
    return this.element && this.element.description(definitions);
  }
  var desc = {};
  desc[this.$name] = this.parts;
  return desc;
};

PortTypeElement.prototype.description = function(definitions) {
  var methods = {};
  for (var name in this.methods) {
    var method = this.methods[name];
    methods[name] = method.description(definitions);
  }
  return methods;
};

OperationElement.prototype.description = function(definitions) {
  var inputDesc = this.input ? this.input.description(definitions) : null;
  var outputDesc = this.output ? this.output.description(definitions) : null;
  return {
    input: inputDesc && inputDesc[Object.keys(inputDesc)[0]],
    output: outputDesc && outputDesc[Object.keys(outputDesc)[0]]
  };
};

BindingElement.prototype.description = function(definitions) {
  var methods = {};
  for (var name in this.methods) {
    var method = this.methods[name];
    methods[name] = method.description(definitions);
  }
  return methods;
};

ServiceElement.prototype.description = function(definitions) {
  var ports = {};
  for (var name in this.ports) {
    var port = this.ports[name];
    ports[name] = port.binding.description(definitions);
  }
  return ports;
};

var WSDL = function(definition, uri, options) {
  var self = this,
      fromFunc;

  this.uri = uri;
  this.callback = function() {
  };
  this._includesWsdl = [];

  // initialize WSDL cache
  this.WSDL_CACHE = (options || {}).WSDL_CACHE || {};

  this._initializeOptions(options);

  if (typeof definition === 'string') {
    definition = stripBom(definition);
    fromFunc = this._fromXML;
  }
  else if (typeof definition === 'object') {
    fromFunc = this._fromServices;
  }
  else {
    throw new Error('WSDL constructor takes either an XML string or service definition');
  }

  process.nextTick(function() {
    try {
      fromFunc.call(self, definition);
    } catch (e) {
      return self.callback(e.message);
    }

    self.processIncludes(function(err) {
      var name;
      if (err) {
        return self.callback(err);
      }

      self.definitions.deleteFixedAttrs();
      var services = self.services = self.definitions.services;
      if (services) {
        for (name in services) {
          services[name].postProcess(self.definitions);
        }
      }
      var complexTypes = self.definitions.complexTypes;
      if (complexTypes) {
        for (name in complexTypes) {
          complexTypes[name].deleteFixedAttrs();
        }
      }

      // for document style, for every binding, prepare input message element name to (methodName, output message element name) mapping
      var bindings = self.definitions.bindings;
      for (var bindingName in bindings) {
        var binding = bindings[bindingName];
        if (typeof binding.style === 'undefined') {
          binding.style = 'document';
        }
        if (binding.style !== 'document')
          continue;
        var methods = binding.methods;
        var topEls = binding.topElements = {};
        for (var methodName in methods) {
          if (methods[methodName].input) {
            var inputName = methods[methodName].input.$name;
            var outputName="";
            if(methods[methodName].output )
              outputName = methods[methodName].output.$name;
            topEls[inputName] = {"methodName": methodName, "outputName": outputName};
          }
        }
      }

      // prepare soap envelope xmlns definition string
      self.xmlnsInEnvelope = self._xmlnsMap();

      self.callback(err, self);
    });

  });
};

WSDL.prototype.ignoredNamespaces = ['tns', 'targetNamespace', 'typedNamespace'];

WSDL.prototype.ignoreBaseNameSpaces = false;

WSDL.prototype.valueKey = '$value';
WSDL.prototype.xmlKey = '$xml';

WSDL.prototype._initializeOptions = function (options) {
  this._originalIgnoredNamespaces = (options || {}).ignoredNamespaces;
  this.options = {};

  var ignoredNamespaces = options ? options.ignoredNamespaces : null;

  if (ignoredNamespaces &&
      (Array.isArray(ignoredNamespaces.namespaces) || typeof ignoredNamespaces.namespaces === 'string')) {
    if (ignoredNamespaces.override) {
      this.options.ignoredNamespaces = ignoredNamespaces.namespaces;
    } else {
      this.options.ignoredNamespaces = this.ignoredNamespaces.concat(ignoredNamespaces.namespaces);
    }
  } else {
    this.options.ignoredNamespaces = this.ignoredNamespaces;
  }

  this.options.valueKey = options.valueKey || this.valueKey;
  this.options.xmlKey = options.xmlKey || this.xmlKey;
  this.options.escapeXML = options.escapeXML || false;
  // Allow any request headers to keep passing through
  this.options.wsdl_headers = options.wsdl_headers;
  this.options.wsdl_options = options.wsdl_options;
  if (options.httpClient) {
    this.options.httpClient = options.httpClient;
  }

  var ignoreBaseNameSpaces = options ? options.ignoreBaseNameSpaces : null;
  if (ignoreBaseNameSpaces !== null && typeof ignoreBaseNameSpaces !== 'undefined') {
    this.options.ignoreBaseNameSpaces = ignoreBaseNameSpaces;
  } else {
    this.options.ignoreBaseNameSpaces = this.ignoreBaseNameSpaces;
  }

  // Works only in client
  this.options.forceSoap12Headers = options.forceSoap12Headers;

  if (options.overrideRootElement !== undefined) {
    this.options.overrideRootElement = options.overrideRootElement;
  }
};

WSDL.prototype.onReady = function(callback) {
  if (callback)
    this.callback = callback;
};

WSDL.prototype._processNextInclude = function(includes, callback) {
  var self = this,
    include = includes.shift(),
    options;

  if (!include)
    return callback();

  var includePath;
  if (!/^https?:/.test(self.uri) && !/^https?:/.test(include.location)) {
    includePath = path.resolve(path.dirname(self.uri), include.location);
  } else {
    includePath = url.resolve(self.uri, include.location);
  }

  options = _.assign({}, this.options);
  // follow supplied ignoredNamespaces option
  options.ignoredNamespaces = this._originalIgnoredNamespaces || this.options.ignoredNamespaces;
  options.WSDL_CACHE = this.WSDL_CACHE;

  open_wsdl_recursive(includePath, options, function(err, wsdl) {
    if (err) {
      return callback(err);
    }

    self._includesWsdl.push(wsdl);

    if (wsdl.definitions instanceof DefinitionsElement) {
      _.merge(self.definitions, wsdl.definitions, function(a,b) {
        return (a instanceof SchemaElement) ? a.merge(b) : undefined;
      });
    } else {
      self.definitions.schemas[include.namespace || wsdl.definitions.$targetNamespace] = deepMerge(self.definitions.schemas[include.namespace || wsdl.definitions.$targetNamespace], wsdl.definitions);
    }
    self._processNextInclude(includes, function(err) {
      callback(err);
    });
  });
};

WSDL.prototype.processIncludes = function(callback) {
  var schemas = this.definitions.schemas,
    includes = [];

  for (var ns in schemas) {
    var schema = schemas[ns];
    includes = includes.concat(schema.includes || []);
  }

  this._processNextInclude(includes, callback);
};

WSDL.prototype.describeServices = function() {
  var services = {};
  for (var name in this.services) {
    var service = this.services[name];
    services[name] = service.description(this.definitions);
  }
  return services;
};

WSDL.prototype.toXML = function() {
  return this.xml || '';
};

WSDL.prototype.xmlToObject = function(xml) {
  var self = this;
  var p = sax.parser(true);
  var objectName = null;
  var root = {};
  var schema = {
    Envelope: {
      Header: {
        Security: {
          UsernameToken: {
            Username: 'string',
            Password: 'string'
          }
        }
      },
      Body: {
        Fault: {
          faultcode: 'string',
          faultstring: 'string',
          detail: 'string'
        }
      }
    }
  };
  var stack = [{name: null, object: root, schema: schema}];
  var xmlns = {};

  var refs = {}, id; // {id:{hrefs:[],obj:}, ...}

  p.onopentag = function(node) {
    var nsName = node.name;
    var attrs  = node.attributes;

    var name = splitQName(nsName).name,
      attributeName,
      top = stack[stack.length - 1],
      topSchema = top.schema,
      elementAttributes = {},
      hasNonXmlnsAttribute = false,
      hasNilAttribute = false,
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
        if (isInput) {
          name = portType.methods[name].input.$name;
        } else {
          name = portType.methods[name].output.$name;
        }
        message = self.definitions.messages[name];
        // 'cache' this alias to speed future lookups
        self.definitions.messages[originalName] = self.definitions.messages[name];
      }

      topSchema = message.description(self.definitions);
      objectName = originalName;
    }

    if (attrs.href) {
      id = attrs.href.substr(1);
      if (!refs[id]) {
        refs[id] = {hrefs: [], obj: null};
      }
      refs[id].hrefs.push({par: top.object, key: name, obj: obj});
    }
    if (id = attrs.id) {
      if (!refs[id]) {
        refs[id] = {hrefs: [], obj: null};
      }
    }

    //Handle element attributes
    for (attributeName in attrs) {
      if (/^xmlns:|^xmlns$/.test(attributeName)) {
        xmlns[splitQName(attributeName).name] = attrs[attributeName];
        continue;
      }
      hasNonXmlnsAttribute = true;
      elementAttributes[attributeName] = attrs[attributeName];
    }

    for(attributeName in elementAttributes){
      var res = splitQName(attributeName);
      if (res.name === 'nil' && xmlns[res.prefix] === 'http://www.w3.org/2001/XMLSchema-instance') {
        hasNilAttribute = true;
        break;
      }
    }

    if (hasNonXmlnsAttribute) {
      obj[self.options.attributesKey] = elementAttributes;
    }

    // Pick up the schema for the type specified in element's xsi:type attribute.
    var xsiTypeSchema;
    var xsiType = elementAttributes['xsi:type'];
    if (xsiType) {
      var type = splitQName(xsiType);
      var typeURI;
      if (type.prefix === TNS_PREFIX) {
        // In case of xsi:type = "MyType"
        typeURI = xmlns[type.prefix] || xmlns.xmlns;
      } else {
        typeURI = xmlns[type.prefix];
      }
      var typeDef = self.findSchemaObject(typeURI, type.name);
      if (typeDef) {
        xsiTypeSchema = typeDef.description(self.definitions);
      }
    }

    if (topSchema && topSchema[name + '[]']) {
      name = name + '[]';
    }
    stack.push({name: originalName, object: obj, schema: (xsiTypeSchema || (topSchema && topSchema[name])), id: attrs.id, nil: hasNilAttribute});
  };

  p.onclosetag = function(nsName) {
    var cur = stack.pop(),
      obj = cur.object,
      top = stack[stack.length - 1],
      topObject = top.object,
      topSchema = top.schema,
      name = splitQName(nsName).name;

    if (typeof cur.schema === 'string' && (cur.schema === 'string' || cur.schema.split(':')[1] === 'string')) {
      if (typeof obj === 'object' &&  Object.keys(obj).length === 0) obj = cur.object = '';
    }

    if (cur.nil === true) {
      return;
    }

    if (_.isPlainObject(obj) && !Object.keys(obj).length) {
      obj = null;
    }

    if (topSchema && topSchema[name + '[]']) {
      if (!topObject[name]) {
        topObject[name] = [];
      }
      topObject[name].push(obj);
    } else if (name in topObject) {
      if (!Array.isArray(topObject[name])) {
        topObject[name] = [topObject[name]];
      }
      topObject[name].push(obj);
    } else {
      topObject[name] = obj;
    }

    if (cur.id) {
      refs[cur.id].obj = obj;
    }
  };

  p.oncdata = function (text) {
    text = trim(text);
    if (!text.length) {
      return;
    }

    if (/<\?xml[\s\S]+\?>/.test(text)) {
      var top = stack[stack.length - 1];
      var value = self.xmlToObject(text);
      if (top.object[self.options.attributesKey]) {
        top.object[self.options.valueKey] = value;
      } else {
        top.object = value;
      }
    } else {
      p.ontext(text);
    }
  };

  p.onerror = function(e) {
    p.resume();
    throw {
      Fault: {
        faultcode: 500,
        faultstring: 'Invalid XML',
        detail: new Error(e).message,
        statusCode: 500
      }
    };
  };

  p.ontext = function(text) {
    text = trim(text);
    if (!text.length) {
      return;
    }

    var top = stack[stack.length - 1];
    var name = splitQName(top.schema).name,
      value;
    if (name === 'int' || name === 'integer') {
      value = parseInt(text, 10);
    } else if (name === 'bool' || name === 'boolean') {
      value = text.toLowerCase() === 'true' || text === '1';
    } else if (name === 'dateTime' || name === 'date') {
      value = new Date(text);
    } else {
      // handle string or other types
      if (typeof top.object !== 'string') {
        value = text;
      } else {
        value = top.object + text;
      }
    }

    if (top.object[self.options.attributesKey]) {
      top.object[self.options.valueKey] = value;
    } else {
      top.object = value;
    }
  };

  p.write(xml).close();

  // merge obj with href
  var merge = function(href, obj) {
    for (var j in obj) {
      if (obj.hasOwnProperty(j)) {
        href.obj[j] = obj[j];
      }
    }
  };

  // MultiRef support: merge objects instead of replacing
  for (var n in refs) {
    var ref = refs[n];
    for (var i = 0; i < ref.hrefs.length; i++) {
      merge(ref.hrefs[i], ref.obj);
    }
  }

  if (root.Envelope) {
    var body = root.Envelope.Body;
    if (body.Fault) {
      var code = selectn('faultcode.$value', body.Fault) || selectn('faultcode', body.Fault);
      var string = selectn('faultstring.$value', body.Fault) || selectn('faultstring', body.Fault);
      var detail = selectn('detail.$value', body.Fault) || selectn('detail.message', body.Fault);
      var error = new Error(code + ': ' + string + (detail ? ': ' + detail : ''));
      error.root = root;
      throw error;
    }
    return root.Envelope;
  }
  return root;
};

/**
 * Look up a XSD type or element by namespace URI and name
 * @param {String} nsURI Namespace URI
 * @param {String} qname Local or qualified name
 * @returns {*} The XSD type/element definition
 */
WSDL.prototype.findSchemaObject = function(nsURI, qname) {
  if (!nsURI || !qname) {
    return null;
  }

  var def = null;

  if (this.definitions.schemas) {
    var schema = this.definitions.schemas[nsURI];
    if (schema) {
      if (qname.indexOf(':') !== -1) {
        qname = qname.substring(qname.indexOf(':') + 1, qname.length);
      }

      // if the client passed an input element which has a `$lookupType` property instead of `$type`
      // the `def` is found in `schema.elements`.
      def = schema.complexTypes[qname] || schema.types[qname] || schema.elements[qname];
    }
  }

  return def;
};

/**
 * Create document style xml string from the parameters
 * @param {String} name
 * @param {*} params
 * @param {String} nsPrefix
 * @param {String} nsURI
 * @param {String} type
 */
WSDL.prototype.objectToDocumentXML = function(name, params, nsPrefix, nsURI, type) {
  var args = {};
  args[name] = params;
  var parameterTypeObj = type ? this.findSchemaObject(nsURI, type) : null;
  return this.objectToXML(args, null, nsPrefix, nsURI, true, null, parameterTypeObj);
};

/**
 * Create RPC style xml string from the parameters
 * @param {String} name
 * @param {*} params
 * @param {String} nsPrefix
 * @param {String} nsURI
 * @returns {string}
 */
 WSDL.prototype.objectToRpcXML = function(name, params, nsPrefix, nsURI,isParts) {
   var parts = [];
   var defs = this.definitions;
   var nsAttrName = '_xmlns';

   nsPrefix = nsPrefix || findPrefix(defs.xmlns, nsURI);

   nsURI = nsURI || defs.xmlns[nsPrefix];
   nsPrefix = nsPrefix === TNS_PREFIX ? '' : (nsPrefix + ':');

   parts.push(['<', nsPrefix, name, '>'].join(''));

   for (var key in params) {
     if (!params.hasOwnProperty(key)) {
       continue;
     }
     if (key !== nsAttrName) {
       var value = params[key];
       var prefixedKey = (isParts ? '' : nsPrefix) + key;
       parts.push(['<', prefixedKey, '>'].join(''));
       parts.push((typeof value === 'object') ? this.objectToXML(value, key, nsPrefix, nsURI) : xmlEscape(value));
       parts.push(['</', prefixedKey, '>'].join(''));
     }
   }
   parts.push(['</', nsPrefix, name, '>'].join(''));
   return parts.join('');
 };


function appendColon(ns) {
  return (ns && ns.charAt(ns.length - 1) !== ':') ? ns + ':' : ns;
}

function noColonNameSpace(ns) {
  return (ns && ns.charAt(ns.length - 1) === ':') ? ns.substring(0, ns.length - 1) : ns;
}

WSDL.prototype.isIgnoredNameSpace = function(ns) {
  return this.options.ignoredNamespaces.indexOf(ns) > -1;
};

WSDL.prototype.filterOutIgnoredNameSpace = function(ns) {
  var namespace = noColonNameSpace(ns);
  return this.isIgnoredNameSpace(namespace) ? '' : namespace;
};



/**
 * Convert an object to XML.  This is a recursive method as it calls itself.
 *
 * @param {Object} obj the object to convert.
 * @param {String} name the name of the element (if the object being traversed is
 * an element).
 * @param {String} nsPrefix the namespace prefix of the object I.E. xsd.
 * @param {String} nsURI the full namespace of the object I.E. http://w3.org/schema.
 * @param {Boolean} isFirst whether or not this is the first item being traversed.
 * @param {?} xmlnsAttr
 * @param {?} parameterTypeObject
 * @param {NamespaceContext} nsContext Namespace context
 */
WSDL.prototype.objectToXML = function(obj, name, nsPrefix, nsURI, isFirst, xmlnsAttr, schemaObject, nsContext) {
  var self = this;
  var schema = this.definitions.schemas[nsURI];

  var parentNsPrefix = nsPrefix ? nsPrefix.parent : undefined;
  if (typeof parentNsPrefix !== 'undefined') {
    //we got the parentNsPrefix for our array. setting the namespace-variable back to the current namespace string
    nsPrefix = nsPrefix.current;
  }

  parentNsPrefix = noColonNameSpace(parentNsPrefix);
  if (this.isIgnoredNameSpace(parentNsPrefix)) {
    parentNsPrefix = '';
  }

  var soapHeader = !schema;
  var qualified = schema && schema.$elementFormDefault === 'qualified';
  var parts = [];
  var prefixNamespace = (nsPrefix || qualified) && nsPrefix !== TNS_PREFIX;

  var xmlnsAttrib = '';
  if (nsURI && isFirst) {
    if(self.options.overrideRootElement && self.options.overrideRootElement.xmlnsAttributes) {
      self.options.overrideRootElement.xmlnsAttributes.forEach(function(attribute) {
        xmlnsAttrib += ' ' + attribute.name + '="' + attribute.value + '"';
      });
    } else {
      if (prefixNamespace && !this.isIgnoredNameSpace(nsPrefix)) {
        // resolve the prefix namespace
        xmlnsAttrib += ' xmlns:' + nsPrefix + '="' + nsURI + '"';
      }
      // only add default namespace if the schema elementFormDefault is qualified
      if (qualified || soapHeader) xmlnsAttrib += ' xmlns="' + nsURI + '"';
    }
  }

  if (!nsContext) {
    nsContext = new NamespaceContext();
    nsContext.declareNamespace(nsPrefix, nsURI);
  } else {
    nsContext.pushContext();
  }

  // explicitly use xmlns attribute if available
  if (xmlnsAttr && !(self.options.overrideRootElement && self.options.overrideRootElement.xmlnsAttributes)) {
    xmlnsAttrib = xmlnsAttr;
  }

  var ns = '';

  if (self.options.overrideRootElement && isFirst) {
    ns = self.options.overrideRootElement.namespace;
  } else if (prefixNamespace && ((qualified || isFirst) || soapHeader) && !this.isIgnoredNameSpace(nsPrefix)) {
    ns = nsPrefix;
  }

  var i, n;
  // start building out XML string.
  if (Array.isArray(obj)) {
    for (i = 0, n = obj.length; i < n; i++) {
      var item = obj[i];
      var arrayAttr = self.processAttributes(item, nsContext),
          correctOuterNsPrefix = parentNsPrefix || ns; //using the parent namespace prefix if given

      parts.push(['<', appendColon(correctOuterNsPrefix), name, arrayAttr, xmlnsAttrib, '>'].join(''));
      parts.push(self.objectToXML(item, name, nsPrefix, nsURI, false, null, schemaObject, nsContext));
      parts.push(['</', appendColon(correctOuterNsPrefix), name, '>'].join(''));
    }
  } else if (typeof obj === 'object') {
    for (name in obj) {
      if (!obj.hasOwnProperty(name)) continue;
      //don't process attributes as element
      if (name === self.options.attributesKey) {
        continue;
      }
      //Its the value of a xml object. Return it directly.
      if (name === self.options.xmlKey){
        nsContext.popContext();
        return obj[name];
      }
      //Its the value of an item. Return it directly.
      if (name === self.options.valueKey) {
        nsContext.popContext();
        return xmlEscape(obj[name]);
      }

      var child = obj[name];
      if (typeof child === 'undefined') {
        continue;
      }

      var attr = self.processAttributes(child, nsContext);

      var value = '';
      var nonSubNameSpace = '';
      var emptyNonSubNameSpace = false;

      var nameWithNsRegex = /^([^:]+):([^:]+)$/.exec(name);
      if (nameWithNsRegex) {
        nonSubNameSpace = nameWithNsRegex[1] + ':';
        name = nameWithNsRegex[2];
      } else if(name[0] === ':'){
        emptyNonSubNameSpace = true;
        name = name.substr(1);
      }

      if (isFirst) {
        value = self.objectToXML(child, name, nsPrefix, nsURI, false, null, schemaObject, nsContext);
      } else {

        if (self.definitions.schemas) {
          if (schema) {
            var childSchemaObject = self.findChildSchemaObject(schemaObject, name);
            //find sub namespace if not a primitive
            if (childSchemaObject &&
              ((childSchemaObject.$type && (childSchemaObject.$type.indexOf('xsd:') === -1)) ||
              childSchemaObject.$ref || childSchemaObject.$name)) {
              /*if the base name space of the children is not in the ingoredSchemaNamspaces we use it.
               This is because in some services the child nodes do not need the baseNameSpace.
               */

              var childNsPrefix = '';
              var childName = '';
              var childNsURI;
              var childXmlnsAttrib = '';

              var elementQName = childSchemaObject.$ref || childSchemaObject.$name;
              if (elementQName) {
                elementQName = splitQName(elementQName);
                childName = elementQName.name;
                if (elementQName.prefix === TNS_PREFIX) {
                  // Local element
                  childNsURI = childSchemaObject.$targetNamespace;
                  childNsPrefix = nsContext.registerNamespace(childNsURI);
                  if (this.isIgnoredNameSpace(childNsPrefix)) {
                    childNsPrefix = nsPrefix;
                  }
                } else {
                  childNsPrefix = elementQName.prefix;
                  if (this.isIgnoredNameSpace(childNsPrefix)) {
                    childNsPrefix = nsPrefix;
                  }
                  childNsURI = schema.xmlns[childNsPrefix] || self.definitions.xmlns[childNsPrefix];
                }

                var unqualified = false;
                // Check qualification form for local elements
                if (childSchemaObject.$name && childSchemaObject.targetNamespace === undefined) {
                  if (childSchemaObject.$form === 'unqualified') {
                    unqualified = true;
                  } else if (childSchemaObject.$form === 'qualified') {
                    unqualified = false;
                  } else {
                    unqualified = schema.$elementFormDefault !== 'qualified';
                  }
                }
                if (unqualified) {
                  childNsPrefix = '';
                }

                if (childNsURI && childNsPrefix) {
                  if (nsContext.declareNamespace(childNsPrefix, childNsURI)) {
                    childXmlnsAttrib = ' xmlns:' + childNsPrefix + '="' + childNsURI + '"';
                    xmlnsAttrib += childXmlnsAttrib;
                  }
                }
              }

              var resolvedChildSchemaObject;
              if (childSchemaObject.$type) {
                var typeQName = splitQName(childSchemaObject.$type);
                var typePrefix = typeQName.prefix;
                var typeURI = schema.xmlns[typePrefix] || self.definitions.xmlns[typePrefix];
                childNsURI = typeURI;
                if (typeURI !== 'http://www.w3.org/2001/XMLSchema' && typePrefix !== TNS_PREFIX) {
                  // Add the prefix/namespace mapping, but not declare it
                  nsContext.addNamespace(typePrefix, typeURI);
                }
                resolvedChildSchemaObject =
                  self.findSchemaType(typeQName.name, typeURI) || childSchemaObject;
              } else {
                resolvedChildSchemaObject =
                  self.findSchemaObject(childNsURI, childName) || childSchemaObject;
              }

              if (childSchemaObject.$baseNameSpace && this.options.ignoreBaseNameSpaces) {
                childNsPrefix = nsPrefix;
                childNsURI = nsURI;
              }

              if (this.options.ignoreBaseNameSpaces) {
                childNsPrefix = '';
                childNsURI = '';
              }

              ns = childNsPrefix;

              if (Array.isArray(child)) {
                //for arrays, we need to remember the current namespace
                childNsPrefix = {
                  current: childNsPrefix,
                  parent: ns
                };
              }

              value = self.objectToXML(child, name, childNsPrefix, childNsURI,
                false, null, resolvedChildSchemaObject, nsContext);
            } else if (obj[self.options.attributesKey] && obj[self.options.attributesKey].xsi_type) {
              //if parent object has complex type defined and child not found in parent
              var completeChildParamTypeObject = self.findChildSchemaObject(
                obj[self.options.attributesKey].xsi_type.type,
                obj[self.options.attributesKey].xsi_type.xmlns);

              nonSubNameSpace = obj[self.options.attributesKey].xsi_type.prefix;
              nsContext.addNamespace(obj[self.options.attributesKey].xsi_type.prefix,
                obj[self.options.attributesKey].xsi_type.xmlns);
              value = self.objectToXML(child, name, obj[self.options.attributesKey].xsi_type.prefix,
                obj[self.options.attributesKey].xsi_type.xmlns, false, null, null, nsContext);
            } else {
              if(Array.isArray(child)) {
                name = nonSubNameSpace + name;
              }

              value = self.objectToXML(child, name, nsPrefix, nsURI, false, null, null, nsContext);
            }
          } else {
            value = self.objectToXML(child, name, nsPrefix, nsURI, false, null, null, nsContext);
          }
        }
      }

      ns = noColonNameSpace(ns);
      if (this.isIgnoredNameSpace(ns)) {
        ns = '';
      }

      if (!Array.isArray(child)) {
        // start tag
        parts.push(['<', emptyNonSubNameSpace ? '' : appendColon(nonSubNameSpace || ns), name, attr, xmlnsAttrib,
          (child === null ? ' xsi:nil="true"' : ''), '>'].join(''));
      }
      parts.push(value);
      if (!Array.isArray(child)) {
        // end tag
        parts.push(['</', emptyNonSubNameSpace ? '' : appendColon(nonSubNameSpace || ns), name, '>'].join(''));
      }
    }
  } else if (obj !== undefined) {
    parts.push((self.options.escapeXML) ? xmlEscape(obj) : obj);
  }
  nsContext.popContext();
  return parts.join('');
};

WSDL.prototype.processAttributes = function(child, nsContext) {
  var attr = '';

  if(child === null) {
    child = [];
  }

  var attrObj = child[this.options.attributesKey];
  if (attrObj && attrObj.xsi_type) {
    var xsiType = attrObj.xsi_type;

    var prefix = xsiType.prefix || xsiType.namespace;
    // Generate a new namespace for complex extension if one not provided
    if (!prefix) {
      prefix = nsContext.registerNamespace(xsiType.xmlns);
    } else {
      nsContext.declareNamespace(prefix, xsiType.xmlns);
    }
    xsiType.prefix = prefix;
  }


  if (attrObj) {
    for (var attrKey in attrObj) {
      //handle complex extension separately
      if (attrKey === 'xsi_type') {
        var attrValue = attrObj[attrKey];
        attr += ' xsi:type="' + attrValue.prefix + ':' + attrValue.type + '"';
        attr += ' xmlns:' + attrValue.prefix + '="' + attrValue.xmlns + '"';

        continue;
      } else {
        attr += ' ' + attrKey + '="' + xmlEscape(attrObj[attrKey]) + '"';
      }
    }
  }

  return attr;
};

/**
 * Look up a schema type definition
 * @param name
 * @param nsURI
 * @returns {*}
 */
WSDL.prototype.findSchemaType = function(name, nsURI) {
  if (!this.definitions.schemas || !name || !nsURI) {
    return null;
  }

  var schema = this.definitions.schemas[nsURI];
  if (!schema || !schema.complexTypes) {
    return null;
  }

  return schema.complexTypes[name];
};

WSDL.prototype.findChildSchemaObject = function(parameterTypeObj, childName) {
  if (!parameterTypeObj || !childName) {
    return null;
  }
  var found = null,
      i = 0,
      child,
      ref;

  if (Array.isArray(parameterTypeObj.$lookupTypes) && parameterTypeObj.$lookupTypes.length) {
    var types = parameterTypeObj.$lookupTypes;

    for(i = 0; i < types.length; i++) {
      var typeObj = types[i];

      if(typeObj.$name === childName) {
        found = typeObj;
        break;
      }
    }
  }

  var object = parameterTypeObj;
  if (object.$name === childName && object.name === 'element') {
    return object;
  }
  if (object.$ref) {
    ref = splitQName(object.$ref);
    if (ref.name === childName) {
      return object;
    }
  }

  var childNsURI;
  if (object.$type) {
    var typeInfo = splitQName(object.$type);
    if (typeInfo.prefix === TNS_PREFIX) {
      childNsURI = parameterTypeObj.$targetNamespace;
    } else {
      childNsURI = this.definitions.xmlns[typeInfo.prefix];
    }
    var typeDef = this.findSchemaType(typeInfo.name, childNsURI);
    if (typeDef) {
      return this.findChildSchemaObject(typeDef, childName);
    }
  }

  if (object.children) {
    for (i = 0, child; child = object.children[i]; i++) {
      found = this.findChildSchemaObject(child, childName);
      if (found) {
        break;
      }

      if (child.$base) {
        var baseQName = splitQName(child.$base);
        var childNameSpace = baseQName.prefix === TNS_PREFIX ? '' : baseQName.prefix;
        childNsURI = this.definitions.xmlns[baseQName.prefix];

        var foundBase = this.findSchemaType(baseQName.name, childNsURI);

        if (foundBase) {
          found = this.findChildSchemaObject(foundBase, childName);

          if (found) {
            found.$baseNameSpace = childNameSpace;
            found.$type = childNameSpace + ':' + childName;
            break;
          }
        }
      }
    }

  }

  if (!found && object.$name === childName) {
    return object;
  }

  return found;
};

WSDL.prototype._parse = function(xml) {
  var self = this,
    p = sax.parser(true),
    stack = [],
    root = null,
    types = null,
    schema = null,
      options = self.options;

  p.onopentag = function(node) {
    var nsName = node.name;
    var attrs  = node.attributes;

    var top = stack[stack.length - 1];
    var name;
    if (top) {
      try {
        top.startElement(stack, nsName, attrs, options);
      } catch (e) {
        if (self.options.strict) {
          throw e;
        } else {
          stack.push(new Element(nsName, attrs, options));
        }
      }
    } else {
      name = splitQName(nsName).name;
      if (name === 'definitions') {
        root = new DefinitionsElement(nsName, attrs, options);
        stack.push(root);
      } else if (name === 'schema') {
        // Shim a structure in here to allow the proper objects to be created when merging back.
        root = new DefinitionsElement('definitions', {}, {});
        types = new TypesElement('types', {}, {});
        schema = new SchemaElement(nsName, attrs, options);
        types.addChild(schema);
        root.addChild(types);
        stack.push(schema);
      } else {
        throw new Error('Unexpected root element of WSDL or include');
      }
    }
  };

  p.onclosetag = function(name) {
    var top = stack[stack.length - 1];
    assert(top, 'Unmatched close tag: ' + name);

    top.endElement(stack, name);
  };

  p.write(xml).close();

  return root;
};

WSDL.prototype._fromXML = function(xml) {
  this.definitions = this._parse(xml);
  this.definitions.descriptions = {
    types:{}
  };
  this.xml = xml;
};

WSDL.prototype._fromServices = function(services) {

};



WSDL.prototype._xmlnsMap = function() {
  var xmlns = this.definitions.xmlns;
  var str = '';
  for (var alias in xmlns) {
    if (alias === '' || alias === TNS_PREFIX) {
      continue;
    }
    var ns = xmlns[alias];
    switch (ns) {
      case "http://xml.apache.org/xml-soap" : // apachesoap
      case "http://schemas.xmlsoap.org/wsdl/" : // wsdl
      case "http://schemas.xmlsoap.org/wsdl/soap/" : // wsdlsoap
      case "http://schemas.xmlsoap.org/wsdl/soap12/": // wsdlsoap12
      case "http://schemas.xmlsoap.org/soap/encoding/" : // soapenc
      case "http://www.w3.org/2001/XMLSchema" : // xsd
        continue;
    }
    if (~ns.indexOf('http://schemas.xmlsoap.org/')) {
      continue;
    }
    if (~ns.indexOf('http://www.w3.org/')) {
      continue;
    }
    if (~ns.indexOf('http://xml.apache.org/')) {
      continue;
    }
    str += ' xmlns:' + alias + '="' + ns + '"';
  }
  return str;
};

/*
 * Have another function to load previous WSDLs as we
 * don't want this to be invoked externally (expect for tests)
 * This will attempt to fix circular dependencies with XSD files,
 * Given
 * - file.wsdl
 *   - xs:import namespace="A" schemaLocation: A.xsd
 * - A.xsd
 *   - xs:import namespace="B" schemaLocation: B.xsd
 * - B.xsd
 *   - xs:import namespace="A" schemaLocation: A.xsd
 * file.wsdl will start loading, import A, then A will import B, which will then import A
 * Because A has already started to load previously it will be returned right away and
 * have an internal circular reference
 * B would then complete loading, then A, then file.wsdl
 * By the time file A starts processing its includes its definitions will be already loaded,
 * this is the only thing that B will depend on when "opening" A
 */
function open_wsdl_recursive(uri, options, callback) {
  var fromCache,
      WSDL_CACHE;

  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  WSDL_CACHE = options.WSDL_CACHE;

  if (fromCache = WSDL_CACHE[ uri ]) {
    return callback.call(fromCache, null, fromCache);
  }

  return open_wsdl(uri, options, callback);
}

function open_wsdl(uri, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  // initialize cache when calling open_wsdl directly
  var WSDL_CACHE = options.WSDL_CACHE || {};
  var request_headers = options.wsdl_headers;
  var request_options = options.wsdl_options;

  var wsdl;
  if (!/^https?:/.test(uri)) {
    debug('Reading file: %s', uri);
    fs.readFile(uri, 'utf8', function(err, definition) {
      if (err) {
        callback(err);
      }
      else {
        wsdl = new WSDL(definition, uri, options);
        WSDL_CACHE[ uri ] = wsdl;
        wsdl.WSDL_CACHE = WSDL_CACHE;
        wsdl.onReady(callback);
      }
    });
  }
  else {
    debug('Reading url: %s', uri);
    var httpClient = options.httpClient || new HttpClient(options);
    httpClient.request(uri, null /* options */, function(err, response, definition) {
      if (err) {
        callback(err);
      } else if (response && response.statusCode === 200) {
        wsdl = new WSDL(definition, uri, options);
        WSDL_CACHE[ uri ] = wsdl;
        wsdl.WSDL_CACHE = WSDL_CACHE;
        wsdl.onReady(callback);
      } else {
        callback(new Error('Invalid WSDL URL: ' + uri + "\n\n\r Code: " + response.statusCode + "\n\n\r Response Body: " + response.body));
      }
    }, request_headers, request_options);
  }

  return wsdl;
}

exports.open_wsdl = open_wsdl;
exports.WSDL = WSDL;
