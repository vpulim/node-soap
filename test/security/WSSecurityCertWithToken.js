"use strict";

var fs = require("fs"),
  join = require("path").join;

describe("WSSecurityCertWithToken", function () {
  var WSSecurityCertWithToken = require("../../lib/soap").WSSecurityCertWithToken;
  var cert = fs.readFileSync(join(__dirname, "..", "certs", "agent2-cert.pem"));
  var key = fs.readFileSync(join(__dirname, "..", "certs", "agent2-key.pem"));


  it("should take parameters as options object", function () {
    var instance = new WSSecurityCertWithToken({
      privateKey: key,
      publicKey: cert,
      keyPassword: "",
      options: {}
    });
    var xml = instance.postProcess(
      "<soap:Envelope><soap:Header></soap:Header><soap:Body></soap:Body></soap:Envelope>",
      "soap"
    );
    xml.should.containEql("<wsse:Security");
  });

  it("should contain username and password", function () {
    var instance = new WSSecurityCertWithToken({
      privateKey: key,
      publicKey: cert,
      keyPassword: "",
      username: "testuser",
      password: "testpw",
      options: {}
    });
    var xml = instance.postProcess(
      "<soap:Envelope><soap:Header></soap:Header><soap:Body></soap:Body></soap:Envelope>",
      "soap"
    );
    xml.should.containEql("<wsse:Username>testuser</wsse:Username>");
    xml.should.containEql("<wsse:Password>testpw</wsse:Password>");
  });
  describe("should pass all the WSSecurityCert tests too", ()=>{
    var keyWithPassword = fs.readFileSync(
      join(__dirname, "..", "certs", "agent2-key-with-password.pem")
    ); // The passphrase protecting the private key is "soap"
    it('is a function', function () {
      WSSecurityCertWithToken.should.be.type('function');
    });
  
    it('should accept valid constructor variables', function () {
      var instance = new WSSecurityCertWithToken({privateKey: key, publicKey: cert, keyPassword: ''});
      instance.should.have.property('publicP12PEM');
      instance.should.have.property('signer');
      instance.should.have.property('x509Id');
    });
  
    it('should fail at computing signature when the private key is invalid', function () {
      var passed = true;
  
      try {
        var instance = new WSSecurityCertWithToken({privateKey: '*****', publicKey: cert, keyPassword: ''});
        instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body></soap:Body></soap:Envelope>', 'soap');
      } catch (e) {
        passed = false;
      }
  
      if (passed) {
        throw new Error('bad private key');
      }
    });
  
    it('should insert a WSSecurity signing block when postProcess is called (private key is raw)', function () {
      var instance = new WSSecurityCertWithToken({privateKey: key, publicKey: cert, keyPassword: ''});
      var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body></soap:Body></soap:Envelope>', 'soap');
  
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
      xml.should.containEql('<wsse:SecurityTokenReference');
      xml.should.containEql('<wsse:Reference URI="#' + instance.x509Id);
      xml.should.containEql('ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"/>');
      xml.should.containEql(instance.publicP12PEM);
      xml.should.containEql(instance.signer.getSignatureXml());
    });
  
    it('should insert a WSSecurity signing block when postProcess is called (private key is protected by a passphrase)', function () {
      var instance = new WSSecurityCertWithToken({privateKey: keyWithPassword, publicKey: cert, keyPassword: 'soap'});
      var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body></soap:Body></soap:Envelope>', 'soap');
  
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
      xml.should.containEql('<wsse:SecurityTokenReference');
      xml.should.containEql('<wsse:Reference URI="#' + instance.x509Id);
      xml.should.containEql('ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"/>');
      xml.should.containEql(instance.publicP12PEM);
      xml.should.containEql(instance.signer.getSignatureXml());
    });
  
    it('should only add two Reference elements, for Soap Body and Timestamp inside wsse:Security element', function () {
      var instance = new WSSecurityCertWithToken({privateKey: key, publicKey: cert, keyPassword: ''});
      var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body><Timestamp></Timestamp></soap:Body></soap:Envelope>', 'soap');
      xml.match(/<Reference URI="#/g).should.have.length(2);
    });
  
    it('should only add one Reference elements, for Soap Body wsse:Security element when addTimestamp is false', function () {
      var instance = new WSSecurityCertWithToken({privateKey: key, publicKey: cert, keyPassword: '', options: { hasTimeStamp: false }});
      var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body><Timestamp></Timestamp></soap:Body></soap:Envelope>', 'soap');
      xml.match(/<Reference URI="#/g).should.have.length(1);
    });
  
    it('should only add one Reference elements, for Soap Body wsse:Security element when addTimestamp is false and SignatureMethod Algorithm=sha256', function () {
      var instance = new WSSecurityCertWithToken({privateKey: key, publicKey: cert, keyPassword: '', options: { hasTimeStamp: false,  signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256" }});
      var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body><Timestamp></Timestamp></soap:Body></soap:Envelope>', 'soap');
      xml.match(/<Reference URI="#/g).should.have.length(1);
    });
  
  
    it('double post process should not add extra alments', function () {
      var instance = new WSSecurityCertWithToken({privateKey: key, publicKey: cert, keyPassword: ''});
      var _ = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body><Timestamp></Timestamp></soap:Body></soap:Envelope>', 'soap');
      var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body><Timestamp></Timestamp></soap:Body></soap:Envelope>', 'soap');
      xml.match(/<Reference URI="#/g).should.have.length(2);
    });
  
    it('should have no timestamp when addTimestamp is false', function () {
      var instance = new WSSecurityCertWithToken({privateKey: key, publicKey: cert, keyPassword: '', options: { hasTimeStamp: false }});
      var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body><Timestamp></Timestamp></soap:Body></soap:Envelope>', 'soap');
      xml.should.not.containEql('<Timestamp xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" Id="_1">');
      xml.should.not.containEql('<Created>' + instance.created);
      xml.should.not.containEql('<Expires>' + instance.expires);
    });
  
    it('should use rsa-sha256 signature method when the signatureAlgorithm option is set to WSSecurityCert', function () {
      var instance = new WSSecurityCertWithToken({privateKey: key, publicKey: cert, keyPassword: '', options: {
        hasTimeStamp: false,
        signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'
      }});
      var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body></soap:Body></soap:Envelope>', 'soap');
      xml.should.containEql('SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"');
    });
  
    it('should use default xmlns:wsse if no signerOptions.existingPrefixes is provided', function () {
      var instance = new WSSecurityCertWithToken({privateKey: key, publicKey: cert, keyPassword: ''});
      var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body></soap:Body></soap:Envelope>', 'soap')
      xml.should.containEql('xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"');
    });
    
    it('should still add wsse if another signerOption attribute is passed through ', function(){
      var instance = new WSSecurityCertWithToken({privateKey: key, publicKey: cert, keyPassword: '', options: { signerOptions: { prefix: 'ds'} }});
      var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body></soap:Body></soap:Envelope>', 'soap')
      xml.should.containEql('xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"');
      xml.should.containEql('<ds:SignedInfo>');
    });

    it('should contain a provided prefix when signerOptions.existingPrefixes is provided', function () {
      var instance = new WSSecurityCertWithToken({privateKey: key, publicKey: cert, keyPassword: '', options: {
        signerOptions: {
          location: { action: 'after', reference: "//*[name(.)='soap:Body']" },
          existingPrefixes: { wsse: 'https://localhost/node-soap.xsd' }
        }
      }});
      var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body></soap:Body></soap:Envelope>', 'soap')
      xml.should.containEql('<wsse:SecurityTokenReference xmlns:wsse="https://localhost/node-soap.xsd">');
    });

    it('should contain the prefix to the generated Signature tags', function () {
      var instance = new WSSecurityCertWithToken({privateKey: key, publicKey: cert, keyPassword: '', options: {
        signerOptions: {
          prefix: 'ds',
        }
      }});
      var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body></soap:Body></soap:Envelope>', 'soap');
      xml.should.containEql('<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">');
      xml.should.containEql('<ds:SignedInfo>');
      xml.should.containEql('<ds:CanonicalizationMethod');
      xml.should.containEql('<ds:SignatureMethod ');
      xml.should.containEql('<ds:Reference URI="#_1">');
      xml.should.containEql('<ds:Transforms>');
      xml.should.containEql('<ds:Transform');
      xml.should.containEql('<ds:DigestMethod');
      xml.should.containEql('<ds:DigestValue>');
      xml.should.containEql('</ds:DigestValue>');
    });

    it('should add attributes to the security tag', function () {
      var instance = new WSSecurityCertWithToken({privateKey: key, publicKey: cert, keyPassword: '', options: {
        signerOptions: {
          attrs: { Id: 'security_123' },
        }
      }});
      var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body></soap:Body></soap:Envelope>', 'soap');
      xml.should.containEql('<Signature Id="security_123" xmlns="http://www.w3.org/2000/09/xmldsig#">');
    });

    it('should sign additional headers that are added via additionalReferences', function () {
      var instance = new WSSecurityCertWithToken({privateKey: key, publicKey: cert, keyPassword: '', options: {
        additionalReferences: [
          'To',
          'Action'
        ],
      }});
      var xml = instance.postProcess('<soap:Envelope><soap:Header><To Id="To">localhost.com</To><Action Id="action-1234">testing</Action></soap:Header><soap:Body><Body></Body></soap:Body></soap:Envelope>', 'soap');
      xml.should.containEql('<Reference URI="#To">');
      xml.should.containEql('<Reference URI="#action-1234">');
    });

    it('should add a WSSecurity signing block when valid envelopeKey is passed', function () {
      var instance = new WSSecurityCertWithToken({privateKey: key, publicKey: cert, keyPassword: ''});
      var xml = instance.postProcess('<soap:Envelope><soapenv:Header></soapenv:Header><soapenv:Body></soapenv:Body></soap:Envelope>', 'soapenv');
      xml.should.containEql('<wsse:Security');
    });

    it('should add envelopeKey to properties in Security block', function () {
      var instance = new WSSecurityCertWithToken({privateKey: key, publicKey: cert, keyPassword: '', options: {
        mustUnderstand: true,
      }});
      var xml = instance.postProcess('<soap:Envelope><soapenv:Header></soapenv:Header><soapenv:Body></soapenv:Body></soap:Envelope>', 'soapenv');
      xml.should.containEql('soapenv:mustUnderstand="1"');
    });

    it('should not accept envelopeKey not set in envelope', function () {
      var xml;
      try {
        var instance = new WSSecurityCertWithToken({privateKey: key, publicKey: cert, keyPassword: ''});
        xml = instance.postProcess('<soap:Envelope><soapenv:Header></soapenv:Header><soapenv:Body></soapenv:Body></soap:Envelope>', 'soap');
      } catch (e) {
        // do nothing
      }
      should(xml).not.be.ok();
    });
  })
});
