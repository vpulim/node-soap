'use strict';

describe('ClientSSLSecurity', function() {
  var ClientSSLSecurity = require('../../').ClientSSLSecurity;
  var cert = __filename;
  var key = __filename;

  it('is a function', function() {
    ClientSSLSecurity.should.be.type('function');
  });

  describe('defaultOption param', function() {
    it('is accepted as the third param', function() {
      new ClientSSLSecurity(key, cert, {});
    });

    it('is used in addOptions', function() {
      var options = {};
      var defaultOptions = { foo: 5 };
      var instance = new ClientSSLSecurity(key, cert, defaultOptions);
      instance.addOptions(options);
      options.should.have.property("foo", 5);
    });
  });
});
