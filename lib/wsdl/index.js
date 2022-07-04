"use strict";
/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 *
 */
/*jshint proto:true*/
exports.__esModule = true;
exports.open_wsdl = exports.WSDL = void 0;
var assert_1 = require("assert");
var debugBuilder = require("debug");
var fs = require("fs");
var _ = require("lodash");
var path = require("path");
var sax = require("sax");
var stripBom = require("strip-bom");
var url = require("url");
var http_1 = require("../http");
var nscontext_1 = require("../nscontext");
var utils_1 = require("../utils");
var elements = require("./elements");
var debug = debugBuilder('node-soap');
var XSI_URI = 'http://www.w3.org/2001/XMLSchema-instance';
var trimLeft = /^[\s\xA0]+/;
var trimRight = /[\s\xA0]+$/;
function trim(text) {
    return text.replace(trimLeft, '').replace(trimRight, '');
}
function deepMerge(destination, source) {
    return _.mergeWith(destination, source, function (a, b) {
        return Array.isArray(a) ? a.concat(b) : undefined;
    });
}
function appendColon(ns) {
    return (ns && ns.charAt(ns.length - 1) !== ':') ? ns + ':' : ns;
}
function noColonNameSpace(ns) {
    return (ns && ns.charAt(ns.length - 1) === ':') ? ns.substring(0, ns.length - 1) : ns;
}
var WSDL = /** @class */ (function () {
    function WSDL(definition, uri, options) {
        var _this = this;
        this.ignoredNamespaces = ['tns', 'targetNamespace', 'typedNamespace'];
        this.ignoreBaseNameSpaces = false;
        this.valueKey = '$value';
        this.xmlKey = '$xml';
        var fromFunc;
        this.uri = uri;
        this.callback = function () { };
        this._includesWsdl = [];
        // initialize WSDL cache
        this.WSDL_CACHE = {};
        if (options && options.WSDL_CACHE) {
            this.WSDL_CACHE = options.WSDL_CACHE;
        }
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
        process.nextTick(function () {
            try {
                fromFunc.call(_this, definition);
            }
            catch (e) {
                return _this.callback(e);
            }
            _this.processIncludes(function (err) {
                var name;
                if (err) {
                    return _this.callback(err);
                }
                try {
                    _this.definitions.deleteFixedAttrs();
                    var services = _this.services = _this.definitions.services;
                    if (services) {
                        for (name in services) {
                            services[name].postProcess(_this.definitions);
                        }
                    }
                    var complexTypes = _this.definitions.complexTypes;
                    if (complexTypes) {
                        for (name in complexTypes) {
                            complexTypes[name].deleteFixedAttrs();
                        }
                    }
                    // for document style, for every binding, prepare input message element name to (methodName, output message element name) mapping
                    var bindings = _this.definitions.bindings;
                    for (var bindingName in bindings) {
                        var binding = bindings[bindingName];
                        if (typeof binding.style === 'undefined') {
                            binding.style = 'document';
                        }
                        var methods = binding.methods;
                        var topEls = binding.topElements = {};
                        for (var methodName in methods) {
                            if ((methods[methodName].style || binding.style) !== 'document') {
                                continue;
                            }
                            if (methods[methodName].input) {
                                var inputName = methods[methodName].input.$name;
                                var outputName = '';
                                if (methods[methodName].output) {
                                    outputName = methods[methodName].output.$name;
                                }
                                topEls[inputName] = { methodName: methodName, outputName: outputName };
                            }
                        }
                    }
                    // prepare soap envelope xmlns definition string
                    _this.xmlnsInEnvelope = _this._xmlnsMap();
                    _this.callback(err, _this);
                }
                catch (e) {
                    _this.callback(e);
                }
            });
        });
    }
    WSDL.prototype.onReady = function (callback) {
        if (callback) {
            this.callback = callback;
        }
    };
    WSDL.prototype.processIncludes = function (callback) {
        var schemas = this.definitions.schemas;
        var includes = [];
        for (var ns in schemas) {
            var schema = schemas[ns];
            includes = includes.concat(schema.includes || []);
        }
        this._processNextInclude(includes, callback);
    };
    WSDL.prototype.describeServices = function () {
        var services = {};
        for (var name_1 in this.services) {
            var service = this.services[name_1];
            services[name_1] = service.description(this.definitions);
        }
        return services;
    };
    WSDL.prototype.toXML = function () {
        return this.xml || '';
    };
    WSDL.prototype.getSaxStream = function (xml) {
        var saxStream = sax.createStream(true, null);
        xml.pipe(saxStream);
        return saxStream;
    };
    WSDL.prototype.xmlToObject = function (xml, callback) {
        var _this = this;
        var p = typeof callback === 'function' ? {} : sax.parser(true, null);
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
        var stack = [{ name: null, object: root, schema: schema }];
        var xmlns = {};
        var refs = {};
        var id; // {id:{hrefs:[],obj:}, ...}
        p.onopentag = function (node) {
            var nsName = node.name;
            var attrs = node.attributes;
            var name = utils_1.splitQName(nsName).name;
            var attributeName;
            var top = stack[stack.length - 1];
            var topSchema = top.schema;
            var elementAttributes = {};
            var hasNonXmlnsAttribute = false;
            var hasNilAttribute = false;
            var obj = {};
            var originalName = name;
            if (!objectName && top.name === 'Body' && name !== 'Fault') {
                var message = _this.definitions.messages[name];
                // Support RPC/literal messages where response body contains one element named
                // after the operation + 'Response'. See http://www.w3.org/TR/wsdl#_names
                if (!message) {
                    try {
                        // Determine if this is request or response
                        var isInput = false;
                        var isOutput = false;
                        if ((/Response$/).test(name)) {
                            isOutput = true;
                            name = name.replace(/Response$/, '');
                        }
                        else if ((/Request$/).test(name)) {
                            isInput = true;
                            name = name.replace(/Request$/, '');
                        }
                        else if ((/Solicit$/).test(name)) {
                            isInput = true;
                            name = name.replace(/Solicit$/, '');
                        }
                        // Look up the appropriate message as given in the portType's operations
                        var portTypes = _this.definitions.portTypes;
                        var portTypeNames = Object.keys(portTypes);
                        // Currently this supports only one portType definition.
                        var portType = portTypes[portTypeNames[0]];
                        if (isInput) {
                            name = portType.methods[name].input.$name;
                        }
                        else {
                            name = portType.methods[name].output.$name;
                        }
                        message = _this.definitions.messages[name];
                        // 'cache' this alias to speed future lookups
                        _this.definitions.messages[originalName] = _this.definitions.messages[name];
                    }
                    catch (e) {
                        if (_this.options.returnFault) {
                            p.onerror(e);
                        }
                    }
                }
                topSchema = message.description(_this.definitions);
                objectName = originalName;
            }
            if (attrs.href) {
                id = attrs.href.substr(1);
                if (!refs[id]) {
                    refs[id] = { hrefs: [], obj: null };
                }
                refs[id].hrefs.push({ par: top.object, key: name, obj: obj });
            }
            if (id = attrs.id) {
                if (!refs[id]) {
                    refs[id] = { hrefs: [], obj: null };
                }
            }
            // Handle element attributes
            for (attributeName in attrs) {
                if (/^xmlns:|^xmlns$/.test(attributeName)) {
                    xmlns[utils_1.splitQName(attributeName).name] = attrs[attributeName];
                    continue;
                }
                hasNonXmlnsAttribute = true;
                elementAttributes[attributeName] = attrs[attributeName];
            }
            for (attributeName in elementAttributes) {
                var res = utils_1.splitQName(attributeName);
                if (res.name === 'nil' && xmlns[res.prefix] === XSI_URI && elementAttributes[attributeName] &&
                    (elementAttributes[attributeName].toLowerCase() === 'true' || elementAttributes[attributeName] === '1')) {
                    hasNilAttribute = true;
                    break;
                }
            }
            if (hasNonXmlnsAttribute) {
                obj[_this.options.attributesKey] = elementAttributes;
            }
            // Pick up the schema for the type specified in element's xsi:type attribute.
            var xsiTypeSchema;
            var xsiType;
            for (var prefix in xmlns) {
                if (xmlns[prefix] === XSI_URI && (prefix + ":type" in elementAttributes)) {
                    xsiType = elementAttributes[prefix + ":type"];
                    break;
                }
            }
            if (xsiType) {
                var type = utils_1.splitQName(xsiType);
                var typeURI = void 0;
                if (type.prefix === utils_1.TNS_PREFIX) {
                    // In case of xsi:type = "MyType"
                    typeURI = xmlns[type.prefix] || xmlns.xmlns;
                }
                else {
                    typeURI = xmlns[type.prefix];
                }
                var typeDef = _this.findSchemaObject(typeURI, type.name);
                if (typeDef) {
                    xsiTypeSchema = typeDef.description(_this.definitions);
                }
            }
            if (topSchema && topSchema[name + '[]']) {
                name = name + '[]';
            }
            stack.push({ name: originalName, object: obj, schema: (xsiTypeSchema || (topSchema && topSchema[name])), id: attrs.id, nil: hasNilAttribute });
        };
        p.onclosetag = function (nsName) {
            var cur = stack.pop();
            var obj = cur.object;
            var top = stack[stack.length - 1];
            var topObject = top.object;
            var topSchema = top.schema;
            var name = utils_1.splitQName(nsName).name;
            if (typeof cur.schema === 'string' && (cur.schema === 'string' || cur.schema.split(':')[1] === 'string')) {
                if (typeof obj === 'object' && Object.keys(obj).length === 0) {
                    obj = cur.object = '';
                }
            }
            if (cur.nil === true) {
                if (_this.options.handleNilAsNull) {
                    obj = null;
                }
                else {
                    return;
                }
            }
            if (_.isPlainObject(obj) && !Object.keys(obj).length) {
                obj = null;
            }
            if (topSchema && topSchema[name + '[]']) {
                if (!topObject[name]) {
                    topObject[name] = [];
                }
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
            var originalText = text;
            text = trim(text);
            if (!text.length) {
                return;
            }
            if (/<\?xml[\s\S]+\?>/.test(text)) {
                var top_1 = stack[stack.length - 1];
                var value = _this.xmlToObject(text);
                if (top_1.object[_this.options.attributesKey]) {
                    top_1.object[_this.options.valueKey] = value;
                }
                else {
                    top_1.object = value;
                }
            }
            else {
                p.ontext(originalText);
            }
        };
        p.onerror = function (e) {
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
        p.ontext = function (text) {
            var originalText = text;
            text = trim(text);
            if (!text.length) {
                return;
            }
            var top = stack[stack.length - 1];
            var name = utils_1.splitQName(top.schema).name;
            var value;
            if (_this.options && _this.options.customDeserializer && _this.options.customDeserializer[name]) {
                value = _this.options.customDeserializer[name](text, top);
            }
            else {
                if (name === 'int' || name === 'integer' || name === 'short' || name === 'long') {
                    value = parseInt(text, 10);
                }
                else if (name === 'double' || name === 'float' || name === 'decimal') {
                    value = Number(text);
                }
                else if (name === 'bool' || name === 'boolean') {
                    value = text.toLowerCase() === 'true' || text === '1';
                }
                else if (name === 'dateTime' || name === 'date') {
                    value = new Date(text);
                }
                else {
                    if (_this.options.preserveWhitespace) {
                        text = originalText;
                    }
                    // handle string or other types
                    if (typeof top.object !== 'string') {
                        value = text;
                    }
                    else {
                        value = top.object + text;
                    }
                }
            }
            if (top.object[_this.options.attributesKey]) {
                top.object[_this.options.valueKey] = value;
            }
            else {
                top.object = value;
            }
        };
        if (typeof callback === 'function') {
            // we be streaming
            var saxStream = sax.createStream(true, null);
            saxStream.on('opentag', p.onopentag);
            saxStream.on('closetag', p.onclosetag);
            saxStream.on('cdata', p.oncdata);
            saxStream.on('text', p.ontext);
            xml.pipe(saxStream)
                .on('error', function (err) {
                callback(err);
            })
                .on('end', function () {
                var r;
                try {
                    r = finish();
                }
                catch (e) {
                    return callback(e);
                }
                callback(null, r);
            });
            return;
        }
        p.write(xml).close();
        return finish();
        function finish() {
            // MultiRef support: merge objects instead of replacing
            for (var n in refs) {
                var ref = refs[n];
                for (var _i = 0, _a = ref.hrefs; _i < _a.length; _i++) {
                    var href = _a[_i];
                    Object.assign(href.obj, ref.obj);
                }
            }
            if (root.Envelope) {
                var body = root.Envelope.Body;
                if (body && body.Fault) {
                    var code = body.Fault.faultcode && body.Fault.faultcode.$value;
                    var string = body.Fault.faultstring && body.Fault.faultstring.$value;
                    var detail = body.Fault.detail && body.Fault.detail.$value;
                    code = code || body.Fault.faultcode;
                    string = string || body.Fault.faultstring;
                    detail = detail || body.Fault.detail;
                    var error = new Error(code + ': ' + string + (detail ? ': ' + JSON.stringify(detail) : ''));
                    error.root = root;
                    throw error;
                }
                return root.Envelope;
            }
            return root;
        }
    };
    /**
     * Look up a XSD type or element by namespace URI and name
     * @param {String} nsURI Namespace URI
     * @param {String} qname Local or qualified name
     * @returns {*} The XSD type/element definition
     */
    WSDL.prototype.findSchemaObject = function (nsURI, qname) {
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
    WSDL.prototype.objectToDocumentXML = function (name, params, nsPrefix, nsURI, type) {
        // If user supplies XML already, just use that.  XML Declaration should not be present.
        if (params && params._xml) {
            return params._xml;
        }
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
    WSDL.prototype.objectToRpcXML = function (name, params, nsPrefix, nsURI, isParts) {
        var parts = [];
        var defs = this.definitions;
        var nsAttrName = '_xmlns';
        nsPrefix = nsPrefix || utils_1.findPrefix(defs.xmlns, nsURI);
        nsURI = nsURI || defs.xmlns[nsPrefix];
        nsPrefix = nsPrefix === utils_1.TNS_PREFIX ? '' : (nsPrefix + ':');
        parts.push(['<', nsPrefix, name, '>'].join(''));
        for (var key in params) {
            if (!params.hasOwnProperty(key)) {
                continue;
            }
            if (key !== nsAttrName) {
                var value = params[key];
                var prefixedKey = (isParts ? '' : nsPrefix) + key;
                var attributes = [];
                if (typeof value === 'object' && value.hasOwnProperty(this.options.attributesKey)) {
                    var attrs = value[this.options.attributesKey];
                    for (var n in attrs) {
                        attributes.push(' ' + n + '=' + '"' + attrs[n] + '"');
                    }
                }
                parts.push(['<', prefixedKey].concat(attributes).concat('>').join(''));
                parts.push((typeof value === 'object') ? this.objectToXML(value, key, nsPrefix, nsURI) : utils_1.xmlEscape(value));
                parts.push(['</', prefixedKey, '>'].join(''));
            }
        }
        parts.push(['</', nsPrefix, name, '>'].join(''));
        return parts.join('');
    };
    WSDL.prototype.isIgnoredNameSpace = function (ns) {
        return this.options.ignoredNamespaces.indexOf(ns) > -1;
    };
    WSDL.prototype.filterOutIgnoredNameSpace = function (ns) {
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
    WSDL.prototype.objectToXML = function (obj, name, nsPrefix, nsURI, isFirst, xmlnsAttr, schemaObject, nsContext) {
        var schema = this.definitions.schemas[nsURI];
        var parentNsPrefix = nsPrefix ? nsPrefix.parent : undefined;
        if (typeof parentNsPrefix !== 'undefined') {
            // we got the parentNsPrefix for our array. setting the namespace-variable back to the current namespace string
            nsPrefix = nsPrefix.current;
        }
        parentNsPrefix = noColonNameSpace(parentNsPrefix);
        if (this.isIgnoredNameSpace(parentNsPrefix)) {
            parentNsPrefix = '';
        }
        var soapHeader = !schema;
        var qualified = schema && schema.$elementFormDefault === 'qualified';
        var parts = [];
        var prefixNamespace = (nsPrefix || qualified) && nsPrefix !== utils_1.TNS_PREFIX;
        var xmlnsAttrib = '';
        if (nsURI && isFirst) {
            if (this.options.overrideRootElement && this.options.overrideRootElement.xmlnsAttributes) {
                this.options.overrideRootElement.xmlnsAttributes.forEach(function (attribute) {
                    xmlnsAttrib += ' ' + attribute.name + '="' + attribute.value + '"';
                });
            }
            else {
                if (prefixNamespace && !this.isIgnoredNameSpace(nsPrefix)) {
                    // resolve the prefix namespace
                    xmlnsAttrib += ' xmlns:' + nsPrefix + '="' + nsURI + '"';
                }
                // only add default namespace if the schema elementFormDefault is qualified
                if (qualified || soapHeader) {
                    xmlnsAttrib += ' xmlns="' + nsURI + '"';
                }
            }
        }
        if (!nsContext) {
            nsContext = new nscontext_1.NamespaceContext();
            nsContext.declareNamespace(nsPrefix, nsURI);
        }
        else {
            nsContext.pushContext();
        }
        // explicitly use xmlns attribute if available
        if (xmlnsAttr && !(this.options.overrideRootElement && this.options.overrideRootElement.xmlnsAttributes)) {
            xmlnsAttrib = xmlnsAttr;
        }
        var ns = '';
        if (this.options.overrideRootElement && isFirst) {
            ns = this.options.overrideRootElement.namespace;
        }
        else if (prefixNamespace && (qualified || isFirst || soapHeader) && !this.isIgnoredNameSpace(nsPrefix)) {
            ns = nsPrefix;
        }
        var i;
        var n;
        // start building out XML string.
        if (Array.isArray(obj)) {
            var nonSubNameSpace = '';
            var emptyNonSubNameSpaceForArray = false;
            var nameWithNsRegex = /^([^:]+):([^:]+)$/.exec(name);
            if (nameWithNsRegex) {
                nonSubNameSpace = nameWithNsRegex[1];
                name = nameWithNsRegex[2];
            }
            else if (name[0] === ':') {
                emptyNonSubNameSpaceForArray = true;
                name = name.substr(1);
            }
            for (i = 0, n = obj.length; i < n; i++) {
                var item = obj[i];
                var arrayAttr = this.processAttributes(item, nsContext);
                var correctOuterNsPrefix = nonSubNameSpace || parentNsPrefix || ns; // using the parent namespace prefix if given
                var body = this.objectToXML(item, name, nsPrefix, nsURI, false, null, schemaObject, nsContext);
                var openingTagParts = ['<', name, arrayAttr, xmlnsAttrib];
                if (!emptyNonSubNameSpaceForArray) {
                    openingTagParts = ['<', appendColon(correctOuterNsPrefix), name, arrayAttr, xmlnsAttrib];
                }
                if (body === '' && this.options.useEmptyTag) {
                    // Use empty (self-closing) tags if no contents
                    openingTagParts.push(' />');
                    parts.push(openingTagParts.join(''));
                }
                else {
                    openingTagParts.push('>');
                    if (this.options.namespaceArrayElements || i === 0) {
                        parts.push(openingTagParts.join(''));
                    }
                    parts.push(body);
                    if (this.options.namespaceArrayElements || i === n - 1) {
                        if (emptyNonSubNameSpaceForArray) {
                            parts.push(['</', name, '>'].join(''));
                        }
                        else {
                            parts.push(['</', appendColon(correctOuterNsPrefix), name, '>'].join(''));
                        }
                    }
                }
            }
        }
        else if (typeof obj === 'object') {
            var currentChildXmlnsAttrib = '';
            for (name in obj) {
                // Happens when Object.create(null) is used, it will not inherit the Object prototype
                if (!obj.hasOwnProperty) {
                    obj = Object.assign({}, obj);
                }
                if (!obj.hasOwnProperty(name)) {
                    continue;
                }
                // don't process attributes as element
                if (name === this.options.attributesKey) {
                    continue;
                }
                // Its the value of a xml object. Return it directly.
                if (name === this.options.xmlKey) {
                    nsContext.popContext();
                    return obj[name];
                }
                // Its the value of an item. Return it directly.
                if (name === this.options.valueKey) {
                    nsContext.popContext();
                    return utils_1.xmlEscape(obj[name]);
                }
                var child = obj[name];
                if (typeof child === 'undefined') {
                    continue;
                }
                var attr = this.processAttributes(child, nsContext);
                var value = '';
                var nonSubNameSpace = '';
                var emptyNonSubNameSpace = false;
                var nameWithNsRegex = /^([^:]+):([^:]+)$/.exec(name);
                if (nameWithNsRegex) {
                    nonSubNameSpace = nameWithNsRegex[1] + ':';
                    name = nameWithNsRegex[2];
                }
                else if (name[0] === ':') {
                    emptyNonSubNameSpace = true;
                    name = name.substr(1);
                }
                if (isFirst) {
                    value = this.objectToXML(child, name, nsPrefix, nsURI, false, null, schemaObject, nsContext);
                }
                else {
                    if (this.definitions.schemas) {
                        if (schema) {
                            var childSchemaObject = this.findChildSchemaObject(schemaObject, name);
                            // find sub namespace if not a primitive
                            if (childSchemaObject &&
                                ((childSchemaObject.$type && (childSchemaObject.$type.indexOf('xsd:') === -1)) ||
                                    childSchemaObject.$ref || childSchemaObject.$name)) {
                                /*if the base name space of the children is not in the ingoredSchemaNamspaces we use it.
                                 This is because in some services the child nodes do not need the baseNameSpace.
                                 */
                                var childNsPrefix = '';
                                var childName = '';
                                var childNsURI = void 0;
                                var childXmlnsAttrib = '';
                                var elementQName = childSchemaObject.$ref || childSchemaObject.$name;
                                if (elementQName) {
                                    elementQName = utils_1.splitQName(elementQName);
                                    childName = elementQName.name;
                                    if (elementQName.prefix === utils_1.TNS_PREFIX) {
                                        // Local element
                                        childNsURI = childSchemaObject.$targetNamespace;
                                        childNsPrefix = nsContext.registerNamespace(childNsURI);
                                        if (this.isIgnoredNameSpace(childNsPrefix)) {
                                            childNsPrefix = nsPrefix;
                                        }
                                    }
                                    else {
                                        childNsPrefix = elementQName.prefix;
                                        if (this.isIgnoredNameSpace(childNsPrefix)) {
                                            childNsPrefix = nsPrefix;
                                        }
                                        childNsURI = schema.xmlns[childNsPrefix] || this.definitions.xmlns[childNsPrefix];
                                    }
                                    var unqualified = false;
                                    // Check qualification form for local elements
                                    if (childSchemaObject.$name && childSchemaObject.targetNamespace === undefined) {
                                        if (childSchemaObject.$form === 'unqualified') {
                                            unqualified = true;
                                        }
                                        else if (childSchemaObject.$form === 'qualified') {
                                            unqualified = false;
                                        }
                                        else {
                                            unqualified = schema.$elementFormDefault !== 'qualified';
                                        }
                                    }
                                    if (unqualified) {
                                        childNsPrefix = '';
                                    }
                                    if (childNsURI && childNsPrefix) {
                                        if (nsContext.declareNamespace(childNsPrefix, childNsURI)) {
                                            childXmlnsAttrib = ' xmlns:' + childNsPrefix + '="' + childNsURI + '"';
                                            if (!xmlnsAttrib.includes(childNsPrefix)) {
                                                currentChildXmlnsAttrib = childXmlnsAttrib;
                                                xmlnsAttrib += childXmlnsAttrib;
                                            }
                                        }
                                    }
                                }
                                var resolvedChildSchemaObject = void 0;
                                if (childSchemaObject.$type) {
                                    var typeQName = utils_1.splitQName(childSchemaObject.$type);
                                    var typePrefix = typeQName.prefix;
                                    var typeURI = schema.xmlns[typePrefix] || this.definitions.xmlns[typePrefix];
                                    childNsURI = typeURI;
                                    if (typeURI !== 'http://www.w3.org/2001/XMLSchema' && typePrefix !== utils_1.TNS_PREFIX) {
                                        // Add the prefix/namespace mapping, but not declare it
                                        nsContext.addNamespace(typePrefix, typeURI);
                                    }
                                    resolvedChildSchemaObject =
                                        this.findSchemaType(typeQName.name, typeURI) || childSchemaObject;
                                }
                                else {
                                    resolvedChildSchemaObject =
                                        this.findSchemaObject(childNsURI, childName) || childSchemaObject;
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
                                    // for arrays, we need to remember the current namespace
                                    childNsPrefix = {
                                        current: childNsPrefix,
                                        parent: ns
                                    };
                                    childXmlnsAttrib = childXmlnsAttrib && childXmlnsAttrib.length ? childXmlnsAttrib : currentChildXmlnsAttrib;
                                }
                                else {
                                    // parent (array) already got the namespace
                                    childXmlnsAttrib = null;
                                }
                                value = this.objectToXML(child, name, childNsPrefix, childNsURI, false, childXmlnsAttrib, resolvedChildSchemaObject, nsContext);
                            }
                            else if (obj[this.options.attributesKey] && obj[this.options.attributesKey].xsi_type) {
                                // if parent object has complex type defined and child not found in parent
                                var completeChildParamTypeObject = this.findChildSchemaObject(obj[this.options.attributesKey].xsi_type.type, obj[this.options.attributesKey].xsi_type.xmlns);
                                nonSubNameSpace = obj[this.options.attributesKey].xsi_type.prefix;
                                nsContext.addNamespace(obj[this.options.attributesKey].xsi_type.prefix, obj[this.options.attributesKey].xsi_type.xmlns);
                                value = this.objectToXML(child, name, obj[this.options.attributesKey].xsi_type.prefix, obj[this.options.attributesKey].xsi_type.xmlns, false, null, null, nsContext);
                            }
                            else {
                                if (Array.isArray(child)) {
                                    if (emptyNonSubNameSpace) {
                                        name = ':' + name;
                                    }
                                    else {
                                        name = nonSubNameSpace + name;
                                    }
                                }
                                value = this.objectToXML(child, name, nsPrefix, nsURI, false, null, null, nsContext);
                            }
                        }
                        else {
                            value = this.objectToXML(child, name, nsPrefix, nsURI, false, null, null, nsContext);
                        }
                    }
                }
                ns = noColonNameSpace(ns);
                if (prefixNamespace && !qualified && isFirst && !this.options.overrideRootElement) {
                    ns = nsPrefix;
                }
                else if (this.isIgnoredNameSpace(ns)) {
                    ns = '';
                }
                var useEmptyTag = !value && this.options.useEmptyTag;
                if (!Array.isArray(child)) {
                    // start tag
                    parts.push(['<', emptyNonSubNameSpace ? '' : appendColon(nonSubNameSpace || ns), name, attr, xmlnsAttrib,
                        (child === null ? ' xsi:nil="true"' : ''),
                        useEmptyTag ? ' />' : '>',
                    ].join(''));
                }
                if (!useEmptyTag) {
                    parts.push(value);
                    if (!Array.isArray(child)) {
                        // end tag
                        parts.push(['</', emptyNonSubNameSpace ? '' : appendColon(nonSubNameSpace || ns), name, '>'].join(''));
                    }
                }
            }
        }
        else if (obj !== undefined) {
            parts.push((this.options.escapeXML) ? utils_1.xmlEscape(obj) : obj);
        }
        nsContext.popContext();
        return parts.join('');
    };
    WSDL.prototype.processAttributes = function (child, nsContext) {
        var attr = '';
        if (child === null || child === undefined) {
            child = [];
        }
        var attrObj = child[this.options.attributesKey] || {};
        if (attrObj && attrObj.xsi_type) {
            var xsiType = attrObj.xsi_type;
            var prefix = xsiType.prefix || xsiType.namespace;
            if (xsiType.xmlns) {
                // Generate a new namespace for complex extension if one not provided
                if (!prefix) {
                    prefix = nsContext.registerNamespace(xsiType.xmlns);
                }
                else {
                    nsContext.declareNamespace(prefix, xsiType.xmlns);
                }
                xsiType.prefix = prefix;
            }
        }
        Object.keys(attrObj).forEach(function (k) {
            var v = attrObj[k];
            if (k === 'xsi_type') {
                var name_2 = v.type;
                if (v.prefix) {
                    name_2 = v.prefix + ":" + name_2;
                }
                attr += " xsi:type=\"" + name_2 + "\"";
                if (v.xmlns) {
                    attr += " xmlns:" + v.prefix + "=\"" + v.xmlns + "\"";
                }
            }
            else {
                attr += " " + k + "=\"" + utils_1.xmlEscape(v) + "\"";
            }
        });
        return attr;
    };
    /**
     * Look up a schema type definition
     * @param name
     * @param nsURI
     * @returns {*}
     */
    WSDL.prototype.findSchemaType = function (name, nsURI) {
        if (!this.definitions.schemas || !name || !nsURI) {
            return null;
        }
        var schema = this.definitions.schemas[nsURI];
        if (!schema || !schema.complexTypes) {
            return null;
        }
        return schema.complexTypes[name];
    };
    WSDL.prototype.findChildSchemaObject = function (parameterTypeObj, childName, backtrace) {
        if (!parameterTypeObj || !childName) {
            return null;
        }
        if (!backtrace) {
            backtrace = [];
        }
        if (backtrace.indexOf(parameterTypeObj) >= 0) {
            // We've recursed back to ourselves; break.
            return null;
        }
        else {
            backtrace = backtrace.concat([parameterTypeObj]);
        }
        var found = null;
        var i = 0;
        var child;
        var ref;
        if (Array.isArray(parameterTypeObj.$lookupTypes) && parameterTypeObj.$lookupTypes.length) {
            var types = parameterTypeObj.$lookupTypes;
            for (i = 0; i < types.length; i++) {
                var typeObj = types[i];
                if (typeObj.$name === childName) {
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
            ref = utils_1.splitQName(object.$ref);
            if (ref.name === childName) {
                return object;
            }
        }
        var childNsURI;
        // want to avoid unecessary recursion to improve performance
        if (object.$type && backtrace.length === 1) {
            var typeInfo = utils_1.splitQName(object.$type);
            if (typeInfo.prefix === utils_1.TNS_PREFIX) {
                childNsURI = parameterTypeObj.$targetNamespace;
            }
            else {
                childNsURI = this.definitions.xmlns[typeInfo.prefix];
            }
            var typeDef = this.findSchemaType(typeInfo.name, childNsURI);
            if (typeDef) {
                return this.findChildSchemaObject(typeDef, childName, backtrace);
            }
        }
        // handle $base (e.g. for ExtensionElement) like $type
        if (object.$base && (!Array.isArray(object.children) || !object.children.length)) {
            var baseInfo = utils_1.splitQName(object.$base);
            childNsURI = parameterTypeObj.$targetNamespace;
            if (baseInfo.prefix !== utils_1.TNS_PREFIX) {
                childNsURI = this.definitions.xmlns[baseInfo.prefix];
            }
            var baseDef = this.findSchemaType(baseInfo.name, childNsURI);
            if (baseDef) {
                return this.findChildSchemaObject(baseDef, childName, backtrace);
            }
        }
        if (Array.isArray(object.children) && object.children.length > 0) {
            for (i = 0, child; child = object.children[i]; i++) {
                found = this.findChildSchemaObject(child, childName, backtrace);
                if (found) {
                    break;
                }
                if (child.$base) {
                    var baseQName = utils_1.splitQName(child.$base);
                    var childNameSpace = baseQName.prefix === utils_1.TNS_PREFIX ? '' : baseQName.prefix;
                    childNsURI = child.xmlns[baseQName.prefix] || child.schemaXmlns[baseQName.prefix];
                    var foundBase = this.findSchemaType(baseQName.name, childNsURI);
                    if (foundBase) {
                        found = this.findChildSchemaObject(foundBase, childName, backtrace);
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
    WSDL.prototype._initializeOptions = function (options) {
        this._originalIgnoredNamespaces = (options || {}).ignoredNamespaces;
        this.options = {};
        var ignoredNamespaces = options ? options.ignoredNamespaces : null;
        if (ignoredNamespaces &&
            (Array.isArray(ignoredNamespaces.namespaces) || typeof ignoredNamespaces.namespaces === 'string')) {
            if (ignoredNamespaces.override) {
                this.options.ignoredNamespaces = ignoredNamespaces.namespaces;
            }
            else {
                this.options.ignoredNamespaces = this.ignoredNamespaces.concat(ignoredNamespaces.namespaces);
            }
        }
        else {
            this.options.ignoredNamespaces = this.ignoredNamespaces;
        }
        this.options.valueKey = options.valueKey || this.valueKey;
        this.options.xmlKey = options.xmlKey || this.xmlKey;
        if (options.escapeXML !== undefined) {
            this.options.escapeXML = options.escapeXML;
        }
        else {
            this.options.escapeXML = true;
        }
        if (options.returnFault !== undefined) {
            this.options.returnFault = options.returnFault;
        }
        else {
            this.options.returnFault = false;
        }
        this.options.handleNilAsNull = !!options.handleNilAsNull;
        if (options.namespaceArrayElements !== undefined) {
            this.options.namespaceArrayElements = options.namespaceArrayElements;
        }
        else {
            this.options.namespaceArrayElements = true;
        }
        // Allow any request headers to keep passing through
        this.options.wsdl_headers = options.wsdl_headers;
        this.options.wsdl_options = options.wsdl_options;
        if (options.httpClient) {
            this.options.httpClient = options.httpClient;
        }
        // The supplied request-object should be passed through
        if (options.request) {
            this.options.request = options.request;
        }
        var ignoreBaseNameSpaces = options ? options.ignoreBaseNameSpaces : null;
        if (ignoreBaseNameSpaces !== null && typeof ignoreBaseNameSpaces !== 'undefined') {
            this.options.ignoreBaseNameSpaces = ignoreBaseNameSpaces;
        }
        else {
            this.options.ignoreBaseNameSpaces = this.ignoreBaseNameSpaces;
        }
        // Works only in client
        this.options.forceSoap12Headers = options.forceSoap12Headers;
        this.options.customDeserializer = options.customDeserializer;
        if (options.overrideRootElement !== undefined) {
            this.options.overrideRootElement = options.overrideRootElement;
        }
        this.options.useEmptyTag = !!options.useEmptyTag;
    };
    WSDL.prototype._processNextInclude = function (includes, callback) {
        var _this = this;
        var include = includes.shift();
        if (!include) {
            return callback();
        }
        var includePath;
        if (!/^https?:/i.test(this.uri) && !/^https?:/i.test(include.location)) {
            var isFixed = (this.options.wsdl_options !== undefined && this.options.wsdl_options.hasOwnProperty('fixedPath')) ? this.options.wsdl_options.fixedPath : false;
            if (isFixed) {
                includePath = path.resolve(path.dirname(this.uri), path.parse(include.location).base);
            }
            else {
                includePath = path.resolve(path.dirname(this.uri), include.location);
            }
        }
        else {
            includePath = url.resolve(this.uri || '', include.location);
        }
        if (this.options.wsdl_options !== undefined && typeof this.options.wsdl_options.overrideImportLocation === 'function') {
            includePath = this.options.wsdl_options.overrideImportLocation(includePath);
        }
        var options = Object.assign({}, this.options);
        // follow supplied ignoredNamespaces option
        options.ignoredNamespaces = this._originalIgnoredNamespaces || this.options.ignoredNamespaces;
        options.WSDL_CACHE = this.WSDL_CACHE;
        open_wsdl_recursive(includePath, options, function (err, wsdl) {
            if (err) {
                return callback(err);
            }
            _this._includesWsdl.push(wsdl);
            if (wsdl.definitions instanceof elements.DefinitionsElement) {
                _.mergeWith(_this.definitions, wsdl.definitions, function (a, b) {
                    return (a instanceof elements.SchemaElement) ? a.merge(b) : undefined;
                });
            }
            else {
                return callback(new Error('wsdl.defintions is not an instance of elements.DefinitionsElement'));
            }
            _this._processNextInclude(includes, function (err) {
                callback(err);
            });
        });
    };
    WSDL.prototype._parse = function (xml) {
        var _this = this;
        var p = sax.parser(true, null);
        var stack = [];
        var root = null;
        var types = null;
        var schema = null;
        var schemaAttrs = null;
        var options = this.options;
        p.onopentag = function (node) {
            var nsName = node.name;
            var attrs = node.attributes;
            var top = stack[stack.length - 1];
            var name = utils_1.splitQName(nsName).name;
            if (name === 'schema') {
                schemaAttrs = attrs;
            }
            if (top) {
                try {
                    top.startElement(stack, nsName, attrs, options, schemaAttrs);
                }
                catch (e) {
                    if (_this.options.strict) {
                        throw e;
                    }
                    else {
                        stack.push(new elements.Element(nsName, attrs, options, schemaAttrs));
                    }
                }
            }
            else {
                if (name === 'definitions') {
                    root = new elements.DefinitionsElement(nsName, attrs, options);
                    stack.push(root);
                }
                else if (name === 'schema') {
                    // Shim a structure in here to allow the proper objects to be created when merging back.
                    root = new elements.DefinitionsElement('definitions', {}, {});
                    types = new elements.TypesElement('types', {}, {});
                    schema = new elements.SchemaElement(nsName, attrs, options);
                    types.addChild(schema);
                    root.addChild(types);
                    stack.push(schema);
                }
                else {
                    throw new Error('Unexpected root element of WSDL or include');
                }
            }
        };
        p.onclosetag = function (name) {
            var top = stack[stack.length - 1];
            assert_1.ok(top, 'Unmatched close tag: ' + name);
            top.endElement(stack, name);
        };
        p.write(xml).close();
        return root;
    };
    WSDL.prototype._fromXML = function (xml) {
        this.definitions = this._parse(xml);
        this.definitions.descriptions = {
            types: {},
            elements: {}
        };
        this.xml = xml;
    };
    WSDL.prototype._fromServices = function (services) {
    };
    WSDL.prototype._xmlnsMap = function () {
        var xmlns = this.definitions.xmlns;
        var str = '';
        for (var alias in xmlns) {
            if (alias === '' || alias === utils_1.TNS_PREFIX) {
                continue;
            }
            var ns = xmlns[alias];
            switch (ns) {
                case 'http://xml.apache.org/xml-soap': // apachesoap
                case 'http://schemas.xmlsoap.org/wsdl/': // wsdl
                case 'http://schemas.xmlsoap.org/wsdl/soap/': // wsdlsoap
                case 'http://schemas.xmlsoap.org/wsdl/soap12/': // wsdlsoap12
                case 'http://schemas.xmlsoap.org/soap/encoding/': // soapenc
                case 'http://www.w3.org/2001/XMLSchema': // xsd
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
    return WSDL;
}());
exports.WSDL = WSDL;
function open_wsdl_recursive(uri, p2, p3) {
    var fromCache;
    var WSDL_CACHE;
    var options;
    var callback;
    if (typeof p2 === 'function') {
        options = {};
        callback = p2;
    }
    else {
        options = p2;
        callback = p3;
    }
    WSDL_CACHE = options.WSDL_CACHE;
    if (fromCache = WSDL_CACHE[uri]) {
        return callback.call(fromCache, null, fromCache);
    }
    return open_wsdl(uri, options, callback);
}
function open_wsdl(uri, p2, p3) {
    var options;
    var callback;
    if (typeof p2 === 'function') {
        options = {};
        callback = p2;
    }
    else if (typeof p3 === 'function') {
        options = p2;
        callback = p3;
    }
    // initialize cache when calling open_wsdl directly
    var WSDL_CACHE = options.WSDL_CACHE || {};
    var request_headers = options.wsdl_headers;
    var request_options = options.wsdl_options;
    var wsdl;
    if (!/^https?:/i.test(uri)) {
        debug('Reading file: %s', uri);
        fs.readFile(uri, 'utf8', function (err, definition) {
            if (err) {
                callback(err);
            }
            else {
                wsdl = new WSDL(definition, uri, options);
                WSDL_CACHE[uri] = wsdl;
                wsdl.WSDL_CACHE = WSDL_CACHE;
                wsdl.onReady(callback);
            }
        });
    }
    else {
        debug('Reading url: %s', uri);
        var httpClient = options.httpClient || new http_1.HttpClient(options);
        httpClient.request(uri, null /* options */, function (err, response, definition) {
            if (err) {
                callback(err);
            }
            else if (response && response.status === 200) {
                wsdl = new WSDL(definition, uri, options);
                WSDL_CACHE[uri] = wsdl;
                wsdl.WSDL_CACHE = WSDL_CACHE;
                wsdl.onReady(callback);
            }
            else {
                callback(new Error('Invalid WSDL URL: ' + uri + '\n\n\r Code: ' + response.status + '\n\n\r Response Body: ' + response.data));
            }
        }, request_headers, request_options);
    }
    return wsdl;
}
exports.open_wsdl = open_wsdl;
//# sourceMappingURL=index.js.map