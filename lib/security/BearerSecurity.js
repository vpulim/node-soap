"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BearerSecurity = void 0;
const _ = require("lodash");
class BearerSecurity {
    constructor(token, defaults) {
        this._token = token;
        this.defaults = {};
        _.merge(this.defaults, defaults);
    }
    addHeaders(headers) {
        headers.Authorization = 'Bearer ' + this._token;
    }
    toXML() {
        return '';
    }
    addOptions(options) {
        _.merge(options, this.defaults);
    }
}
exports.BearerSecurity = BearerSecurity;
//# sourceMappingURL=BearerSecurity.js.map