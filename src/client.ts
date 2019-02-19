/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

import * as assert from 'assert';
import * as BluebirdPromise from 'bluebird';
import * as concatStream from 'concat-stream';
import * as debugBuilder from 'debug';
import { EventEmitter } from 'events';
import * as _ from 'lodash';
import { v4 as uuid4 } from 'uuid';
import { HttpClient, Request } from './http';
import { IHeaders, IOptions, ISecurity, SoapMethod } from './types';
import { findPrefix } from './utils';
import { WSDL } from './wsdl';
import { IPort, OperationElement, ServiceElement } from './wsdl/elements';

const debug = debugBuilder('node-soap');

var nonIdentifierChars = /[^a-z$_0-9]/i;

export interface ISoapError extends Error {
  response?;
  body?;
}

// tslint:disable unified-signatures
// tslint:disable-next-line:interface-name
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

export class Client extends EventEmitter {
  [method: string]: any;
  /** contains last full soap request for client logging */
  public lastRequest: string;

  private wsdl: WSDL;
  private httpClient: HttpClient;
  private soapHeaders: string[];
  private httpHeaders: IHeaders;
  private bodyAttributes: string[];
  private endpoint: string;
  private security: ISecurity;
  private SOAPAction: string;
  private streamAllowed: boolean;
  private normalizeNames: boolean;
  private lastMessage: string;
  private lastEndpoint: string;
  private lastRequestHeaders;
  private lastResponse;
  private lastResponseHeaders;
  private lastElapsedTime: number;

  constructor(wsdl: WSDL, endpoint?: string, options?: IOptions) {
    super();
    options = options || {};
    this.wsdl = wsdl;
    this._initializeOptions(options);
    this._initializeServices(endpoint);
    this.httpClient = options.httpClient || new HttpClient(options);
    var promiseOptions: BluebirdPromise.PromisifyAllOptions<this> = { multiArgs: true };
    if (options.overridePromiseSuffix) {
      promiseOptions.suffix = options.overridePromiseSuffix;
    }
    BluebirdPromise.promisifyAll(this, promiseOptions);
  }

  /** add soapHeader to soap:Header node */
  public addSoapHeader(soapHeader: any, name?: string, namespace?: string, xmlns?: string): number {
    if (!this.soapHeaders) {
      this.soapHeaders = [];
    }
    if (typeof soapHeader === 'object') {
      soapHeader = this.wsdl.objectToXML(soapHeader, name, namespace, xmlns, true);
    }
    return this.soapHeaders.push(soapHeader) - 1;
  }

  public changeSoapHeader(index: number, soapHeader: any, name?: string, namespace?: string, xmlns?: string): void {
    if (!this.soapHeaders) {
      this.soapHeaders = [];
    }
    if (typeof soapHeader === 'object') {
      soapHeader = this.wsdl.objectToXML(soapHeader, name, namespace, xmlns, true);
    }
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
    this.httpHeaders = {};
  }

  public addBodyAttribute(bodyAttribute: any, name?: string, namespace?: string, xmlns?: string): void {
    if (!this.bodyAttributes) {
      this.bodyAttributes = [];
    }
    if (typeof bodyAttribute === 'object') {
      var composition = '';
      Object.getOwnPropertyNames(bodyAttribute).forEach(function(prop, idx, array) {
        composition += ' ' + prop + '="' + bodyAttribute[prop] + '"';
      });
      bodyAttribute = composition;
    }
    if (bodyAttribute.substr(0, 1) !== ' ') bodyAttribute = ' ' + bodyAttribute;
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
    var definitions = this.wsdl.definitions,
      services = definitions.services;
    for (var name in services) {
      this[name] = this._defineService(services[name], endpoint);
    }
  }

  private _initializeOptions(options: IOptions) {
    this.streamAllowed = options.stream;
    this.normalizeNames = options.normalizeNames;
    this.wsdl.options.attributesKey = options.attributesKey || 'attributes';
    this.wsdl.options.envelopeKey = options.envelopeKey || 'soap';
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

  private _defineService(service: ServiceElement, endpoint?: string) {
    var ports = service.ports,
      def = {};
    for (var name in ports) {
      def[name] = this._definePort(ports[name], endpoint ? endpoint : ports[name].location);
    }
    return def;
  }

  private _definePort(port: IPort, endpoint: string) {
    var location = endpoint,
      binding = port.binding,
      methods = binding.methods,
      def: {
        [methodName: string]: SoapMethod;
      } = {};
    for (var name in methods) {
      def[name] = this._defineMethod(methods[name], location);
      var methodName = this.normalizeNames ? name.replace(nonIdentifierChars, '_') : name;
      this[methodName] = def[name];
    }
    return def;
  }

  private _defineMethod(method: OperationElement, location: string): SoapMethod {
    var self = this;
    var temp;
    return function(args, callback, options, extraHeaders) {
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
      self._invoke(method, args, location, function(error, result, rawResponse, soapHeader, rawRequest) {
        callback(error, result, rawResponse, soapHeader, rawRequest);
      }, options, extraHeaders);
    };
  }

  private _invoke(method: OperationElement, args, location: string, callback, options, extraHeaders) {
    var self = this,
      name = method.$name,
      input = method.input,
      output = method.output,
      style = method.style,
      defs = this.wsdl.definitions,
      envelopeKey = this.wsdl.options.envelopeKey,
      ns: string = defs.$targetNamespace,
      encoding = '',
      message = '',
      xml: string = null,
      req: Request,
      soapAction: string,
      alias = findPrefix(defs.xmlns, ns),
      headers: any = {
        "Content-Type": "text/xml; charset=utf-8",
      },
      xmlnsSoap = "xmlns:" + envelopeKey + "=\"http://schemas.xmlsoap.org/soap/envelope/\"";

    if (this.wsdl.options.forceSoap12Headers) {
      headers["Content-Type"] = "application/soap+xml; charset=utf-8";
      xmlnsSoap = "xmlns:" + envelopeKey + "=\"http://www.w3.org/2003/05/soap-envelope\"";
    }

    if (this.SOAPAction) {
      soapAction = this.SOAPAction;
    } else if (method.soapAction !== undefined && method.soapAction !== null) {
      soapAction = method.soapAction;
    } else {
      soapAction = ((ns.lastIndexOf("/") !== ns.length - 1) ? ns + "/" : ns) + name;
    }

    if (!this.wsdl.options.forceSoap12Headers) {
      headers.SOAPAction = '"' + soapAction + '"';
    }

    options = options || {};

    // Add extra headers
    for (var header in this.httpHeaders ) { headers[header] = this.httpHeaders[header];  }
    for (var attr in extraHeaders) { headers[attr] = extraHeaders[attr]; }

    // Allow the security object to add headers
    if (self.security && self.security.addHeaders)
      self.security.addHeaders(headers);
    if (self.security && self.security.addOptions)
      self.security.addOptions(options);

    if ((style === 'rpc') && ( ( input.parts || input.name === "element" ) || args === null) ) {
      assert.ok(!style || style === 'rpc', 'invalid message definition for document style binding');
      message = self.wsdl.objectToRpcXML(name, args, alias, ns, (input.name !== "element" ));
      (method.inputSoap === 'encoded') && (encoding = 'soap:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" ');
    } else {
      assert.ok(!style || style === 'document', 'invalid message definition for rpc style binding');
      // pass `input.$lookupType` if `input.$type` could not be found
      message = self.wsdl.objectToDocumentXML(input.$name, args, input.targetNSAlias, input.targetNamespace, (input.$type || input.$lookupType));
    }
    xml = "<?xml version=\"1.0\" encoding=\"utf-8\"?>" +
      "<" + envelopeKey + ":Envelope " +
      xmlnsSoap + " " +
      "xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" " +
      encoding +
      this.wsdl.xmlnsInEnvelope + '>' +
      ((self.soapHeaders || self.security) ?
        (
          "<" + envelopeKey + ":Header>" +
          (self.soapHeaders ? self.soapHeaders.join("\n") : "") +
          (self.security && !self.security.postProcess ? self.security.toXML() : "") +
          "</" + envelopeKey + ":Header>"
        )
        :
          ''
        ) +
      "<" + envelopeKey + ":Body" +
      (self.bodyAttributes ? self.bodyAttributes.join(' ') : '') +
      (self.security && self.security.postProcess ? ' Id="_0"' : '') +
      ">" +
      message +
      "</" + envelopeKey + ":Body>" +
      "</" + envelopeKey + ":Envelope>";

    if (self.security && self.security.postProcess){
      xml = self.security.postProcess(xml, envelopeKey);
    }

    if (options && options.postProcess){
      xml = options.postProcess(xml);
    }

    self.lastMessage = message;
    self.lastRequest = xml;
    self.lastEndpoint = location;

    var eid: string = options.exchangeId || uuid4();

    self.emit('message', message, eid);
    self.emit('request', xml, eid);

    var tryJSONparse = function(body) {
      try {
        return JSON.parse(body);
      }
      catch (err) {
        return undefined;
      }
    };

    if (this.streamAllowed && typeof self.httpClient.requestStream === 'function') {
      callback = _.once(callback);
      var startTime = Date.now();
      req = self.httpClient.requestStream(location, xml, headers, options, self);
      self.lastRequestHeaders = req.headers;
      var onError = function onError(err) {
        self.lastResponse = null;
        self.lastResponseHeaders = null;
        self.lastElapsedTime = null;
        self.emit('response', null, null, eid);

        callback(err, undefined, undefined, undefined, xml);
      };
      req.on('error', onError);
      req.on('response', function(response) {
        response.on('error', onError);

        // When the output element cannot be looked up in the wsdl, play it safe and
        // don't stream
        if (response.statusCode !== 200 || !output || !output.$lookupTypes) {
          response.pipe(concatStream({encoding: 'string'}, function(body) {
            self.lastResponse = body;
            self.lastResponseHeaders = response && response.headers;
            self.lastElapsedTime = Date.now() - startTime;
            self.emit('response', body, response, eid);

            return parseSync(body, response);

          }));
          return;
        }

        self.wsdl.xmlToObject(response, function(error, obj) {
          self.lastResponse = response;
          self.lastResponseHeaders = response && response.headers;
          self.lastElapsedTime = Date.now() - startTime;
          self.emit('response', '<stream>', response, eid);

          if (error) {
            error.response = response;
            error.body = '<stream>';
            self.emit('soapError', error, eid);
            return callback(error, response, undefined, undefined, xml);
          }

          return finish(obj, '<stream>', response);
        });
      });
      return;
    }

    req = self.httpClient.request(location, xml, function(err, response, body) {
      self.lastResponse = body;
      self.lastResponseHeaders = response && response.headers;
      self.lastElapsedTime = response && response.elapsedTime;
      self.emit('response', body, response, eid);

      if (err) {
        callback(err, undefined, undefined, undefined, xml);
      } else {
        return parseSync(body, response);
      }
    }, headers, options, self);

    function parseSync(body, response) {
      var obj;
      try {
        obj = self.wsdl.xmlToObject(body);
      } catch (error) {
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
        self.emit('soapError', error, eid);
        return callback(error, response, body, undefined, xml);
      }
      return finish(obj, body, response);
    }

    function finish(obj, body, response) {
      var result;

      if (!output){
        // one-way, no output expected
        return callback(null, null, body, obj.Header, xml);
      }

      // If it's not HTML and Soap Body is empty
      if (!obj.html && !obj.Body) {
        return callback(null, obj, body, obj.Header);
      }

      if ( typeof obj.Body !== 'object' ) {
        var error: ISoapError = new Error('Cannot parse response');
        error.response = response;
        error.body = body;
        return callback(error, obj, body, undefined, xml);
      }

      result = obj.Body[output.$name];
      // RPC/literal response body may contain elements with added suffixes I.E.
      // 'Response', or 'Output', or 'Out'
      // This doesn't necessarily equal the ouput message name. See WSDL 1.1 Section 2.4.5
      if (!result){
        result = obj.Body[output.$name.replace(/(?:Out(?:put)?|Response)$/, '')];
      }
      if (!result) {
        ['Response', 'Out', 'Output'].forEach(function(term) {
          if (obj.Body.hasOwnProperty(name + term)) {
            return result = obj.Body[name + term];
          }
        });
      }

      callback(null, result, body, obj.Header, xml);
    }

    // Added mostly for testability, but possibly useful for debugging
    if (req && req.headers && !options.ntlm) // fixes an issue when req or req.headers is undefined, doesn't apply to ntlm requests
      self.lastRequestHeaders = req.headers;
  }
}
