'use strict';

var fs = require('fs'),
  join = require('path').join;

describe('WSSecurityCert', function() {
  var WSSecurityCert = require('../../').WSSecurityCert;
  var cert = fs.readFileSync(join(__dirname, '..', 'certs', 'agent2-cert.pem'));
  var key = fs.readFileSync(join(__dirname, '..', 'certs', 'agent2-key.pem'));
  var keyWithPassword = fs.readFileSync(join(__dirname, '..', 'certs', 'agent2-key-with-password.pem')); // The passphrase protecting the private key is "soap"

  it('is a function', function() {
    WSSecurityCert.should.be.type('function');
  });

  it('should accept valid constructor variables', function() {
    var instance = new WSSecurityCert(key, cert, '');
    instance.should.have.property('publicP12PEM');
    instance.should.have.property('signer');
    instance.should.have.property('x509Id');
  });

  it('should fail at computing signature when the private key is invalid', function() {
    var passed = true;

    try {
      var instance = new WSSecurityCert('*****', cert, '');
      instance.postProcess('<soap:Header></soap:Header><soap:Body></soap:Body>', 'soap');
    } catch(e) {
      passed = false;
    }

    if (passed) {
      throw new Error('bad private key');
    }
  });

  it('should insert a WSSecurity signing block when postProcess is called (private key is raw)', function() {
    var instance = new WSSecurityCert(key, cert, '');
    var xml = instance.postProcess('<soap:Header></soap:Header><soap:Body></soap:Body>', 'soap');

    xml.should.containEql('<wsse:Security');
    xml.should.containEql('http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd');
    xml.should.containEql('http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd');
    xml.should.containEql('soap:mustUnderstand="1"');
    xml.should.containEql('<wsse:BinarySecurityToken');
    xml.should.containEql('EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary');
    xml.should.containEql('ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"');
    xml.should.containEql('wsu:Id="' + instance.x509Id);
    xml.should.containEql('</wsse:BinarySecurityToken>');
    xml.should.containEql('<Timestamp xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" Id="_1">');
    xml.should.containEql('<Created>' + instance.created);
    xml.should.containEql('<Expires>' + instance.expires);
    xml.should.containEql('<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">');
    xml.should.containEql('<wsse:SecurityTokenReference>');
    xml.should.containEql('<wsse:Reference URI="#' + instance.x509Id);
    xml.should.containEql('ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"/>');
    xml.should.containEql(instance.publicP12PEM);
    xml.should.containEql(instance.signer.getSignatureXml());
  });
  
  it('should insert a WSSecurity signing block when postProcess is called (private key is protected by a passphrase)', function() {
    var instance = new WSSecurityCert(keyWithPassword, cert, 'soap');
    var xml = instance.postProcess('<soap:Header></soap:Header><soap:Body></soap:Body>', 'soap');

    xml.should.containEql('<wsse:Security');
    xml.should.containEql('http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd');
    xml.should.containEql('http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd');
    xml.should.containEql('soap:mustUnderstand="1"');
    xml.should.containEql('<wsse:BinarySecurityToken');
    xml.should.containEql('EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary');
    xml.should.containEql('ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"');
    xml.should.containEql('wsu:Id="' + instance.x509Id);
    xml.should.containEql('</wsse:BinarySecurityToken>');
    xml.should.containEql('<Timestamp xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" Id="_1">');
    xml.should.containEql('<Created>' + instance.created);
    xml.should.containEql('<Expires>' + instance.expires);
    xml.should.containEql('<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">');
    xml.should.containEql('<wsse:SecurityTokenReference>');
    xml.should.containEql('<wsse:Reference URI="#' + instance.x509Id);
    xml.should.containEql('ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"/>');
    xml.should.containEql(instance.publicP12PEM);
    xml.should.containEql(instance.signer.getSignatureXml());
  });

  it('should only add two Reference elements, for Soap Body and Timestamp inside wsse:Security element', function() {
    var instance = new WSSecurityCert(key, cert, '');
    var xml = instance.postProcess('<soap:Header></soap:Header><soap:Body><Body></Body><Timestamp></Timestamp></soap:Body>', 'soap');
    xml.match(/<Reference URI="#/g).should.have.length(2);
  });

  it('should only add one Reference elements, for Soap Body wsse:Security element when addTimestamp is false', function() {
    var instance = new WSSecurityCert(key, cert, '', {hasTimeStamp: false});
    var xml = instance.postProcess('<soap:Header></soap:Header><soap:Body><Body></Body><Timestamp></Timestamp></soap:Body>', 'soap');
    xml.match(/<Reference URI="#/g).should.have.length(1);
  });

  it('double post process should not add extra alments', function() {
    var instance = new WSSecurityCert(key, cert, '');
    var _ = instance.postProcess('<soap:Header></soap:Header><soap:Body><Body></Body><Timestamp></Timestamp></soap:Body>', 'soap');
    var xml = instance.postProcess('<soap:Header></soap:Header><soap:Body><Body></Body><Timestamp></Timestamp></soap:Body>', 'soap');
    xml.match(/<Reference URI="#/g).should.have.length(2);
  });

  it('should have no timestamp when addTimestamp is false', function() {
    var instance = new WSSecurityCert(key, cert, '', {hasTimeStamp: false});
    var xml = instance.postProcess('<soap:Header></soap:Header><soap:Body><Body></Body><Timestamp></Timestamp></soap:Body>', 'soap');
    xml.should.not.containEql('<Timestamp xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" Id="_1">');
    xml.should.not.containEql('<Created>' + instance.created);
    xml.should.not.containEql('<Expires>' + instance.expires);
  });
});
