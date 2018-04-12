'use strict';

describe('NTLMSecurity', function() {
  var NTLMSecurity = require('../../').NTLMSecurity;
  var username = "admin";
  var password = "password1234";
  var domain = "LOCAL";
  var workstation = "MACHINE";

  it('is a function', function() {
    NTLMSecurity.should.be.type('function');
  });

  describe('constructor', function () {
    it('should optionally accept an options object as the first parameter', function () {
      var options = {
        username: username,
        password: password,
        domain: domain,
        workstation: workstation
      };
      var instance = new NTLMSecurity(options);
      instance.defaults.should.have.property('username', options.username);
      instance.defaults.should.have.property('password', options.password);
      instance.defaults.should.have.property('domain', options.domain);
      instance.defaults.should.have.property('workstation', options.workstation);
      instance.defaults.should.have.property('ntlm', true);
    });

    it('should accept valid variables', function() {
      var instance = new NTLMSecurity(username, password, domain, workstation);
      instance.defaults.should.have.property('username', username);
      instance.defaults.should.have.property('password', password);
      instance.defaults.should.have.property('domain', domain);
      instance.defaults.should.have.property('workstation', workstation);
      instance.defaults.should.have.property('ntlm', true);
    });
  });
  
  describe('addHeaders', function () {
    it('should set connection as \'keep-alive\'', function () {
      var headers = {};
      var instance = new NTLMSecurity(username, password);
      instance.addHeaders(headers);
      headers.should.have.property('Connection', 'keep-alive');
    });
  });

  describe('defaultOption param', function() {
    it('is used in addOptions', function() {
      var options = {};
      var instance = new NTLMSecurity(username, password);
      instance.addOptions(options);
      options.should.have.property("username", username);
      options.should.have.property("password", password);
    });
  });
});
