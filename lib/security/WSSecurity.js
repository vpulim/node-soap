"use strict";

var crypto = require('crypto');
var wsse = require('wsse');

var validPasswordTypes = ['PasswordDigest', 'PasswordText'];

function WSSecurity(username, password, options) {
  options = options || {};
  this._username = username;
  this._password = password;
  this._token = wsse({
    username: username,
    password: password
  });

  if (typeof options === 'string') {
    this._passwordType = options ?
      options :
      'PasswordText';
    options = {};
  } else {
    this._passwordType = options.passwordType ?
      options.passwordType :
      'PasswordText';
  }

  if (validPasswordTypes.indexOf(this._passwordType) === -1) {
    this._passwordType = 'PasswordText';
  }

  this._hasTimeStamp = options.hasTimeStamp || typeof options.hasTimeStamp === 'boolean' ? !!options.hasTimeStamp : true;
  if (options.hasNonce != null) {
    this._hasNonce = !!options.hasNonce;
  }
  this._hasTokenCreated = options.hasTokenCreated || typeof options.hasTokenCreated === 'boolean' ? !!options.hasTokenCreated : true;
  if (options.actor != null) {
    this._actor = options.actor;
  }
  if (options.mustUnderstand != null) {
    this._mustUnderstand = !!options.mustUnderstand;
  }
}

WSSecurity.prototype.toXML = function() {
  function getDate(d) {
    function pad(n) {
      return n < 10 ? '0' + n : n;
    }
    return d.getUTCFullYear() + '-'
      + pad(d.getUTCMonth() + 1) + '-'
      + pad(d.getUTCDate()) + 'T'
      + pad(d.getUTCHours()) + ':'
      + pad(d.getUTCMinutes()) + ':'
      + pad(d.getUTCSeconds()) + 'Z';
  }
  var now = new Date(this._token.getCreated());
  var created = this._token.getCreated();
  var timeStampXml = '';
  if (this._hasTimeStamp) {
    var expires = getDate( new Date(now.getTime() + (1000 * 600)) );
    timeStampXml = "<wsu:Timestamp wsu:Id=\"Timestamp-"+created+"\">" +
      "<wsu:Created>"+created+"</wsu:Created>" +
      "<wsu:Expires>"+expires+"</wsu:Expires>" +
      "</wsu:Timestamp>";
  }

  var password, nonce;
  if (this._hasNonce || this._passwordType !== 'PasswordText') {
    var nHash = crypto.createHash('sha1');
    nHash.update(created + Math.random());
    nonce = nHash.digest('base64');
  }
  if (this._passwordType === 'PasswordText') {
    password = "<wsse:Password Type=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText\">" + this._password + "</wsse:Password>";
    if (nonce) {
      password += "<wsse:Nonce EncodingType=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary\">" + nonce + "</wsse:Nonce>";
    }
  } else {
    password = "<wsse:Password Type=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest\">" + this._token.getPasswordDigest() + "</wsse:Password>" +
      "<wsse:Nonce EncodingType=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary\">" + this._token.getNonceBase64() + "</wsse:Nonce>";
  }

  return "<wsse:Security " + (this._actor ? "soap:actor=\"" + this._actor + "\" " : "") +
    (this._mustUnderstand ? "soap:mustUnderstand=\"1\" " : "") +
    "xmlns:wsse=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\" xmlns:wsu=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd\">" +
    timeStampXml +
    "<wsse:UsernameToken wsu:Id=\"UsernameToken-" + created +"\">"+
    "<wsse:Username>" + this._username + "</wsse:Username>" +
    password +
    (this._hasTokenCreated ? "<wsu:Created>" + created + "</wsu:Created>" : "") +
    "</wsse:UsernameToken>" +
    "</wsse:Security>";
};

module.exports = WSSecurity;
