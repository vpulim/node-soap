'use strict';

var Utils = require('../../lib/utils'),
  assert = require('assert');

describe('PasswordDigest', function () {
  var nonce = '2FW1CIo2ZUOJmSjVRcJZlQ==';
  var created = '2019-02-12T12:34:12.110Z';
  var password = 'vM3s1hKVMy6zBOn';
  var expected = 'wM9xjA92wCw+QcQI1urjZ6B8+LQ=';

  it('is a function', function () {
    Utils.passwordDigest.should.be.type('function');
  });

  it('should calculate a valid passworddigest ', function () {
    var result = Utils.passwordDigest(nonce, created, password);
    assert.equal(result, expected);
  });
});
