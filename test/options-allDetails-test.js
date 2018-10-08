'use strict'
var fs = require('fs'),
    soap = require('..'),
    http = require('http'),
    assert = require('assert');
   

describe('SOAP Client', function() {
    var options = {
        allDetails:true
};

it('output should contain other details apart from name and type', function(done) {
    soap.createClient(__dirname+'/wsdl/BLZService.wsdl', options, function(err, client) {
      assert.ok(client);
      assert.ifError(err);

      let bic = { minOccurs: '0',
                    name: 'bic',
                    type: 'xsd:string',
                    targetNamespace: 'http://thomas-bayer.com/blz/' }
                    
      assert.deepEqual(client.describe().BLZService.BLZServiceSOAP11port_http
      .getBank.output.getBankResponseType.details.detailsType.bic, bic);

      done();
    });
  });
});
