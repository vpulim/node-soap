"use strict";
/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
exports.__esModule = true;
exports.HttpClient = void 0;
var req = require("axios");
var axios_ntlm_1 = require("axios-ntlm");
var debugBuilder = require("debug");
var url = require("url");
var uuid_1 = require("uuid");
var MIMEType = require("whatwg-mimetype");
var zlib_1 = require("zlib");
var utils_1 = require("./utils");
var debug = debugBuilder('node-soap');
var VERSION = require('../package.json').version;
/**
 * A class representing the http client
 * @param {Object} [options] Options object. It allows the customization of
 * `request` module
 *
 * @constructor
 */
var HttpClient = /** @class */ (function () {
    function HttpClient(options) {
        options = options || {};
        this.options = options;
        this._request = options.request || req["default"].create();
    }
    /**
     * Build the HTTP request (method, uri, headers, ...)
     * @param {String} rurl The resource url
     * @param {Object|String} data The payload
     * @param {Object} exheaders Extra http headers
     * @param {Object} exoptions Extra options
     * @returns {Object} The http request object for the `request` module
     */
    HttpClient.prototype.buildRequest = function (rurl, data, exheaders, exoptions) {
        if (exoptions === void 0) { exoptions = {}; }
        var curl = url.parse(rurl);
        var method = data ? 'POST' : 'GET';
        var secure = curl.protocol === 'https:';
        var path = [curl.pathname || '/', curl.search || '', curl.hash || ''].join('');
        var host = curl.hostname;
        var port = parseInt(curl.port, 10);
        var headers = {
            'User-Agent': 'node-soap/' + VERSION,
            'Accept': 'text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
            'Accept-Encoding': 'none',
            'Accept-Charset': 'utf-8',
            'Connection': exoptions.forever ? 'keep-alive' : 'close',
            'Host': host + (isNaN(port) ? '' : ':' + port)
        };
        var mergeOptions = ['headers'];
        var _attachments = exoptions.attachments, newExoptions = __rest(exoptions, ["attachments"]);
        var attachments = _attachments || [];
        if (typeof data === 'string' && attachments.length === 0 && !exoptions.forceMTOM) {
            headers['Content-Length'] = Buffer.byteLength(data, 'utf8');
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
        exheaders = exheaders || {};
        for (var attr in exheaders) {
            headers[attr] = exheaders[attr];
        }
        var options = {
            url: curl.href,
            method: method,
            headers: headers,
            transformResponse: function (data) { return data; }
        };
        if (!exoptions.ntlm) {
            options.validateStatus = null;
        }
        if (exoptions.forceMTOM || attachments.length > 0) {
            var start = uuid_1.v4();
            var action = null;
            if (headers['Content-Type'].indexOf('action') > -1) {
                for (var _i = 0, _a = headers['Content-Type'].split('; '); _i < _a.length; _i++) {
                    var ct = _a[_i];
                    if (ct.indexOf('action') > -1) {
                        action = ct;
                    }
                }
            }
            var boundary_1 = uuid_1.v4();
            headers['Content-Type'] = 'multipart/related; type="application/xop+xml"; start="<' + start + '>"; type="text/xml"; boundary=' + boundary_1;
            if (action) {
                headers['Content-Type'] = headers['Content-Type'] + '; ' + action;
            }
            var multipart_1 = [{
                    'Content-Type': 'application/xop+xml; charset=UTF-8; type="text/xml"',
                    'Content-ID': '<' + start + '>',
                    'body': data
                }];
            attachments.forEach(function (attachment) {
                multipart_1.push({
                    'Content-Type': attachment.mimetype,
                    'Content-Transfer-Encoding': 'binary',
                    'Content-ID': '<' + attachment.contentId + '>',
                    'Content-Disposition': 'attachment; filename="' + attachment.name + '"',
                    'body': attachment.body
                });
            });
            options.data = "--" + boundary_1 + "\r\n";
            var multipartCount_1 = 0;
            multipart_1.forEach(function (part) {
                Object.keys(part).forEach(function (key) {
                    if (key !== 'body') {
                        options.data += key + ": " + part[key] + "\r\n";
                    }
                });
                options.data += '\r\n';
                options.data += part.body + "\r\n--" + boundary_1 + (multipartCount_1 === multipart_1.length - 1 ? '--' : '') + "\r\n";
                multipartCount_1++;
            });
        }
        else {
            options.data = data;
        }
        if (exoptions.forceGzip) {
            options.decompress = true;
            options.data = zlib_1.gzipSync(options.data);
            options.headers['Accept-Encoding'] = 'gzip,deflate';
            options.headers['Content-Encoding'] = 'gzip';
        }
        for (var attr in newExoptions) {
            if (mergeOptions.indexOf(attr) !== -1) {
                for (var header in exoptions[attr]) {
                    options[attr][header] = exoptions[attr][header];
                }
            }
            else {
                options[attr] = exoptions[attr];
            }
        }
        debug('Http request: %j', options);
        return options;
    };
    /**
     * Handle the http response
     * @param {Object} The req object
     * @param {Object} res The res object
     * @param {Object} body The http body
     * @param {Object} The parsed body
     */
    HttpClient.prototype.handleResponse = function (req, res, body) {
        debug('Http response body: %j', body);
        if (typeof body === 'string') {
            // Remove any extra characters that appear before or after the SOAP envelope.
            var regex = /(?:<\?[^?]*\?>[\s]*)?<([^:]*):Envelope([\S\s]*)<\/\1:Envelope>/i;
            var match = body.replace(/<!--[\s\S]*?-->/, '').match(regex);
            if (match) {
                body = match[0];
            }
        }
        return body;
    };
    HttpClient.prototype.request = function (rurl, data, callback, exheaders, exoptions, caller) {
        var _this_1 = this;
        var options = this.buildRequest(rurl, data, exheaders, exoptions);
        var req;
        if (exoptions !== undefined && exoptions.ntlm) {
            var ntlmReq = axios_ntlm_1.NtlmClient({
                username: exoptions.username,
                password: exoptions.password,
                workstation: exoptions.workstation || '',
                domain: exoptions.domain || ''
            });
            req = ntlmReq(options);
        }
        else {
            if (this.options.parseReponseAttachments) {
                options.responseType = 'arraybuffer';
                options.responseEncoding = 'binary';
            }
            req = this._request(options);
        }
        var _this = this;
        req.then(function (res) {
            var body;
            if (_this.options.parseReponseAttachments) {
                var isMultipartResp = res.headers['content-type'] && res.headers['content-type'].toLowerCase().indexOf('multipart/related') > -1;
                if (isMultipartResp) {
                    var boundary = void 0;
                    var parsedContentType = MIMEType.parse(res.headers['content-type']);
                    if (parsedContentType) {
                        boundary = parsedContentType.parameters.get('boundary');
                    }
                    if (!boundary) {
                        return callback(new Error('Missing boundary from content-type'));
                    }
                    var multipartResponse = utils_1.parseMTOMResp(res.data, boundary);
                    // first part is the soap response
                    var firstPart = multipartResponse.parts.shift();
                    if (!firstPart || !firstPart.body) {
                        return callback(new Error('Cannot parse multipart response'));
                    }
                    body = firstPart.body.toString('utf8');
                    res.mtomResponseAttachments = multipartResponse;
                }
                else {
                    body = res.data.toString('utf8');
                }
            }
            res.data = _this_1.handleResponse(req, res, body || res.data);
            callback(null, res, res.data);
            return res;
        }, function (err) {
            return callback(err);
        });
        return req;
    };
    HttpClient.prototype.requestStream = function (rurl, data, exheaders, exoptions, caller) {
        var _this_1 = this;
        var options = this.buildRequest(rurl, data, exheaders, exoptions);
        options.responseType = 'stream';
        var req = this._request(options).then(function (res) {
            res.data = _this_1.handleResponse(req, res, res.data);
            return res;
        });
        return req;
    };
    return HttpClient;
}());
exports.HttpClient = HttpClient;
//# sourceMappingURL=http.js.map