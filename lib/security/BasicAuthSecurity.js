"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasicAuthSecurity = void 0;
const _ = require("lodash");
class BasicAuthSecurity {
    constructor(username, password, defaults) {
        this._username = username;
        this._password = password;
        this.defaults = {};
        _.merge(this.defaults, defaults);
    }
    addHeaders(headers) {
        headers.Authorization = 'Basic ' + Buffer.from((this._username + ':' + this._password) || '').toString('base64');
    }
    toXML() {
        return '';
    }
    addOptions(options) {
        _.merge(options, this.defaults);
    }
}
exports.BasicAuthSecurity = BasicAuthSecurity;
//# sourceMappingURL=BasicAuthSecurity.js.map