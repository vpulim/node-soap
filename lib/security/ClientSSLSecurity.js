
"use strict";

var fs = require('fs')
  , https = require('https');

function ClientSSLSecurity(keyPath, certPath) {
  this.key = fs.readFileSync(keyPath);
  this.cert = fs.readFileSync(certPath);
}

ClientSSLSecurity.prototype.toXML = function(headers) {
  return "";
};

ClientSSLSecurity.prototype.addOptions = function(options) {
  options.key = this.key;
  options.cert = this.cert;
  options.agent = new https.Agent(options);
};

module.exports = ClientSSLSecurity;