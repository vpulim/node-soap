'use strict';

describe('NTLMSecurity', function() {
  var NTLMSecurity = require('../../').NTLMSecurity;
  var username = "admin";
  var password = "password1234";

  it('is a function', function() {
    NTLMSecurity.should.be.type('function');
  });
});
