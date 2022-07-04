"use strict";
exports.__esModule = true;
exports.BasicAuthSecurity = void 0;
var _ = require("lodash");
var BasicAuthSecurity = /** @class */ (function () {
    function BasicAuthSecurity(username, password, defaults) {
        this._username = username;
        this._password = password;
        this.defaults = {};
        _.merge(this.defaults, defaults);
    }
    BasicAuthSecurity.prototype.addHeaders = function (headers) {
        headers.Authorization = 'Basic ' + Buffer.from((this._username + ':' + this._password) || '').toString('base64');
    };
    BasicAuthSecurity.prototype.toXML = function () {
        return '';
    };
    BasicAuthSecurity.prototype.addOptions = function (options) {
        _.merge(options, this.defaults);
    };
    return BasicAuthSecurity;
}());
exports.BasicAuthSecurity = BasicAuthSecurity;
//# sourceMappingURL=BasicAuthSecurity.js.map