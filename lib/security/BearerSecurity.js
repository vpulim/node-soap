"use strict";
exports.__esModule = true;
exports.BearerSecurity = void 0;
var _ = require("lodash");
var BearerSecurity = /** @class */ (function () {
    function BearerSecurity(token, defaults) {
        this._token = token;
        this.defaults = {};
        _.merge(this.defaults, defaults);
    }
    BearerSecurity.prototype.addHeaders = function (headers) {
        headers.Authorization = 'Bearer ' + this._token;
    };
    BearerSecurity.prototype.toXML = function () {
        return '';
    };
    BearerSecurity.prototype.addOptions = function (options) {
        _.merge(options, this.defaults);
    };
    return BearerSecurity;
}());
exports.BearerSecurity = BearerSecurity;
//# sourceMappingURL=BearerSecurity.js.map