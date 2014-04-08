
"use strict";

var crypto = require('crypto')
  , passwordDigest = require('../utils').passwordDigest;


function WSSecurity(username, password, passwordType) {
  this._username = username;
  this._password = password;
  this._passwordType = passwordType || 'PasswordText';
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
  var expires = getDate(new Date(now.getTime() + (1000 * 600)));

  // nonce = base64 ( sha1 ( created + random ) )
  var nHash = crypto.createHash('sha1');
  nHash.update(created + Math.random());
  var nonce = nHash.digest('base64');

  return  "<wsse:Security xmlns:wsse=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\" xmlns:wsu=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd\">" +
    "<wsu:Timestamp wsu:Id=\"Timestamp-" + created + "\">" +
    "<wsu:Created>" + created + "</wsu:Created>" +
    "<wsu:Expires>" + expires + "</wsu:Expires>" +
    "</wsu:Timestamp>" +
    "<wsse:UsernameToken xmlns:wsu=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd\" wsu:Id=\"SecurityToken-" + created + "\">" +
    "<wsse:Username>" + this._username + "</wsse:Username>" +
    (this._passwordType === 'PasswordText' ?
      "<wsse:Password>" + this._password + "</wsse:Password>"
      :
      "<wsse:Password Type=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest\">" + passwordDigest(nonce, created, this._password) + "</wsse:Password>"
      ) +
    "<wsse:Nonce EncodingType=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary\">" + nonce + "</wsse:Nonce>" +
    "<wsu:Created>" + created + "</wsu:Created>" +
    "</wsse:UsernameToken>" +
    "</wsse:Security>";
};

module.exports = WSSecurity;
