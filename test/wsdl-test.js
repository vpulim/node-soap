"use strict";

var fs = require('fs'),
    soap = require('..'),
    WSDL = require('../lib/wsdl').WSDL,
    assert = require('assert'),
    sinon = require('sinon'),
    elements = require('../lib/wsdl/elements');

describe('WSDL Parser (strict)', () => {

  const baseUrl = 'http://localhost:80';

  fs.readdirSync(__dirname+'/wsdl/strict').forEach(function(file) {
    if (!/.wsdl$/.exec(file)) return;
    it('should parse and describe '+file, (done) => {
      soap.createClient(__dirname+'/wsdl/strict/'+file, {strict: true}, function(err, client) {
        assert.ifError(err);
        client.describe();
        done();
      });
    });
  });

  it('should catch parse error', (done) => {
    soap.createClient(__dirname+'/wsdl/bad.txt', {strict: true}, function(err) {
      assert.notEqual(err, null);
      done();
    });
  });

  it("should catch incorrect wsdl", done => {
    soap.createClient(__dirname + "/wsdl/bad2.txt", { strict: true }, function(
      err
    ) {
      assert.notEqual(err, null);
      done();
    });
  });

  it('should not give error as string', (done) => {
    soap.createClient(__dirname+'/wsdl/bad.txt', function(err) {
      assert.notEqual(typeof err, 'string');
      done();
    });
  });

  it('should parse external wsdl', (done) => {
    soap.createClient(__dirname+'/wsdl/wsdlImport/main.wsdl', {strict: true}, function(err, client){
      assert.ifError(err);
      assert.deepEqual(Object.keys(client.wsdl.definitions.schemas),
        ['http://example.com/', 'http://schemas.microsoft.com/2003/10/Serialization/Arrays']);
      assert.equal(typeof client.getLatestVersion, 'function');
      done();
    });
  });

  it('should support the overrideImportLocation option', (done) => {
    const options = {
      strict: true,
      wsdl_options: {
        overrideImportLocation: (location) => {
          return location.replace('sub.wsdl', 'overridden.wsdl');
        }
      },
      disableCache: true,
    };

    soap.createClient(__dirname+'/wsdl/wsdlImport/main.wsdl', options, function(err, client){
      assert.ifError(err);
      assert.deepEqual(Object.keys(client.wsdl.definitions.schemas),
        ['http://example.com/', 'http://schemas.microsoft.com/2003/10/Serialization/Arrays']);
      assert.equal(typeof client.getLatestVersionOverridden, 'function');
      done();
    });
  });

  it('should get the parent namespace when parent namespace is empty string', (done) => {
    soap.createClient(__dirname+'/wsdl/marketo.wsdl', {strict: true}, function(err, client){
      assert.ifError(err);
      client.getLeadChanges({
          batchSize: 1,
          startPosition: {activityCreatedAt: '2014-04-14T22:03:48.587Z'},
          activityNameFilter: {stringItem: ['Send Email']}
        }, function() {
          done();
        });
    }, baseUrl);
  });

  it('should describe extended elements in correct order', (done) => {
    var expected = '{"DummyService":{"DummyPortType":{"Dummy":{"input":{"DummyRequest":{"DummyField1":"xs:string","DummyField2":"xs:string"},"ExtendedDummyField":"xs:string"},"output":{"DummyResult":"c:DummyResult"}}}}}';
    soap.createClient(__dirname+'/wsdl/extended_element.wsdl', function(err, client){
      assert.ifError(err);
      assert.equal(JSON.stringify(client.describe()), expected);
      done();
    });
  });

  it('should handle element ref', (done) => {
    var expectedMsg = '<ns1:fooRq xmlns:ns1="http://example.com/bar/xsd"' +
      ' xmlns="http://example.com/bar/xsd"><bar1:paymentRq' +
      ' xmlns:bar1="http://example.com/bar1/xsd">' +
      '<bar1:bankSvcRq>' +
      '<bar1:requestUID>001</bar1:requestUID></bar1:bankSvcRq>' +
      '</bar1:paymentRq></ns1:fooRq>';
    soap.createClient(__dirname + '/wsdl/elementref/foo.wsdl', {strict: true}, function(err, client) {
      assert.ifError(err);
      client.fooOp({paymentRq: {bankSvcRq: {requestUID: '001'}}}, function(err, result) {
        assert.equal(client.lastMessage, expectedMsg);
        done();
      });
    });
  });

  it('should handle type ref', (done) => {
    var expectedMsg = require('./wsdl/typeref/request.xml.js');
    var reqJson = require('./wsdl/typeref/request.json');
    soap.createClient(__dirname + '/wsdl/typeref/order.wsdl', {strict: true}, function(err, client) {
      assert.ifError(err);
      client.order(reqJson, function(err, result) {
        assert.equal(client.lastMessage, expectedMsg);
        done();
      });
    });
  });

  it('should handle extension base', (done) => {
    var expectedMsg = '<bar:Shipper xmlns:bar="http://example.com/bar/xsd"' +
      ' xmlns="http://example.com/bar/xsd"><bar:Name>' +
      '<bar1:name1 xmlns:bar1="http://example.com/bar1/xsd">ABC</bar1:name1></bar:Name>' +
      '</bar:Shipper>';
    soap.createClient(__dirname + '/wsdl/extensionBase/foo.wsdl', {strict: true}, function(err, client) {
      assert.ifError(err);
      client.fooOp({Name: {name1: 'ABC'}}, function(err, result) {
        assert.equal(client.lastMessage, expectedMsg);
        done();
      });
    });
  });

  it('should parse POJO into xml without making unnecessary recursion', (done) => {
    var expectedMsg = require('./wsdl/perf/request.xml.js');
    var reqJson = require('./wsdl/perf/request.json');
    var spy = sinon.spy(WSDL.prototype, "findChildSchemaObject");

    soap.createClient(__dirname + '/wsdl/perf/order.wsdl', {strict: true}, function(err, client) {
      var i, spyCall;

      assert.ifError(err);
      client.order(reqJson, function(err, result) {
        assert.equal(client.lastMessage, expectedMsg);

        // since the reqJson does not use the element named "thing", then findChildSchemaObject should never get to the type named RabbitHole
        // see perf/ns1.xsd
        // this tests the fix for the performance problem where we too many calls to findChildSchemaObject
        // https://github.com/CumberlandGroup/node-ews/issues/58
        assert.ok(spy.callCount);
        for (i = 0; i < spy.callCount; i++) {
          spyCall = spy.getCall(i);
          if (spyCall.args[0]) {
            assert.notEqual(spyCall.args[0].$type, "RabbitHole");
          }
        }

        spy.restore();
        done();
      });
    });
  });

  it('should get empty namespace prefix', (done) => {
    var expectedMsg = '<ns1:fooRq xmlns:ns1="http://example.com/bar/xsd"' +
      ' xmlns="http://example.com/bar/xsd"><bar1:paymentRq' +
      ' xmlns:bar1="http://example.com/bar1/xsd">' +
      '<bar1:bankSvcRq>' +
      '<requestUID>001</requestUID></bar1:bankSvcRq>' +
      '</bar1:paymentRq></ns1:fooRq>';
    // var expectedMsg = 'gg';

    soap.createClient(__dirname + '/wsdl/elementref/foo.wsdl', {strict: true}, function(err, client) {
      assert.ifError(err);
      client.fooOp({paymentRq: {bankSvcRq: {':requestUID': '001'}}}, function(err, result) {
        assert.equal(client.lastMessage, expectedMsg);
        done();
      });
    });
  });

  it('should merge schema with attributes', (done) => {
    var expectedMsg =
      '<peatdef:AskPeat xmlns:peatdef="urn:peat.def" xmlns="urn:peat.def">' +
        '<peatdef:Question>How are you?</peatdef:Question>' +
      '</peatdef:AskPeat>';

    soap.createClient(__dirname + '/wsdl/mergeWithAttributes/main.wsdl', {}, function(err, client) {
      assert.ok(!err);
      client.AskPeat({ Question: 'How are you?' }, function(err, result) {
        assert.equal(client.lastMessage, expectedMsg);
        done();
      });
    });
  });

});

describe('WSDL Parser (non-strict)', () => {
  fs.readdirSync(__dirname+'/wsdl').forEach(function(file) {
    if (!/.wsdl$/.exec(file)) return;
    it('should parse and describe '+file, (done) => {
      soap.createClient(__dirname+'/wsdl/'+file, function(err, client) {
        if (err && err.message === 'Root element of WSDL was <html>. This is likely an authentication issue.') {
          done();
        } else {
          assert.ifError(err);
          client.describe();
          done();
        }
      });
    });
  });

  it('should not parse connection error', (done) => {
    soap.createClient(__dirname+'/wsdl/connection/econnrefused.wsdl', function(err, client) {
      assert.ok(/EADDRNOTAVAIL|ECONNREFUSED/.test(err.code), err);
      done();
    });
  });

  it('should catch parse error', (done) => {
    soap.createClient(__dirname+'/wsdl/bad.txt', function(err) {
      assert.notEqual(err, null);
      done();
    });
  });

  it('should not give error as string', (done) => {
    soap.createClient(__dirname+'/wsdl/bad.txt', function(err) {
      assert.notEqual(typeof err, 'string');
      done();
    });
  });

  it('should load same namespace from included xsd', (done) => {
    var expected = '{"DummyService":{"DummyPortType":{"Dummy":{"input":{"ID":"IdType|xs:string|pattern","Name":"NameType|xs:string|minLength,maxLength"},"output":{"Result":"dummy:DummyList"}}}}}';
    soap.createClient(__dirname + '/wsdl/xsdinclude/xsd_include.wsdl', function(err, client) {
      assert.ifError(err);
      assert.equal(JSON.stringify(client.describe()), expected);
      done();
    });
  });

  it('should load same namespace from included xsd with inline xmlns ', (done) => {
    var expected = '{"DummyService":{"DummyPortType":{"Dummy":{"input":{"ID":"IdType|xs:string|pattern","Name":"NameType|xs:string|minLength,maxLength"},"output":{"Result":"dummy:DummyList"}}}}}';
    soap.createClient(__dirname + '/wsdl/xsdinclude/xsd_include_inline_xmlns.wsdl', function(err, client) {
      assert.ifError(err);
      assert.equal(JSON.stringify(client.describe()), expected);
      done();
    });
  });

  it('should all attributes to root elements', (done) => {
    var expectedMsg = '<ns1:fooRq xmlns:ns1="http://example.com/bar/xsd"' +
      ' xmlns="http://example.com/bar/xsd"><bar1:paymentRq bar1:test="attr"' +
      ' xmlns:bar1="http://example.com/bar1/xsd">' +
      '<bar1:bankSvcRq>' +
      '<requestUID>001</requestUID></bar1:bankSvcRq>' +
      '</bar1:paymentRq></ns1:fooRq>';
    // var expectedMsg = 'gg';

    soap.createClient(__dirname + '/wsdl/elementref/foo.wsdl', {}, function(err, client) {
      assert.ok(!err);
      client.fooOp({paymentRq: { attributes: {'bar1:test': 'attr'}, bankSvcRq: {':requestUID': '001'}}}, function(err, result) {
        assert.equal(client.lastMessage, expectedMsg);
        done();
      });
    });
  });

  it('should merge schema with attributes', (done) => {
    var expectedMsg =
      '<peatdef:AskPeat xmlns:peatdef="urn:peat.def" xmlns="urn:peat.def">' +
        '<peatdef:Question>How are you?</peatdef:Question>' +
      '</peatdef:AskPeat>';

    soap.createClient(__dirname + '/wsdl/mergeWithAttributes/main.wsdl', {}, function(err, client) {
      assert.ok(!err);
      client.AskPeat({ Question: 'How are you?' }, function(err, result) {
        assert.equal(client.lastMessage, expectedMsg);
        done();
      });
    });
  });

  it('should describe recursive wsdl with extended elements', (done) => {
    soap.createClient(__dirname+'/wsdl/extended_recursive.wsdl', function(err, client) {
      assert.ifError(err);
      var desc = client.describe();
      var personDescription = desc.Service1.BasicHttpBinding_IService1.GetPerson.output.GetPersonResult;
      assert.equal(personDescription, personDescription.Department.HeadOfDepartment);
      done();
    });
  });

  it('should describe referenced elements with type of the same name', (done) => {
    soap.createClient(__dirname+'/wsdl/ref_element_same_as_type.wsdl', function(err, client) {
      assert.ifError(err);
      var desc = client.describe();
      assert.equal(desc.MyService.MyPort.MyOperation.input.ExampleContent.MyID, 'xsd:string');
      done();
    });
  });

  it('should describe port type', (done) => {
    soap.createClient(__dirname+'/wsdl/ref_element_same_as_type.wsdl', function(err, client) {
      assert.ifError(err);
      var desc = client.wsdl.definitions.portTypes.MyPortType.description(client.wsdl.definitions);
      assert.equal(desc.MyOperation.input.ExampleContent.MyID, 'xsd:string');
      done();
    });
  });

  it('Should convert objects without prototypical chains to objects with prototypical chains', function () {
    var noPrototypeObj = Object.create(null);
    assert.ok(typeof noPrototypeObj.hasOwnProperty === 'undefined');
    noPrototypeObj.a = 'a';
    noPrototypeObj.b = 'b';
    const xml = fs.readFileSync(__dirname + '/wsdl/binding_document.wsdl', 'utf8');
    var processed = new WSDL(xml, __dirname + '/wsdl/binding_document.wsdl', {});
    processed.definitions = {
      schemas: {
        foo: {}
      }
    };
    var parsed = processed.objectToXML(noPrototypeObj, 'a', 'xsd', 'foo');
    assert.equal(parsed, '<a>a</a><b>b</b>');
  });

  it('Should create client with empty target namespace', (done) => {
    soap.createClient(__dirname+'/wsdl/emptyTargetNamespace.txt', function(err, client) {
      assert.equal(err, null);
      assert.equal(client.wsdl.definitions.schemas[undefined], undefined);
      done();
    });
  });


  it('Should create client even if the some of message definitions are missing', function (done) {
    soap.createClient(__dirname+'/wsdl/missing_message_definition.wsdl', function(err, client) {
      assert.equal(err, null);
      done();
    });
  });

  it('Should describe return correct result for attributes in complexTypeElement', function(done) {
    soap.createClient(__dirname+ '/wsdl/wsdl_with_attributes.wsdl', function(err,client){
      assert.ifError(err);
      var description = client.describe();

      assert.deepEqual(description.StockQuoteService.StockQuotePort.GetLastTradePrice.input[elements.AttributeElement.Symbol], {
        AttributeInOne: { type: "s:boolean", required: false },
        AttributeInTwo: { type: "s:boolean", required: true },
      });
      assert.deepEqual(description.StockQuoteService.StockQuotePort.GetLastTradePrice.output[elements.AttributeElement.Symbol], {
        AttributeOut: { type: "s:boolean", required: true },
      });

      assert.deepEqual(Object.keys(description.StockQuoteService.StockQuotePort.GetLastTradePrice.input), ['tickerSymbol']);
      assert.deepEqual(Object.keys(description.StockQuoteService.StockQuotePort.GetLastTradePrice.output), []);
      done();
    });
  });
});
