'use strict';

var fs = require('fs'),
  soap = require('../..'),
  assert = require('assert'),
  _ = require('lodash'),
  sinon = require('sinon'),
  wsdl = require('../../lib/wsdl'),
  join = require('path').join;

describe('SecurityChaining', function() {
  var WSSecurity = require('../../').WSSecurity;
  var WSSecurityCert = require('../../').WSSecurityCert;
  var cert = fs.readFileSync(join(__dirname, '..', 'certs', 'agent2-cert.pem'));
  var key = fs.readFileSync(join(__dirname, '..', 'certs', 'agent2-key.pem'));
  var keyWithPassword = fs.readFileSync(join(__dirname, '..', 'certs', 'agent2-key-with-password.pem')); // The passphrase protecting the private key is "soap"




  it('should insert a WSSecurity when postProcess is called', function(done) {
    soap.createClient(__dirname + '/../wsdl/default_namespace.wsdl', function(err, client) {
      var username = 'myUser';
      var password = 'myPass';
      var options = {
        passwordType: 'PassWordText',
        hasNonce: true,
        actor: 'urn:sample'
      };
      var security = new WSSecurity(username, password, options);

      var securityCert = new WSSecurityCert(key, cert, '');
      //var xml = instance.postProcess('<soap:Header></soap:Header><soap:Body></soap:Body>', 'soap');

      client.appendSecurity(security);
      client.appendSecurity(securityCert);

      assert.ok(client);
      assert.ifError(err);

      client.MyOperation({}, function (err, result) {
        var xml = client.lastRequest;

        // login with password
        xml.should.containEql('<wsse:Security soap:actor="urn:sample" ');
        xml.should.containEql('xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" ');
        xml.should.containEql('xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">');
        xml.should.containEql('<wsu:Timestamp wsu:Id="Timestamp-');
        xml.should.containEql('<wsu:Created>');
        xml.should.containEql('<wsu:Expires>');
        xml.should.containEql('</wsu:Timestamp>');
        xml.should.containEql('<wsse:UsernameToken ');
        xml.should.containEql('xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" ');
        xml.should.containEql('wsu:Id="SecurityToken-');
        xml.should.containEql('<wsse:Username>myUser</wsse:Username>');
        xml.should.containEql('<wsse:Password ');
        xml.should.containEql('Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">');
        xml.should.containEql('myPass</wsse:Password>');
        xml.should.containEql('<wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">');
        xml.should.containEql('</wsse:Nonce>');
        xml.should.containEql('<wsu:Created>');
        xml.should.containEql('</wsse:UsernameToken>');
        xml.should.containEql('</wsse:Security>');


        // signed with certificate
        xml.should.containEql('<wsse:Security');
        xml.should.containEql('http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd');
        xml.should.containEql('http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd');
        xml.should.containEql('soap:mustUnderstand="1"');
        xml.should.containEql('<wsse:BinarySecurityToken');
        xml.should.containEql('EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary');
        xml.should.containEql('ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"');
        xml.should.containEql('wsu:Id="' + securityCert.x509Id);
        xml.should.containEql('</wsse:BinarySecurityToken>');
        xml.should.containEql('<Timestamp xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" Id="_1">');
        xml.should.containEql('<Created>' + securityCert.created);
        xml.should.containEql('<Expires>' + securityCert.expires);
        xml.should.containEql('<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">');
        xml.should.containEql('<wsse:SecurityTokenReference>');
        xml.should.containEql('<wsse:Reference URI="#' + securityCert.x509Id);
        xml.should.containEql('ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"/>');
        xml.should.containEql(securityCert.publicP12PEM);
        xml.should.containEql(securityCert.signer.getSignatureXml());
        done();
      });
    });




  });
});
