'use strict';

var fs = require('fs'),
  join = require('path').join;

describe('WSSecurity', function() {
  var WSSecurity = require('../../').WSSecurity;

  it('is a function', function() {
    WSSecurity.should.be.type('function');
  });

  it('should accept valid constructor variables', function() {
    var username = 'myUser';
    var password = 'myPass';
    var options = {
      passwordType: 'PasswordText',
      hasNonce: true,
      actor: 'urn:sample'
    };
    var instance = new WSSecurity(username, password, options);
    instance.should.have.property('_username', username);
    instance.should.have.property('_password', password);
    instance.should.have.property('_passwordType', options.passwordType);
    instance.should.have.property('_hasNonce', options.hasNonce);
    instance.should.have.property('_actor', options.actor);
  });

  it('should accept passwordType as 3rd arg', function() {
    var username = 'myUser';
    var password = 'myPass';
    var passwordType = 'PasswordText';
    var instance = new WSSecurity(username, password, passwordType);
    instance.should.have.property('_username', username);
    instance.should.have.property('_password', password);
    instance.should.have.property('_passwordType', passwordType);
    instance.should.not.have.property('_hasNonce');
    instance.should.not.have.property('_actor');
  });

  it('should insert a WSSecurity when postProcess is called', function() {
    var username = 'myUser';
    var password = 'myPass';
    var options = {
      passwordType: 'PassWordText',
      hasNonce: true,
      actor: 'urn:sample'
    };
    var instance = new WSSecurity(username, password, options);
    var xml = instance.toXML();

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
    xml.should.containEql('</wsse:UsernameToken></wsse:Security>');

  });
});
