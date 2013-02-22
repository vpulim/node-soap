/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

var url = require('url'),
    req = require('request');

var VERSION = "0.2.0";

exports.request = function(rurl, data, callback, exheaders, exoptions) {
    var curl = url.parse(rurl);
    var secure = curl.protocol == 'https:';
    var host = curl.hostname;
    var port = parseInt(curl.port || (secure ? 443 : 80));
    var path = [curl.pathname || '/', curl.search || '', curl.hash || ''].join('');
    var method = data ? "POST" : "GET";
    var headers = {
        "User-Agent": "node-soap/" + VERSION,
        "Accept" : "text/html,application/xhtml+xml,application/xml",
        "Accept-Encoding": "none",
        "Accept-Charset": "utf-8",
        "Connection": "close",
        "Host" : host
    };

    if (typeof data == 'string') {
        headers["Content-Length"] = Buffer.byteLength(data, 'utf8');;
        headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    exheaders = exheaders || {};
    for (var attr in exheaders) { headers[attr] = exheaders[attr]; }

    var options = {
        uri: curl,
        method: method,
        headers: headers
    };
   
    exoptions = exoptions || {};
    for (var attr in exoptions) { options[attr] = exoptions[attr]; }

    var request = req(options, function (error, res, body) {
        if (error) {
            callback(error);
        } else {
            callback(null, res, body);
        }
    });
    request.on('error', callback);
    request.end(data);
}
