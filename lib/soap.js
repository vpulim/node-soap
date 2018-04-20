/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

"use strict";

var Client = require('./client').Client,
  Server = require('./server').Server,
  HttpClient = require('./http'),
  security = require('./security'),
  passwordDigest = require('./utils').passwordDigest,
  BluebirdPromise = require('bluebird'),
  wsdl = require('./wsdl'),
  WSDL = require('./wsdl').WSDL;

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
    } else {
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
  var openWsdl = wsdl.open_wsdl.bind(null, url, options);

  if (options.disableCache === true) {
    openWsdl(callback);
  } else {
    getFromCache(url, openWsdl, callback);
  }
}

function createClient(url, options, callback, endpoint) {
  if (typeof options === 'function') {
    endpoint = callback;
    callback = options;
    options = {};
  }
  endpoint = options.endpoint || endpoint;
  _requestWSDL(url, options, function(err, wsdl) {
    callback(err, wsdl && new Client(wsdl, endpoint, options));
  });
}

function createClientAsync(url, options, endpoint) {
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

function listen(server, pathOrOptions, services, xml) {
  var options = {},
    path = pathOrOptions,
    uri = "";

  if (typeof pathOrOptions === 'object') {
    options = pathOrOptions;
    path = options.path;
    services = options.services;
    xml = options.xml;
    uri = options.uri;
  }

  var wsdl = new WSDL(xml || services, uri, options);
  return new Server(server, path, services, wsdl, options);
}

exports.security = security;
exports.BasicAuthSecurity = security.BasicAuthSecurity;
exports.WSSecurity = security.WSSecurity;
exports.WSSecurityCert = security.WSSecurityCert;
exports.ClientSSLSecurity = security.ClientSSLSecurity;
exports.ClientSSLSecurityPFX = security.ClientSSLSecurityPFX;
exports.BearerSecurity = security.BearerSecurity;
exports.createClient = createClient;
exports.createClientAsync = createClientAsync;
exports.passwordDigest = passwordDigest;
exports.listen = listen;
exports.WSDL = WSDL;

// Export Client and Server to allow customization
exports.Server = Server;
exports.Client = Client;
exports.HttpClient = HttpClient;
