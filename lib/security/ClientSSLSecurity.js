'use strict';

var fs = require('fs')
  , constants = require('constants')
  , https = require('https')
  , _ = require('lodash');

module.exports = ClientSSLSecurity;

function ClientSSLSecurity(keyPath, certPath, defaults) {
  var prop;
  this.key = fs.readFileSync(keyPath);
  this.cert = fs.readFileSync(certPath);
  this.defaults = {};
  _.merge(this.defaults, defaults);
}

ClientSSLSecurity.prototype.toXML = function(headers) {
  return '';
};

ClientSSLSecurity.prototype.addOptions = function(options) {
  options.key = this.key;
  options.cert = this.cert;
  _.merge(options, this.defaults);
  options.agent = new https.Agent(options);
};
