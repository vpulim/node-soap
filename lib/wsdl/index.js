/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 *
 */

"use strict";

var assert = require('assert').ok;
var fs = require('fs');
var inherits = require('util').inherits;
var path = require('path');
var url = require('url');

var _ = require('lodash');
var debug = require('debug')('node-soap');
var sax = require('sax');
var selectn = require('selectn');
var stripBom = require('strip-bom');

var HttpClient = require('../http');
var splitNSName = require('./split_ns_name');
var extend = require('./extend');
var Element = require('./element');
var elements = require('./elements');

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
  if (!/^http/.test(self.uri) && !/^http/.test(include.location)) {
    includePath = path.resolve(path.dirname(self.uri), include.location);
  } else {
    includePath = url.resolve(self.uri, include.location);
  }

  open_wsdl(includePath, this.options, function(err, wsdl) {
    if (err) {
      return callback(err);
    }
    if(wsdl.definitions instanceof elements.DefinitionsElement){
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

WSDL.prototype.objectToXML = function(obj, name, namespace, xmlns, first, xmlnsAttr, parameterTypeObject, ancestorXmlns) {
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
  if (xmlns && first) {

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
  if (prefixNamespace && ((qualified || first) || soapHeader) && this.options.ignoredNamespaces.indexOf(namespace) === -1) {
    // prefix element
    ns = namespace.indexOf(":") === -1 ? namespace + ':' : namespace;
  }

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
      if (first) {
        value = self.objectToXML(child, name, namespace, xmlns, false, null, parameterTypeObject, ancXmlns);
      } else {

        if (self.definitions.schemas) {
          if (schema) {
            var childParameterTypeObject = self.findChildParameterObject(parameterTypeObject, name);
            //find sub namespace if not a primitive
            if (childParameterTypeObject && childParameterTypeObject.$type && (childParameterTypeObject.$type.indexOf('xsd') === -1)) {
              if(childParameterTypeObject.$baseNameSpace) { //this element has a base with another namespace (the correct one)
                ns = childParameterTypeObject.$baseNameSpace + ':';
              }

              var childParameterType = childParameterTypeObject.$type;

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
              var completeChildParameterTypeObject = self.findChildParameterObjectFromSchema(childName, childXmlns) || childParameterTypeObject;

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
      child;

  if(parameterTypeObj.$lookupTypes && Array.isArray(parameterTypeObj.$lookupTypes && parameterTypeObj.$lookupTypes.length)) {
    var types = parameterTypeObj.$lookupTypes;

    for(i = 0; i < types.length; i++) {
      var typeObj = types[i];

      if(typeObj.$name === childName) {
        found = typeObj;
        break;
      }
    }
  } else {
    var object = parameterTypeObj;
    if (object.$name === childName) {
      return object;
    }

    if (object.children) {
      for (i = 0, child; child = object.children[i]; i++) {
        found = this.findChildParameterObject(child, childName);
        if (found) {
          break;
        }

        if(child.$base) {
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
        root = new elements.DefinitionsElement(nsName, attrs, options);
        stack.push(root);
      } else if (name === 'schema') {
        // Shim a structure in here to allow the proper objects to be created when merging back.
        root = new elements.DefinitionsElement('definitions', {}, {});
        types = new elements.TypesElement('types', {}, {});
        schema = new elements.SchemaElement(nsName, attrs, options);
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

function open_wsdl(uri, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  var request_headers = options.wsdl_headers;
  var request_options = options.wsdl_options;

  var wsdl;
  if (!/^http/.test(uri)) {
    debug('Reading file: %s', uri);
    fs.readFile(uri, 'utf8', function(err, definition) {
      if (err) {
        callback(err);
      }
      else {
        wsdl = new WSDL(definition, uri, options);
        wsdl.onReady(callback);
      }
    });
  }
  else {
    debug('Reading url: %s', uri);
    var httpClient = new HttpClient(options);
    httpClient.request(uri, null /* options */, function(err, response, definition) {
      if (err) {
        callback(err);
      } else if (response && response.statusCode === 200) {
        wsdl = new WSDL(definition, uri, options);
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
