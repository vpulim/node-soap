"use strict";
exports.__esModule = true;
exports.WSSecurityCert = void 0;
var uuid_1 = require("uuid");
var xml_crypto_1 = require("xml-crypto");
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
    return uuid_1.v4().replace(/-/gm, '');
}
function resolvePlaceholderInReferences(references, bodyXpath) {
    for (var _i = 0, references_1 = references; _i < references_1.length; _i++) {
        var ref = references_1[_i];
        if (ref.xpath === bodyXpathPlaceholder) {
            ref.xpath = bodyXpath;
        }
    }
}
var oasisBaseUri = 'http://docs.oasis-open.org/wss/2004/01';
var bodyXpathPlaceholder = '[[bodyXpath]]';
var WSSecurityCert = /** @class */ (function () {
    function WSSecurityCert(privatePEM, publicP12PEM, password, options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        this.signerOptions = {};
        this.additionalReferences = [];
        this.publicP12PEM = publicP12PEM.toString()
            .replace('-----BEGIN CERTIFICATE-----', '')
            .replace('-----END CERTIFICATE-----', '')
            .replace(/(\r\n|\n|\r)/gm, '');
        this.signer = new xml_crypto_1.SignedXml();
        if (options.signatureAlgorithm === 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256') {
            this.signer.signatureAlgorithm = options.signatureAlgorithm;
            this.signer.addReference(bodyXpathPlaceholder, ['http://www.w3.org/2001/10/xml-exc-c14n#'], 'http://www.w3.org/2001/04/xmlenc#sha256');
        }
        if (options.additionalReferences && options.additionalReferences.length > 0) {
            this.additionalReferences = options.additionalReferences;
        }
        if (options.signerOptions) {
            var signerOptions = options.signerOptions;
            this.signerOptions = signerOptions;
            if (!this.signerOptions.existingPrefixes) {
                this.signerOptions.existingPrefixes = {};
            }
            if (this.signerOptions.existingPrefixes && !this.signerOptions.existingPrefixes.wsse) {
                this.signerOptions.existingPrefixes.wsse = oasisBaseUri + "/oasis-200401-wss-wssecurity-secext-1.0.xsd";
            }
        }
        else {
            this.signerOptions = { existingPrefixes: { wsse: oasisBaseUri + "/oasis-200401-wss-wssecurity-secext-1.0.xsd" } };
        }
        this.signer.signingKey = {
            key: privatePEM,
            passphrase: password
        };
        this.x509Id = "x509-" + generateId();
        this.hasTimeStamp = typeof options.hasTimeStamp === 'undefined' ? true : !!options.hasTimeStamp;
        this.signatureTransformations = Array.isArray(options.signatureTransformations) ? options.signatureTransformations
            : ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/2001/10/xml-exc-c14n#'];
        this.signer.keyInfoProvider = {};
        this.signer.keyInfoProvider.getKeyInfo = function (key) {
            return "<wsse:SecurityTokenReference>" +
                ("<wsse:Reference URI=\"#" + _this.x509Id + "\" ValueType=\"" + oasisBaseUri + "/oasis-200401-wss-x509-token-profile-1.0#X509v3\"/>") +
                "</wsse:SecurityTokenReference>";
        };
    }
    WSSecurityCert.prototype.postProcess = function (xml, envelopeKey) {
        this.created = generateCreated();
        this.expires = generateExpires();
        var timestampStr = '';
        if (this.hasTimeStamp) {
            timestampStr =
                "<Timestamp xmlns=\"" + oasisBaseUri + "/oasis-200401-wss-wssecurity-utility-1.0.xsd\" Id=\"_1\">" +
                    ("<Created>" + this.created + "</Created>") +
                    ("<Expires>" + this.expires + "</Expires>") +
                    "</Timestamp>";
        }
        var secHeader = "<wsse:Security xmlns:wsse=\"" + oasisBaseUri + "/oasis-200401-wss-wssecurity-secext-1.0.xsd\" " +
            ("xmlns:wsu=\"" + oasisBaseUri + "/oasis-200401-wss-wssecurity-utility-1.0.xsd\" ") +
            (envelopeKey + ":mustUnderstand=\"1\">") +
            "<wsse:BinarySecurityToken " +
            ("EncodingType=\"" + oasisBaseUri + "/oasis-200401-wss-soap-message-security-1.0#Base64Binary\" ") +
            ("ValueType=\"" + oasisBaseUri + "/oasis-200401-wss-x509-token-profile-1.0#X509v3\" ") +
            ("wsu:Id=\"" + this.x509Id + "\">" + this.publicP12PEM + "</wsse:BinarySecurityToken>") +
            timestampStr +
            "</wsse:Security>";
        var xmlWithSec = insertStr(secHeader, xml, xml.indexOf("</" + envelopeKey + ":Header>"));
        var references = this.signatureTransformations;
        var bodyXpath = "//*[name(.)='" + envelopeKey + ":Body']";
        resolvePlaceholderInReferences(this.signer.references, bodyXpath);
        if (!(this.signer.references.filter(function (ref) { return (ref.xpath === bodyXpath); }).length > 0)) {
            this.signer.addReference(bodyXpath, references);
        }
        var _loop_1 = function (name_1) {
            var xpath = "//*[name(.)='" + name_1 + "']";
            if (!(this_1.signer.references.filter(function (ref) { return (ref.xpath === xpath); }).length > 0)) {
                this_1.signer.addReference(xpath, references);
            }
        };
        var this_1 = this;
        for (var _i = 0, _a = this.additionalReferences; _i < _a.length; _i++) {
            var name_1 = _a[_i];
            _loop_1(name_1);
        }
        var timestampXpath = "//*[name(.)='wsse:Security']/*[local-name(.)='Timestamp']";
        if (this.hasTimeStamp && !(this.signer.references.filter(function (ref) { return (ref.xpath === timestampXpath); }).length > 0)) {
            this.signer.addReference(timestampXpath, references);
        }
        this.signer.computeSignature(xmlWithSec, this.signerOptions);
        return insertStr(this.signer.getSignatureXml(), xmlWithSec, xmlWithSec.indexOf('</wsse:Security>'));
    };
    return WSSecurityCert;
}());
exports.WSSecurityCert = WSSecurityCert;
//# sourceMappingURL=WSSecurityCert.js.map