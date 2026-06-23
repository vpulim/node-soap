"use strict";
/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = void 0;
const events_1 = require("events");
const url = require("url");
const utils_1 = require("./utils");
let zlib;
try {
    zlib = require('zlib');
}
catch (error) {
}
function isExpress(server) {
    return (typeof server.route === 'function' && typeof server.use === 'function');
}
function isPromiseLike(obj) {
    return (!!obj && typeof obj.then === 'function');
}
function getDateString(d) {
    function pad(n) {
        return n < 10 ? '0' + n : n;
    }
    return d.getUTCFullYear() + '-'
        + pad(d.getUTCMonth() + 1) + '-'
        + pad(d.getUTCDate()) + 'T'
        + pad(d.getUTCHours()) + ':'
        + pad(d.getUTCMinutes()) + ':'
        + pad(d.getUTCSeconds()) + 'Z';
}
class Server extends events_1.EventEmitter {
    constructor(server, path, services, wsdl, options) {
        super();
        options = options || {
            path: path,
            services: services,
        };
        this.path = path;
        this.services = services;
        this.wsdl = wsdl;
        this.suppressStack = options && options.suppressStack;
        this.returnFault = options && options.returnFault;
        this.onewayOptions = options && options.oneWay || {};
        this.enableChunkedEncoding =
            options.enableChunkedEncoding === undefined ? true : !!options.enableChunkedEncoding;
        this.callback = options.callback ? options.callback : () => { };
        if (typeof path === 'string' && path[path.length - 1] !== '/') {
            path += '/';
        }
        else if (path instanceof RegExp && path.source[path.source.length - 1] !== '/') {
            path = new RegExp(path.source + '(?:\\/|)');
        }
        wsdl.onReady((err) => {
            if (isExpress(server)) {
                // handle only the required URL path for express server
                server.route(path).all((req, res) => {
                    if (typeof this.authorizeConnection === 'function') {
                        if (!this.authorizeConnection(req, res)) {
                            res.end();
                            return;
                        }
                    }
                    this._requestListener(req, res);
                });
                this.callback(err, this);
            }
            else {
                const listeners = server.listeners('request').slice();
                server.removeAllListeners('request');
                server.addListener('request', (req, res) => {
                    if (typeof this.authorizeConnection === 'function') {
                        if (!this.authorizeConnection(req, res)) {
                            res.end();
                            return;
                        }
                    }
                    let reqPath = url.parse(req.url).pathname;
                    if (reqPath[reqPath.length - 1] !== '/') {
                        reqPath += '/';
                    }
                    if (path === reqPath || (path instanceof RegExp && reqPath.match(path))) {
                        this._requestListener(req, res);
                    }
                    else {
                        for (let i = 0, len = listeners.length; i < len; i++) {
                            listeners[i].call(this, req, res);
                        }
                    }
                });
                this.callback(err, this);
            }
        });
        this._initializeOptions(options);
    }
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
    getSoapHeaders() {
        return this.soapHeaders;
    }
    clearSoapHeaders() {
        this.soapHeaders = null;
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
    _initializeOptions(options) {
        this.wsdl.options.attributesKey = options.attributesKey || 'attributes';
        this.onewayOptions.statusCode = this.onewayOptions.responseCode || 200;
        this.onewayOptions.emptyBody = !!this.onewayOptions.emptyBody;
    }
    _processRequestXml(req, res, xml) {
        let error;
        try {
            if (typeof this.log === 'function') {
                this.log('received', xml, req);
            }
            this._process(xml, req, res, (result, statusCode) => {
                this._sendHttpResponse(res, statusCode, result);
                if (typeof this.log === 'function') {
                    this.log('replied', result, req);
                }
            });
        }
        catch (err) {
            if (err.Fault !== undefined) {
                return this._sendError(err.Fault, (result, statusCode) => {
                    this._sendHttpResponse(res, statusCode || 500, result);
                    if (typeof this.log === 'function') {
                        this.log('error', err, req);
                    }
                }, new Date().toISOString());
            }
            else {
                error = err.stack ? (this.suppressStack === true ? err.message : err.stack) : err;
                this._sendHttpResponse(res, /* statusCode */ 500, error);
                if (typeof this.log === 'function') {
                    this.log('error', err, req);
                }
            }
        }
    }
    _requestListener(req, res) {
        const reqParse = url.parse(req.url);
        const reqPath = reqParse.pathname;
        const reqQuery = reqParse.search;
        if (typeof this.log === 'function') {
            this.log('info', 'Handling ' + req.method + ' on ' + req.url, req);
        }
        if (req.method === 'GET') {
            if (reqQuery && reqQuery.toLowerCase().startsWith('?wsdl')) {
                if (typeof this.log === 'function') {
                    this.log('info', 'Wants the WSDL', req);
                }
                res.setHeader('Content-Type', 'application/xml');
                res.write(this.wsdl.toXML());
            }
            res.end();
        }
        else if (req.method === 'POST') {
            if (typeof req.headers['content-type'] !== 'undefined') {
                res.setHeader('Content-Type', req.headers['content-type']);
            }
            else {
                res.setHeader('Content-Type', 'application/xml');
            }
            // request body is already provided by an express middleware
            // in this case unzipping should also be done by the express middleware itself
            if (req.body && req.body.length > 0) {
                return this._processRequestXml(req, res, req.body.toString());
            }
            const chunks = [];
            let gunzip;
            let source = req;
            if (req.headers['content-encoding'] === 'gzip') {
                gunzip = zlib.createGunzip();
                req.pipe(gunzip);
                source = gunzip;
            }
            source.on('data', (chunk) => {
                chunks.push(chunk);
            });
            source.on('end', () => {
                const xml = Buffer.concat(chunks).toString();
                this._processRequestXml(req, res, xml);
            });
        }
        else {
            res.end();
        }
    }
    _getSoapAction(req) {
        if (typeof req.headers.soapaction === 'undefined') {
            return;
        }
        const soapAction = req.headers.soapaction;
        return (soapAction.indexOf('"') === 0)
            ? soapAction.slice(1, -1)
            : soapAction;
    }
    _process(input, req, res, cb) {
        const pathname = url.parse(req.url).pathname.replace(/\/$/, '');
        const obj = this.wsdl.xmlToObject(input);
        const body = obj.Body;
        const headers = obj.Header;
        let binding;
        let methodName;
        let serviceName;
        let portName;
        const includeTimestamp = obj.Header && obj.Header.Security && obj.Header.Security.Timestamp;
        const authenticate = this.authenticate || function defaultAuthenticate() { return true; };
        const callback = (result, statusCode) => {
            const response = { result: result };
            this.emit('response', response, methodName);
            cb(response.result, statusCode);
        };
        const process = () => {
            if (typeof this.log === 'function') {
                this.log('info', 'Attempting to bind to ' + pathname, req);
            }
            // Avoid Cannot convert undefined or null to object due to Object.keys(body)
            // and throw more meaningful error
            if (!body) {
                throw new Error('Failed to parse the SOAP Message body');
            }
            // use port.location and current url to find the right binding
            binding = (() => {
                const services = this.wsdl.definitions.services;
                let firstPort;
                let name;
                for (name in services) {
                    serviceName = name;
                    const service = services[serviceName];
                    const ports = service.ports;
                    for (name in ports) {
                        portName = name;
                        const port = ports[portName];
                        const portPathname = url.parse(port.location).pathname.replace(/\/$/, '');
                        if (typeof this.log === 'function') {
                            this.log('info', 'Trying ' + portName + ' from path ' + portPathname, req);
                        }
                        if (portPathname === pathname) {
                            return port.binding;
                        }
                        // The port path is almost always wrong for generated WSDLs
                        if (!firstPort) {
                            firstPort = port;
                        }
                    }
                }
                return !firstPort ? void 0 : firstPort.binding;
            })();
            if (!binding) {
                throw new Error('Failed to bind to WSDL');
            }
            try {
                const soapAction = this._getSoapAction(req);
                const messageElemName = (Object.keys(body)[0] === 'attributes' ? Object.keys(body)[1] : Object.keys(body)[0]);
                const pair = binding.topElements[messageElemName];
                if (soapAction) {
                    methodName = this._getMethodNameBySoapAction(binding, soapAction);
                }
                else {
                    methodName = pair ? pair.methodName : messageElemName;
                }
                /** Style can be defined in method. If method has no style then look in binding */
                const style = binding.methods[methodName].style || binding.style;
                this.emit('request', obj, methodName);
                if (headers) {
                    this.emit('headers', headers, methodName);
                }
                if (style === 'rpc') {
                    this._executeMethod({
                        serviceName: serviceName,
                        portName: portName,
                        methodName: methodName,
                        outputName: messageElemName + 'Response',
                        args: body[messageElemName],
                        headers: headers,
                        style: 'rpc',
                    }, req, res, callback);
                }
                else {
                    this._executeMethod({
                        serviceName: serviceName,
                        portName: portName,
                        methodName: methodName,
                        outputName: pair.outputName,
                        args: body[messageElemName],
                        headers: headers,
                        style: 'document',
                    }, req, res, callback, includeTimestamp);
                }
            }
            catch (error) {
                if (error.Fault !== undefined) {
                    return this._sendError(error.Fault, callback, includeTimestamp);
                }
                throw error;
            }
        };
        // Authentication
        if (typeof authenticate === 'function') {
            let authResultProcessed = false;
            const processAuthResult = (authResult) => {
                if (authResultProcessed) {
                    return;
                }
                authResultProcessed = true;
                // Handle errors
                if (authResult instanceof Error) {
                    return this._sendError({
                        Code: {
                            Value: 'SOAP-ENV:Server',
                            Subcode: { Value: 'InternalServerError' },
                        },
                        Reason: { Text: authResult.toString() },
                        statusCode: 500,
                    }, callback, includeTimestamp);
                }
                // Handle actual results
                if (typeof authResult === 'boolean') {
                    if (authResult === true) {
                        try {
                            process();
                        }
                        catch (error) {
                            if (error.Fault !== undefined) {
                                return this._sendError(error.Fault, callback, includeTimestamp);
                            }
                            return this._sendError({
                                Code: {
                                    Value: 'SOAP-ENV:Server',
                                    Subcode: { Value: 'InternalServerError' },
                                },
                                Reason: { Text: error.toString() },
                                statusCode: 500,
                            }, callback, includeTimestamp);
                        }
                    }
                    else {
                        return this._sendError({
                            Code: {
                                Value: 'SOAP-ENV:Client',
                                Subcode: { Value: 'AuthenticationFailure' },
                            },
                            Reason: { Text: 'Invalid username or password' },
                            statusCode: 401,
                        }, callback, includeTimestamp);
                    }
                }
            };
            const functionResult = authenticate(obj.Header && obj.Header.Security, processAuthResult, req, obj);
            if (isPromiseLike(functionResult)) {
                functionResult.then((result) => {
                    processAuthResult(result);
                }, (err) => {
                    processAuthResult(err);
                });
            }
            if (typeof functionResult === 'boolean') {
                processAuthResult(functionResult);
            }
        }
        else {
            throw new Error('Invalid authenticate function (not a function)');
        }
    }
    _getMethodNameBySoapAction(binding, soapAction) {
        for (const methodName in binding.methods) {
            if (binding.methods[methodName].soapAction === soapAction) {
                return methodName;
            }
        }
    }
    _executeMethod(options, req, res, callback, includeTimestamp) {
        options = options || {};
        let method;
        let body;
        let headers;
        const serviceName = options.serviceName;
        const portName = options.portName;
        const binding = this.wsdl.definitions.services[serviceName].ports[portName].binding;
        const methodName = options.methodName;
        const outputName = options.outputName;
        const args = options.args;
        const style = options.style;
        if (this.soapHeaders) {
            headers = this.soapHeaders.map((header) => {
                if (typeof header === 'function') {
                    return header(methodName, args, options.headers, req, res, this);
                }
                else {
                    return header;
                }
            }).join('\n');
        }
        try {
            method = this.services[serviceName][portName][methodName];
        }
        catch (error) {
            return callback(this._envelope('', headers, includeTimestamp));
        }
        let handled = false;
        const handleResult = (error, result) => {
            if (handled) {
                return;
            }
            handled = true;
            if (error) {
                if (error.Fault !== undefined) {
                    return this._sendError(error.Fault, callback, includeTimestamp);
                }
                else {
                    return this._sendError({
                        Code: {
                            Value: 'SOAP-ENV:Server',
                            Subcode: { Value: 'InternalServerError' },
                        },
                        Reason: { Text: error.toString() },
                        statusCode: 500,
                    }, callback, includeTimestamp);
                }
            }
            if (style === 'rpc') {
                body = this.wsdl.objectToRpcXML(outputName, result, '', this.wsdl.definitions.$targetNamespace);
            }
            else if (style === 'document') {
                const element = binding.methods[methodName].output;
                body = this.wsdl.objectToDocumentXML(outputName, result, element.targetNSAlias, element.targetNamespace);
            }
            else {
                const element = binding.methods[methodName].output;
                // Check for targetNamespace on the element
                const elementTargetNamespace = element.$targetNamespace;
                let outputNameWithNamespace = outputName;
                if (elementTargetNamespace) {
                    // if targetNamespace is set on the element concatinate it with the outputName
                    outputNameWithNamespace = `${elementTargetNamespace}:${outputNameWithNamespace}`;
                }
                body = this.wsdl.objectToDocumentXML(outputNameWithNamespace, result, element.targetNSAlias, element.targetNamespace);
            }
            callback(this._envelope(body, headers, includeTimestamp));
        };
        if (!binding.methods[methodName].output) {
            // no output defined = one-way operation so return empty response
            handled = true;
            body = '';
            if (this.onewayOptions.emptyBody) {
                body = this._envelope('', headers, includeTimestamp);
            }
            callback(body, this.onewayOptions.responseCode);
        }
        const methodCallback = (error, result) => {
            if (error && error.Fault !== undefined) {
                // do nothing
            }
            else if (result === undefined) {
                // Backward compatibility to support one argument callback style
                result = error;
                error = null;
            }
            handleResult(error, result);
        };
        const result = method(args, methodCallback, options.headers, req, res, this);
        if (typeof result !== 'undefined') {
            if (isPromiseLike(result)) {
                result.then((value) => {
                    handleResult(null, value);
                }, (err) => {
                    handleResult(err);
                });
            }
            else {
                handleResult(null, result);
            }
        }
    }
    _envelope(body, headers, includeTimestamp) {
        const defs = this.wsdl.definitions;
        const ns = defs.$targetNamespace;
        const encoding = '';
        const alias = (0, utils_1.findPrefix)(defs.xmlns, ns);
        const envelopeDefinition = this.wsdl.options.forceSoap12Headers
            ? 'http://www.w3.org/2003/05/soap-envelope'
            : 'http://schemas.xmlsoap.org/soap/envelope/';
        let xml = '<?xml version="1.0" encoding="utf-8"?>' +
            '<soap:Envelope xmlns:soap="' + envelopeDefinition + '" ' +
            encoding +
            this.wsdl.xmlnsInEnvelope + '>';
        headers = headers || '';
        if (includeTimestamp) {
            const now = new Date();
            const created = getDateString(now);
            const expires = getDateString(new Date(now.getTime() + (1000 * 600)));
            headers += '<o:Security soap:mustUnderstand="1" ' +
                'xmlns:o="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" ' +
                'xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">' +
                '    <u:Timestamp u:Id="_0">' +
                '      <u:Created>' + created + '</u:Created>' +
                '      <u:Expires>' + expires + '</u:Expires>' +
                '    </u:Timestamp>' +
                '  </o:Security>\n';
        }
        if (headers !== '') {
            xml += '<soap:Header>' + headers + '</soap:Header>';
        }
        xml += body ? '<soap:Body>' + body + '</soap:Body>' : '<soap:Body/>';
        xml += '</soap:Envelope>';
        return xml;
    }
    _sendError(soapFault, callback, includeTimestamp) {
        let fault;
        let statusCode;
        if (soapFault.statusCode) {
            statusCode = soapFault.statusCode;
            soapFault.statusCode = undefined;
        }
        if ('faultcode' in soapFault) {
            // Soap 1.1 error style
            // Root element will be prependend with the soap NS
            // It must match the NS defined in the Envelope (set by the _envelope method)
            fault = this.wsdl.objectToDocumentXML('soap:Fault', soapFault, undefined);
        }
        else {
            // Soap 1.2 error style.
            // 3rd param is the NS prepended to all elements
            // It must match the NS defined in the Envelope (set by the _envelope method)
            fault = this.wsdl.objectToDocumentXML('Fault', soapFault, 'soap');
        }
        return callback(this._envelope(fault, '', includeTimestamp), statusCode);
    }
    _sendHttpResponse(res, statusCode, result) {
        if (statusCode) {
            res.statusCode = statusCode;
        }
        /*
        * Calling res.write(result) follow by res.end() will cause Node.js to use
        * chunked encoding, while calling res.end(result) directly will cause
        * Node.js to calculate and send Content-Length header. See
        * nodejs/node#26005.
        */
        if (this.enableChunkedEncoding) {
            res.write(result);
            res.end();
        }
        else {
            res.end(result);
        }
    }
}
exports.Server = Server;
//# sourceMappingURL=server.js.map