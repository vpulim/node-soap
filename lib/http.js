/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

var http = require('http'),
    https = require('https'),
    url = require('url'),
    compress = null;

try { compress = require("compress"); } catch(e) {}

var VERSION = "0.0.1";

exports.request = function(rurl, data, callback, exheaders) {
    var curl = url.parse(rurl);
	var secure = curl.protocol == 'https:';
	var host = curl.hostname;
	var port = parseInt(curl.port || secure ? 443 : 80);
	var path = [curl.pathname || '/', curl.search || '', curl.hash || ''].join('');
	var method = data ? "POST" : "GET";
	var headers = {
		"User-Agent": "node-soap/" + VERSION,
		"Accept" : "text/html,application/xhtml+xml,application/xml",
        "Accept-Encoding": compress ? "gzip,deflate" : "none",
        "Accept-Charset": "utf-8",
        "Connection": "close",
		"Host" : host
	};

	if (typeof data == 'string') {
		headers["Content-Length"] = data.length;
		headers["Content-Type"] = "application/x-www-form-urlencoded";
	}

    exheaders = exheaders || {};
    for (attr in exheaders) { headers[attr] = exheaders[attr]; }		

    var options = {
        host: host,
        port: port,
        method: method,
        path: path,
        headers: headers,
        agent: false
    };

    var request = (secure ? https : http).request(options);
    request.on('response', function(res) {            
        var chunks = [], gunzip;
        if (compress && res.headers["content-encoding"] == "gzip") {
    	    gunzip = new compress.Gunzip;    
            gunzip.init();
        }
        res.setEncoding(res.headers["content-encoding"] == "gzip" ? "binary" : "utf8");
        res.on('data', function(chunk) {
            if (gunzip) chunk = gunzip.inflate(chunk, "binary");
            chunks.push(chunk);
        });
        res.on('end', function() {
            res.body = chunks.join('');
            if (gunzip) {
                gunzip.end();
                gunzip = null
            }
            callback(null, res);
        });
        res.on('error', callback);
    });
    request.on('error', callback);
    request.end(data);
}
