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


  it('should accept extraneous data before cert encapsulation boundaries per rfc 7468', function () {
    var certBuffer = fs.readFileSync(join(__dirname, '..', 'certs', 'agent2-cert-with-extra-data.pem'));

    var instanceCert = new ClientSSLSecurity(null, certBuffer);
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

  it('should accept a Array as argument for the ca', function () {
    var caList = [];
    var instance = new ClientSSLSecurity(null, null, caList);
    instance.should.have.property("ca", caList);
  });
});
