'use strict';

var soap = require('..'),
  assert = require('assert'),
  path = require('path');

describe('Namespace Type Conflict Test', () => {
  it('should use correct namespace for TypeA', (done) => {
    const wsdlPath = path.join(__dirname, 'wsdl/nsTypeConflict/main.wsdl');
    
    soap.createClient(wsdlPath, { strict: true }, function (err, client) {
      assert.ifError(err);

      const message = client.wsdl.definitions.messages.RequestA;
      const fieldA = message.parts.fieldA;
      
      assert.strictEqual(
        fieldA.targetNamespace,
        'http://test.example.com/SchemaA',
        `Expected namespace from SchemaA but got ${fieldA.targetNamespace}`
      );
      
      assert(fieldA['childA[]'], 'Should have childA[] from SchemaA');
      assert(!fieldA['childB[]'], 'Should NOT have childB[] from SchemaB');
      
      done();
    });
  });
});
