/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

import * as BluebirdPromise from 'bluebird';
import * as debugBuilder from 'debug';
import { Client } from './client';
import * as _security from './security';
import { Server, ServerType } from './server';
import { IOptions, IServerOptions } from './types';
import { open_wsdl, WSDL } from './wsdl';

const debug = debugBuilder('node-soap:soap');

export const security = _security;
export { Client } from './client';
export { HttpClient } from './http';
export { BasicAuthSecurity, BearerSecurity, ClientSSLSecurity, ClientSSLSecurityPFX, NTLMSecurity, WSSecurity, WSSecurityCert } from './security';
export { Server } from './server';
export { passwordDigest } from './utils';
export * from './types';

type WSDLCallback = (error: any, result?: WSDL) => any;

function createCache() {
  var cache: {
    [key: string]: WSDL,
  } = {};
  return function (key: string, load: (cb: WSDLCallback) => any, callback: WSDLCallback) {
    if (!cache[key]) {
      load(function (err, result) {
        if (err) {
          return callback(err);
        }
        cache[key] = result;
        callback(null, result);
      });
    } else {
      process.nextTick(function () {
        callback(null, cache[key]);
      });
    }
  };
}
var getFromCache = createCache();

function _requestWSDL(url: string, options: IOptions, callback: WSDLCallback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  var openWsdl = function(callback: WSDLCallback) {
    open_wsdl(url, options, callback);
  };

  if (options.disableCache === true) {
    openWsdl(callback);
  } else {
    getFromCache(url, openWsdl, callback);
  }
}

export type CreateClientCallback = (err: any, client: Client) => void;

export function createClient(url: string, callback: CreateClientCallback, endpoint?: string): void;
export function createClient(url: string, options: IOptions, callback: CreateClientCallback, endpoint?: string): void;
export function createClient(url: string, p2: CreateClientCallback | IOptions, p3?: CreateClientCallback | string, p4?: string): void {
  let endpoint: string = p4;
  let callback: CreateClientCallback;
  let options: IOptions;
  if (typeof p2 === 'function') {
    callback = p2;
    endpoint = p3 as string;
    options = {};
  } else if (typeof p3 === 'function') {
    options = p2;
    callback = p3;
    endpoint = p4;
  }
  endpoint = options.endpoint || endpoint;
  _requestWSDL(url, options, function(err, wsdl) {
    callback(err, wsdl && new Client(wsdl, endpoint, options));
  });
}

export function createClientAsync(url: string, options: IOptions, endpoint?: string): BluebirdPromise<Client> {
  if (typeof options === 'undefined') {
    options = {};
  }
  return new BluebirdPromise(function(resolve, reject) {
    createClient(url, options, function(err, client) {
      if (err) {
        reject(err);
      }
      resolve(client);
    }, endpoint);
  });
}

export function listen(server: ServerType, path: string, services: any, wsdl: string): Server;
export function listen(server: ServerType, options: IServerOptions): Server;
export function listen(server: ServerType, p2: string | IServerOptions, services?: any, xml?: string): Server {
  let options: IServerOptions;
  let path: string;
  let uri = '';

  if (typeof p2 === 'object') {
    // p2 is options
    // server, options
    options = p2;
    path = options.path;
    services = options.services;
    xml = options.xml;
    uri = options.uri;
  } else {
    // p2 is path
    // server, path, services, wsdl
    path = p2;
    options = {
      path: p2,
      services: services,
    };
  }

  var wsdl = new WSDL(xml || services, uri, options);
  return new Server(server, path, services, wsdl, options);
}
