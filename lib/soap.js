"use strict";
/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listen = exports.createClientAsync = exports.createClient = exports.WSDL = exports.passwordDigest = exports.Server = exports.WSSecurityCertWithToken = exports.WSSecurityPlusCert = exports.WSSecurityCert = exports.WSSecurity = exports.NTLMSecurity = exports.ClientSSLSecurityPFX = exports.ClientSSLSecurity = exports.BearerSecurity = exports.BasicAuthSecurity = exports.HttpClient = exports.Client = exports.security = void 0;
const debug_1 = require("debug");
const client_1 = require("./client");
const _security = require("./security");
const server_1 = require("./server");
const utils_1 = require("./utils");
const wsdl_1 = require("./wsdl");
const debug = (0, debug_1.default)('node-soap:soap');
exports.security = _security;
var client_2 = require("./client");
Object.defineProperty(exports, "Client", { enumerable: true, get: function () { return client_2.Client; } });
var http_1 = require("./http");
Object.defineProperty(exports, "HttpClient", { enumerable: true, get: function () { return http_1.HttpClient; } });
var security_1 = require("./security");
Object.defineProperty(exports, "BasicAuthSecurity", { enumerable: true, get: function () { return security_1.BasicAuthSecurity; } });
Object.defineProperty(exports, "BearerSecurity", { enumerable: true, get: function () { return security_1.BearerSecurity; } });
Object.defineProperty(exports, "ClientSSLSecurity", { enumerable: true, get: function () { return security_1.ClientSSLSecurity; } });
Object.defineProperty(exports, "ClientSSLSecurityPFX", { enumerable: true, get: function () { return security_1.ClientSSLSecurityPFX; } });
Object.defineProperty(exports, "NTLMSecurity", { enumerable: true, get: function () { return security_1.NTLMSecurity; } });
Object.defineProperty(exports, "WSSecurity", { enumerable: true, get: function () { return security_1.WSSecurity; } });
Object.defineProperty(exports, "WSSecurityCert", { enumerable: true, get: function () { return security_1.WSSecurityCert; } });
Object.defineProperty(exports, "WSSecurityPlusCert", { enumerable: true, get: function () { return security_1.WSSecurityPlusCert; } });
Object.defineProperty(exports, "WSSecurityCertWithToken", { enumerable: true, get: function () { return security_1.WSSecurityCertWithToken; } });
var server_2 = require("./server");
Object.defineProperty(exports, "Server", { enumerable: true, get: function () { return server_2.Server; } });
var utils_2 = require("./utils");
Object.defineProperty(exports, "passwordDigest", { enumerable: true, get: function () { return utils_2.passwordDigest; } });
__exportStar(require("./types"), exports);
var wsdl_2 = require("./wsdl");
Object.defineProperty(exports, "WSDL", { enumerable: true, get: function () { return wsdl_2.WSDL; } });
function getFromCache(key, cache, load, callback) {
    if (!cache.has(key)) {
        load((err, result) => {
            if (err) {
                return callback(err);
            }
            cache.set(key, result);
            callback(null, result);
        });
    }
    else {
        process.nextTick(() => {
            callback(null, cache.get(key));
        });
    }
}
function _requestWSDL(url, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    const openWsdl = (callback) => {
        (0, wsdl_1.open_wsdl)(url, options, callback);
    };
    if (options.disableCache === true) {
        openWsdl(callback);
    }
    else {
        let cache;
        if (options.wsdlCache) {
            cache = options.wsdlCache;
        }
        else {
            cache = utils_1.wsdlCacheSingleton;
        }
        getFromCache(url, cache, openWsdl, callback);
    }
}
function createClient(url, p2, p3, p4) {
    let endpoint = p4;
    let callback;
    let options;
    if (typeof p2 === 'function') {
        callback = p2;
        endpoint = p3;
        options = {};
    }
    else if (typeof p3 === 'function') {
        options = p2;
        callback = p3;
        endpoint = p4;
    }
    endpoint = options.endpoint || endpoint;
    _requestWSDL(url, options, (err, wsdl) => {
        callback(err, wsdl && new client_1.Client(wsdl, endpoint, options));
    });
}
exports.createClient = createClient;
function createClientAsync(url, options, endpoint) {
    if (typeof options === 'undefined') {
        options = {};
    }
    return new Promise((resolve, reject) => {
        createClient(url, options, (err, client) => {
            if (err) {
                reject(err);
            }
            resolve(client);
        }, endpoint);
    });
}
exports.createClientAsync = createClientAsync;
function listen(server, p2, services, xml, callback) {
    let options;
    let path;
    let uri = '';
    if (typeof p2 === 'object' && !(p2 instanceof RegExp)) {
        // p2 is options
        // server, options
        options = p2;
        path = options.path;
        services = options.services;
        xml = options.xml;
        uri = options.uri;
    }
    else {
        // p2 is path
        // server, path, services, wsdl
        path = p2;
        options = {
            path: p2,
            services: services,
            callback: callback,
        };
    }
    const wsdl = new wsdl_1.WSDL(xml || services, uri, options);
    return new server_1.Server(server, path, services, wsdl, options);
}
exports.listen = listen;
//# sourceMappingURL=soap.js.map