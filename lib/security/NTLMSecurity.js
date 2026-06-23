"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NTLMSecurity = void 0;
const _ = require("lodash");
class NTLMSecurity {
    constructor(username, password, domain, workstation) {
        if (typeof username === 'object') {
            this.defaults = username;
            this.defaults.ntlm = true;
        }
        else {
            this.defaults = {
                ntlm: true,
                username: username,
                password: password,
                domain: domain,
                workstation: workstation,
            };
        }
    }
    addHeaders(headers) {
        headers.Connection = 'keep-alive';
    }
    toXML() {
        return '';
    }
    addOptions(options) {
        _.merge(options, this.defaults);
    }
}
exports.NTLMSecurity = NTLMSecurity;
//# sourceMappingURL=NTLMSecurity.js.map