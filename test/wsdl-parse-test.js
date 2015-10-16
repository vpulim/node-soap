'use strict';

var _ = require('lodash');
var path = require('path');
var wsdl = require('../lib/wsdl');
var open_wsdl = require('../lib/wsdl').open_wsdl;
var assert = require('assert');

describe(__filename, function () {
  beforeEach(function() {
    wsdl.clear_cache();
  });

  it('should parse recursive elements', function (done) {
    open_wsdl(path.resolve(__dirname, 'wsdl/recursive.wsdl'), function (err, def) {
      assert.equal(def.definitions.messages.operationRequest.parts['constraint[]'].expression,
          def.definitions.messages.operationRequest.parts['constraint[]'].expression.expression);
      assert.equal(def.definitions.messages.operationRequest.parts['constraint[]'].expression,
          def.definitions.messages.operationRequest.parts['constraint[]'].expression.expression['constraint[]'].expression);
      done();
    });
  });

  it('should parse recursive wsdls', function (done) {
    open_wsdl(path.resolve(__dirname, 'wsdl/recursive/file.wsdl'), function (err, def) {
      // If we get here then we succeeded 
      done( err );
    });
  });

  it('should parse multiple xsd files with the same namespace using lodash merge', function (done) {
    wsdl.set_merge_method('lodash.default');
    open_wsdl(path.resolve(__dirname, 'wsdl/split-xsd/foo.wsdl'), function (err, def) {
      var elementNames = _.keys(def.definitions.schemas['http://example.com/bar/xsd'].elements);

      //will fail - is missing elements from bar1.xsd
      assert.deepEqual(elementNames, ['fooRq', 'fooRs', 'paymentRq', 'paymentRs', 'requestUID']);

      // If we get here then we succeeded
      done( err );
    });
  });

  it('should parse multiple xsd files with the same namespace using lodash defaults', function (done) {
    wsdl.set_merge_method('lodash.merge');
    open_wsdl(path.resolve(__dirname, 'wsdl/split-xsd/foo.wsdl'), function (err, def) {
      var elementNames = _.keys(def.definitions.schemas['http://example.com/bar/xsd'].elements);

      //will fail - is missing elements from bar1.xsd
      assert.deepEqual(elementNames, ['fooRq', 'fooRs', 'paymentRq', 'paymentRs', 'requestUID']);

      // If we get here then we succeeded
      done( err );
    });
  });

  it('should parse multiple xsd files with the same namespace using lodash defaultsDeep', function (done) {
    wsdl.set_merge_method('lodash.defaultsDeep');
    open_wsdl(path.resolve(__dirname, 'wsdl/split-xsd/foo.wsdl'), function (err, def) {
      var elementNames = _.keys(def.definitions.schemas['http://example.com/bar/xsd'].elements);

      //will fail - is missing elements from bar1.xsd
      assert.deepEqual(elementNames, ['fooRq', 'fooRs', 'paymentRq', 'paymentRs', 'requestUID']);

      // If we get here then we succeeded
      done( err );
    });
  });

  it('should parse multiple xsd files with the same namespace using merge.recursive', function (done) {
    wsdl.set_merge_method('merge');
    open_wsdl(path.resolve(__dirname, 'wsdl/split-xsd/foo.wsdl'), function (err, def) {
      var elementNames = _.keys(def.definitions.schemas['http://example.com/bar/xsd'].elements);

      //contains all 5 elements
      assert.deepEqual(elementNames, ['fooRq', 'fooRs', 'paymentRq', 'paymentRs', 'requestUID']);

      // If we get here then we succeeded
      done( err );
    });
  });
});
