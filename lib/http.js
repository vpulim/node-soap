/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

"use strict";

var url = require('url');
var req = require('request');

var VERSION = "0.2.0";

exports.request = function(rurl, data, callback, exheaders, exceptions) {
  var curl = url.parse(rurl);
  var host = curl.hostname;
  var method = data ? "POST" : "GET";
  var attr;
  var headers = {
    "User-Agent": "node-soap/" + VERSION,
    "Accept" : "text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
    "Accept-Encoding": "none",
    "Accept-Charset": "utf-8",
    "Connection": "close",
    "Host" : host
  };

  if (typeof data === 'string') {
    headers["Content-Length"] = Buffer.byteLength(data, 'utf8');
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  exheaders = exheaders || {};
  for (attr in exheaders) { headers[attr] = exheaders[attr]; }

  var options = {
    uri: curl,
    method: method,
    headers: headers
  };
   
  exceptions = exceptions || {};
  for (attr in exceptions) { options[attr] = exceptions[attr]; }

  var request = req(options, function (error, res, body) {
    if (error) {
      callback(error);
    } else {
      callback(null, res, body);
    }
  });
  request.on('error', callback);
  request.end(data);
};