"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WSSecurityPlusCert = void 0;
class WSSecurityPlusCert {
    constructor(wsSecurity, wsSecurityCert) {
        this.wsSecurity = wsSecurity;
        this.wsSecurityCert = wsSecurityCert;
    }
    postProcess(xml, envelopeKey) {
        const securityXml = this.wsSecurity.toXML();
        const endOfHeader = xml.indexOf(`</${envelopeKey}:Header>`);
        xml = [xml.slice(0, endOfHeader), securityXml, xml.slice(endOfHeader)].join('');
        return this.wsSecurityCert.postProcess(xml, envelopeKey);
    }
}
exports.WSSecurityPlusCert = WSSecurityPlusCert;
//# sourceMappingURL=WSSecurityPlusCert.js.map