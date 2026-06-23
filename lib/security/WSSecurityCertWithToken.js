"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WSSecurityCertWithToken = void 0;
const crypto_1 = require("crypto");
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
    return (0, crypto_1.randomUUID)().replace(/-/gm, '');
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
class WSSecurityCertWithToken {
    constructor(props) {
        this.signerOptions = {};
        this.additionalReferences = [];
        this.publicP12PEM = props.publicKey.toString()
            .replace('-----BEGIN CERTIFICATE-----', '')
            .replace('-----END CERTIFICATE-----', '')
            .replace(/(\r\n|\n|\r)/gm, '');
        this.username = props.username;
        this.password = props.password;
        this.signer = new xml_crypto_1.SignedXml();
        const opts = props.options || {};
        if (opts.signatureAlgorithm === 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256') {
            this.signer.signatureAlgorithm = opts.signatureAlgorithm;
            this.signer.addReference({
                xpath: bodyXpathPlaceholder,
                transforms: ['http://www.w3.org/2001/10/xml-exc-c14n#'],
                digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
            });
        }
        if (!opts.signatureAlgorithm) {
            this.signer.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
        }
        this.signer.canonicalizationAlgorithm = 'http://www.w3.org/2001/10/xml-exc-c14n#';
        if (opts.additionalReferences && opts.additionalReferences.length > 0) {
            this.additionalReferences = opts.additionalReferences;
        }
        if (opts.signerOptions) {
            const { signerOptions } = props.options;
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
        this.signer.privateKey = {
            key: props.privateKey,
            passphrase: props.keyPassword,
        };
        this.x509Id = `x509-${generateId()}`;
        this.hasTimeStamp = typeof opts.hasTimeStamp === 'undefined' ? true : !!opts.hasTimeStamp;
        this.signatureTransformations = Array.isArray(opts.signatureTransformations) ? opts.signatureTransformations
            : ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/2001/10/xml-exc-c14n#'];
        this.signer.keyInfoProvider = {};
        this.signer.getKeyInfo = (key) => {
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
        let usernameToken = '';
        if (this.username) {
            usernameToken = `<wsse:UsernameToken wsu:Id="SecurityToken-${this.created}" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">` +
                `<wsse:Username>${this.username}</wsse:Username> ` +
                `<wsse:Password>${this.password}</wsse:Password> ` +
                `</wsse:UsernameToken>`;
        }
        const secHeader = `<wsse:Security xmlns:wsse="${oasisBaseUri}/oasis-200401-wss-wssecurity-secext-1.0.xsd" ` +
            `xmlns:wsu="${oasisBaseUri}/oasis-200401-wss-wssecurity-utility-1.0.xsd" ` +
            `${envelopeKey}:mustUnderstand="1">` +
            `<wsse:BinarySecurityToken ` +
            `EncodingType="${oasisBaseUri}/oasis-200401-wss-soap-message-security-1.0#Base64Binary" ` +
            `ValueType="${oasisBaseUri}/oasis-200401-wss-x509-token-profile-1.0#X509v3" ` +
            `wsu:Id="${this.x509Id}">${this.publicP12PEM}</wsse:BinarySecurityToken>` +
            usernameToken +
            timestampStr +
            `</wsse:Security>`;
        const xmlWithSec = insertStr(secHeader, xml, xml.indexOf(`</${envelopeKey}:Header>`));
        const references = this.signatureTransformations;
        const bodyXpath = `//*[name(.)='${envelopeKey}:Body']`;
        resolvePlaceholderInReferences(this.signer.references, bodyXpath);
        if (!(this.signer.references.filter((ref) => (ref.xpath === bodyXpath)).length > 0)) {
            this.signer.addReference({ xpath: bodyXpath, transforms: references, digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256' });
        }
        for (const name of this.additionalReferences) {
            const xpath = `//*[name(.)='${name}']`;
            if (!(this.signer.references.filter((ref) => (ref.xpath === xpath)).length > 0)) {
                this.signer.addReference({ xpath: xpath, transforms: references, digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256' });
            }
        }
        const timestampXpath = `//*[name(.)='wsse:Security']/*[local-name(.)='Timestamp']`;
        if (this.hasTimeStamp && !(this.signer.references.filter((ref) => (ref.xpath === timestampXpath)).length > 0)) {
            this.signer.addReference({ xpath: timestampXpath, transforms: references, digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256' });
        }
        this.signer.computeSignature(xmlWithSec, this.signerOptions);
        return insertStr(this.signer.getSignatureXml(), xmlWithSec, xmlWithSec.indexOf('</wsse:Security>'));
    }
}
exports.WSSecurityCertWithToken = WSSecurityCertWithToken;
//# sourceMappingURL=WSSecurityCertWithToken.js.map