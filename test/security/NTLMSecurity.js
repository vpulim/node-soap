'use strict';

describe('NTLMSecurity', function() {
  var NTLMSecurity = require('../../').NTLMSecurity;
  var username = "admin";
  var password = "password1234";

  it('is a function', function() {
    NTLMSecurity.should.be.type('function');
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
