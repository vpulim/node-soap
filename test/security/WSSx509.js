'use strict';

var fs = require('fs'),
    join = require('path').join;

describe('WSSx509', function() {
  var WSSx509 = require('../../lib/security/WSSX509');
  var publicKey = fs.readFileSync(join(__dirname, '..', 'certs', 'agent2-cert.pem')).toString();
  var privateKey = fs.readFileSync(join(__dirname, '..', 'certs', 'agent2-key.pem')).toString();

  it('is a function', function() {
    WSSx509.should.be.type('function');
  });

 it('private key should be required',function(){
      try{
        WSSx509()
      }
      catch(error){
        error.message.should.equal('You mus provide a private key');
      }
 })

 it('public key should be required',function(){
      try{
        WSSx509('something')
      }
      catch(error){
        error.message.should.equal('You mus provide a public key');
      }
 })

  describe('security object interface',function(){
    var X509=new WSSx509(privateKey,publicKey)
    it('should have a postprocess function',function(){
      X509.postProcess.should.be.type('function')
    })
  })


  describe('verifying xml structure',function(){
    var X509=new WSSx509(privateKey,publicKey)
    var request= fs.readFileSync(join(__dirname, '..','request-response-samples', 'addList__complex_extension_namespace_for_arrays', 'request.xml')).toString();

    request=X509.postProcess(request);


    it('should have a header',function(){
      /<\/soap:Header>/.test(request).should.be.equal(true)
    })
    it('should have a body',function(){
      /<\/soap:Body>/.test(request).should.be.equal(true)
    })
    it('should have a token',function(){
      /<\/wsse:Security>/.test(request).should.be.equal(true)
    })

    it('should have a token',function(){
      /<\/wsse:BinarySecurityToken>/.test(request).should.be.equal(true)
    })
    it('should have a timestamp',function(){
      /<\/wsse:BinarySecurityToken>/.test(request).should.be.equal(true)
    })
    it('should have a created',function(){
      /<Timestamp xmlns="http:\/\/docs.oasis-open.org\/wss\/2004\/01\/oasis-200401-wss-wssecurity-utility-1.0.xsd" Id="_1">( *\n*)*<Created>/.test(request).should.be.equal(true)
    })
    it('created should have a date iso string in it',function(){
      /<Timestamp xmlns="http:\/\/docs.oasis-open.org\/wss\/2004\/01\/oasis-200401-wss-wssecurity-utility-1.0.xsd" Id="_1">( *\n*)*<Created>( *\n*)*(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))( *\n*)*<\/Created>/.test(request).should.be.equal(true)
    })
    it('should have an expires',function(){
      /<\/Expires>( *\n*)*<\/Timestamp>/.test(request).should.be.equal(true)
    })
    it('expires should have a valid date iso string in it',function(){
      /<Expires>( *\n*)*(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))( *\n*)*<\/Expires>( *\n*)*<\/Timestamp>/.test(request).should.be.equal(true)
    })



  })

 it()

});
