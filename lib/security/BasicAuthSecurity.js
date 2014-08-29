"use strict";

var _ = require('lodash');

function BasicAuthSecurity(username, password, defaults) {
  this._username = username;
  this._password = password;
  this.defaults = {};
  _.merge(this.defaults, defaults);
}

BasicAuthSecurity.prototype.addHeaders = function(headers) {
  headers.Authorization = 'Basic ' + new Buffer((this._username + ':' + this._password) || '').toString('base64');
};

BasicAuthSecurity.prototype.toXML = function() {
  return '';
};

BasicAuthSecurity.prototype.addOptions = function(options) {
  _.merge(options, this.defaults);
};

module.exports = BasicAuthSecurity;
