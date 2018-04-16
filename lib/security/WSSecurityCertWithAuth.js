"use strict";

var crypto = require('crypto');
var passwordDigest = require('../utils').passwordDigest;
var fs = require('fs');
var path = require('path');
var ejs = require('ejs');
var SignedXml = require('xml-crypto').SignedXml;
var uuid4 = require('uuid/v4');
var wsse = require('wsse');
var wsseSecurityHeaderTemplate = ejs.compile(fs.readFileSync(path.join(__dirname, 'templates', 'wsse-security-with-auth-header.ejs')).toString());
var wsseSecurityTokenTemplate = ejs.compile(fs.readFileSync(path.join(__dirname, 'templates', 'wsse-security-token.ejs')).toString());

var validPasswordTypes = ['PasswordDigest', 'PasswordText'];

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

function WSSecurityCertWithAuth(privatePEM, publicP12PEM, certPassword, options, username, password) {
  options = options || {};
  this._username = username;
  this._password = password;
  this._token = wsse({
    username: username,
    password: password
  });
  //must account for backward compatibility for passwordType String param as well as object options defaults: passwordType = 'PasswordText', hasTimeStamp = true
  if (typeof options === 'string') {
    this._passwordType = options ? options : 'PasswordText';
    options = {};
  } else {
    this._passwordType = options.passwordType ? options.passwordType : 'PasswordText';
  }

  if (validPasswordTypes.indexOf(this._passwordType) === -1) {
    this._passwordType = 'PasswordText';
  }

  this.publicP12PEM = publicP12PEM.toString().replace('-----BEGIN CERTIFICATE-----', '').replace('-----END CERTIFICATE-----', '').replace(/(\r\n|\n|\r)/gm, '');

  this.signer = new SignedXml();
  this.signer.signingKey = {
    key: privatePEM,
    passphrase: certPassword
  };
  this.x509Id = "x509-" + generateId();

  var _this = this;
  this.signer.keyInfoProvider = {};
  this.signer.keyInfoProvider.getKeyInfo = function (key) {
    return wsseSecurityTokenTemplate({ x509Id: _this.x509Id });
  };
}

WSSecurityCertWithAuth.prototype.postProcess = function (xml, envelopeKey) {
  this.created = this._token.getCreated();
  this.expires = generateExpires();

  var nonce;
  nonce = this._token.getNonceBase64();
  var digest = this._token.getPasswordDigest();
  var secHeader = wsseSecurityHeaderTemplate({
    binaryToken: this.publicP12PEM,
    created: this.created,
    username: this._username,
    digest: digest,
    nonce: nonce,
    id: this.x509Id
  });

  if (xml.indexOf('<soap:Header') == -1) {
    xml = insertStr('<soap:Header></soap:Header>', xml, xml.indexOf('<soap:Body'));
  }
  var xmlWithSec = insertStr(secHeader, xml, xml.indexOf('</soap:Header>'));

  var references = ["http://www.w3.org/2000/09/xmldsig#enveloped-signature",
    "http://www.w3.org/2001/10/xml-exc-c14n#"];

  this.signer.addReference("//*[name(.)='" + envelopeKey + ":Body']", references);
  this.signer.addReference("//*[name(.)='wsse:Security']/*[local-name(.)='Timestamp']", references);

  this.signer.computeSignature(xmlWithSec);

  return insertStr(this.signer.getSignatureXml(), xmlWithSec, xmlWithSec.indexOf('</wsse:Security>'));
};

module.exports = WSSecurityCertWithAuth;
