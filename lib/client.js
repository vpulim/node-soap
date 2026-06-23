"use strict";
/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = void 0;
const assert = require("assert");
const crypto_1 = require("crypto");
const debug_1 = require("debug");
const events_1 = require("events");
const getStream = require("get-stream");
const _ = require("lodash");
const http_1 = require("./http");
const utils_1 = require("./utils");
const debug = (0, debug_1.default)('node-soap');
const nonIdentifierChars = /[^a-z$_0-9]/i;
class Client extends events_1.EventEmitter {
    constructor(wsdl, endpoint, options) {
        super();
        options = options || {};
        this.wsdl = wsdl;
        this._initializeOptions(options);
        this._initializeServices(endpoint);
        this.httpClient = options.httpClient || new http_1.HttpClient(options);
    }
    /** add soapHeader to soap:Header node */
    addSoapHeader(soapHeader, name, namespace, xmlns) {
        if (!this.soapHeaders) {
            this.soapHeaders = [];
        }
        soapHeader = this._processSoapHeader(soapHeader, name, namespace, xmlns);
        return this.soapHeaders.push(soapHeader) - 1;
    }
    changeSoapHeader(index, soapHeader, name, namespace, xmlns) {
        if (!this.soapHeaders) {
            this.soapHeaders = [];
        }
        soapHeader = this._processSoapHeader(soapHeader, name, namespace, xmlns);
        this.soapHeaders[index] = soapHeader;
    }
    /** return all defined headers */
    getSoapHeaders() {
        return this.soapHeaders;
    }
    /** remove all defined headers */
    clearSoapHeaders() {
        this.soapHeaders = null;
    }
    addHttpHeader(name, value) {
        if (!this.httpHeaders) {
            this.httpHeaders = {};
        }
        this.httpHeaders[name] = value;
    }
    getHttpHeaders() {
        return this.httpHeaders;
    }
    clearHttpHeaders() {
        this.httpHeaders = null;
    }
    addBodyAttribute(bodyAttribute, name, namespace, xmlns) {
        if (!this.bodyAttributes) {
            this.bodyAttributes = [];
        }
        if (typeof bodyAttribute === 'object') {
            let composition = '';
            Object.getOwnPropertyNames(bodyAttribute).forEach((prop, idx, array) => {
                composition += ' ' + prop + '="' + bodyAttribute[prop] + '"';
            });
            bodyAttribute = composition;
        }
        if (bodyAttribute.substr(0, 1) !== ' ') {
            bodyAttribute = ' ' + bodyAttribute;
        }
        this.bodyAttributes.push(bodyAttribute);
    }
    getBodyAttributes() {
        return this.bodyAttributes;
    }
    clearBodyAttributes() {
        this.bodyAttributes = null;
    }
    /** overwrite the SOAP service endpoint address */
    setEndpoint(endpoint) {
        this.endpoint = endpoint;
        this._initializeServices(endpoint);
    }
    /** description of services, ports and methods as a JavaScript object */
    describe() {
        return this.wsdl.describeServices();
    }
    /** use the specified security protocol */
    setSecurity(security) {
        this.security = security;
    }
    setSOAPAction(SOAPAction) {
        this.SOAPAction = SOAPAction;
    }
    _initializeServices(endpoint) {
        const definitions = this.wsdl.definitions;
        const services = definitions.services;
        for (const name in services) {
            this[name] = this._defineService(services[name], endpoint);
        }
    }
    _initializeOptions(options) {
        this.streamAllowed = options.stream;
        this.returnSaxStream = options.returnSaxStream;
        this.normalizeNames = options.normalizeNames;
        this.overridePromiseSuffix = options.overridePromiseSuffix || 'Async';
        this.wsdl.options.attributesKey = options.attributesKey || 'attributes';
        this.wsdl.options.envelopeKey = options.envelopeKey || 'soap';
        this.wsdl.options.envelopeSoapUrl = options.envelopeSoapUrl || 'http://schemas.xmlsoap.org/soap/envelope/';
        this.wsdl.options.preserveWhitespace = !!options.preserveWhitespace;
        const igNs = options.ignoredNamespaces;
        if (igNs !== undefined && typeof igNs === 'object') {
            if ('override' in igNs) {
                if (igNs.override === true) {
                    if (igNs.namespaces !== undefined) {
                        this.wsdl.options.ignoredNamespaces = igNs.namespaces;
                    }
                }
            }
        }
        if (options.overrideRootElement !== undefined) {
            this.wsdl.options.overrideRootElement = options.overrideRootElement;
        }
        this.wsdl.options.forceSoap12Headers = !!options.forceSoap12Headers;
    }
    _defineService(service, endpoint) {
        const ports = service.ports;
        const def = {};
        for (const name in ports) {
            def[name] = this._definePort(ports[name], endpoint ? endpoint : ports[name].location);
        }
        return def;
    }
    _definePort(port, endpoint) {
        const location = endpoint;
        const binding = port.binding;
        const methods = binding.methods;
        const def = {};
        for (const name in methods) {
            def[name] = this._defineMethod(methods[name], location);
            const methodName = this.normalizeNames ? name.replace(nonIdentifierChars, '_') : name;
            this[methodName] = def[name];
            if (!nonIdentifierChars.test(methodName)) {
                const suffix = this.overridePromiseSuffix;
                this[methodName + suffix] = this._promisifyMethod(def[name]);
            }
        }
        return def;
    }
    _promisifyMethod(method) {
        return (args, options, extraHeaders) => {
            return new Promise((resolve, reject) => {
                const callback = (err, result, rawResponse, soapHeader, rawRequest, mtomAttachments) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve([result, rawResponse, soapHeader, rawRequest, mtomAttachments]);
                    }
                };
                method(args, callback, options, extraHeaders);
            });
        };
    }
    _defineMethod(method, location) {
        let temp;
        return (args, callback, options, extraHeaders) => {
            if (typeof args === 'function') {
                callback = args;
                args = {};
            }
            else if (typeof options === 'function') {
                temp = callback;
                callback = options;
                options = temp;
            }
            else if (typeof extraHeaders === 'function') {
                temp = callback;
                callback = extraHeaders;
                extraHeaders = options;
                options = temp;
            }
            this._invoke(method, args, location, (error, result, rawResponse, soapHeader, rawRequest, mtomAttachments) => {
                callback(error, result, rawResponse, soapHeader, rawRequest, mtomAttachments);
            }, options, extraHeaders);
        };
    }
    _processSoapHeader(soapHeader, name, namespace, xmlns) {
        switch (typeof soapHeader) {
            case 'object':
                return this.wsdl.objectToXML(soapHeader, name, namespace, xmlns, true);
            case 'function':
                const _this = this;
                // arrow function does not support arguments variable
                // tslint:disable-next-line
                return function () {
                    const result = soapHeader.apply(null, arguments);
                    if (typeof result === 'object') {
                        return _this.wsdl.objectToXML(result, name, namespace, xmlns, true);
                    }
                    else {
                        return result;
                    }
                };
            default:
                return soapHeader;
        }
    }
    _invoke(method, args, location, callback, options, extraHeaders) {
        const name = method.$name;
        const input = method.input;
        const output = method.output;
        const style = method.style;
        const defs = this.wsdl.definitions;
        const envelopeKey = this.wsdl.options.envelopeKey;
        const envelopeSoapUrl = this.wsdl.options.envelopeSoapUrl;
        const ns = defs.$targetNamespace;
        let encoding = '';
        let message = '';
        let xml = null;
        let soapAction;
        const alias = (0, utils_1.findPrefix)(defs.xmlns, ns);
        let headers = {
            'Content-Type': 'text/xml; charset=utf-8',
        };
        let xmlnsSoap = 'xmlns:' + envelopeKey + '="' + envelopeSoapUrl + '"';
        const finish = (obj, body, response) => {
            let result;
            if (!output) {
                // one-way, no output expected
                return callback(null, null, body, obj.Header, xml, response.mtomResponseAttachments);
            }
            // If it's not HTML and Soap Body is empty
            if (!obj.html && !obj.Body) {
                if (response.status >= 400) {
                    const error = new Error('Error http status codes');
                    error.response = response;
                    error.body = body;
                    this.emit('soapError', error, eid);
                    return callback(error, obj, body, obj.Header);
                }
                return callback(null, obj, body, obj.Header);
            }
            if (typeof obj.Body !== 'object') {
                const error = new Error('Cannot parse response');
                error.response = response;
                error.body = body;
                return callback(error, obj, body, undefined, xml);
            }
            result = obj.Body[output.$name];
            // RPC/literal response body may contain elements with added suffixes I.E.
            // 'Response', or 'Output', or 'Out'
            // This doesn't necessarily equal the ouput message name. See WSDL 1.1 Section 2.4.5
            if (!result) {
                result = obj.Body[output.$name.replace(/(?:Out(?:put)?|Response)$/, '')];
            }
            if (!result) {
                ['Response', 'Out', 'Output'].forEach((term) => {
                    if (obj.Body.hasOwnProperty(name + term)) {
                        return result = obj.Body[name + term];
                    }
                });
            }
            callback(null, result, body, obj.Header, xml, response.mtomResponseAttachments);
        };
        const parseSync = (body, response) => {
            let obj;
            try {
                obj = this.wsdl.xmlToObject(body);
            }
            catch (error) {
                //  When the output element cannot be looked up in the wsdl and the body is JSON
                //  instead of sending the error, we pass the body in the response.
                if (!output || !output.$lookupTypes) {
                    debug('Response element is not present. Unable to convert response xml to json.');
                    //  If the response is JSON then return it as-is.
                    const json = _.isObject(body) ? body : tryJSONparse(body);
                    if (json) {
                        return callback(null, response, json, undefined, xml);
                    }
                }
                error.response = response;
                error.body = body;
                this.emit('soapError', error, eid);
                return callback(error, response, body, undefined, xml, response.mtomResponseAttachments);
            }
            return finish(obj, body, response);
        };
        if (this.SOAPAction) {
            soapAction = this.SOAPAction;
        }
        else if (method.soapAction !== undefined && method.soapAction !== null) {
            soapAction = method.soapAction;
        }
        else {
            soapAction = ((ns.lastIndexOf('/') !== ns.length - 1) ? ns + '/' : ns) + name;
        }
        if (this.wsdl.options.forceSoap12Headers) {
            headers['Content-Type'] = `application/soap+xml; charset=utf-8; action="${soapAction}"`;
            xmlnsSoap = 'xmlns:' + envelopeKey + '="http://www.w3.org/2003/05/soap-envelope"';
        }
        else {
            headers.SOAPAction = '"' + soapAction + '"';
        }
        options = options || {};
        // Allow the security object to add headers
        if (this.security && this.security.addHeaders) {
            this.security.addHeaders(headers);
        }
        if (this.security && this.security.addOptions) {
            this.security.addOptions(options);
        }
        if ((style === 'rpc') && ((input.parts || input.name === 'element') || args === null)) {
            assert.ok(!style || style === 'rpc', 'invalid message definition for document style binding');
            message = this.wsdl.objectToRpcXML(name, args, alias, ns, (input.name !== 'element'));
            (method.inputSoap === 'encoded') && (encoding = 'soap:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" ');
        }
        else {
            assert.ok(!style || style === 'document', 'invalid message definition for rpc style binding');
            // pass `input.$lookupType` if `input.$type` could not be found
            message = this.wsdl.objectToDocumentXML(input.$name, args, input.targetNSAlias, input.targetNamespace, (input.$type || input.$lookupType));
        }
        let decodedHeaders;
        if (this.soapHeaders) {
            decodedHeaders = this.soapHeaders.map((header) => {
                if (typeof header === 'function') {
                    return header(method, location, soapAction, args);
                }
                else {
                    return header;
                }
            }).join(' ');
        }
        xml = '<?xml version="1.0" encoding="utf-8"?>' +
            '<' + envelopeKey + ':Envelope ' +
            xmlnsSoap + ' ' +
            'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
            encoding +
            this.wsdl.xmlnsInEnvelope + '>' +
            ((decodedHeaders || this.security) ?
                ('<' + envelopeKey + ':Header' + (this.wsdl.xmlnsInHeader ? (' ' + this.wsdl.xmlnsInHeader) : '') + '>' +
                    (decodedHeaders ? decodedHeaders : '') +
                    (this.security && !this.security.postProcess ? this.security.toXML() : '') +
                    '</' + envelopeKey + ':Header>')
                :
                    '') +
            '<' + envelopeKey + ':Body' +
            (this.bodyAttributes ? this.bodyAttributes.join(' ') : '') +
            '>' +
            message +
            '</' + envelopeKey + ':Body>' +
            '</' + envelopeKey + ':Envelope>';
        if (this.security && this.security.postProcess) {
            xml = this.security.postProcess(xml, envelopeKey);
        }
        if (options && options.postProcess) {
            xml = options.postProcess(xml);
        }
        this.lastMessage = message;
        this.lastRequest = xml;
        this.lastEndpoint = location;
        const eid = options.exchangeId || (0, crypto_1.randomUUID)();
        this.emit('message', message, eid);
        this.emit('request', xml, eid);
        // Add extra headers
        if (this.httpHeaders === null) {
            headers = {};
        }
        else {
            for (const header in this.httpHeaders) {
                headers[header] = this.httpHeaders[header];
            }
            for (const attr in extraHeaders) {
                headers[attr] = extraHeaders[attr];
            }
        }
        const tryJSONparse = (body) => {
            try {
                return JSON.parse(body);
            }
            catch (err) {
                return undefined;
            }
        };
        if (this.streamAllowed && typeof this.httpClient.requestStream === 'function') {
            callback = _.once(callback);
            const startTime = Date.now();
            const onError = (err) => {
                this.lastResponse = null;
                this.lastResponseHeaders = null;
                this.lastElapsedTime = null;
                this.lastRequestHeaders = err.config && err.config.headers;
                this.emit('response', null, null, eid);
                if (this.returnSaxStream || !err.response || !err.response.data) {
                    callback(err, undefined, undefined, undefined, xml);
                }
                else {
                    err.response.data.on('close', (e) => {
                        callback(err, undefined, undefined, undefined, xml);
                    });
                    err.response.data.on('data', (e) => {
                        err.response.data = e.toString();
                    });
                }
            };
            this.httpClient.requestStream(location, xml, headers, options, this).then((res) => {
                this.lastRequestHeaders = res.headers;
                if (res.data.on) {
                    res.data.on('error', (err) => onError(err));
                }
                // When the output element cannot be looked up in the wsdl,
                // play it safe and don't stream
                if (res.status !== 200 || !output || !output.$lookupTypes) {
                    getStream(res.data).then((body) => {
                        this.lastResponse = body;
                        this.lastElapsedTime = Date.now() - startTime;
                        this.lastResponseHeaders = res && res.headers;
                        // Added mostly for testability, but possibly useful for debugging
                        this.lastRequestHeaders = res.config && res.config.headers || res.headers;
                        this.emit('response', body, res, eid);
                        return parseSync(body, res);
                    });
                    return;
                }
                if (this.returnSaxStream) {
                    // directly return the saxStream allowing the end user to define
                    // the parsing logics and corresponding errors managements
                    const saxStream = this.wsdl.getSaxStream(res.data);
                    return finish({ saxStream }, '<stream>', res.data);
                }
                else {
                    this.wsdl.xmlToObject(res.data, (error, obj) => {
                        this.lastResponse = res;
                        this.lastElapsedTime = Date.now() - startTime;
                        this.lastResponseHeaders = res && res.headers;
                        // Added mostly for testability, but possibly useful for debugging
                        this.lastRequestHeaders = res.config.headers;
                        this.emit('response', '<stream>', res.data, eid);
                        if (error) {
                            error.response = res;
                            error.body = '<stream>';
                            this.emit('soapError', error, eid);
                            return callback(error, res, undefined, undefined, xml);
                        }
                        return finish(obj, '<stream>', res);
                    });
                }
            }, onError);
            return;
        }
        const startTime = Date.now();
        return this.httpClient.request(location, xml, (err, response, body) => {
            this.lastResponse = body;
            if (response) {
                this.lastResponseHeaders = response.headers;
                this.lastElapsedTime = Date.now() - startTime;
                this.lastResponseAttachments = response.mtomResponseAttachments;
                // Added mostly for testability, but possibly useful for debugging
                this.lastRequestHeaders = response.config && response.config.headers;
            }
            this.emit('response', body, response, eid);
            if (err) {
                this.lastRequestHeaders = err.config && err.config.headers;
                try {
                    if (err.response && err.response.data) {
                        this.wsdl.xmlToObject(err.response.data);
                    }
                }
                catch (error) {
                    err.root = error.root || error;
                }
                callback(err, undefined, undefined, undefined, xml);
            }
            else {
                return parseSync(body, response);
            }
        }, headers, options, this);
    }
}
exports.Client = Client;
//# sourceMappingURL=client.js.map