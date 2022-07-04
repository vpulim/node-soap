"use strict";
exports.__esModule = true;
exports.parseMTOMResp = exports.xmlEscape = exports.splitQName = exports.findPrefix = exports.TNS_PREFIX = exports.passwordDigest = void 0;
var crypto = require("crypto");
var formidable_1 = require("formidable");
function passwordDigest(nonce, created, password) {
    // digest = base64 ( sha1 ( nonce + created + password ) )
    var pwHash = crypto.createHash('sha1');
    var NonceBytes = Buffer.from(nonce || '', 'base64');
    var CreatedBytes = Buffer.from(created || '', 'utf8');
    var PasswordBytes = Buffer.from(password || '', 'utf8');
    var FullBytes = Buffer.concat([NonceBytes, CreatedBytes, PasswordBytes]);
    pwHash.update(FullBytes);
    return pwHash.digest('base64');
}
exports.passwordDigest = passwordDigest;
exports.TNS_PREFIX = '__tns__'; // Prefix for targetNamespace
/**
 * Find a key from an object based on the value
 * @param {Object} Namespace prefix/uri mapping
 * @param {*} nsURI value
 * @returns {String} The matching key
 */
function findPrefix(xmlnsMapping, nsURI) {
    for (var n in xmlnsMapping) {
        if (n === exports.TNS_PREFIX) {
            continue;
        }
        if (xmlnsMapping[n] === nsURI) {
            return n;
        }
    }
}
exports.findPrefix = findPrefix;
function splitQName(nsName) {
    if (typeof nsName !== 'string') {
        return {
            prefix: exports.TNS_PREFIX,
            name: nsName
        };
    }
    var topLevelName = nsName.split('|')[0];
    var prefixOffset = topLevelName.indexOf(':');
    return {
        prefix: topLevelName.substring(0, prefixOffset) || exports.TNS_PREFIX,
        name: topLevelName.substring(prefixOffset + 1)
    };
}
exports.splitQName = splitQName;
function xmlEscape(obj) {
    if (typeof (obj) === 'string') {
        if (obj.substr(0, 9) === '<![CDATA[' && obj.substr(-3) === ']]>') {
            return obj;
        }
        return obj
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
    return obj;
}
exports.xmlEscape = xmlEscape;
function parseMTOMResp(payload, boundary) {
    var resp = {
        parts: []
    };
    var headerName = '';
    var headerValue = '';
    var data;
    var partIndex = 0;
    var parser = new formidable_1.MultipartParser();
    parser.initWithBoundary(boundary);
    parser.on('data', function (_a) {
        var name = _a.name, buffer = _a.buffer, start = _a.start, end = _a.end;
        switch (name) {
            case 'partBegin':
                resp.parts[partIndex] = {
                    body: null,
                    headers: {}
                };
                data = Buffer.from('');
                break;
            case 'headerField':
                headerName = buffer.slice(start, end).toString();
                break;
            case 'headerValue':
                headerValue = buffer.slice(start, end).toString();
                break;
            case 'headerEnd':
                resp.parts[partIndex].headers[headerName.toLowerCase()] = headerValue;
                break;
            case 'partData':
                data = Buffer.concat([data, buffer.slice(start, end)]);
                break;
            case 'partEnd':
                resp.parts[partIndex].body = data;
                partIndex++;
                break;
        }
    });
    parser.write(payload);
    return resp;
}
exports.parseMTOMResp = parseMTOMResp;
//# sourceMappingURL=utils.js.map