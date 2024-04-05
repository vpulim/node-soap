"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WSSecurityCert = void 0;
const uuid_1 = require("uuid");
const xml_crypto_1 = require("xml-crypto");
function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
}
function dateStringForSOAP(date) {
    return date.getUTCFullYear() + '-' + ('0' + (date.getUTCMonth() + 1)).slice(-2) + '-' +
        ('0' + date.getUTCDate()).slice(-2) + 'T' + ('0' + date.getUTCHours()).slice(-2) + ':' +
        ('0' + date.getUTCMinutes()).slice(-2) + ':' + ('0' + date.getUTCSeconds()).slice(-2) + 'Z';
}
function generateCreated() {
    return dateStringForSOAP(new Date());
}
function generateExpires() {
    return dateStringForSOAP(addMinutes(new Date(), 10));
}
function insertStr(src, dst, pos) {
    return [dst.slice(0, pos), src, dst.slice(pos)].join('');
}
function generateId() {
    return (0, uuid_1.v4)().replace(/-/gm, '');
}
function resolvePlaceholderInReferences(references, bodyXpath) {
    for (const ref of references) {
        if (ref.xpath === bodyXpathPlaceholder) {
            ref.xpath = bodyXpath;
        }
    }
}
const oasisBaseUri = 'http://docs.oasis-open.org/wss/2004/01';
const bodyXpathPlaceholder = '[[bodyXpath]]';
class WSSecurityCert {
    constructor(privatePEM, publicP12PEM, password, options = {}) {
        this.signerOptions = {};
        this.additionalReferences = [];
        this.publicP12PEM = publicP12PEM.toString()
            .replace('-----BEGIN CERTIFICATE-----', '')
            .replace('-----END CERTIFICATE-----', '')
            .replace(/(\r\n|\n|\r)/gm, '');
        this.signer = new xml_crypto_1.SignedXml(options?.signerOptions?.idMode);
        if (options.signatureAlgorithm === 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256') {
            this.signer.signatureAlgorithm = options.signatureAlgorithm;
            this.signer.addReference(bodyXpathPlaceholder, ['http://www.w3.org/2001/10/xml-exc-c14n#'], 'http://www.w3.org/2001/04/xmlenc#sha256');
        }
        if (options.additionalReferences && options.additionalReferences.length > 0) {
            this.additionalReferences = options.additionalReferences;
        }
        if (options.signerOptions) {
            const { signerOptions } = options;
            this.signerOptions = signerOptions;
            if (!this.signerOptions.existingPrefixes) {
                this.signerOptions.existingPrefixes = {};
            }
            if (this.signerOptions.existingPrefixes && !this.signerOptions.existingPrefixes.wsse) {
                this.signerOptions.existingPrefixes.wsse = `${oasisBaseUri}/oasis-200401-wss-wssecurity-secext-1.0.xsd`;
            }
        }
        else {
            this.signerOptions = { existingPrefixes: { wsse: `${oasisBaseUri}/oasis-200401-wss-wssecurity-secext-1.0.xsd` } };
        }
        this.signer.signingKey = {
            key: privatePEM,
            passphrase: password,
        };
        this.x509Id = `x509-${generateId()}`;
        this.hasTimeStamp = typeof options.hasTimeStamp === 'undefined' ? true : !!options.hasTimeStamp;
        this.signatureTransformations = Array.isArray(options.signatureTransformations) ? options.signatureTransformations
            : ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/2001/10/xml-exc-c14n#'];
        this.signer.keyInfoProvider = {};
        this.signer.keyInfoProvider.getKeyInfo = (key) => {
            return `<wsse:SecurityTokenReference>` +
                `<wsse:Reference URI="#${this.x509Id}" ValueType="${oasisBaseUri}/oasis-200401-wss-x509-token-profile-1.0#X509v3"/>` +
                `</wsse:SecurityTokenReference>`;
        };
    }
    postProcess(xml, envelopeKey) {
        this.created = generateCreated();
        this.expires = generateExpires();
        let timestampStr = '';
        if (this.hasTimeStamp) {
            timestampStr =
                `<Timestamp xmlns="${oasisBaseUri}/oasis-200401-wss-wssecurity-utility-1.0.xsd" Id="_1">` +
                    `<Created>${this.created}</Created>` +
                    `<Expires>${this.expires}</Expires>` +
                    `</Timestamp>`;
        }
        const binarySecurityToken = `<wsse:BinarySecurityToken ` +
            `EncodingType="${oasisBaseUri}/oasis-200401-wss-soap-message-security-1.0#Base64Binary" ` +
            `ValueType="${oasisBaseUri}/oasis-200401-wss-x509-token-profile-1.0#X509v3" ` +
            `wsu:Id="${this.x509Id}">${this.publicP12PEM}</wsse:BinarySecurityToken>` +
            timestampStr;
        let xmlWithSec;
        const secExt = `xmlns:wsse="${oasisBaseUri}/oasis-200401-wss-wssecurity-secext-1.0.xsd"`;
        const secUtility = `xmlns:wsu="${oasisBaseUri}/oasis-200401-wss-wssecurity-utility-1.0.xsd"`;
        const endOfSecurityHeader = xml.indexOf('</wsse:Security>');
        if (endOfSecurityHeader > -1) {
            const securityHeaderRegexp = /<wsse:Security( [^>]*)?>/;
            const match = xml.match(securityHeaderRegexp);
            let insertHeaderAttributes = '';
            if (!match[0].includes(` ${envelopeKey}:mustUnderstand="`)) {
                insertHeaderAttributes += `${envelopeKey}:mustUnderstand="1" `;
            }
            if (!match[0].includes(secExt.substring(0, secExt.indexOf('=')))) {
                insertHeaderAttributes += `${secExt} `;
            }
            if (!match[0].includes(secUtility.substring(0, secExt.indexOf('=')))) {
                insertHeaderAttributes += `${secUtility} `;
            }
            const headerMarker = '<wsse:Security ';
            const startOfSecurityHeader = xml.indexOf(headerMarker);
            xml = insertStr(binarySecurityToken, xml, endOfSecurityHeader);
            xmlWithSec = insertStr(insertHeaderAttributes, xml, startOfSecurityHeader + headerMarker.length);
        }
        else {
            const secHeader = `<wsse:Security ${secExt} ` +
                secUtility +
                `${envelopeKey}:mustUnderstand="1">` +
                binarySecurityToken +
                `</wsse:Security>`;
            xmlWithSec = insertStr(secHeader, xml, xml.indexOf(`</${envelopeKey}:Header>`));
        }
        const references = this.signatureTransformations;
        const bodyXpath = `//*[name(.)='${envelopeKey}:Body']`;
        resolvePlaceholderInReferences(this.signer.references, bodyXpath);
        if (!(this.signer.references.filter((ref) => (ref.xpath === bodyXpath)).length > 0)) {
            this.signer.addReference(bodyXpath, references);
        }
        for (const name of this.additionalReferences) {
            const xpath = `//*[name(.)='${name}']`;
            if (!(this.signer.references.filter((ref) => (ref.xpath === xpath)).length > 0)) {
                this.signer.addReference(xpath, references);
            }
        }
        const timestampXpath = `//*[name(.)='wsse:Security']/*[local-name(.)='Timestamp']`;
        if (this.hasTimeStamp && !(this.signer.references.filter((ref) => (ref.xpath === timestampXpath)).length > 0)) {
            this.signer.addReference(timestampXpath, references);
        }
        this.signer.computeSignature(xmlWithSec, this.signerOptions);
        const originalXmlWithIds = this.signer.getOriginalXmlWithIds();
        const signatureXml = this.signer.getSignatureXml();
        return insertStr(signatureXml, originalXmlWithIds, originalXmlWithIds.indexOf('</wsse:Security>'));
    }
}
exports.WSSecurityCert = WSSecurityCert;
//# sourceMappingURL=WSSecurityCert.js.map