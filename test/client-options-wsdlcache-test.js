'use strict';
var soap = require('..'),
  assert = require('assert'),
  sinon = require('sinon'),
  utils = require('../lib/utils'),
  wsdl = require("../lib/wsdl");
describe('SOAP Client - WSDL Cache', function () {
  var sandbox = sinon.createSandbox();
  var wsdlUri = __dirname + '/wsdl/Dummy.wsdl';
  beforeEach(function () {
    sandbox.spy(wsdl, 'open_wsdl');
  });
  afterEach(function () {
    sandbox.restore();
  });

  it('should use default cache if not provided', function (done) {
    // ensure cache is empty to prevent impacts to this case
    // if other test already loaded this WSDL
    utils.wsdlCacheSingleton.clear();

    // cache miss
    soap.createClient(wsdlUri, {}, function (err, clientFirstCall) {
      if (err) return done(err);
      assert.strictEqual(wsdl.open_wsdl.callCount, 1);

      // hits cache
      soap.createClient(wsdlUri, {}, function (err, clientSecondCall) {
        if (err) return done(err);
        assert.strictEqual(wsdl.open_wsdl.callCount, 1);

        // disabled cache
        soap.createClient(wsdlUri, { disableCache: true }, function (err, clientSecondCall) {
          if (err) return done(err);
          assert.strictEqual(wsdl.open_wsdl.callCount, 2);
          done();
        });
      });
    });
  });

  it('should use the provided WSDL cache', function (done) {
    /** @type {IWSDLCache} */
    var dummyCache = {
      has: function () { },
      get: function () { },
      set: function () { },
    };
    sandbox.stub(dummyCache, 'has');
    sandbox.stub(dummyCache, 'get');
    sandbox.stub(dummyCache, 'set');
    dummyCache.has.returns(false);
    var options = {
      wsdlCache: dummyCache,
    };
    soap.createClient(wsdlUri, options, function (err, clientFirstCall) {
      assert.strictEqual(dummyCache.has.callCount, 1);
      assert.strictEqual(dummyCache.get.callCount, 0);
      assert.strictEqual(dummyCache.set.callCount, 1);
      // cache miss
      assert.strictEqual(wsdl.open_wsdl.callCount, 1);

      var cacheEntry = dummyCache.set.firstCall.args;
      assert.deepStrictEqual(cacheEntry[0], wsdlUri);

      var cachedWSDL = cacheEntry[1];
      assert.ok(cachedWSDL instanceof wsdl.WSDL);
      assert.deepStrictEqual(clientFirstCall.wsdl, cachedWSDL);

      sandbox.reset();
      dummyCache.has.returns(true);
      dummyCache.get.returns(cachedWSDL);

      soap.createClient(wsdlUri, options, function (err, clientSecondCall) {
        // hits cache
        assert.strictEqual(wsdl.open_wsdl.callCount, 0);
        assert.strictEqual(dummyCache.has.callCount, 1);
        assert.strictEqual(dummyCache.get.callCount, 1);
        assert.deepStrictEqual(dummyCache.get.firstCall.args, [wsdlUri]);
        assert.strictEqual(dummyCache.set.callCount, 0);
        assert.deepStrictEqual(clientSecondCall.wsdl, cachedWSDL);
        done();
      });
    });
  });
});
