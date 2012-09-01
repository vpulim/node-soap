/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 */

var Client = require('./client').Client,
    Server = require('./server').Server,
    open_wsdl = require('./wsdl').open_wsdl,
    crypto = require('crypto'),
    WSDL = require('./wsdl').WSDL,
    https = require('https'),
    fs = require('fs');

var WSDL = require('./wsdl').WSDL;
var _wsdlCache = {};

function _requestWSDL(url, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    var wsdl = _wsdlCache[url];
    if (wsdl) {
        callback(null, wsdl);
    }
    else {
        open_wsdl(url, options, function(err, wsdl) {
            if (err) 
                return callback(err);
            else
                _wsdlCache[url] = wsdl;
            callback(null, wsdl);
        })
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
        callback(err, wsdl && new Client(wsdl, endpoint));
    })
}

function listen(server, pathOrOptions, services, xml) {
    var options = {},
        path = pathOrOptions;

    if (typeof pathOrOptions === 'object') {
        options = pathOrOptions;
        path = options.path;
        services = options.services;
        xml = options.xml;
    }

    var wsdl = new WSDL(xml || services, null, options);
    return new Server(server, path, services, wsdl);
}

function BasicAuthSecurity(username, password) {
    this._username = username;
    this._password = password;
}

BasicAuthSecurity.prototype.addHeaders = function (headers) {
    headers['Authorization'] = "Basic " + new Buffer((this._username + ':' + this._password) || '').toString('base64');
}

BasicAuthSecurity.prototype.toXML = function() {
    return "";
}

function ClientSSLSecurity(keyPath, certPath) {
    this.key  =  fs.readFileSync(keyPath);
    this.cert =  fs.readFileSync(certPath);
}

ClientSSLSecurity.prototype.toXML = function (headers) {
    return "";
}

ClientSSLSecurity.prototype.addOptions = function (options) {
    options.key = this.key;
    options.cert = this.cert;
    options.agent = new https.Agent(options);
}

function WSSecurity(username, password, passwordType) {
    this._username = username;
    this._password = password;
    this._passwordType = passwordType || 'PasswordText';
}

var passwordDigest = function(nonce, created, password) {
    // digest = base64 ( sha1 ( nonce + created + password ) )
    var pwHash = crypto.createHash('sha1');
    var rawNonce = new Buffer(nonce || '', 'base64').toString('binary');
    pwHash.update(rawNonce + created + password);
    var passwordDigest = pwHash.digest('base64');
    return passwordDigest;
}

WSSecurity.prototype.toXML = function() {
    // avoid dependency on date formatting libraries
    function getDate(d) {
        function pad(n){return n<10 ? '0'+n : n}
        return d.getUTCFullYear()+'-'
            + pad(d.getUTCMonth()+1)+'-'
            + pad(d.getUTCDate())+'T'
            + pad(d.getUTCHours())+':'
            + pad(d.getUTCMinutes())+':'
            + pad(d.getUTCSeconds())+'Z';
    }
    var now = new Date();
    var created = getDate( now );
    var expires = getDate( new Date(now.getTime() + (1000 * 600)) );

    // nonce = base64 ( sha1 ( created + random ) )
    var nHash = crypto.createHash('sha1');
    nHash.update(created + Math.random());
    var nonce = nHash.digest('base64');

    return  "<wsse:Security xmlns:wsse=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\" xmlns:wsu=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd\">" +
            "<wsu:Timestamp wsu:Id=\"Timestamp-"+created+"\">" +
            "<wsu:Created>"+created+"</wsu:Created>" +
            "<wsu:Expires>"+expires+"</wsu:Expires>" +
            "</wsu:Timestamp>" +
            "<wsse:UsernameToken xmlns:wsu=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd\" wsu:Id=\"SecurityToken-"+created+"\">" +
            "<wsse:Username>"+this._username+"</wsse:Username>" +
            (this._passwordType === 'PasswordText' ?
            "<wsse:Password>"+this._password+"</wsse:Password>"
            :
            "<wsse:Password Type=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest\">"+passwordDigest(nonce, created, this._password)+"</wsse:Password>"
            ) +
            "<wsse:Nonce EncodingType=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary\">"+nonce+"</wsse:Nonce>" +
            "<wsu:Created>"+created+"</wsu:Created>" +
            "</wsse:UsernameToken>" +
            "</wsse:Security>"
}

exports.BasicAuthSecurity = BasicAuthSecurity;
exports.WSSecurity = WSSecurity;
exports.ClientSSLSecurity = ClientSSLSecurity;
exports.createClient = createClient;
exports.passwordDigest = passwordDigest;
exports.listen = listen;
exports.WSDL = WSDL;
