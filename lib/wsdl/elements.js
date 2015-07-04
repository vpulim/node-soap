/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 *
 */
/*jshint proto:true*/

"use strict";

var assert = require('assert').ok;

var _ = require('lodash');
var debug = require('debug')('node-soap');

var Element = require('./element');
var splitNSName = require('./split_ns_name');
var extend = require('./extend');

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

module.exports = {
  ElementElement: ElementElement,
  AnyElement: AnyElement,
  InputElement: InputElement,
  OutputElement: OutputElement,
  SimpleTypeElement: SimpleTypeElement,
  RestrictionElement: RestrictionElement,
  ExtensionElement: ExtensionElement,
  ChoiceElement: ChoiceElement,
  EnumerationElement: EnumerationElement,
  ComplexTypeElement: ComplexTypeElement,
  ComplexContentElement: ComplexContentElement,
  SimpleContentElement: SimpleContentElement,
  SequenceElement: SequenceElement,
  AllElement: AllElement,
  MessageElement: MessageElement,
  DocumentationElement: DocumentationElement,

  SchemaElement: SchemaElement,
  TypesElement: TypesElement,
  OperationElement: OperationElement,
  PortTypeElement: PortTypeElement,
  BindingElement: BindingElement,
  PortElement: PortElement,
  ServiceElement: ServiceElement,
  DefinitionsElement: DefinitionsElement
};
