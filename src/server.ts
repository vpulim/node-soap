/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

import { EventEmitter } from 'events';
import * as http from 'http';
import * as url from 'url';
import { IOneWayOptions, ISecurity, IServerOptions, IServices, ISoapFault, ISoapServiceMethod } from './types';
import { findPrefix } from './utils';
import { WSDL } from './wsdl';
import { BindingElement, IPort } from './wsdl/elements';

let zlib;
try {
  zlib = require('zlib');
} catch (error) {
}

interface IExpressApp {
  route;
  use;
}

export type ServerType = http.Server | IExpressApp;
type Request = http.IncomingMessage & { body?: any };
type Response = http.ServerResponse;

function isExpress(server): server is IExpressApp {
  return (typeof server.route === 'function' && typeof server.use === 'function');
}

function isPromiseLike<T>(obj): obj is PromiseLike<T> {
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

// tslint:disable unified-signatures
// tslint:disable-next-line:interface-name
export interface Server {
  emit(event: 'request', request: any, methodName: string): boolean;
  emit(event: 'headers', headers: any, methodName: string): boolean;
  emit(event: 'response', headers: any, methodName: string): boolean;

  /** Emitted for every received messages. */
  on(event: 'request', listener: (request: any, methodName: string) => void): this;
  /** Emitted when the SOAP Headers are not empty. */
  on(event: 'headers', listener: (headers: any, methodName: string) => void): this;
  /** Emitted before sending SOAP response. */
  on(event: 'response', listener: (response: any, methodName: string) => void): this;
}

interface IExecuteMethodOptions {
  serviceName?: string;
  portName?: string;
  methodName?: string;
  outputName?: string;
  args?: any;
  headers?: any;
  style?: 'document' | 'rpc';
}

export class Server extends EventEmitter {
  public path: string | RegExp;
  public services: IServices;
  public log: (type: string, data: any) => any;
  public authorizeConnection: (req: Request, res?: Response) => boolean;
  public authenticate: (security: any, processAuthResult?: (result: boolean) => void, req?: Request, obj?: any) => boolean | void | Promise<boolean>;

  private wsdl: WSDL;
  private suppressStack: boolean;
  private returnFault: boolean;
  private onewayOptions: IOneWayOptions & { statusCode?: number; };
  private enableChunkedEncoding: boolean;
  private soapHeaders: any[];
  private callback?: (err: any, res: any) => void;

  constructor(server: ServerType, path: string | RegExp, services: IServices, wsdl: WSDL, options?: IServerOptions) {
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
    } else if (path instanceof RegExp && path.source[path.source.length - 1] !== '/') {
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
      } else {
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
          } else {
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

  public getSoapHeaders(): string[] {
    return this.soapHeaders;
  }

  public clearSoapHeaders(): void {
    this.soapHeaders = null;
  }

  private _processSoapHeader(soapHeader, name, namespace, xmlns) {
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
          } else {
            return result;
          }
        };
      default:
        return soapHeader;
    }
  }

  private _initializeOptions(options: IServerOptions) {
    this.wsdl.options.attributesKey = options.attributesKey || 'attributes';
    this.onewayOptions.statusCode = this.onewayOptions.responseCode || 200;
    this.onewayOptions.emptyBody = !!this.onewayOptions.emptyBody;
  }

  private _processRequestXml(req: Request, res: Response, xml) {
    let error;
    try {
      if (typeof this.log === 'function') {
        this.log('received', xml);
      }
      this._process(xml, req, res, (result, statusCode) => {
        this._sendHttpResponse(res, statusCode, result);
        if (typeof this.log === 'function') {
          this.log('replied', result);
        }
      });
    } catch (err) {
      if (err.Fault !== undefined) {
        return this._sendError(err.Fault, (result, statusCode) => {
          this._sendHttpResponse(res, statusCode || 500, result);
          if (typeof this.log === 'function') {
            this.log('error', err);
          }
        }, new Date().toISOString());
      } else {
        error = err.stack ? (this.suppressStack === true ? err.message : err.stack) : err;
        this._sendHttpResponse(res, /* statusCode */ 500, error);
        if (typeof this.log === 'function') {
          this.log('error', error);
        }
      }
    }
  }

  private _requestListener(req: Request, res: Response) {
    const reqParse = url.parse(req.url);
    const reqPath = reqParse.pathname;
    const reqQuery = reqParse.search;

    if (typeof this.log === 'function') {
      this.log('info', 'Handling ' + req.method + ' on ' + req.url);
    }

    if (req.method === 'GET') {

      if (reqQuery && reqQuery.toLowerCase().startsWith('?wsdl')) {
        if (typeof this.log === 'function') {
          this.log('info', 'Wants the WSDL');
        }
        res.setHeader('Content-Type', 'application/xml');
        res.write(this.wsdl.toXML());
      }
      res.end();
    } else if (req.method === 'POST') {
      if (typeof req.headers['content-type'] !== 'undefined') {
        res.setHeader('Content-Type', req.headers['content-type']);
      } else {
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
    } else {
      res.end();
    }
  }

  private _getSoapAction(req: Request) {
    if (typeof req.headers.soapaction === 'undefined') {
         return;
     }
    const soapAction: string = req.headers.soapaction as string;
    return (soapAction.indexOf('"') === 0)
         ? soapAction.slice(1, -1)
         : soapAction;
  }

  private _process(input, req: Request, res: Response, cb: (result: any, statusCode?: number) => any) {
    const pathname = url.parse(req.url).pathname.replace(/\/$/, '');
    const obj = this.wsdl.xmlToObject(input);
    const body = obj.Body ? obj.Body : obj;
    const headers = obj.Header;
    let binding: BindingElement;
    let methodName: string;
    let serviceName: string;
    let portName: string;
    const includeTimestamp = obj.Header && obj.Header.Security && obj.Header.Security.Timestamp;
    const authenticate = this.authenticate || function defaultAuthenticate() { return true; };

    const callback = (result, statusCode) => {
      const response = { result: result };
      this.emit('response', response, methodName);
      cb(response.result, statusCode);
    };

    const process = () => {

      if (typeof this.log === 'function') {
        this.log('info', 'Attempting to bind to ' + pathname);
      }

      // Avoid Cannot convert undefined or null to object due to Object.keys(body)
      // and throw more meaningful error
      if (!body) {
        throw new Error('Failed to parse the SOAP Message body');
      }

      // use port.location and current url to find the right binding
      binding = (() => {
        const services = this.wsdl.definitions.services;
        let firstPort: IPort;
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
              this.log('info', 'Trying ' + portName + ' from path ' + portPathname);
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
        } else {
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
        } else {
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
      } catch (error) {
        if (error.Fault !== undefined) {
          return this._sendError(error.Fault, callback, includeTimestamp);
        }

        throw error;
      }
    };

    // Authentication
    if (typeof authenticate === 'function') {
      let authResultProcessed = false;
      const processAuthResult = (authResult: boolean | Error) => {
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
            } catch (error) {
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
          } else {
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
      if (isPromiseLike<boolean>(functionResult)) {
        functionResult.then((result: boolean) => {
          processAuthResult(result);
        }, (err: any) => {
          processAuthResult(err);
        });
      }
      if (typeof functionResult === 'boolean') {
        processAuthResult(functionResult);
      }
    } else {
      throw new Error('Invalid authenticate function (not a function)');
    }
  }

  private _getMethodNameBySoapAction(binding: BindingElement, soapAction: string) {
    for (const methodName in binding.methods) {
      if (binding.methods[methodName].soapAction === soapAction) {
        return methodName;
      }
    }
  }

  private _executeMethod(
    options: IExecuteMethodOptions,
    req: Request,
    res: Response,
    callback: (result: any, statusCode?: number) => any,
    includeTimestamp?,
  ) {
    options = options || {};
    let method: ISoapServiceMethod;
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
        } else {
          return header;
        }
      }).join('\n');
    }

    try {
      method = this.services[serviceName][portName][methodName];
    } catch (error) {
      return callback(this._envelope('', headers, includeTimestamp));
    }

    let handled = false;
    const handleResult = (error, result?) => {
      if (handled) {
        return;
      }
      handled = true;

      if (error) {
        if (error.Fault !== undefined) {
          return this._sendError(error.Fault, callback, includeTimestamp);
        } else {
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
      } else if (style === 'document') {
        const element = binding.methods[methodName].output;
        body = this.wsdl.objectToDocumentXML(outputName, result, element.targetNSAlias, element.targetNamespace);
      } else {
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

    const methodCallback = (error, result?) => {
      if (error && error.Fault !== undefined) {
        // do nothing
      } else if (result === undefined) {
        // Backward compatibility to support one argument callback style
        result = error;
        error = null;
      }
      handleResult(error, result);
    };

    const result = method(args, methodCallback, options.headers, req, res, this);
    if (typeof result !== 'undefined') {
      if (isPromiseLike<any>(result)) {
        result.then((value) => {
          handleResult(null, value);
        }, (err) => {
          handleResult(err);
        });
      } else {
        handleResult(null, result);
      }
    }
  }

  private _envelope(body, headers, includeTimestamp) {
    const defs = this.wsdl.definitions;
    const ns = defs.$targetNamespace;
    const encoding = '';
    const alias = findPrefix(defs.xmlns, ns);

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

  private _sendError(soapFault: ISoapFault, callback: (result: any, statusCode?: number) => any, includeTimestamp) {
    let fault;

    let statusCode: number;
    if (soapFault.statusCode) {
      statusCode = soapFault.statusCode;
      soapFault.statusCode = undefined;
    }

    if ('faultcode' in soapFault) {
      // Soap 1.1 error style
      // Root element will be prependend with the soap NS
      // It must match the NS defined in the Envelope (set by the _envelope method)
      fault = this.wsdl.objectToDocumentXML('soap:Fault', soapFault, undefined);
    } else {
      // Soap 1.2 error style.
      // 3rd param is the NS prepended to all elements
      // It must match the NS defined in the Envelope (set by the _envelope method)
      fault = this.wsdl.objectToDocumentXML('Fault', soapFault, 'soap');
    }

    return callback(this._envelope(fault, '', includeTimestamp), statusCode);
  }

  private _sendHttpResponse(res: Response, statusCode: number, result) {
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
    } else {
      res.end(result);
    }
  }
}
