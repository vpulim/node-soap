'use strict';

var soap = require('../..');

var fs = require('fs'),
  join = require('path').join;

var assert = require('assert');

describe('WSSecurityCert', function () {
  var WSSecurityCert = require('../../').WSSecurityCert;
  var cert = fs.readFileSync(join(__dirname, '..', 'certs', 'agent2-cert.pem'));
  var key = fs.readFileSync(join(__dirname, '..', 'certs', 'agent2-key.pem'));
  var keyWithPassword = fs.readFileSync(join(__dirname, '..', 'certs', 'agent2-key-with-password.pem')); // The passphrase protecting the private key is "soap"

  it('is a function', function () {
    WSSecurityCert.should.be.type('function');
  });

  it('should accept valid constructor variables', function () {
    var instance = new WSSecurityCert(key, cert, '');
    instance.should.have.property('publicP12PEM');
    instance.should.have.property('signer');
    instance.should.have.property('x509Id');
  });

  it('should fail at computing signature when the private key is invalid', function () {
    var passed = true;

    try {
      var instance = new WSSecurityCert('*****', cert, '');
      instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body></soap:Body></soap:Envelope>', 'soap');
    } catch (e) {
      passed = false;
    }

    if (passed) {
      throw new Error('bad private key');
    }
  });

  it('should insert a WSSecurity signing block when postProcess is called (private key is raw)', function () {
    var instance = new WSSecurityCert(key, cert, '');
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
    xml.should.containEql('<KeyInfo>');
    xml.should.containEql('</KeyInfo>');
    xml.should.containEql('ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"/>');
    xml.should.containEql(instance.publicP12PEM);
    xml.should.containEql(instance.signer.getSignatureXml());
  });

  it('should insert a WSSecurity signing block when postProcess is called (private key is protected by a passphrase)', function () {
    var instance = new WSSecurityCert(keyWithPassword, cert, 'soap');
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

  it('should extend an existing Security block', function () {
    var instance = new WSSecurityCert(keyWithPassword, cert, 'soap');
    var xml1 = instance.postProcess('<soap:Envelope><soap:Header><wsse:Security someAttribute="someValue"></wsse:Security></soap:Header><soap:Body></soap:Body></soap:Envelope>', 'soap');
    var matches1 = xml1.match(/<wsse:Security [^>]*>/);
    matches1[0].should.containEql('soap:mustUnderstand="1"');
    matches1[0].should.containEql('someAttribute="someValue"');
    matches1[0].should.containEql('http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd');
    matches1[0].should.containEql('http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd');

    var xml2 = instance.postProcess(
      '<soap:Envelope><soap:Header><wsse:Security xmlns:wsu="wsu" xmlns:wsse="wsse" soap:mustUnderstand="true" someAttribute="someValue"></wsse:Security></soap:Header><soap:Body></soap:Body></soap:Envelope>',
      'soap',
    );
    var matches2 = xml2.match(/<wsse:Security [^>]*>/);
    matches2[0].should.not.containEql('soap:mustUnderstand="1"');
    matches2[0].should.containEql('soap:mustUnderstand="true"');
    matches2[0].should.not.containEql('http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd');
    matches2[0].should.containEql('xmlns:wsse="wsse"');
    matches2[0].should.not.containEql('http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd');
    matches2[0].should.containEql('xmlns:wsu="wsu"');
  });

  it('should only add two Reference elements, for Soap Body and Timestamp inside wsse:Security element', function () {
    var instance = new WSSecurityCert(key, cert, '');
    var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body><Timestamp></Timestamp></soap:Body></soap:Envelope>', 'soap');
    xml.match(/<Reference URI="#/g).should.have.length(2);
  });

  it('Verifies that only Soap Timestamp reference added to wsse:Security when the Soap Body is excluded from signing', function () {
    var instance = new WSSecurityCert(key, cert, '', { excludeReferencesFromSigning: ['Body'] });
    var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body><Timestamp></Timestamp></soap:Body></soap:Envelope>', 'soap');
    xml.match(/<Reference URI="#/g).should.have.length(1);
  });

  it('Verifies that Soap Timestamp reference is not added to wsse:Security when it is excluded from signing', function () {
    var instance = new WSSecurityCert(key, cert, '', { excludeReferencesFromSigning: ['Timestamp'] });
    var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body><Timestamp></Timestamp></soap:Body></soap:Envelope>', 'soap');
    xml.should.not.containEql('<Reference URI="#Timestamp">');
  });

  it('should only add one Reference elements, for Soap Body wsse:Security element when addTimestamp is false', function () {
    var instance = new WSSecurityCert(key, cert, '', { hasTimeStamp: false });
    var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body><Timestamp></Timestamp></soap:Body></soap:Envelope>', 'soap');
    xml.match(/<Reference URI="#/g).should.have.length(1);
  });

  it('should only add one Reference elements, for Soap Body wsse:Security element when addTimestamp is false and SignatureMethod Algorithm=sha256', function () {
    var instance = new WSSecurityCert(key, cert, '', { hasTimeStamp: false, signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256' });
    var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body><Timestamp></Timestamp></soap:Body></soap:Envelope>', 'soap');
    xml.match(/<Reference URI="#/g).should.have.length(1);
  });

  it('double post process should not add extra alments', function () {
    var instance = new WSSecurityCert(key, cert, '');
    var _ = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body><Timestamp></Timestamp></soap:Body></soap:Envelope>', 'soap');
    var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body><Timestamp></Timestamp></soap:Body></soap:Envelope>', 'soap');
    xml.match(/<Reference URI="#/g).should.have.length(2);
  });

  it('should have no timestamp when addTimestamp is false', function () {
    var instance = new WSSecurityCert(key, cert, '', { hasTimeStamp: false });
    var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body><Timestamp></Timestamp></soap:Body></soap:Envelope>', 'soap');
    xml.should.not.containEql('<Timestamp xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" Id="_1">');
    xml.should.not.containEql('<Created>' + instance.created);
    xml.should.not.containEql('<Expires>' + instance.expires);
  });

  it('should use rsa-sha256 signature method when the signatureAlgorithm option is set to WSSecurityCert', function () {
    var instance = new WSSecurityCert(key, cert, '', {
      hasTimeStamp: false,
      signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    });
    var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body></soap:Body></soap:Envelope>', 'soap');
    xml.should.containEql('SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"');
  });

  it('should use default xmlns:wsse if no signerOptions.existingPrefixes is provided', function () {
    var instance = new WSSecurityCert(key, cert, '');
    var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body></soap:Body></soap:Envelope>', 'soap');
    xml.should.containEql('xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"');
  });

  it('should still add wsse if another signerOption attribute is passed through ', function () {
    var instance = new WSSecurityCert(key, cert, '', { signerOptions: { prefix: 'ds' } });
    var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body></soap:Body></soap:Envelope>', 'soap');
    xml.should.containEql('xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"');
    xml.should.containEql('<ds:SignedInfo>');
  });

  it('should contain a provided prefix when signerOptions.existingPrefixes is provided', function () {
    var instance = new WSSecurityCert(key, cert, '', {
      signerOptions: {
        location: { action: 'after', reference: "//*[name(.)='soap:Body']" },
        existingPrefixes: { wsse: 'https://localhost/node-soap.xsd' },
      },
    });
    var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body></soap:Body></soap:Envelope>', 'soap');
    xml.should.containEql('<wsse:SecurityTokenReference xmlns:wsse="https://localhost/node-soap.xsd">');
  });

  it('should contain the prefix to the generated Signature tags', function () {
    var instance = new WSSecurityCert(key, cert, '', {
      signerOptions: {
        prefix: 'ds',
      },
    });
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
    xml.should.containEql('<ds:KeyInfo>');
    xml.should.containEql('</ds:KeyInfo>');
  });

  it('should add attributes to the security tag', function () {
    var instance = new WSSecurityCert(key, cert, '', {
      signerOptions: {
        attrs: { Id: 'security_123' },
      },
    });
    var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body></soap:Body></soap:Envelope>', 'soap');
    xml.should.containEql('<Signature Id="security_123" xmlns="http://www.w3.org/2000/09/xmldsig#">');
  });

  it('should sign additional headers that are added via additionalReferences', function () {
    var instance = new WSSecurityCert(key, cert, '', {
      additionalReferences: ['To', 'Action'],
    });
    var xml = instance.postProcess('<soap:Envelope><soap:Header><To Id="To">localhost.com</To><Action Id="action-1234">testing</Action></soap:Header><soap:Body><Body></Body></soap:Body></soap:Envelope>', 'soap');
    xml.should.containEql('<Reference URI="#To">');
    xml.should.containEql('<Reference URI="#action-1234">');
  });

  it('references id should be autogenerated and unique across all references', function () {
    var instance = new WSSecurityCert(key, cert, '', {
      additionalReferences: ['To', 'Action'],
    });
    var xml = instance.postProcess('<soap:Envelope><soap:Header><To>localhost.com</To><Action>testing</Action></soap:Header><soap:Body><Body></Body></soap:Body></soap:Envelope>', 'soap');
    xml.should.containEql('<Reference URI="#_0">'); // For Body element
    xml.should.containEql('<Reference URI="#_1">'); // For To element
    xml.should.containEql('<Reference URI="#_2">'); // For Action element
    xml.should.containEql('<Reference URI="#_3">'); // For Timestamp element
  });

  it('should not sign additional headers that are excluded from signing', function () {
    var instance = new WSSecurityCert(key, cert, '', {
      excludedReferences: ['To', 'Action'],
    });
    var xml = instance.postProcess('<soap:Envelope><soap:Header><To Id="To">localhost.com</To><Action Id="action-1234">testing</Action></soap:Header><soap:Body><Body></Body></soap:Body></soap:Envelope>', 'soap');
    xml.should.not.containEql('<Reference URI="#To">');
    xml.should.not.containEql('<Reference URI="#action-1234">');
  });

  it('should add a WSSecurity signing block when valid envelopeKey is passed', function () {
    var instance = new WSSecurityCert(key, cert, '');
    var xml = instance.postProcess('<soap:Envelope><soapenv:Header></soapenv:Header><soapenv:Body></soapenv:Body></soap:Envelope>', 'soapenv');
    xml.should.containEql('<wsse:Security');
  });

  it('should add envelopeKey to properties in Security block', function () {
    var instance = new WSSecurityCert(key, cert, '', {
      mustUnderstand: true,
    });
    var xml = instance.postProcess('<soap:Envelope><soapenv:Header></soapenv:Header><soapenv:Body></soapenv:Body></soap:Envelope>', 'soapenv');
    xml.should.containEql('soapenv:mustUnderstand="1"');
  });

  it('should not accept envelopeKey not set in envelope', function () {
    var xml;
    try {
      var instance = new WSSecurityCert(key, cert, '');
      xml = instance.postProcess('<soap:Envelope><soapenv:Header></soapenv:Header><soapenv:Body></soapenv:Body></soap:Envelope>', 'soap');
    } catch (e) {
      // do nothing
    }
    should(xml).not.be.ok();
  });

  it('should use rsa-sha1 signature method when the signatureAlgorithm option is set to WSSecurityCert', function () {
    var instance = new WSSecurityCert(key, cert, '', {
      hasTimeStamp: false,
      signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    });
    var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body></soap:Body></soap:Envelope>', 'soap');
    xml.should.containEql('SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"');
  });

  it('should use rsa-sha512 signature method when the signatureAlgorithm option is set to WSSecurityCert', function () {
    var instance = new WSSecurityCert(key, cert, '', {
      hasTimeStamp: false,
      signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512',
    });
    var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body></soap:Body></soap:Envelope>', 'soap');
    xml.should.containEql('SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha512"');
  });

  it('should use digest method when the digestAlgorithm option is set on WSSecurityCert', function () {
    var instance = new WSSecurityCert(key, cert, '', {
      hasTimeStamp: false,
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
    });
    var xml = instance.postProcess('<soap:Envelope><soap:Header></soap:Header><soap:Body><Body></Body></soap:Body></soap:Envelope>', 'soap');
    xml.should.containEql('DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"');
  });

  it('should add appendElement when provided', function () {
    var instance = new WSSecurityCert(key, cert, '', {
      appendElement: '<Certificate>Mfg...1+</Certificate>',
    });
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
    xml.should.containEql('<Certificate>Mfg...1+</Certificate>');
    xml.should.containEql('<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">');
    xml.should.containEql('<wsse:SecurityTokenReference');
    xml.should.containEql('<wsse:Reference URI="#' + instance.x509Id);
    xml.should.containEql('<KeyInfo>');
    xml.should.containEql('</KeyInfo>');
    xml.should.containEql('ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"/>');
    xml.should.containEql(instance.publicP12PEM);
    xml.should.containEql(instance.signer.getSignatureXml());
  });

  it('can handle undefined toXML in WSSecurity', async function () {
    const baseUrl = 'http://localhost:80';

    try {
      const client = await soap.createClientAsync(__dirname + '/../wsdl/default_namespace.wsdl', {}, baseUrl);

      const security = new soap.WSSecurityCert(key, cert, '', {
        hasTimeStamp: true,
        signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
        digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
        signatureTransformations: ['http://www.w3.org/2001/10/xml-exc-c14n#'],
      });

      client.setSecurity(security);

      client.MyOperation(function () {});
      assert.fail('must fail');
    } catch (err) {
      assert.ok(err.message?.includes('the following xpath cannot be signed'));
    }
  });
});
