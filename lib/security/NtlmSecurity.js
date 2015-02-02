"use strict";

var _ = require('lodash');


function NtlmSecurity(username, password) {
    this.defaults = {
        username: username,
        password: password
    };
}

NtlmSecurity.prototype.addHeaders = function(headers) {

};

NtlmSecurity.prototype.toXML = function() {
    return '';
};

NtlmSecurity.prototype.addOptions = function(options) {
    _.merge(options, this.defaults);
};

module.exports = NtlmSecurity;
