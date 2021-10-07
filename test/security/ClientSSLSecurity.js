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

  it('should accept a String as argument for the key or cert', function () {
    var certString = join(__dirname, '..', 'certs', 'agent2-cert.pem'),
      keyString = join(__dirname, '..', 'certs', 'agent2-key.pem'),
      certBuffer = fs.readFileSync(join(__dirname, '..', 'certs', 'agent2-cert.pem')),
      keyBuffer = fs.readFileSync(join(__dirname, '..', 'certs', 'agent2-key.pem')),
      instance;

    instance = new ClientSSLSecurity(keyString, certString, certString);
    instance.should.have.property("ca", certBuffer);
    instance.should.have.property("cert", certBuffer);
    instance.should.have.property("key", keyBuffer);
  });

  it('should not accept a integer as argument for the key', function () {
    var instance;
    try {
      instance = new ClientSSLSecurity(10);
    } catch(error) {
      // do nothing
    }
    should(instance).not.be.ok();
  });

  it('should not accept a integer as argument for the key', function () {
    var instance;
    try {
      instance = new ClientSSLSecurity(null, 10);
    } catch(error) {
      // do nothing
    }
    should(instance).not.be.ok();
  });

  it('should return blank string when call toXml', function () {
    var certBuffer = fs.readFileSync(join(__dirname, '..', 'certs', 'agent2-cert.pem')),
      keyBuffer = fs.readFileSync(join(__dirname, '..', 'certs', 'agent2-key.pem')),
      instance;

    instance = new ClientSSLSecurity(keyBuffer, certBuffer, certBuffer);
    var xml = instance.toXML();
    xml.should.be.exactly('');
  });
  it('should accept a Array as argument for the ca', function () {
    var caList = [];
    var instance = new ClientSSLSecurity(null, null, caList);
    instance.should.have.property("ca", caList);
  });

  describe('forever parameter', function () {
    it('should return different agents if parameter is not present', function () {
      var instance = new ClientSSLSecurity();
      var firstOptions = {};
      var secondOptions = {};

      instance.addOptions(firstOptions);
      instance.addOptions(secondOptions);

      firstOptions.httpsAgent.should.not.equal(secondOptions.httpsAgent);
    });

    it('should return the same agent if parameter is present', function () {
      var instance = new ClientSSLSecurity();
      var firstOptions = {forever: true};
      var secondOptions = {forever: true};

      instance.addOptions(firstOptions);
      instance.addOptions(secondOptions);

      firstOptions.httpsAgent.should.equal(secondOptions.httpsAgent);
    });

    it('should return the same agent if set in defaults', function () {
      var instance = new ClientSSLSecurity(null, null, null, {forever: true});
      var firstOptions = {};
      var secondOptions = {};

      instance.addOptions(firstOptions);
      instance.addOptions(secondOptions);

      firstOptions.httpsAgent.should.equal(secondOptions.httpsAgent);
    });
  });
});
