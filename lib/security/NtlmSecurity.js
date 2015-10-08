"use strict";

var _ = require('lodash');

function NtlmSecurity(username, password, domain, workstation) {
    if (typeof username == "object") {
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

NtlmSecurity.prototype.addHeaders = function (headers) {
  headers.Connection = 'keep-alive';
};

NtlmSecurity.prototype.toXML = function () {
    return '';
};

NtlmSecurity.prototype.addOptions = function (options) {
    _.merge(options, this.defaults);
};

module.exports = NtlmSecurity;
