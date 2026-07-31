'use strict';

const { equal } = require('should');
const sinon = require('sinon');

describe('WSSecurity', function () {
  var WSSecurity = require('../../').WSSecurity;

  let clock;

  before(() => {
    const fixedDate = new Date('2025-10-06T00:00:00Z');
    clock = sinon.useFakeTimers(fixedDate.getTime());
  });

  after(() => {
    clock.restore();
  });

  it('is a function', function () {
    WSSecurity.should.be.type('function');
  });

  it('should accept valid constructor variables', function () {
    var username = 'myUser';
    var password = 'myPass';
    var options = {
      passwordType: 'PasswordText',
      hasNonce: true,
      actor: 'urn:sample',
    };
    var instance = new WSSecurity(username, password, options);
    instance.should.have.property('_username', username);
    instance.should.have.property('_password', password);
    instance.should.have.property('_passwordType', options.passwordType);
    instance.should.have.property('_hasNonce', options.hasNonce);
    instance.should.have.property('_actor', options.actor);
  });

  it('should accept passwordType as 3rd arg', function () {
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

  it('should insert a WSSecurity when postProcess is called', function () {
    var username = 'my&User';
    var password = 'my&Pass';
    var options = {
      passwordType: 'PassWordText',
      hasNonce: false,
      actor: 'urn:sample',
    };
    var instance = new WSSecurity(username, password, options);
    var xml = instance.toXML();

    equal(
      xml,
      `<wsse:Security soap:actor="urn:sample" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">` +
        `<wsu:Timestamp wsu:Id="Timestamp-2025-10-06T00:00:00Z">` +
        `<wsu:Created>2025-10-06T00:00:00Z</wsu:Created>` +
        `<wsu:Expires>2025-10-06T00:10:00Z</wsu:Expires>` +
        `</wsu:Timestamp><wsse:UsernameToken xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" wsu:Id="SecurityToken-2025-10-06T00:00:00Z">` +
        `<wsse:Username>my&amp;User</wsse:Username>` +
        `<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">my&amp;Pass</wsse:Password>` +
        `<wsu:Created>2025-10-06T00:00:00Z</wsu:Created>` +
        `</wsse:UsernameToken></wsse:Security>`,
    );
  });

  it('should add envelopeKey to properties in Security block', function () {
    var username = 'myUser';
    var password = 'myPass';
    var options = {
      hasTimeStamp: false,
      mustUnderstand: true,
      actor: 'urn:sample',
      envelopeKey: 'soapenv',
    };
    var instance = new WSSecurity(username, password, options);
    var xml = instance.toXML();
    xml.should.containEql('<wsse:Security soapenv:actor="urn:sample" ');
    xml.should.containEql('soapenv:mustUnderstand="1"');
  });

  it('should add appendElement when provided', function () {
    var username = 'myUser';
    var password = 'myPass';
    var options = {
      hasTimeStamp: false,
      appendElement: '<custom:MyCustomElement xmlns:custom="http://example.com/custom">foo</custom:MyCustomElement>',
    };
    var instance = new WSSecurity(username, password, options);
    var xml = instance.toXML();

    equal(
      xml,
      `<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">` +
        `<wsse:UsernameToken xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" wsu:Id="SecurityToken-2025-10-06T00:00:00Z">` +
        `<wsse:Username>myUser</wsse:Username>` +
        `<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">myPass</wsse:Password>` +
        `<wsu:Created>2025-10-06T00:00:00Z</wsu:Created>` +
        `</wsse:UsernameToken>` +
        `<custom:MyCustomElement xmlns:custom="http://example.com/custom">foo</custom:MyCustomElement>` +
        `</wsse:Security>`,
    );
  });
});
