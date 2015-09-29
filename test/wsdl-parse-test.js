'use strict';

var path = require('path');
var open_wsdl = require('../lib/wsdl').open_wsdl;
var assert = require('assert');

describe(__filename, function () {
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
});
