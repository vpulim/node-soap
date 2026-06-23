"use strict";
/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 *
 */
/*jshint proto:true*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.open_wsdl = exports.WSDL = exports.trim = void 0;
const assert_1 = require("assert");
const debug_1 = require("debug");
const fs = require("fs");
const _ = require("lodash");
const path = require("path");
const sax = require("sax");
const stripBom = require("strip-bom");
const url = require("url");
const http_1 = require("../http");
const nscontext_1 = require("../nscontext");
const utils_1 = require("../utils");
const elements = require("./elements");
const debug = (0, debug_1.default)('node-soap');
const XSI_URI = 'http://www.w3.org/2001/XMLSchema-instance';
function trim(text) {
    return text.trim();
}
exports.trim = trim;
function deepMerge(destination, source) {
    return _.mergeWith(destination, source, (a, b) => {
        return Array.isArray(a) ? a.concat(b) : undefined;
    });
}
function appendColon(ns) {
    return (ns && ns.charAt(ns.length - 1) !== ':') ? ns + ':' : ns;
}
function noColonNameSpace(ns) {
    return (ns && ns.charAt(ns.length - 1) === ':') ? ns.substring(0, ns.length - 1) : ns;
}
class WSDL {
    constructor(definition, uri, options) {
        this.ignoredNamespaces = ['tns', 'targetNamespace', 'typedNamespace'];
        this.ignoreBaseNameSpaces = false;
        this.valueKey = '$value';
        this.xmlKey = '$xml';
        let fromFunc;
        this.uri = uri;
        this.callback = () => { };
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
        process.nextTick(() => {
            try {
                fromFunc.call(this, definition);
            }
            catch (e) {
                return this.callback(e);
            }
            this.processIncludes((err) => {
                let name;
                if (err) {
                    return this.callback(err);
                }
                try {
                    this.definitions.deleteFixedAttrs();
                    const services = this.services = this.definitions.services;
                    if (services) {
                        for (name in services) {
                            services[name].postProcess(this.definitions);
                        }
                    }
                    const complexTypes = this.definitions.complexTypes;
                    if (complexTypes) {
                        for (name in complexTypes) {
                            complexTypes[name].deleteFixedAttrs();
                        }
                    }
                    // for document style, for every binding, prepare input message element name to (methodName, output message element name) mapping
                    const bindings = this.definitions.bindings;
                    for (const bindingName in bindings) {
                        const binding = bindings[bindingName];
                        if (typeof binding.style === 'undefined') {
                            binding.style = 'document';
                        }
                        const methods = binding.methods;
                        const topEls = binding.topElements = {};
                        for (const methodName in methods) {
                            if ((methods[methodName].style || binding.style) !== 'document') {
                                continue;
                            }
                            if (methods[methodName].input) {
                                const inputName = methods[methodName].input.$name;
                                let outputName = '';
                                if (methods[methodName].output) {
                                    outputName = methods[methodName].output.$name;
                                }
                                topEls[inputName] = { methodName: methodName, outputName: outputName };
                            }
                        }
                    }
                    // prepare soap envelope xmlns definition string
                    this.xmlnsInEnvelope = this._xmlnsMap();
                    this.callback(err, this);
                }
                catch (e) {
                    this.callback(e);
                }
            });
        });
    }
    onReady(callback) {
        if (callback) {
            this.callback = callback;
        }
    }
    processIncludes(callback) {
        const schemas = this.definitions.schemas;
        let includes = [];
        for (const ns in schemas) {
            const schema = schemas[ns];
            includes = includes.concat(schema.includes || []);
        }
        this._processNextInclude(includes, callback);
    }
    describeServices() {
        const services = {};
        for (const name in this.services) {
            const service = this.services[name];
            services[name] = service.description(this.definitions);
        }
        return services;
    }
    toXML() {
        return this.xml || '';
    }
    getSaxStream(xml) {
        const saxStream = sax.createStream(true, null);
        xml.pipe(saxStream);
        return saxStream;
    }
    xmlToObject(xml, callback) {
        const p = typeof callback === 'function' ? {} : sax.parser(true, null);
        let objectName = null;
        const root = {};
        const schema = {
            Envelope: {
                Header: {
                    Security: {
                        UsernameToken: {
                            Username: 'string',
                            Password: 'string',
                        },
                    },
                },
                Body: {
                    Fault: {
                        faultcode: 'string',
                        faultstring: 'string',
                        detail: 'string',
                    },
                },
            },
        };
        const stack = [{ name: null, object: root, schema: schema }];
        const xmlns = {};
        const refs = {};
        let id; // {id:{hrefs:[],obj:}, ...}
        p.onopentag = (node) => {
            const nsName = node.name;
            const attrs = node.attributes;
            let name = (0, utils_1.splitQName)(nsName).name;
            let attributeName;
            const top = stack[stack.length - 1];
            let topSchema = top.schema;
            const elementAttributes = {};
            let hasNonXmlnsAttribute = false;
            let hasNilAttribute = false;
            const obj = {};
            const originalName = name;
            if (!objectName && top.name === 'Body' && name !== 'Fault') {
                let message = this.definitions.messages[name];
                // Support RPC/literal messages where response body contains one element named
                // after the operation + 'Response'. See http://www.w3.org/TR/wsdl#_names
                if (!message) {
                    try {
                        // Determine if this is request or response
                        let isInput = false;
                        let isOutput = false;
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
                        const portTypes = this.definitions.portTypes;
                        const portTypeNames = Object.keys(portTypes);
                        // Currently this supports only one portType definition.
                        const portType = portTypes[portTypeNames[0]];
                        if (isInput) {
                            name = portType.methods[name].input.$name;
                        }
                        else {
                            name = portType.methods[name].output.$name;
                        }
                        message = this.definitions.messages[name];
                        // 'cache' this alias to speed future lookups
                        this.definitions.messages[originalName] = this.definitions.messages[name];
                    }
                    catch (e) {
                        if (this.options.returnFault) {
                            p.onerror(e);
                        }
                    }
                }
                topSchema = message.description(this.definitions);
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
                    xmlns[(0, utils_1.splitQName)(attributeName).name] = attrs[attributeName];
                    continue;
                }
                hasNonXmlnsAttribute = true;
                elementAttributes[attributeName] = attrs[attributeName];
            }
            for (attributeName in elementAttributes) {
                const res = (0, utils_1.splitQName)(attributeName);
                if (res.name === 'nil' && xmlns[res.prefix] === XSI_URI && elementAttributes[attributeName] &&
                    (elementAttributes[attributeName].toLowerCase() === 'true' || elementAttributes[attributeName] === '1')) {
                    hasNilAttribute = true;
                    break;
                }
            }
            if (hasNonXmlnsAttribute) {
                obj[this.options.attributesKey] = elementAttributes;
            }
            // Pick up the schema for the type specified in element's xsi:type attribute.
            let xsiTypeSchema;
            let xsiType;
            for (const prefix in xmlns) {
                if (xmlns[prefix] === XSI_URI && (`${prefix}:type` in elementAttributes)) {
                    xsiType = elementAttributes[`${prefix}:type`];
                    break;
                }
            }
            if (xsiType) {
                const type = (0, utils_1.splitQName)(xsiType);
                let typeURI;
                if (type.prefix === utils_1.TNS_PREFIX) {
                    // In case of xsi:type = "MyType"
                    typeURI = xmlns[type.prefix] || xmlns.xmlns;
                }
                else {
                    typeURI = xmlns[type.prefix];
                }
                const typeDef = this.findSchemaObject(typeURI, type.name);
                if (typeDef) {
                    xsiTypeSchema = typeDef.description(this.definitions);
                }
            }
            if (topSchema && topSchema[name + '[]']) {
                name = name + '[]';
            }
            stack.push({ name: originalName, object: obj, schema: (xsiTypeSchema || (topSchema && topSchema[name])), id: attrs.id, nil: hasNilAttribute });
        };
        p.onclosetag = (nsName) => {
            const cur = stack.pop();
            let obj = cur.object;
            const top = stack[stack.length - 1];
            const topObject = top.object;
            const topSchema = top.schema;
            const name = (0, utils_1.splitQName)(nsName).name;
            if (typeof cur.schema === 'string' && (cur.schema === 'string' || cur.schema.split(':')[1] === 'string')) {
                if (typeof obj === 'object' && Object.keys(obj).length === 0) {
                    obj = cur.object = (this.options.preserveWhitespace ? cur.text || '' : '');
                }
            }
            if (cur.nil === true) {
                if (this.options.handleNilAsNull) {
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
        p.oncdata = (text) => {
            const originalText = text;
            text = trim(text);
            if (!text.length) {
                return;
            }
            if (/<\?xml[\s\S]+\?>/.test(text)) {
                const top = stack[stack.length - 1];
                const value = this.xmlToObject(text);
                if (top.object[this.options.attributesKey]) {
                    top.object[this.options.valueKey] = value;
                }
                else {
                    top.object = value;
                }
            }
            else {
                p.ontext(originalText);
            }
        };
        p.onerror = (e) => {
            p.resume();
            throw {
                Fault: {
                    faultcode: 500,
                    faultstring: 'Invalid XML',
                    detail: new Error(e).message,
                    statusCode: 500,
                },
            };
        };
        p.ontext = (text) => {
            const top = stack[stack.length - 1];
            const originalText = text;
            text = trim(text);
            if (!text.length) {
                if (this.options.preserveWhitespace) {
                    top.text = (top.text || '') + originalText;
                }
                return;
            }
            const name = (0, utils_1.splitQName)(top.schema).name;
            let value;
            if (this.options && this.options.customDeserializer && this.options.customDeserializer[name]) {
                value = this.options.customDeserializer[name](text, top);
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
                    if (this.options.preserveWhitespace) {
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
            if (top.object[this.options.attributesKey]) {
                top.object[this.options.valueKey] = value;
            }
            else {
                top.object = value;
            }
        };
        if (typeof callback === 'function') {
            // we be streaming
            const saxStream = sax.createStream(true, null);
            saxStream.on('opentag', p.onopentag);
            saxStream.on('closetag', p.onclosetag);
            saxStream.on('cdata', p.oncdata);
            saxStream.on('text', p.ontext);
            xml.pipe(saxStream)
                .on('error', (err) => {
                callback(err);
            })
                .on('end', () => {
                let r;
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
            for (const n in refs) {
                const ref = refs[n];
                for (const href of ref.hrefs) {
                    Object.assign(href.obj, ref.obj);
                }
            }
            if (root.Envelope) {
                const body = root.Envelope.Body;
                if (body && body.Fault) {
                    const fault = body.Fault;
                    let code = fault.faultcode && fault.faultcode.$value;
                    let string = fault.faultstring && fault.faultstring.$value;
                    let detail = fault.detail && fault.detail.$value;
                    code = code || fault.faultcode;
                    string = string || fault.faultstring;
                    detail = detail || fault.detail;
                    // SOAP 1.2
                    code = code || fault.Code && `${fault.Code.Value}: ${fault.Code.Subcode && fault.Code.Subcode.Value}`;
                    string = string || fault.Reason && fault.Reason.Text.$value;
                    string = string || fault.Reason && fault.Reason.Text;
                    detail = detail || fault.Detail;
                    const error = new Error(code + ': ' + string + (detail ? ': ' + JSON.stringify(detail) : ''));
                    error.root = root;
                    throw error;
                }
                return root.Envelope;
            }
            return root;
        }
    }
    /**
     * Look up a XSD type or element by namespace URI and name
     * @param {String} nsURI Namespace URI
     * @param {String} qname Local or qualified name
     * @returns {*} The XSD type/element definition
     */
    findSchemaObject(nsURI, qname) {
        if (!nsURI || !qname) {
            return null;
        }
        let def = null;
        if (this.definitions.schemas) {
            const schema = this.definitions.schemas[nsURI];
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
    }
    /**
     * Create document style xml string from the parameters
     * @param {String} name
     * @param {*} params
     * @param {String} nsPrefix
     * @param {String} nsURI
     * @param {String} type
     */
    objectToDocumentXML(name, params, nsPrefix, nsURI, type) {
        // If user supplies XML already, just use that.  XML Declaration should not be present.
        if (params && params._xml) {
            return params._xml;
        }
        const args = {};
        args[name] = params;
        const parameterTypeObj = type ? this.findSchemaObject(nsURI, type) : null;
        return this.objectToXML(args, null, nsPrefix, nsURI, true, null, parameterTypeObj);
    }
    /**
     * Create RPC style xml string from the parameters
     * @param {String} name
     * @param {*} params
     * @param {String} nsPrefix
     * @param {String} nsURI
     * @returns {string}
     */
    objectToRpcXML(name, params, nsPrefix, nsURI, isParts) {
        const parts = [];
        const defs = this.definitions;
        const nsAttrName = '_xmlns';
        nsPrefix = nsPrefix || (0, utils_1.findPrefix)(defs.xmlns, nsURI);
        nsURI = nsURI || defs.xmlns[nsPrefix];
        nsPrefix = nsPrefix === utils_1.TNS_PREFIX ? '' : (nsPrefix + ':');
        parts.push(['<', nsPrefix, name, '>'].join(''));
        for (const key in params) {
            if (!params.hasOwnProperty(key)) {
                continue;
            }
            if (key !== nsAttrName) {
                const value = params[key];
                const prefixedKey = (isParts ? '' : nsPrefix) + key;
                const attributes = [];
                if (typeof value === 'object' && value.hasOwnProperty(this.options.attributesKey)) {
                    const attrs = value[this.options.attributesKey];
                    for (const n in attrs) {
                        attributes.push(' ' + n + '=' + '"' + attrs[n] + '"');
                    }
                }
                parts.push(['<', prefixedKey].concat(attributes).concat('>').join(''));
                parts.push((typeof value === 'object') ? this.objectToXML(value, key, nsPrefix, nsURI) : (0, utils_1.xmlEscape)(value));
                parts.push(['</', prefixedKey, '>'].join(''));
            }
        }
        parts.push(['</', nsPrefix, name, '>'].join(''));
        return parts.join('');
    }
    isIgnoredNameSpace(ns) {
        return this.options.ignoredNamespaces.indexOf(ns) > -1;
    }
    filterOutIgnoredNameSpace(ns) {
        const namespace = noColonNameSpace(ns);
        return this.isIgnoredNameSpace(namespace) ? '' : namespace;
    }
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
    objectToXML(obj, name, nsPrefix, nsURI, isFirst, xmlnsAttr, schemaObject, nsContext) {
        const schema = this.definitions.schemas[nsURI];
        let parentNsPrefix = nsPrefix ? nsPrefix.parent : undefined;
        if (typeof parentNsPrefix !== 'undefined') {
            // we got the parentNsPrefix for our array. setting the namespace-variable back to the current namespace string
            nsPrefix = nsPrefix.current;
        }
        parentNsPrefix = noColonNameSpace(parentNsPrefix);
        if (this.isIgnoredNameSpace(parentNsPrefix)) {
            parentNsPrefix = '';
        }
        const soapHeader = !schema;
        const qualified = schema && schema.$elementFormDefault === 'qualified';
        const parts = [];
        const prefixNamespace = (nsPrefix || qualified) && nsPrefix !== utils_1.TNS_PREFIX;
        let xmlnsAttrib = '';
        if (nsURI && isFirst) {
            if (this.options.overrideRootElement && this.options.overrideRootElement.xmlnsAttributes) {
                this.options.overrideRootElement.xmlnsAttributes.forEach((attribute) => {
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
        let ns = '';
        if (this.options.overrideRootElement && isFirst) {
            ns = this.options.overrideRootElement.namespace;
        }
        else if (prefixNamespace && (qualified || isFirst || soapHeader) && !this.isIgnoredNameSpace(nsPrefix)) {
            ns = nsPrefix;
        }
        let i;
        let n;
        // start building out XML string.
        if (Array.isArray(obj)) {
            let nonSubNameSpace = '';
            let emptyNonSubNameSpaceForArray = false;
            const nameWithNsRegex = /^([^:]+):([^:]+)$/.exec(name);
            if (nameWithNsRegex) {
                nonSubNameSpace = nameWithNsRegex[1];
                name = nameWithNsRegex[2];
            }
            else if (name[0] === ':') {
                emptyNonSubNameSpaceForArray = true;
                name = name.substr(1);
            }
            for (i = 0, n = obj.length; i < n; i++) {
                const item = obj[i];
                const arrayAttr = this.processAttributes(item, nsContext);
                const correctOuterNsPrefix = nonSubNameSpace || parentNsPrefix || ns; // using the parent namespace prefix if given
                const body = this.objectToXML(item, name, nsPrefix, nsURI, false, null, schemaObject, nsContext);
                let openingTagParts = ['<', name, arrayAttr, xmlnsAttrib];
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
            let currentChildXmlnsAttrib = '';
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
                    return (0, utils_1.xmlEscape)(obj[name]);
                }
                const child = obj[name];
                if (typeof child === 'undefined') {
                    continue;
                }
                const attr = this.processAttributes(child, nsContext);
                let value = '';
                let nonSubNameSpace = '';
                let emptyNonSubNameSpace = false;
                const nameWithNsRegex = /^([^:]+):([^:]+)$/.exec(name);
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
                            const childSchemaObject = this.findChildSchemaObject(schemaObject, name);
                            // find sub namespace if not a primitive
                            if (childSchemaObject &&
                                ((childSchemaObject.$type && (childSchemaObject.$type.indexOf('xsd:') === -1)) ||
                                    childSchemaObject.$ref || childSchemaObject.$name)) {
                                /*if the base name space of the children is not in the ingoredSchemaNamspaces we use it.
                                 This is because in some services the child nodes do not need the baseNameSpace.
                                 */
                                let childNsPrefix = '';
                                let childName = '';
                                let childNsURI;
                                let childXmlnsAttrib = '';
                                let elementQName = childSchemaObject.$ref || childSchemaObject.$name;
                                if (elementQName) {
                                    elementQName = (0, utils_1.splitQName)(elementQName);
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
                                    let unqualified = false;
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
                                let resolvedChildSchemaObject;
                                if (childSchemaObject.$type) {
                                    const typeQName = (0, utils_1.splitQName)(childSchemaObject.$type);
                                    const typePrefix = childSchemaObject.$baseNameSpace || typeQName.prefix;
                                    const typeURI = schema.xmlns[typePrefix] || this.definitions.xmlns[typePrefix];
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
                                        parent: ns,
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
                                const completeChildParamTypeObject = this.findChildSchemaObject(obj[this.options.attributesKey].xsi_type.type, obj[this.options.attributesKey].xsi_type.xmlns);
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
                const useEmptyTag = !value && this.options.useEmptyTag;
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
            parts.push((this.options.escapeXML) ? (0, utils_1.xmlEscape)(obj) : obj);
        }
        nsContext.popContext();
        return parts.join('');
    }
    processAttributes(child, nsContext) {
        let attr = '';
        if (child === null || child === undefined) {
            child = [];
        }
        const attrObj = child[this.options.attributesKey] || {};
        if (attrObj && attrObj.xsi_type) {
            const xsiType = attrObj.xsi_type;
            let prefix = xsiType.prefix || xsiType.namespace;
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
        Object.keys(attrObj).forEach((k) => {
            const v = attrObj[k];
            if (k === 'xsi_type') {
                let name = v.type;
                if (v.prefix) {
                    name = `${v.prefix}:${name}`;
                }
                attr += ` xsi:type="${name}"`;
                if (v.xmlns) {
                    attr += ` xmlns:${v.prefix}="${v.xmlns}"`;
                }
            }
            else {
                attr += ` ${k}="${(0, utils_1.xmlEscape)(v)}"`;
            }
        });
        return attr;
    }
    /**
     * Look up a schema type definition
     * @param name
     * @param nsURI
     * @returns {*}
     */
    findSchemaType(name, nsURI) {
        if (!this.definitions.schemas || !name || !nsURI) {
            return null;
        }
        const schema = this.definitions.schemas[nsURI];
        if (!schema || !schema.complexTypes) {
            return null;
        }
        return schema.complexTypes[name];
    }
    findChildSchemaObject(parameterTypeObj, childName, backtrace) {
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
        let found = null;
        let i = 0;
        let child;
        let ref;
        if (Array.isArray(parameterTypeObj.$lookupTypes) && parameterTypeObj.$lookupTypes.length) {
            const types = parameterTypeObj.$lookupTypes;
            for (i = 0; i < types.length; i++) {
                const typeObj = types[i];
                if (typeObj.$name === childName) {
                    found = typeObj;
                    break;
                }
            }
        }
        const object = parameterTypeObj;
        if (object.$name === childName && object.name === 'element') {
            return object;
        }
        if (object.$ref) {
            ref = (0, utils_1.splitQName)(object.$ref);
            if (ref.name === childName) {
                return object;
            }
        }
        let childNsURI;
        // want to avoid unecessary recursion to improve performance
        if (object.$type && backtrace.length === 1) {
            const typeInfo = (0, utils_1.splitQName)(object.$type);
            if (typeInfo.prefix === utils_1.TNS_PREFIX) {
                childNsURI = parameterTypeObj.$targetNamespace;
            }
            else {
                childNsURI = this.definitions.xmlns[typeInfo.prefix];
            }
            const typeDef = this.findSchemaType(typeInfo.name, childNsURI);
            if (typeDef) {
                return this.findChildSchemaObject(typeDef, childName, backtrace);
            }
        }
        // handle $base (e.g. for ExtensionElement) like $type
        if (object.$base && (!Array.isArray(object.children) || !object.children.length)) {
            const baseInfo = (0, utils_1.splitQName)(object.$base);
            childNsURI = parameterTypeObj.$targetNamespace;
            if (baseInfo.prefix !== utils_1.TNS_PREFIX) {
                childNsURI = this.definitions.xmlns[baseInfo.prefix];
            }
            const baseDef = this.findSchemaType(baseInfo.name, childNsURI);
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
                    const baseQName = (0, utils_1.splitQName)(child.$base);
                    const childNameSpace = baseQName.prefix === utils_1.TNS_PREFIX ? '' : baseQName.prefix;
                    childNsURI = child.xmlns[baseQName.prefix] || child.schemaXmlns[baseQName.prefix];
                    const foundBase = this.findSchemaType(baseQName.name, childNsURI);
                    if (foundBase) {
                        found = this.findChildSchemaObject(foundBase, childName, backtrace);
                        if (found) {
                            found.$baseNameSpace = childNameSpace;
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
    }
    _initializeOptions(options) {
        this._originalIgnoredNamespaces = (options || {}).ignoredNamespaces;
        this.options = {};
        const ignoredNamespaces = options ? options.ignoredNamespaces : null;
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
        const ignoreBaseNameSpaces = options ? options.ignoreBaseNameSpaces : null;
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
    }
    _processNextInclude(includes, callback) {
        const include = includes.shift();
        if (!include) {
            return callback();
        }
        let includePath;
        if (!/^https?:/i.test(this.uri) && !/^https?:/i.test(include.location)) {
            const isFixed = (this.options.wsdl_options !== undefined && this.options.wsdl_options.hasOwnProperty('fixedPath')) ? this.options.wsdl_options.fixedPath : false;
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
        const options = Object.assign({}, this.options);
        // follow supplied ignoredNamespaces option
        options.ignoredNamespaces = this._originalIgnoredNamespaces || this.options.ignoredNamespaces;
        options.WSDL_CACHE = this.WSDL_CACHE;
        if (this.options.wsdl_options !== undefined && typeof this.options.wsdl_options.overrideImportLocation === 'function') {
            try {
                includePath = this.options.wsdl_options.overrideImportLocation(includePath, this.uri, include.location, options);
            }
            catch (e) {
                return callback(e);
            }
        }
        open_wsdl_recursive(includePath, options, (err, wsdl) => {
            if (err) {
                return callback(err);
            }
            this._includesWsdl.push(wsdl);
            if (wsdl.definitions instanceof elements.DefinitionsElement) {
                _.mergeWith(this.definitions, wsdl.definitions, (a, b) => {
                    return (a instanceof elements.SchemaElement) ? a.merge(b) : undefined;
                });
            }
            else {
                return callback(new Error('wsdl.defintions is not an instance of elements.DefinitionsElement'));
            }
            this._processNextInclude(includes, (err) => {
                callback(err);
            });
        });
    }
    _parse(xml) {
        const p = sax.parser(true, null);
        const stack = [];
        let root = null;
        let types = null;
        let schema = null;
        let schemaAttrs = null;
        const options = this.options;
        p.onopentag = (node) => {
            const nsName = node.name;
            const attrs = node.attributes;
            const top = stack[stack.length - 1];
            const name = (0, utils_1.splitQName)(nsName).name;
            if (name === 'schema') {
                schemaAttrs = attrs;
            }
            if (top) {
                try {
                    top.startElement(stack, nsName, attrs, options, schemaAttrs);
                }
                catch (e) {
                    if (this.options.strict) {
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
                else if (name === 'html') {
                    throw new Error(`Root element of WSDL was <html>. This is likely an authentication issue.`);
                }
                else {
                    throw new Error('Unexpected root element of WSDL or include');
                }
            }
        };
        p.onclosetag = (name) => {
            const top = stack[stack.length - 1];
            (0, assert_1.ok)(top, 'Unmatched close tag: ' + name);
            top.endElement(stack, name);
        };
        p.write(xml).close();
        return root;
    }
    _fromXML(xml) {
        this.definitions = this._parse(xml);
        this.definitions.descriptions = {
            types: {},
            elements: {},
        };
        this.xml = xml;
    }
    _fromServices(services) {
    }
    _xmlnsMap() {
        const xmlns = this.definitions.xmlns;
        let str = '';
        for (const alias in xmlns) {
            if (alias === '' || alias === utils_1.TNS_PREFIX) {
                continue;
            }
            const ns = xmlns[alias];
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
    }
}
exports.WSDL = WSDL;
function open_wsdl_recursive(uri, p2, p3) {
    let fromCache;
    let WSDL_CACHE;
    let options;
    let callback;
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
    let options;
    let callback;
    if (typeof p2 === 'function') {
        options = {};
        callback = p2;
    }
    else if (typeof p3 === 'function') {
        options = p2;
        callback = p3;
    }
    // initialize cache when calling open_wsdl directly
    const WSDL_CACHE = options.WSDL_CACHE || {};
    const request_headers = options.wsdl_headers;
    const request_options = options.wsdl_options;
    let wsdl;
    if (/^\<\?xml[^>]*?>/i.test(uri)) {
        wsdl = new WSDL(uri, uri, options);
        WSDL_CACHE[uri] = wsdl;
        wsdl.WSDL_CACHE = WSDL_CACHE;
        wsdl.onReady(callback);
    }
    else if (!/^https?:/i.test(uri)) {
        debug('Reading file: %s', uri);
        fs.readFile(uri, 'utf8', (err, definition) => {
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
        const httpClient = options.httpClient || new http_1.HttpClient(options);
        httpClient.request(uri, null /* options */, (err, response, definition) => {
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