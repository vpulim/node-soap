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
var fs = require('fs');
var url = require('url');
var path = require('path');
var assert = require('assert').ok;
var stripBom = require('strip-bom');
var debug = require('debug')('node-soap');
var _ = require('lodash');
var selectn = require('selectn');

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

function splitNSName(nsName) {
  var i = typeof nsName === 'string' ? nsName.indexOf(':') : -1;
  return i < 0 ? {namespace: 'xmlns', name: nsName} : {namespace: nsName.substring(0, i), name: nsName.substring(i + 1)};
}

function xmlEscape(obj) {
  if (typeof (obj) === 'string') {
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

function findKey(obj, val) {
  for (var n in obj)
    if (obj[n] === val)
      return n;
}

var Element = function(nsName, attrs, options) {
  var parts = splitNSName(nsName);

  this.nsName = nsName;
  this.namespace = parts.namespace;
  this.name = parts.name;
  this.children = [];
  this.xmlns = {};

  this._initializeOptions(options);

  for (var key in attrs) {
    var match = /^xmlns:?(.*)$/.exec(key);
    if (match) {
      this.xmlns[match[1] ? match[1] : 'xmlns'] = attrs[key];
    }
    else {
      if(key === 'value') {
        this[this.valueKey] = attrs[key];
      } else {
        this['$' + key] = attrs[key];
      }
    }
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
  delete this.namespace;
  delete this.name;
};

Element.prototype.allowedChildren = [];

Element.prototype.startElement = function(stack, nsName, attrs, options) {
  if (!this.allowedChildren)
    return;

  var ChildClass = this.allowedChildren[splitNSName(nsName).name],
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
  restriction: [RestrictionElement, 'enumeration choice sequence'],
  extension: [ExtensionElement, 'sequence choice'],
  choice: [ChoiceElement, 'element choice'],
    // group: [GroupElement, 'element group'],
  enumeration: [EnumerationElement, ''],
  complexType: [ComplexTypeElement,  'annotation sequence all complexContent simpleContent choice'],
  complexContent: [ComplexContentElement,  'extension'],
  simpleContent: [SimpleContentElement,  'extension'],
  sequence: [SequenceElement, 'element choice any'],
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

  if(!targetNamespace) {
    if(child.includes && (child.includes instanceof Array) && child.includes.length > 0) {
      targetNamespace = child.includes[0].namespace;
    }
  }

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

    nsName = splitNSName(part.$element);
    ns = nsName.namespace;
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
    this.element.$lookupType = part.$name;

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
      type = splitNSName(this.element.$type);
      var typeNs = schema.xmlns && schema.xmlns[type.namespace] || definitions.xmlns[type.namespace];

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
      nsName = splitNSName(part.$type);
      ns = definitions.xmlns[nsName.namespace];
      type = nsName.name;
      var schemaDefinition = definitions.schemas[ns];
      if (typeof schemaDefinition !== 'undefined') {
        this.parts[part.$name] = definitions.schemas[ns].types[type] || definitions.schemas[ns].complexTypes[type];
      } else {
        this.parts[part.$name] = part.$type;
      }

      if (typeof this.parts[part.$name] === 'object') {
        this.parts[part.$name].namespace = nsName.namespace;
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
 * method and provides an entry point for the already existing code in `findChildParameterObject`.
 *
 * @method _createLookupTypeObject
 * @param {String}            nsString          The NS String (for example "alias:type").
 * @param {Object}            xmlns       The fully parsed `wsdl` definitions object (including all schemas).
 * @returns {Object}
 * @private
 */
MessageElement.prototype._createLookupTypeObject = function (nsString, xmlns) {
  var splittedNSString = splitNSName(nsString),
      nsAlias = splittedNSString.namespace,
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
    var messageName = splitNSName(child.$message).name;
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
  var type = splitNSName(this.$type).name,
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
  for (var i = 0, child; child = children[i]; i++) {
    if (child.name !== 'port')
      continue;
    var bindingName = splitNSName(child.$binding).name;
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
      desc = child.description(definitions);
      break;
    }
  }
  if (desc && this.$base) {
    var type = splitNSName(this.$base),
      typeName = type.name,
      ns = xmlns && xmlns[type.namespace] || definitions.xmlns[type.namespace],
      schema = definitions.schemas[ns],
      typeElement = schema && ( schema.complexTypes[typeName] || schema.types[typeName] || schema.elements[typeName] );

    desc.getBase = function() {
      return typeElement.description(definitions, xmlns);
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
      desc = child.description(definitions);
    }
  }
  if (this.$base) {
    var type = splitNSName(this.$base),
      typeName = type.name,
      ns = xmlns && xmlns[type.namespace] || definitions.xmlns[type.namespace],
      schema = definitions.schemas[ns];

    if (typeName in Primitives) {
      return this.$base;
    }
    else {
      var typeElement = schema && ( schema.complexTypes[typeName] ||
        schema.types[typeName] || schema.elements[typeName] );

      if (typeElement) {
        var base = typeElement.description(definitions, xmlns);
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

  var type = this.$type || this.$ref;
  if (type) {
    type = splitNSName(type);
    var typeName = type.name,
      ns = xmlns && xmlns[type.namespace] || definitions.xmlns[type.namespace],
      schema = definitions.schemas[ns],
      typeElement = schema && ( schema.complexTypes[typeName] || schema.types[typeName] || schema.elements[typeName] );

    if(ns && definitions.schemas[ns]) {
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
          elem.targetNSAlias = type.namespace;
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

  // Allow any request headers to keep passing through
  this.options.wsdl_headers = options.wsdl_headers;
  this.options.wsdl_options = options.wsdl_options;

  var ignoreBaseNameSpaces = options ? options.ignoreBaseNameSpaces : null;
  if(ignoreBaseNameSpaces !== null && typeof ignoreBaseNameSpaces !== 'undefined' )
    this.options.ignoreBaseNameSpaces = ignoreBaseNameSpaces;
  else
    this.options.ignoreBaseNameSpaces = this.ignoreBaseNameSpaces;

};

WSDL.prototype.onReady = function(callback) {
  if (callback)
    this.callback = callback;
};

WSDL.prototype._processNextInclude = function(includes, callback) {
  var self = this,
    include = includes.shift();

  if (!include)
    return callback();

  var includePath;
  if (!/^https?/.test(self.uri) && !/^https?/.test(include.location)) {
    includePath = path.resolve(path.dirname(self.uri), include.location);
  } else {
    includePath = url.resolve(self.uri, include.location);
  }

  open_wsdl_recursive(includePath, this.options, function(err, wsdl) {
    if (err) {
      return callback(err);
    }
    if(wsdl.definitions instanceof DefinitionsElement){
      _.merge(self.definitions, wsdl.definitions);
    }else{
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

    var name = splitNSName(nsName).name,
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
        if (isInput)
          name = portType.methods[name].input.$name;
        else
          name = portType.methods[name].output.$name;
        message = self.definitions.messages[name];
        // 'cache' this alias to speed future lookups
        self.definitions.messages[originalName] = self.definitions.messages[name];
      }

      topSchema = message.description(self.definitions);
      objectName = originalName;
    }

    if (attrs.href) {
      id = attrs.href.substr(1);
      if (!refs[id])
        refs[id] = {hrefs: [], obj: null};
      refs[id].hrefs.push({par: top.object, key: name, obj: obj});
    }
    if (id = attrs.id) {
      if (!refs[id])
        refs[id] = {hrefs: [], obj: null};
    }

    //Handle element attributes
    for(attributeName in attrs){
      if(/^xmlns:|^xmlns$/.test(attributeName)){
        xmlns[splitNSName(attributeName).name] = attrs[attributeName];
        continue;
      }
      hasNonXmlnsAttribute = true;
      elementAttributes[attributeName] = attrs[attributeName];
    }

    for(attributeName in elementAttributes){
      var res = splitNSName(attributeName);
      if(res.name === 'nil' && xmlns[res.namespace] === 'http://www.w3.org/2001/XMLSchema-instance'){
        hasNilAttribute = true;
        break;
      }
    }

    if(hasNonXmlnsAttribute)obj[self.options.attributesKey] = elementAttributes;

    // Pick up the schema for the type specified in element's xsi:type attribute.
    var xsiTypeSchema;
    var xsiType = elementAttributes['xsi:type'];
    if (xsiType) {
      var type = splitNSName(xsiType);
      var typeDef = self.findParameterObject(xmlns[type.namespace], type.name);
      if (typeDef) {
        xsiTypeSchema = typeDef.description(self.definitions);
      }
    }

    if (topSchema && topSchema[name + '[]'])
      name = name + '[]';
    stack.push({name: originalName, object: obj, schema: (xsiTypeSchema || (topSchema && topSchema[name])), id: attrs.id, nil: hasNilAttribute});
  };

  p.onclosetag = function(nsName) {
    var cur = stack.pop(),
      obj = cur.object,
      top = stack[stack.length - 1],
      topObject = top.object,
      topSchema = top.schema,
      name = splitNSName(nsName).name;

    if (typeof cur.schema === 'string' && (cur.schema === 'string' || cur.schema.split(':')[1] === 'string')) {
      if (typeof obj === 'object' &&  Object.keys(obj).length === 0) obj = cur.object = '';
    }

    if(cur.nil === true) {
      return;
    }


    if (topSchema && topSchema[name + '[]']) {
      if (!topObject[name])
        topObject[name] = [];
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

    if (cur.id) {
      refs[cur.id].obj = obj;
    }
  };

  p.oncdata = function (text) {
    text = trim(text);
    if (!text.length)
      return;

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

  p.ontext = function(text) {
    text = trim(text);
    if (!text.length)
      return;

    var top = stack[stack.length - 1];
    var name = splitNSName(top.schema).name,
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

    if(top.object[self.options.attributesKey]) {
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
      var code = selectn('faultcode.$value', body.Fault);
      var string = selectn('faultstring.$value', body.Fault);
      var detail = selectn('detail.$value', body.Fault);
      var error = new Error(code + ': ' + string + (detail ? ': ' + detail : ''));
      error.root = root;
      throw error;
    }
    return root.Envelope;
  }
  return root;
};

WSDL.prototype.findParameterObject = function(xmlns, parameterType) {
  if (!xmlns || !parameterType) {
    return null;
  }

  var parameterTypeObj = null;

  if (this.definitions.schemas) {
    var schema = this.definitions.schemas[xmlns];
    if (schema) {
      if (parameterType.indexOf(':') !== -1) {
        parameterType = parameterType.substring(parameterType.indexOf(':') + 1, parameterType.length);
      }

      // if the client passed an input element which has a `$lookupType` property instead of `$type`
      // the `parameterTypeObj` is found in `schema.elements`.
      parameterTypeObj = schema.complexTypes[parameterType] || schema.elements[parameterType];
    }
  }

  return parameterTypeObj;
};

WSDL.prototype.objectToDocumentXML = function(name, params, ns, xmlns, type) {
  var args = {};
  args[name] = params;
  var parameterTypeObj = type ? this.findParameterObject(xmlns, type) : null;
  if (this.namespaceNumber) {
    this.namespaceNumber = 0;
  }
  return this.objectToXML(args, null, ns, xmlns, true, null, parameterTypeObj);
};

WSDL.prototype.objectToRpcXML = function(name, params, namespace, xmlns) {
  var self = this;
  var parts = [];
  var defs = this.definitions;
  var nsAttrName = '_xmlns';

  namespace = namespace || findKey(defs.xmlns, xmlns);
  xmlns = xmlns || defs.xmlns[namespace];
  namespace = namespace === 'xmlns' ? '' : (namespace + ':');
  parts.push(['<', namespace, name, '>'].join(''));

  for (var key in params) {
    if (key !== nsAttrName) {
      var value = params[key];
      parts.push(['<', key, '>'].join(''));
      parts.push((typeof value === 'object') ? this.objectToXML(value, key, namespace, xmlns) : xmlEscape(value));
      parts.push(['</', key, '>'].join(''));
    }
  }
  parts.push(['</', namespace, name, '>'].join(''));

  return parts.join('');
};

/**
 * Convert an object to XML.  This is a recursive method as it calls itself.
 *
 * @param {Object} obj the object to convert.
 * @param {String} name the name of the element (if the object being traversed is
 * an element).
 * @param {String} namespace the namespace prefix of the object I.E. xsd.
 * @param {String} xmlns the full namespace of the object I.E. http://w3.org/schema.
 * @param {Boolean} isFirst whether or not this is the first item being traversed.
 * @param {?} xmlnsAttr
 * @param {?} parameterTypeObject
 * @param {?} ancestorXmlns
 */
WSDL.prototype.objectToXML = function(obj, name, namespace, xmlns, isFirst, xmlnsAttr, parameterTypeObject, ancestorXmlns) {
  var self = this;
  var schema = this.definitions.schemas[xmlns];

  var parentNamespace = namespace ? namespace.parent : undefined;
  if(typeof parentNamespace !== 'undefined') {
    //we got the parentNamespace for our array. setting the namespace-variable back to the current namespace string
    namespace = namespace.current;
  }

  var soapHeader = !schema;
  var qualified = schema && schema.$elementFormDefault === 'qualified';
  var parts = [];
  var prefixNamespace = (namespace || qualified) && namespace !== 'xmlns';

  var xmlnsAttrib = '';
  if (xmlns && isFirst) {

    if (prefixNamespace && this.options.ignoredNamespaces.indexOf(namespace) === -1) {
      // resolve the prefix namespace
      xmlnsAttrib += ' xmlns:' + namespace + '="' + xmlns + '"';
    }
    // only add default namespace if the schema elementFormDefault is qualified
    if (qualified || soapHeader) xmlnsAttrib += ' xmlns="' + xmlns + '"';
  }

  var ancXmlns = ancestorXmlns ? ancestorXmlns : new Array(xmlns);

  // explicitly use xmlns attribute if available
  if (xmlnsAttr) {
    xmlnsAttrib = xmlnsAttr;
  }

  var ns = '';
  if (prefixNamespace && ((qualified || isFirst) || soapHeader) && this.options.ignoredNamespaces.indexOf(namespace) === -1) {
    // prefix element
    ns = namespace.indexOf(":") === -1 ? namespace + ':' : namespace;
  }

  // start building out XML string.
  if (Array.isArray(obj)) {
    for (var i = 0, item; item = obj[i]; i++) {
      var arrayAttr = self.processAttributes(item),
          correctOuterNamespace = parentNamespace || ns; //using the parent namespace if given

      parts.push(['<', correctOuterNamespace, name, arrayAttr, xmlnsAttrib, '>'].join(''));
      parts.push(self.objectToXML(item, name, namespace, xmlns, false, null, parameterTypeObject, ancXmlns));
      parts.push(['</', correctOuterNamespace, name, '>'].join(''));
    }
  } else if (typeof obj === 'object') {
    for (name in obj) {
      //don't process attributes as element
      if (name === self.options.attributesKey) {
        continue;
      }
      //Its the value of a xml object. Return it directly.
      if (name === self.options.xmlKey){
        return obj[name];
      }
      //Its the value of an item. Return it directly.
      if (name === self.options.valueKey) {
        return xmlEscape(obj[name]);
      }

      var child = obj[name];
      if (typeof child === 'undefined')
        continue;

      var attr = self.processAttributes(child);

      var value = '';
      var nonSubNameSpace = '';

      var nameWithNsRegex = /^([^:]+):([^:]+)$/.exec(name);
      if (nameWithNsRegex) {
        nonSubNameSpace = nameWithNsRegex[1] + ':';
        name = nameWithNsRegex[2];
      }

      if (isFirst) {
        value = self.objectToXML(child, name, namespace, xmlns, false, null, parameterTypeObject, ancXmlns);
      } else {

        if (self.definitions.schemas) {
          if (schema) {
            var childParameterTypeObject = self.findChildParameterObject(parameterTypeObject, name);
            //find sub namespace if not a primitive
            if (childParameterTypeObject &&
              ((childParameterTypeObject.$type && (childParameterTypeObject.$type.indexOf('xsd') === -1)) ||
              childParameterTypeObject.$ref)) {
              /*if the base name space of the children is not in the ingoredSchemaNamspaces we use it.
               This is because in some services the child nodes do not need the baseNameSpace.
               */
              if(childParameterTypeObject.$baseNameSpace && !this.options.ignoreBaseNameSpaces) {
                ns = childParameterTypeObject.$baseNameSpace + ':';
              }

              var childParameterType = childParameterTypeObject.$type || childParameterTypeObject.$ref;

              var childNamespace = '';
              var childName = '';
              if (childParameterType.indexOf(':') !== -1) {
                childNamespace = childParameterType.substring(0, childParameterType.indexOf(':'));
                childName = childParameterType.substring(childParameterType.indexOf(':') + 1);
              }
              var childXmlns = schema.xmlns[childNamespace] || self.definitions.xmlns[childNamespace];
              var childXmlnsAttrib = '';
              if ((ancXmlns.indexOf(childXmlns) === -1) && (childXmlns)) {
                childXmlnsAttrib = ' xmlns:' + childNamespace + '="' + childXmlns+ '"';
                if ((childXmlns)) {
                  ancXmlns.push(childXmlns);
                }
              }
              // There is matching element ref
              if (childParameterTypeObject.$ref) {
                ns = childNamespace ? childNamespace + ':' : '';
                xmlnsAttrib = childXmlnsAttrib;
              }

              var completeChildParameterTypeObject;
              if (childParameterTypeObject.$type) {
                completeChildParameterTypeObject =
                  self.findChildParameterObjectFromSchema(childName, childXmlns) ||
                  childParameterTypeObject;
              } else {
                completeChildParameterTypeObject =
                  self.findParameterObject(childXmlns, childName) ||
                  childParameterTypeObject;
              }

              for(var ignoredNamespacesIndex = 0, ignoredNamespacesLength = this.ignoredNamespaces.length; ignoredNamespacesIndex < ignoredNamespacesLength; ignoredNamespacesIndex++) {
                if(this.ignoredNamespaces[ignoredNamespacesIndex] === childNamespace) {
                  childNamespace = namespace;

                  break;
                }
              }

              if(Array.isArray(child)) {
                //for arrays, we need to remember the current namespace
                childNamespace = {
                  current: childNamespace,
                  parent: ns
                };
              }

              value = self.objectToXML(child, name, childNamespace, childXmlns, false, childXmlnsAttrib, completeChildParameterTypeObject, ancXmlns);
            } else if (obj[self.options.attributesKey] && obj[self.options.attributesKey].xsi_type) { //if parent object has complex type defined and child not found in parent
              var completeChildParamTypeObject = self.findChildParameterObjectFromSchema(obj[self.options.attributesKey].xsi_type.type, obj[self.options.attributesKey].xsi_type.xmlns);

              nonSubNameSpace = obj[self.options.attributesKey].xsi_type.namespace + ':';
              ancXmlns.push(obj[self.options.attributesKey].xsi_type.xmlns);
              value = self.objectToXML(child, name, obj[self.options.attributesKey].xsi_type.namespace, obj[self.options.attributesKey].xsi_type.xmlns, false, null, null, ancXmlns);
            } else {
              value = self.objectToXML(child, name, namespace, xmlns, false, null, null, ancXmlns);
            }
          } else {
            value = self.objectToXML(child, name, namespace, xmlns, false, null, null, ancXmlns);
          }
        }
      }

      if (!Array.isArray(child)) {
        parts.push(['<', nonSubNameSpace || ns, name, attr, xmlnsAttrib, (child === null ? ' xsi:nil="true"' : ''), '>'].join(''));
      }

      parts.push(value);
      if (!Array.isArray(child)) {
        parts.push(['</', nonSubNameSpace || ns, name, '>'].join(''));
      }
    }
  } else if (obj !== undefined) {
    parts.push(xmlEscape(obj));
  }
  return parts.join('');
};

WSDL.prototype.processAttributes = function(child) {
  var self = this;
  var attr = '';

  if(child === null) {
    child = [];
  }

  if (child[this.options.attributesKey] && child[this.options.attributesKey].xsi_type) {
    var xsiType = child[this.options.attributesKey].xsi_type;

    // Generate a new namespace for complex extension if one not provided
    if (!xsiType.namespace) {
      if (self.namespaceNumber) {
        self.namespaceNumber++;
      } else {
        self.namespaceNumber = 1;
      }
      xsiType.namespace = 'ns' + self.namespaceNumber;
    }
  }

  if (child[this.options.attributesKey]) {
    for (var attrKey in child[this.options.attributesKey]) {
      //handle complex extension separately
      if (attrKey === 'xsi_type') {
        var attrValue = child[this.options.attributesKey][attrKey];
        attr += ' xsi:type="' + attrValue.namespace + ':' + attrValue.type + '"';
        attr += ' xmlns:' + attrValue.namespace + '="' + attrValue.xmlns + '"';

        continue;
      } else {
        attr += ' ' + attrKey + '="' + xmlEscape(child[this.options.attributesKey][attrKey]) + '"';
      }
    }
  }

  return attr;
};

WSDL.prototype.findChildParameterObjectFromSchema = function(name, xmlns) {
  if (!this.definitions.schemas || !name || !xmlns) {
    return null;
  }

  var schema = this.definitions.schemas[xmlns];
  if (!schema || !schema.complexTypes) {
    return null;
  }

  return schema.complexTypes[name];
};

WSDL.prototype.findChildParameterObject = function(parameterTypeObj, childName) {
  if (!parameterTypeObj || !childName) {
    return null;
  }
  var found = null,
      i = 0,
      child,
      ref;

  if(Array.isArray(parameterTypeObj.$lookupTypes) && parameterTypeObj.$lookupTypes.length) {
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
  if (object.$name === childName) {
    return object;
  }
  if (object.$ref) {
    ref = splitNSName(object.$ref);
    if (ref.name === childName) {
      return object;
    }
  }

  if (object.children) {
    for (i = 0, child; child = object.children[i]; i++) {
      found = this.findChildParameterObject(child, childName);
      if (found) {
        break;
      }

      if (child.$base) {
        var childNameSpace = child.$base.substr(0, child.$base.indexOf(':')),
          childXmlns = this.definitions.xmlns[childNameSpace];

        var foundBase = this.findChildParameterObjectFromSchema(child.$base.substr(child.$base.indexOf(':') + 1), childXmlns);

        if (foundBase) {
          found = this.findChildParameterObject(foundBase, childName);

          if (found) {
            found.$baseNameSpace = childNameSpace;
            found.$type = childNameSpace + ':' + childName;
            break;
          }
        }
      }
    }

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
      name = splitNSName(nsName).name;
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
    if (alias === '' || alias === 'xmlns')
      continue;
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
    if (~ns.indexOf('http://schemas.xmlsoap.org/'))
      continue;
    if (~ns.indexOf('http://www.w3.org/'))
      continue;
    if (~ns.indexOf('http://xml.apache.org/'))
      continue;
    str += ' xmlns:' + alias + '="' + ns + '"';
  }
  return str;
};

var WSDL_CACHE = { };

/* 
  Have another function to load previous WSDLs as we
  don't want this to be invoked externally (expect for tests)
  This will attempt to fix circular dependencies with XSD files, 
  Given

    file.wsdl
        xs:import namespace="A" schemaLocation: A.xsd
    A.xsd
        xs:import namespace="B" schemaLocation: B.xsd
    B.xsd
        xs:import namespace="A" schemaLocation: A.xsd

  file.wsdl will start loading, import A, then A will import B, which will then import A
  Because A has already started to load previously it will be returned right away and 
  have an internal circular reference

  B would then complete loading, then A, then file.wsdl

  By the time file A starts processing its includes its definitions will be already loaded, 
  this is the only thing that B will depend on when "opening" A
*/
function open_wsdl_recursive(uri, options, callback) {
  var fromCache;

  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

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

  var request_headers = options.wsdl_headers;
  var request_options = options.wsdl_options;

  var wsdl;
  if (!/^https?/.test(uri)) {
    debug('Reading file: %s', uri);
    fs.readFile(uri, 'utf8', function(err, definition) {
      if (err) {
        callback(err);
      }
      else {
        wsdl = new WSDL(definition, uri, options);
        WSDL_CACHE[ uri ] = wsdl;
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
