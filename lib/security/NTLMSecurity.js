"use strict";

var _ = require('lodash');

function NTLMSecurity(username, password, domain, workstation) {
    if (typeof username === "object") {
        this.defaults = username;
        this.defaults.ntlm = true;
    } else {
        this.defaults = {
            ntlm: true,
            username: username,
            password: password,
            domain: domain,
            workstation: workstation
        };
    }
}

NTLMSecurity.prototype.addHeaders = function (headers) {
  headers.Connection = 'keep-alive';
};

NTLMSecurity.prototype.toXML = function () {
    return '';
};

NTLMSecurity.prototype.addOptions = function (options) {
    _.merge(options, this.defaults);
};

module.exports = NTLMSecurity;
