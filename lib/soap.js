"use strict";
/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) __createBinding(exports, m, p);
};
exports.__esModule = true;
exports.listen = exports.createClientAsync = exports.createClient = exports.security = void 0;
var debugBuilder = require("debug");
var client_1 = require("./client");
var _security = require("./security");
var server_1 = require("./server");
var wsdl_1 = require("./wsdl");
var debug = debugBuilder('node-soap:soap');
exports.security = _security;
var client_2 = require("./client");
__createBinding(exports, client_2, "Client");
var http_1 = require("./http");
__createBinding(exports, http_1, "HttpClient");
var security_1 = require("./security");
__createBinding(exports, security_1, "BasicAuthSecurity");
__createBinding(exports, security_1, "BearerSecurity");
__createBinding(exports, security_1, "ClientSSLSecurity");
__createBinding(exports, security_1, "ClientSSLSecurityPFX");
__createBinding(exports, security_1, "NTLMSecurity");
__createBinding(exports, security_1, "WSSecurity");
__createBinding(exports, security_1, "WSSecurityCert");
var server_2 = require("./server");
__createBinding(exports, server_2, "Server");
var utils_1 = require("./utils");
__createBinding(exports, utils_1, "passwordDigest");
__exportStar(require("./types"), exports);
var wsdl_2 = require("./wsdl");
__createBinding(exports, wsdl_2, "WSDL");
function createCache() {
    var cache = {};
    return function (key, load, callback) {
        if (!cache[key]) {
            load(function (err, result) {
                if (err) {
                    return callback(err);
                }
                cache[key] = result;
                callback(null, result);
            });
        }
        else {
            process.nextTick(function () {
                callback(null, cache[key]);
            });
        }
    };
}
var getFromCache = createCache();
function _requestWSDL(url, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    var openWsdl = function (callback) {
        wsdl_1.open_wsdl(url, options, callback);
    };
    if (options.disableCache === true) {
        openWsdl(callback);
    }
    else {
        getFromCache(url, openWsdl, callback);
    }
}
function createClient(url, p2, p3, p4) {
    var endpoint = p4;
    var callback;
    var options;
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
    _requestWSDL(url, options, function (err, wsdl) {
        callback(err, wsdl && new client_1.Client(wsdl, endpoint, options));
    });
}
exports.createClient = createClient;
function createClientAsync(url, options, endpoint) {
    if (typeof options === 'undefined') {
        options = {};
    }
    return new Promise(function (resolve, reject) {
        createClient(url, options, function (err, client) {
            if (err) {
                reject(err);
            }
            resolve(client);
        }, endpoint);
    });
}
exports.createClientAsync = createClientAsync;
function listen(server, p2, services, xml, callback) {
    var options;
    var path;
    var uri = '';
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
            callback: callback
        };
    }
    var wsdl = new wsdl_1.WSDL(xml || services, uri, options);
    return new server_1.Server(server, path, services, wsdl, options);
}
exports.listen = listen;
//# sourceMappingURL=soap.js.map