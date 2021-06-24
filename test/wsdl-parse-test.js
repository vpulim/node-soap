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

  it('should parse recursive wsdls keeping default options', function(done) {
    open_wsdl(path.resolve(__dirname, 'wsdl/recursive/file.wsdl'), function (err, def) {
      if (err) {
        return done( err );
      }

      def._includesWsdl.forEach(function(currentWsdl) {
        assert.deepEqual(def.options, currentWsdl.options);
      });

      done();
    });
  });

  it('should parse recursive wsdls keeping provided options', function(done) {
    open_wsdl(path.resolve(__dirname, 'wsdl/recursive/file.wsdl'), {
      ignoredNamespaces: {
        namespaces: ['targetNamespace', 'typedNamespace'],
        override: true
      }
    } , function (err, def) {
      if (err) {
        return done( err );
      }

      def._includesWsdl.forEach(function(currentWsdl, index) {
        assert.deepEqual(def.options, currentWsdl.options);
      });

      done();
    });
  });

  it('should parse recursive wsdls with element references', function (done) {
    open_wsdl(path.resolve(__dirname, 'wsdl/recursive_with_ref.wsdl'), function (err, def) {
        assert.ifError(err);
        var desc = def.definitions.portTypes.CloudSignService.description(def.definitions);
        assert.equal(desc.AddSignature.input.properties.property && desc.AddSignature.input.properties.property.value2, 'string');
        done();
    });
  });

  it('should parse recursive wsdls with element references and complex types named same as references', function (done) {
    open_wsdl(path.resolve(__dirname, 'wsdl/recursive_with_ref2.wsdl'), function (err, def) {
      assert.ifError(err);
      var desc = def.definitions.portTypes.CloudSignService.description(def.definitions);
      assert.equal(desc.AddSignature.input.properties.property && desc.AddSignature.input.properties.property.value2, 'string');
      done();
    });
  });

  it('should parse complex wsdls', function (done) {
    open_wsdl(path.resolve(__dirname, 'wsdl/complex/registration-common.wsdl'), function (err, def) {
      if (err) {
        return done( err );
      }

      if (null === def.findSchemaType('recipientAddress', 'http://test-soap.com/api/common/types')) {
        return done( 'Unable to find "recipientAddress" complex type' );
      }
      if (null === def.findSchemaType('commonAddress', 'http://test-soap.com/api/common/types')) {
        return done( 'Unable to find "commonAddress" complex type' );
      }
      if (null === def.findSchemaType('companyAddress', 'http://test-soap.com/api/common/types')) {
        return done( 'Unable to find "companyAddress" complex type' );
      }
      if (null === def.findSchemaObject('http://test-soap.com/api/registration/messages', 'registerUserRequest')) {
        return done( 'Unable to find "registerUserRequest" schema object' );
      }

      var requestBody = {
        id: 'ID00000000000000000000000000000000',
        lastName: 'Doe',
        firstName: 'John',
        dateOfBirth: '1970-01-01',
        correspondenceLanguage: 'ENG',
        emailAddress: 'jdoe@doe.com',
        lookupPermission: 'ALLOWED',
        companyAddress: {
          address: {
            streetName: 'Street',
            postalCode: 'Code',
            city: 'City',
            countryCode: 'US'
          },
          companyName: 'ACME'
        }
      }

      var requestAsXML = def.objectToDocumentXML(
        'registerUserRequest', 
        requestBody, 
        'msg',
        'http://test-soap.com/api/registration/messages',
        'registerUserRequest' 
      );

      /*
      Expected XML:
      <msg:registerUserRequest xmlns:msg="http://test-soap.com/api/registration/messages" xmlns="http://test-soap.com/api/registration/messages">
        <msg:id>ID00000000000000000000000000000000</msg:id>
        <msg:lastName>Doe</msg:lastName>
        <msg:firstName>John</msg:firstName>
        <msg:dateOfBirth>1970-01-01</msg:dateOfBirth>
        <msg:correspondenceLanguage>ENG</msg:correspondenceLanguage>
        <msg:emailAddress>jdoe@doe.com</msg:emailAddress>
        <msg:lookupPermission>ALLOWED</msg:lookupPermission>
        <msg:companyAddress>
          <ct:address xmlns:ct="http://test-soap.com/api/common/types">
            <ct:streetName>Street</ct:streetName>
            <ct:postalCode>Code</ct:postalCode>
            <ct:city>City</ct:city>
            <ct:countryCode>US</ct:countryCode>
          </ct:address>
          <ct:companyName xmlns:ct="http://test-soap.com/api/common/types">ACME</ct:companyName>
        </msg:companyAddress>
      </msg:registerUserRequest>
      */
      assert.strictEqual(requestAsXML, '<msg:registerUserRequest xmlns:msg="http://test-soap.com/api/registration/messages" xmlns="http://test-soap.com/api/registration/messages"><msg:id>ID00000000000000000000000000000000</msg:id><msg:lastName>Doe</msg:lastName><msg:firstName>John</msg:firstName><msg:dateOfBirth>1970-01-01</msg:dateOfBirth><msg:correspondenceLanguage>ENG</msg:correspondenceLanguage><msg:emailAddress>jdoe@doe.com</msg:emailAddress><msg:lookupPermission>ALLOWED</msg:lookupPermission><msg:companyAddress><ct:address xmlns:ct="http://test-soap.com/api/common/types"><ct:streetName>Street</ct:streetName><ct:postalCode>Code</ct:postalCode><ct:city>City</ct:city><ct:countryCode>US</ct:countryCode></ct:address><ct:companyName xmlns:ct="http://test-soap.com/api/common/types">ACME</ct:companyName></msg:companyAddress></msg:registerUserRequest>');

      done();
    });
  });
});
