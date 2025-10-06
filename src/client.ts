/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

import * as assert from 'assert';
import { AxiosResponseHeaders, RawAxiosResponseHeaders } from 'axios';
import { randomUUID } from 'crypto';
import debugBuilder from 'debug';
import { EventEmitter } from 'events';
import getStream from 'get-stream';
import * as _ from 'lodash';
import { HttpClient } from './http';
import { IHeaders, IHttpClient, IMTOMAttachments, IOptions, ISecurity, SoapMethod, SoapMethodAsync } from './types';
import { findPrefix } from './utils';
import { WSDL } from './wsdl';
import { IPort, OperationElement, ServiceElement } from './wsdl/elements';

const debug = debugBuilder('node-soap');

const nonIdentifierChars = /[^a-z$_0-9]/i;

export interface ISoapError extends Error {
  response?;
  body?;
}

//eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface Client {
  emit(event: 'request', xml: string, eid: string): boolean;
  emit(event: 'message', message: string, eid: string): boolean;
  emit(event: 'soapError', error: any, eid: string): boolean;
  emit(event: 'response', body: any, response: any, eid: string): boolean;

  /** Emitted before a request is sent. */
  on(event: 'request', listener: (xml: string, eid: string) => void): this;
  /** Emitted before a request is sent, but only the body is passed to the event handler. Useful if you don't want to log /store Soap headers. */
  on(event: 'message', listener: (message: string, eid: string) => void): this;
  /** Emitted when an erroneous response is received. */
  on(event: 'soapError', listener: (error, eid: string) => void): this;
  /** Emitted after a response is received. This is emitted for all responses (both success and errors). */
  on(event: 'response', listener: (body: any, response: any, eid: string) => void): this;
}

//eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class Client extends EventEmitter {
  [method: string]: any;
  /** contains last full soap request for client logging */
  public lastRequest?: string;
  public lastMessage?: string;
  public lastEndpoint?: string;
  public lastRequestHeaders?: any;
  public lastResponse?: any;
  public lastResponseHeaders?: AxiosResponseHeaders | RawAxiosResponseHeaders;
  public lastElapsedTime?: number;
  public lastResponseAttachments: IMTOMAttachments;

  public wsdl: WSDL;
  private httpClient: IHttpClient;
  private soapHeaders: any[];
  private httpHeaders: IHeaders;
  private bodyAttributes: string[];
  private endpoint: string;
  private security: ISecurity;
  private SOAPAction: string;
  private streamAllowed: boolean;
  private returnSaxStream: boolean;
  private normalizeNames: boolean;
  private overridePromiseSuffix: string;

  constructor(wsdl: WSDL, endpoint?: string, options?: IOptions) {
    super();
    options = options || {};
    this.wsdl = wsdl;
    this._initializeOptions(options);
    this._initializeServices(endpoint);
    this.httpClient = options.httpClient || new HttpClient(options);
  }

  /** add soapHeader to soap:Header node */
  public addSoapHeader(soapHeader: any, name?: string, namespace?: any, xmlns?: string): number {
    if (!this.soapHeaders) {
      this.soapHeaders = [];
    }
    soapHeader = this._processSoapHeader(soapHeader, name, namespace, xmlns);
    return this.soapHeaders.push(soapHeader) - 1;
  }

  public changeSoapHeader(index: any, soapHeader: any, name?: any, namespace?: any, xmlns?: any): void {
    if (!this.soapHeaders) {
      this.soapHeaders = [];
    }
    soapHeader = this._processSoapHeader(soapHeader, name, namespace, xmlns);
    this.soapHeaders[index] = soapHeader;
  }

  /** return all defined headers */
  public getSoapHeaders(): string[] {
    return this.soapHeaders;
  }

  /** remove all defined headers */
  public clearSoapHeaders(): void {
    this.soapHeaders = null;
  }

  public addHttpHeader(name: string, value: any): void {
    if (!this.httpHeaders) {
      this.httpHeaders = {};
    }
    this.httpHeaders[name] = value;
  }

  public getHttpHeaders(): IHeaders {
    return this.httpHeaders;
  }

  public clearHttpHeaders(): void {
    this.httpHeaders = null;
  }

  public addBodyAttribute(bodyAttribute: any): void {
    if (!this.bodyAttributes) {
      this.bodyAttributes = [];
    }
    if (typeof bodyAttribute === 'object') {
      let composition = '';
      Object.getOwnPropertyNames(bodyAttribute).forEach((prop) => {
        composition += ' ' + prop + '="' + bodyAttribute[prop] + '"';
      });
      bodyAttribute = composition;
    }
    if (bodyAttribute.substr(0, 1) !== ' ') {
      bodyAttribute = ' ' + bodyAttribute;
    }
    this.bodyAttributes.push(bodyAttribute);
  }

  public getBodyAttributes(): any[] {
    return this.bodyAttributes;
  }

  public clearBodyAttributes(): void {
    this.bodyAttributes = null;
  }

  /** overwrite the SOAP service endpoint address */
  public setEndpoint(endpoint: string): void {
    this.endpoint = endpoint;
    this._initializeServices(endpoint);
  }

  /** description of services, ports and methods as a JavaScript object */
  public describe(): any {
    return this.wsdl.describeServices();
  }

  /** use the specified security protocol */
  public setSecurity(security: ISecurity): void {
    this.security = security;
  }

  public setSOAPAction(SOAPAction: string): void {
    this.SOAPAction = SOAPAction;
  }

  private _initializeServices(endpoint: string) {
    const definitions = this.wsdl.definitions;
    const services = definitions.services;
    for (const name in services) {
      this[name] = this._defineService(services[name], endpoint);
    }
  }

  private _initializeOptions(options: IOptions) {
    this.streamAllowed = options.stream;
    this.returnSaxStream = options.returnSaxStream;
    this.normalizeNames = options.normalizeNames;
    this.overridePromiseSuffix = options.overridePromiseSuffix || 'Async';
    this.wsdl.options.attributesKey = options.attributesKey || 'attributes';
    this.wsdl.options.envelopeKey = options.envelopeKey || 'soap';
    this.wsdl.options.envelopeSoapUrl = options.envelopeSoapUrl || 'http://schemas.xmlsoap.org/soap/envelope/';
    this.wsdl.options.preserveWhitespace = !!options.preserveWhitespace;
    this.wsdl.options.forceUseSchemaXmlns = !!options.forceUseSchemaXmlns;

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

    if (options.overrideElementKey !== undefined) {
      this.wsdl.options.overrideElementKey = options.overrideElementKey;
    }
    if (options.overrideRootElement !== undefined) {
      this.wsdl.options.overrideRootElement = options.overrideRootElement;
    }
    this.wsdl.options.forceSoap12Headers = !!options.forceSoap12Headers;
  }

  private _defineService(service: ServiceElement, endpoint?: string) {
    const ports = service.ports;
    const def = {};
    for (const name in ports) {
      def[name] = this._definePort(ports[name], endpoint ? endpoint : ports[name].location);
    }
    return def;
  }

  private _definePort(port: IPort, endpoint: string) {
    const location = endpoint;
    const binding = port.binding;
    const methods = binding.methods;
    const def: {
      [methodName: string]: SoapMethod;
    } = {};
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

  private _promisifyMethod(method: SoapMethod): SoapMethodAsync {
    return (args: any, options?: any, extraHeaders?: any) => {
      return new Promise((resolve, reject) => {
        const callback = (err: any, result: any, rawResponse: any, soapHeader: any, rawRequest: any, mtomAttachments: any) => {
          if (err) {
            reject(err);
          } else {
            resolve([result, rawResponse, soapHeader, rawRequest, mtomAttachments]);
          }
        };
        method(args, callback, options, extraHeaders);
      });
    };
  }

  private _defineMethod(method: OperationElement, location: string): SoapMethod {
    let temp;
    return (args, callback, options, extraHeaders) => {
      if (typeof args === 'function') {
        callback = args;
        args = {};
      } else if (typeof options === 'function') {
        temp = callback;
        callback = options;
        options = temp;
      } else if (typeof extraHeaders === 'function') {
        temp = callback;
        callback = extraHeaders;
        extraHeaders = options;
        options = temp;
      }
      this._invoke(
        method,
        args,
        location,
        (error, result, rawResponse, soapHeader, rawRequest, mtomAttachments) => {
          callback(error, result, rawResponse, soapHeader, rawRequest, mtomAttachments);
        },
        options,
        extraHeaders,
      );
    };
  }

  private _processSoapHeader(soapHeader, name, namespace, xmlns) {
    switch (typeof soapHeader) {
      case 'object':
        return this.wsdl.objectToXML(soapHeader, name, namespace, xmlns, true);
      case 'function': {
        //eslint-disable-next-line @typescript-eslint/no-this-alias
        const _this = this;
        return (...args: any) => {
          const result = soapHeader.apply(null, [...args]);

          if (typeof result === 'object') {
            return _this.wsdl.objectToXML(result, name, namespace, xmlns, true);
          } else {
            return result;
          }
        };
      }
      default:
        return soapHeader;
    }
  }

  private _invoke(method: OperationElement, args, location: string, callback, options, extraHeaders) {
    const name = method.$name;
    const input = method.input;
    const output = method.output;
    const style = method.style;
    const defs = this.wsdl.definitions;
    const envelopeKey = this.wsdl.options.envelopeKey;
    const envelopeSoapUrl = this.wsdl.options.envelopeSoapUrl;
    const ns: string = defs.$targetNamespace;
    let encoding = '';
    let message = '';
    let xml: string = null;
    let soapAction: string;
    const alias = findPrefix(defs.xmlns, ns);
    let headers: any = {
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
          const error: ISoapError = new Error('Error http status codes');
          error.response = response;
          error.body = body;
          this.emit('soapError', error, eid);
          return callback(error, obj, body, obj.Header);
        }
        return callback(null, obj, body, obj.Header);
      }

      if (typeof obj.Body !== 'object') {
        const error: ISoapError = new Error('Cannot parse response');
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
          if (Object.hasOwnProperty.call(obj.Body, name + term)) {
            return (result = obj.Body[name + term]);
          }
        });
      }

      callback(null, result, body, obj.Header, xml, response.mtomResponseAttachments);
    };

    const parseSync = (body, response) => {
      let obj;
      try {
        obj = this.wsdl.xmlToObject(body);
      } catch (error) {
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
    } else if (method.soapAction !== undefined && method.soapAction !== null) {
      soapAction = method.soapAction;
    } else {
      soapAction = (ns.lastIndexOf('/') !== ns.length - 1 ? ns + '/' : ns) + name;
    }

    if (this.wsdl.options.forceSoap12Headers) {
      headers['Content-Type'] = `application/soap+xml; charset=utf-8; action="${soapAction}"`;
      xmlnsSoap = 'xmlns:' + envelopeKey + '="http://www.w3.org/2003/05/soap-envelope"';
    } else {
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

    if (style === 'rpc' && (input.parts || input.name === 'element' || args === null)) {
      assert.ok(!style || style === 'rpc', 'invalid message definition for document style binding');
      message = this.wsdl.objectToRpcXML(name, args, alias, ns, input.name !== 'element');
      if (method.inputSoap === 'encoded') encoding = 'soap:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" ';
    } else {
      assert.ok(!style || style === 'document', 'invalid message definition for rpc style binding');
      // pass `input.$lookupType` if `input.$type` could not be found
      message = this.wsdl.objectToDocumentXML(input.$name, args, input.targetNSAlias, input.targetNamespace, input.$type || input.$lookupType);
    }

    let decodedHeaders;
    if (this.soapHeaders) {
      decodedHeaders = this.soapHeaders
        .map((header) => {
          if (typeof header === 'function') {
            return header(method, location, soapAction, args);
          } else {
            return header;
          }
        })
        .join(' ');
    }

    xml =
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<' +
      envelopeKey +
      ':Envelope ' +
      xmlnsSoap +
      ' ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
      encoding +
      this.wsdl.xmlnsInEnvelope +
      '>' +
      (decodedHeaders || this.security
        ? '<' +
          envelopeKey +
          ':Header' +
          (this.wsdl.xmlnsInHeader ? ' ' + this.wsdl.xmlnsInHeader : '') +
          '>' +
          (decodedHeaders ? decodedHeaders : '') +
          (this.security && !this.security.postProcess ? this.security.toXML() : '') +
          '</' +
          envelopeKey +
          ':Header>'
        : '') +
      '<' +
      envelopeKey +
      ':Body' +
      (this.bodyAttributes ? this.bodyAttributes.join(' ') : '') +
      '>' +
      message +
      '</' +
      envelopeKey +
      ':Body>' +
      '</' +
      envelopeKey +
      ':Envelope>';

    if (this.security && this.security.postProcess) {
      xml = this.security.postProcess(xml, envelopeKey);
    }

    if (options && options.postProcess) {
      xml = options.postProcess(xml);
    }

    this.lastMessage = message;
    this.lastRequest = xml;
    this.lastEndpoint = location;

    const eid: string = options.exchangeId || randomUUID();

    this.emit('message', message, eid);
    this.emit('request', xml, eid);

    // Add extra headers
    if (this.httpHeaders === null) {
      headers = {};
    } else {
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
      } catch {
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
        } else {
          err.response.data.on('close', () => {
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
            this.lastRequestHeaders = (res.config && res.config.headers) || res.headers;
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
        } else {
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
    return this.httpClient.request(
      location,
      xml,
      (err, response, body) => {
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
          } catch (error) {
            err.root = error.root || error;
          }
          callback(err, undefined, undefined, undefined, xml);
        } else {
          return parseSync(body, response);
        }
      },
      headers,
      options,
      this,
    );
  }
}
