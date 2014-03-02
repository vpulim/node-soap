
"use strict";

function BasicAuthSecurity(username, password) {
  this._username = username;
  this._password = password;
}

BasicAuthSecurity.prototype.addHeaders = function(headers) {
  headers.Authorization = "Basic " + new Buffer((this._username + ':' + this._password) || '').toString('base64');
};

BasicAuthSecurity.prototype.toXML = function() {
  return "";
};

module.exports = BasicAuthSecurity;