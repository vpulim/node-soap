'use strict';

describe('BearerSecurity', function () {
  var BearerSecurity = require('../../').BearerSecurity;
  var token = 'token';

  it('is a function', function () {
    BearerSecurity.should.be.type('function');
  });

  describe('defaultOption param', function () {
    it('is accepted as the second param', function () {
      new BearerSecurity(token, {});
    });

    it('is used in addOptions', function () {
      var options = {};
      var defaultOptions = { foo: 2 };
      var instance = new BearerSecurity(token, defaultOptions);
      instance.addOptions(options);
      options.should.have.property('foo', 2);
    });

    it('should return the authoriation header on calling addHeader', () => {
      const security = new BearerSecurity(token, {});
      let headers = {};
      security.addHeaders(headers);
      headers.should.have.property('Authorization', 'Bearer token');
    });
  });
});
