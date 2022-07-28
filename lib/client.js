"use strict";
/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
exports.Client = void 0;
var assert = require("assert");
var debugBuilder = require("debug");
var events_1 = require("events");
var getStream = require("get-stream");
var _ = require("lodash");
var uuid_1 = require("uuid");
var http_1 = require("./http");
var utils_1 = require("./utils");
var debug = debugBuilder('node-soap');
var nonIdentifierChars = /[^a-z$_0-9]/i;
var Client = /** @class */ (function (_super) {
    __extends(Client, _super);
    function Client(wsdl, endpoint, options) {
        var _this_1 = _super.call(this) || this;
        options = options || {};
        _this_1.wsdl = wsdl;
        _this_1._initializeOptions(options);
        _this_1._initializeServices(endpoint);
        _this_1.httpClient = options.httpClient || new http_1.HttpClient(options);
        return _this_1;
    }
    /** add soapHeader to soap:Header node */
    Client.prototype.addSoapHeader = function (soapHeader, name, namespace, xmlns) {
        if (!this.soapHeaders) {
            this.soapHeaders = [];
        }
        soapHeader = this._processSoapHeader(soapHeader, name, namespace, xmlns);
        return this.soapHeaders.push(soapHeader) - 1;
    };
    Client.prototype.changeSoapHeader = function (index, soapHeader, name, namespace, xmlns) {
        if (!this.soapHeaders) {
            this.soapHeaders = [];
        }
        soapHeader = this._processSoapHeader(soapHeader, name, namespace, xmlns);
        this.soapHeaders[index] = soapHeader;
    };
    /** return all defined headers */
    Client.prototype.getSoapHeaders = function () {
        return this.soapHeaders;
    };
    /** remove all defined headers */
    Client.prototype.clearSoapHeaders = function () {
        this.soapHeaders = null;
    };
    Client.prototype.addHttpHeader = function (name, value) {
        if (!this.httpHeaders) {
            this.httpHeaders = {};
        }
        this.httpHeaders[name] = value;
    };
    Client.prototype.getHttpHeaders = function () {
        return this.httpHeaders;
    };
    Client.prototype.clearHttpHeaders = function () {
        this.httpHeaders = null;
    };
    Client.prototype.addBodyAttribute = function (bodyAttribute, name, namespace, xmlns) {
        if (!this.bodyAttributes) {
            this.bodyAttributes = [];
        }
        if (typeof bodyAttribute === 'object') {
            var composition_1 = '';
            Object.getOwnPropertyNames(bodyAttribute).forEach(function (prop, idx, array) {
                composition_1 += ' ' + prop + '="' + bodyAttribute[prop] + '"';
            });
            bodyAttribute = composition_1;
        }
        if (bodyAttribute.substr(0, 1) !== ' ') {
            bodyAttribute = ' ' + bodyAttribute;
        }
        this.bodyAttributes.push(bodyAttribute);
    };
    Client.prototype.getBodyAttributes = function () {
        return this.bodyAttributes;
    };
    Client.prototype.clearBodyAttributes = function () {
        this.bodyAttributes = null;
    };
    /** overwrite the SOAP service endpoint address */
    Client.prototype.setEndpoint = function (endpoint) {
        this.endpoint = endpoint;
        this._initializeServices(endpoint);
    };
    /** description of services, ports and methods as a JavaScript object */
    Client.prototype.describe = function () {
        return this.wsdl.describeServices();
    };
    /** use the specified security protocol */
    Client.prototype.setSecurity = function (security) {
        this.security = security;
    };
    Client.prototype.setSOAPAction = function (SOAPAction) {
        this.SOAPAction = SOAPAction;
    };
    Client.prototype._initializeServices = function (endpoint) {
        var definitions = this.wsdl.definitions;
        var services = definitions.services;
        for (var name_1 in services) {
            this[name_1] = this._defineService(services[name_1], endpoint);
        }
    };
    Client.prototype._initializeOptions = function (options) {
        this.streamAllowed = options.stream;
        this.returnSaxStream = options.returnSaxStream;
        this.normalizeNames = options.normalizeNames;
        this.overridePromiseSuffix = options.overridePromiseSuffix || 'Async';
        this.wsdl.options.attributesKey = options.attributesKey || 'attributes';
        this.wsdl.options.envelopeKey = options.envelopeKey || 'soap';
        this.wsdl.options.preserveWhitespace = !!options.preserveWhitespace;
        var igNs = options.ignoredNamespaces;
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
    };
    Client.prototype._defineService = function (service, endpoint) {
        var ports = service.ports;
        var def = {};
        for (var name_2 in ports) {
            def[name_2] = this._definePort(ports[name_2], endpoint ? endpoint : ports[name_2].location);
        }
        return def;
    };
    Client.prototype._definePort = function (port, endpoint) {
        var location = endpoint;
        var binding = port.binding;
        var methods = binding.methods;
        var def = {};
        for (var name_3 in methods) {
            def[name_3] = this._defineMethod(methods[name_3], location);
            var methodName = this.normalizeNames ? name_3.replace(nonIdentifierChars, '_') : name_3;
            this[methodName] = def[name_3];
            if (!nonIdentifierChars.test(methodName)) {
                var suffix = this.overridePromiseSuffix;
                this[methodName + suffix] = this._promisifyMethod(def[name_3]);
            }
        }
        return def;
    };
    Client.prototype._promisifyMethod = function (method) {
        return function (args, options, extraHeaders) {
            return new Promise(function (resolve, reject) {
                var callback = function (err, result, rawResponse, soapHeader, rawRequest, mtomAttachments) {
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
    };
    Client.prototype._defineMethod = function (method, location) {
        var _this_1 = this;
        var temp;
        return function (args, callback, options, extraHeaders) {
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
            _this_1._invoke(method, args, location, function (error, result, rawResponse, soapHeader, rawRequest, mtomAttachments) {
                callback(error, result, rawResponse, soapHeader, rawRequest, mtomAttachments);
            }, options, extraHeaders);
        };
    };
    Client.prototype._processSoapHeader = function (soapHeader, name, namespace, xmlns) {
        switch (typeof soapHeader) {
            case 'object':
                return this.wsdl.objectToXML(soapHeader, name, namespace, xmlns, true);
            case 'function':
                var _this_2 = this;
                // arrow function does not support arguments variable
                // tslint:disable-next-line
                return function () {
                    var result = soapHeader.apply(null, arguments);
                    if (typeof result === 'object') {
                        return _this_2.wsdl.objectToXML(result, name, namespace, xmlns, true);
                    }
                    else {
                        return result;
                    }
                };
            default:
                return soapHeader;
        }
    };
    Client.prototype._invoke = function (method, args, location, callback, options, extraHeaders) {
        var _this_1 = this;
        var name = method.$name;
        var input = method.input;
        var output = method.output;
        var style = method.style;
        var defs = this.wsdl.definitions;
        var envelopeKey = this.wsdl.options.envelopeKey;
        var ns = defs.$targetNamespace;
        var encoding = '';
        var message = '';
        var xml = null;
        var soapAction;
        var alias = utils_1.findPrefix(defs.xmlns, ns);
        var headers = {
            'Content-Type': 'text/xml; charset=utf-8'
        };
        var xmlnsSoap = 'xmlns:' + envelopeKey + '="http://schemas.xmlsoap.org/soap/envelope/"';
        var finish = function (obj, body, response) {
            var result;
            if (!output) {
                // one-way, no output expected
                return callback(null, null, body, obj.Header, xml, response.mtomResponseAttachments);
            }
            // If it's not HTML and Soap Body is empty
            if (!obj.html && !obj.Body) {
                if (response.status >= 400) {
                    var error = new Error('Error http status codes');
                    error.response = response;
                    error.body = body;
                    _this_1.emit('soapError', error, eid);
                    return callback(error, obj, body, obj.Header);
                }
                return callback(null, obj, body, obj.Header);
            }
            if (typeof obj.Body !== 'object') {
                var error = new Error('Cannot parse response');
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
                ['Response', 'Out', 'Output'].forEach(function (term) {
                    if (obj.Body.hasOwnProperty(name + term)) {
                        return result = obj.Body[name + term];
                    }
                });
            }
            callback(null, result, body, obj.Header, xml, response.mtomResponseAttachments);
        };
        var parseSync = function (body, response) {
            var obj;
            try {
                obj = _this_1.wsdl.xmlToObject(body);
            }
            catch (error) {
                //  When the output element cannot be looked up in the wsdl and the body is JSON
                //  instead of sending the error, we pass the body in the response.
                if (!output || !output.$lookupTypes) {
                    debug('Response element is not present. Unable to convert response xml to json.');
                    //  If the response is JSON then return it as-is.
                    var json = _.isObject(body) ? body : tryJSONparse(body);
                    if (json) {
                        return callback(null, response, json, undefined, xml);
                    }
                }
                error.response = response;
                error.body = body;
                _this_1.emit('soapError', error, eid);
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
            headers['Content-Type'] = "application/soap+xml; charset=utf-8; action=\"" + soapAction + "\"";
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
        var decodedHeaders;
        if (this.soapHeaders) {
            decodedHeaders = this.soapHeaders.map(function (header) {
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
            (this.security && this.security.postProcess ? ' Id="_0"' : '') +
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
        var eid = options.exchangeId || uuid_1.v4();
        this.emit('message', message, eid);
        this.emit('request', xml, eid);
        // Add extra headers
        if (this.httpHeaders === null) {
            headers = {};
        }
        else {
            for (var header in this.httpHeaders) {
                headers[header] = this.httpHeaders[header];
            }
            for (var attr in extraHeaders) {
                headers[attr] = extraHeaders[attr];
            }
        }
        var tryJSONparse = function (body) {
            try {
                return JSON.parse(body);
            }
            catch (err) {
                return undefined;
            }
        };
        if (this.streamAllowed && typeof this.httpClient.requestStream === 'function') {
            callback = _.once(callback);
            var startTime_1 = Date.now();
            var onError_1 = function (err) {
                _this_1.lastResponse = null;
                _this_1.lastResponseHeaders = null;
                _this_1.lastElapsedTime = null;
                _this_1.lastRequestHeaders = err.config && err.config.headers;
                _this_1.emit('response', null, null, eid);
                if (_this_1.returnSaxStream || !err.response || !err.response.data) {
                    callback(err, undefined, undefined, undefined, xml);
                }
                else {
                    err.response.data.on('close', function (e) {
                        callback(err, undefined, undefined, undefined, xml);
                    });
                    err.response.data.on('data', function (e) {
                        err.response.data = e.toString();
                    });
                }
            };
            this.httpClient.requestStream(location, xml, headers, options, this).then(function (res) {
                _this_1.lastRequestHeaders = res.headers;
                if (res.data.on) {
                    res.data.on('error', function (err) { return onError_1(err); });
                }
                // When the output element cannot be looked up in the wsdl,
                // play it safe and don't stream
                if (res.status !== 200 || !output || !output.$lookupTypes) {
                    getStream(res.data).then(function (body) {
                        _this_1.lastResponse = body;
                        _this_1.lastElapsedTime = Date.now() - startTime_1;
                        _this_1.lastResponseHeaders = res && res.headers;
                        // Added mostly for testability, but possibly useful for debugging
                        _this_1.lastRequestHeaders = res.config && res.config.headers || res.headers;
                        _this_1.emit('response', body, res, eid);
                        return parseSync(body, res);
                    });
                    return;
                }
                if (_this_1.returnSaxStream) {
                    // directly return the saxStream allowing the end user to define
                    // the parsing logics and corresponding errors managements
                    var saxStream = _this_1.wsdl.getSaxStream(res.data);
                    return finish({ saxStream: saxStream }, '<stream>', res.data);
                }
                else {
                    _this_1.wsdl.xmlToObject(res.data, function (error, obj) {
                        _this_1.lastResponse = res;
                        _this_1.lastElapsedTime = Date.now() - startTime_1;
                        _this_1.lastResponseHeaders = res && res.headers;
                        // Added mostly for testability, but possibly useful for debugging
                        _this_1.lastRequestHeaders = res.config.headers;
                        _this_1.emit('response', '<stream>', res.data, eid);
                        if (error) {
                            error.response = res;
                            error.body = '<stream>';
                            _this_1.emit('soapError', error, eid);
                            return callback(error, res, undefined, undefined, xml);
                        }
                        return finish(obj, '<stream>', res);
                    });
                }
            }, onError_1);
            return;
        }
        var startTime = Date.now();
        return this.httpClient.request(location, xml, function (err, response, body) {
            _this_1.lastResponse = body;
            if (response) {
                _this_1.lastResponseHeaders = response.headers;
                _this_1.lastElapsedTime = Date.now() - startTime;
                _this_1.lastResponseAttachments = response.mtomResponseAttachments;
                // Added mostly for testability, but possibly useful for debugging
                _this_1.lastRequestHeaders = response.config && response.config.headers;
            }
            _this_1.emit('response', body, response, eid);
            if (err) {
                _this_1.lastRequestHeaders = err.config && err.config.headers;
                try {
                    if (err.response && err.response.data) {
                        _this_1.wsdl.xmlToObject(err.response.data);
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
    };
    return Client;
}(events_1.EventEmitter));
exports.Client = Client;
//# sourceMappingURL=client.js.map