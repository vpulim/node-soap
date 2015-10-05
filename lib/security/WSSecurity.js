"use strict";

var crypto = require('crypto');
var passwordDigest = require('../utils').passwordDigest;
var validPasswordTypes = ['PasswordDigest', 'PasswordText'];

function WSSecurity(username, password, options) {
  options = options || {};
  this._username = username;
  this._password = password;
  //must account for backward compatibility for passwordType String param as well as object options defaults: passwordType = 'PasswordText', hasTimeStamp = true   
  if (typeof options === 'string') {
    this._passwordType = options ? options : 'PasswordText';
  } else {
    this._passwordType = options.passwordType ? options.passwordType : 'PasswordText';
  }

  if (validPasswordTypes.indexOf(this._passwordType) === -1) {
    this._passwordType = 'PasswordText';
  }

  this._hasTimeStamp = options.hasTimeStamp || typeof options.hasTimeStamp === 'boolean' ? !!options.hasTimeStamp : true;
}

WSSecurity.prototype.toXML = function() {
  // avoid dependency on date formatting libraries
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
  var now = new Date();
  var created = getDate(now);
  var timeStampXml = '';
  if (this._hasTimeStamp) {
    var expires = getDate( new Date(now.getTime() + (1000 * 600)) );
    timeStampXml = "<wsu:Timestamp wsu:Id=\"Timestamp-"+created+"\">" +
      "<wsu:Created>"+created+"</wsu:Created>" +
      "<wsu:Expires>"+expires+"</wsu:Expires>" +
      "</wsu:Timestamp>";
  }

  var password;
  if(this._passwordType === 'PasswordText') {
    password = "<wsse:Password>" + this._password + "</wsse:Password>";
  } else {
    // nonce = base64 ( sha1 ( created + random ) )
    var nHash = crypto.createHash('sha1');
    nHash.update(created + Math.random());
    var nonce = nHash.digest('base64');
    password = "<wsse:Password Type=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest\">" + passwordDigest(nonce, created, this._password) + "</wsse:Password>" +
      "<wsse:Nonce EncodingType=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary\">" + nonce + "</wsse:Nonce>";
  }

  return  "<wsse:Security xmlns:wsse=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\" xmlns:wsu=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd\">" +
    timeStampXml +
    "<wsse:UsernameToken xmlns:wsu=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd\" wsu:Id=\"SecurityToken-" + created + "\">" +
    "<wsse:Username>" + this._username + "</wsse:Username>" +
    password +
    "<wsu:Created>" + created + "</wsu:Created>" +
    "</wsse:UsernameToken>" +
    "</wsse:Security>";
};

module.exports = WSSecurity;
