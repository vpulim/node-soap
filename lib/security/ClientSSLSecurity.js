"use strict";
exports.__esModule = true;
exports.ClientSSLSecurity = void 0;
var fs = require("fs");
var https = require("https");
var _ = require("lodash");
/**
 * activates SSL for an already existing client
 *
 * @module ClientSSLSecurity
 * @param {Buffer|String}   key
 * @param {Buffer|String}   cert
 * @param {Buffer|String|Array}   [ca]
 * @param {Object}          [defaults]
 * @constructor
 */
var ClientSSLSecurity = /** @class */ (function () {
    function ClientSSLSecurity(key, cert, ca, defaults) {
        if (key) {
            if (Buffer.isBuffer(key)) {
                this.key = key;
            }
            else if (typeof key === 'string') {
                this.key = fs.readFileSync(key);
            }
            else {
                throw new Error('key should be a buffer or a string!');
            }
        }
        if (cert) {
            if (Buffer.isBuffer(cert)) {
                this.cert = cert;
            }
            else if (typeof cert === 'string') {
                this.cert = fs.readFileSync(cert);
            }
            else {
                throw new Error('cert should be a buffer or a string!');
            }
        }
        if (ca) {
            if (Buffer.isBuffer(ca) || Array.isArray(ca)) {
                this.ca = ca;
            }
            else if (typeof ca === 'string') {
                this.ca = fs.readFileSync(ca);
            }
            else {
                defaults = ca;
                this.ca = null;
            }
        }
        this.defaults = {};
        _.merge(this.defaults, defaults);
        this.agent = null;
    }
    ClientSSLSecurity.prototype.toXML = function () {
        return '';
    };
    ClientSSLSecurity.prototype.addOptions = function (options) {
        var httpsAgent = null;
        options.key = this.key;
        options.cert = this.cert;
        options.ca = this.ca;
        _.merge(options, this.defaults);
        if (!!options.forever) {
            if (!this.agent) {
                options.keepAlive = true;
                this.agent = new https.Agent(options);
            }
            httpsAgent = this.agent;
        }
        else {
            httpsAgent = new https.Agent(options);
        }
        options.httpsAgent = httpsAgent;
    };
    return ClientSSLSecurity;
}());
exports.ClientSSLSecurity = ClientSSLSecurity;
//# sourceMappingURL=ClientSSLSecurity.js.map