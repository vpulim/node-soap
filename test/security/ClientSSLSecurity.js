'use strict';

var fs = require('fs'),
    join = require('path').join;

describe('ClientSSLSecurity', function() {
  var ClientSSLSecurity = require('../../').ClientSSLSecurity;
  var cert = __filename;
  var key = __filename;

  it('is a function', function() {
    ClientSSLSecurity.should.be.type('function');
  });

  describe('defaultOption param', function() {
    it('is accepted as the third param', function() {
      new ClientSSLSecurity(null, null, {});
    });

    it('is used in addOptions', function() {
      var options = {};
      var defaultOptions = { foo: 5 };
      var instance = new ClientSSLSecurity(null, null, defaultOptions);
      instance.addOptions(options);
      options.should.have.property("foo", 5);
    });
  });

  it('should throw if invalid (ca or client) cert or key is given', function () {
    var instanceCert = null,
      instanceKey = null,
      instanceCA = null;

    try {
      instanceCert = new ClientSSLSecurity(null, cert);
    } catch (e) {
      //should happen!
      instanceCert = false;
    }

    try {
      instanceKey = new ClientSSLSecurity(key, null);
    } catch (e) {
      //should happen!
      instanceKey = false;
    }

    try {
      instanceCA = new ClientSSLSecurity(null, null, cert);
    } catch (e) {
      //should happen!
      instanceCA = false;
    }

    if (instanceCert !== false) {
      throw new Error('accepted wrong cert');
    }

    if (instanceKey !== false) {
      throw new Error('accepted wrong key');
    }

    if (instanceCA !== false) {
      throw new Error('accepted wrong CA cert');
    }
  });

  it('should accept a Buffer as argument for the key or cert', function () {
    var certBuffer = fs.readFileSync(join(__dirname, '..', 'certs', 'agent2-cert.pem')),
      keyBuffer = fs.readFileSync(join(__dirname, '..', 'certs', 'agent2-key.pem')),
      instance;

    instance = new ClientSSLSecurity(keyBuffer, certBuffer, certBuffer);
    instance.should.have.property("ca", certBuffer);
    instance.should.have.property("cert", certBuffer);
    instance.should.have.property("key", keyBuffer);
  });
});
