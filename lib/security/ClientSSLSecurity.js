'use strict';

var fs = require('fs')
  , https = require('https')
  , _ = require('lodash');

function ClientSSLSecurity(key, cert, defaults) {
  if (key) {
    if(Buffer.isBuffer(key)) {
      this.key = key;
    } else if (typeof key === 'string') {
      this.key = fs.readFileSync(key);
    } else {
      throw new Error('key should be a buffer or a string!');
    }

    if(this.key.toString().lastIndexOf('-----BEGIN RSA PRIVATE KEY-----', 0) !== 0) {
      throw new Error('key should start with -----BEGIN RSA PRIVATE KEY-----');
    }
  }

  if (cert) {
    if(Buffer.isBuffer(cert)) {
      this.cert = cert;
    } else if (typeof cert === 'string') {
      this.cert = fs.readFileSync(cert);
    } else {
      throw new Error('cert should be a buffer or a string!');
    }

    if(this.cert.toString().lastIndexOf('-----BEGIN CERTIFICATE-----', 0) !== 0) {
      throw new Error('cert should start with -----BEGIN CERTIFICATE-----');
    }
  }

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

module.exports = ClientSSLSecurity;
