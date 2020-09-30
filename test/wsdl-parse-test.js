'use strict';

var path = require('path');
var open_wsdl = require('../lib/wsdl').open_wsdl;
var assert = require('assert');

describe(__filename, function () {
  it('should parse recursive elements', function (done) {
    open_wsdl(path.resolve(__dirname, 'wsdl/recursive.wsdl'), function (
      err,
      def
    ) {
      assert.equal(
        def.definitions.messages.operationRequest.parts['constraint[]']
          .expression,
        def.definitions.messages.operationRequest.parts['constraint[]']
          .expression.expression
      );
      assert.equal(
        def.definitions.messages.operationRequest.parts['constraint[]']
          .expression,
        def.definitions.messages.operationRequest.parts['constraint[]']
          .expression.expression['constraint[]'].expression
      );
      done();
    });
  });

  it('should parse recursive wsdls', function (done) {
    open_wsdl(path.resolve(__dirname, 'wsdl/recursive/file.wsdl'), function (
      err,
      def
    ) {
      // If we get here then we succeeded
      done(err);
    });
  });

  it('should parse recursive wsdls keeping default options', function (done) {
    open_wsdl(path.resolve(__dirname, 'wsdl/recursive/file.wsdl'), function (
      err,
      def
    ) {
      if (err) {
        return done(err);
      }

      def._includesWsdl.forEach(function (currentWsdl) {
        assert.deepEqual(def.options, currentWsdl.options);
      });

      done();
    });
  });

  it('should parse recursive wsdls keeping provided options', function (done) {
    open_wsdl(
      path.resolve(__dirname, 'wsdl/recursive/file.wsdl'),
      {
        ignoredNamespaces: {
          namespaces: ['targetNamespace', 'typedNamespace'],
          override: true,
        },
      },
      function (err, def) {
        if (err) {
          return done(err);
        }

        def._includesWsdl.forEach(function (currentWsdl, index) {
          assert.deepEqual(def.options, currentWsdl.options);
        });

        done();
      }
    );
  });
});
