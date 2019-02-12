"use strict";

var fs = require('fs');
var path = require('path');
var ejs = require('ejs');
var SignedXml = require('xml-crypto').SignedXml;
var uuid4 = require('uuid/v4');
var wsseSecurityHeaderTemplate;
var wsseSecurityTokenTemplate;

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function dateStringForSOAP(date) {
  return date.getUTCFullYear() + '-' + ('0' + (date.getUTCMonth() + 1)).slice(-2) + '-' +
    ('0' + date.getUTCDate()).slice(-2) + 'T' + ('0' + date.getUTCHours()).slice(-2) + ":" +
    ('0' + date.getUTCMinutes()).slice(-2) + ":" + ('0' + date.getUTCSeconds()).slice(-2) + "Z";
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
  return uuid4().replace(/-/gm, '');
}

function WSSecurityCert(privatePEM, publicP12PEM, password, options) {
  options = options || {};
  this.publicP12PEM = publicP12PEM.toString().replace('-----BEGIN CERTIFICATE-----', '').replace('-----END CERTIFICATE-----', '').replace(/(\r\n|\n|\r)/gm, '');

  this.signer = new SignedXml();
  this.signer.signingKey = {
    key: privatePEM,
    passphrase: password
  };
  this.x509Id = "x509-" + generateId();
  this.hasTimeStamp = typeof options.hasTimeStamp === 'undefined' ? true : !!options.hasTimeStamp;
  this.signatureTransformations = Array.isArray(options.signatureTransformations) ? options.signatureTransformations
    : ["http://www.w3.org/2000/09/xmldsig#enveloped-signature", "http://www.w3.org/2001/10/xml-exc-c14n#"];

  var _this = this;
  this.signer.keyInfoProvider = {};
  this.signer.keyInfoProvider.getKeyInfo = function (key) {
    if (!wsseSecurityTokenTemplate) {
      wsseSecurityTokenTemplate = ejs.compile(fs.readFileSync(path.join(__dirname, 'templates', 'wsse-security-token.ejs')).toString());
    }

    return wsseSecurityTokenTemplate({ x509Id: _this.x509Id });
  };
}

WSSecurityCert.prototype.postProcess = function (xml, envelopeKey) {
  this.created = generateCreated();
  this.expires = generateExpires();

  if (!wsseSecurityHeaderTemplate) {
    wsseSecurityHeaderTemplate = ejs.compile(fs.readFileSync(path.join(__dirname, 'templates', 'wsse-security-header.ejs')).toString());
  }

  var secHeader = wsseSecurityHeaderTemplate({
    binaryToken: this.publicP12PEM,
    created: this.created,
    expires: this.expires,
    hasTimeStamp: this.hasTimeStamp,
    id: this.x509Id
  });

  var xmlWithSec = insertStr(secHeader, xml, xml.indexOf('</soap:Header>'));

  var references = this.signatureTransformations;

  var bodyXpath = "//*[name(.)='" + envelopeKey + ":Body']";
  if (!this.signer.references.filter(function(ref){ return ref.xpath === bodyXpath; }).length > 0) {
    this.signer.addReference(bodyXpath, references);
  }

  var timestampXpath = "//*[name(.)='wsse:Security']/*[local-name(.)='Timestamp']"
  if (this.hasTimeStamp && !this.signer.references.filter(function(ref){ return ref.xpath === timestampXpath; }).length > 0) {
    this.signer.addReference(timestampXpath, references);
  }

  this.signer.computeSignature(xmlWithSec);

  return insertStr(this.signer.getSignatureXml(), xmlWithSec, xmlWithSec.indexOf('</wsse:Security>'));
};

module.exports = WSSecurityCert;
