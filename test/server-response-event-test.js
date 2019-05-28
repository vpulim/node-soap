'use strict';

var request = require('request');
var assert = require('assert');
var http = require('http');
var soap = require('../');
var server;
var url;

var wsdl = '<definitions name="HelloService" targetNamespace="http://www.examples.com/wsdl/HelloService.wsdl" xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:tns="http://www.examples.com/wsdl/HelloService.wsdl" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><message name="SayHelloRequest"><part name="firstName" type="xsd:string"/></message><message name="SayHelloResponse"><part name="greeting" type="xsd:string"/></message><portType name="Hello_PortType"><operation name="sayHello"><input message="tns:SayHelloRequest"/><output message="tns:SayHelloResponse"/></operation></portType><binding name="Hello_Binding" type="tns:Hello_PortType"><soap:binding style="rpc" transport="http://schemas.xmlsoap.org/soap/http"/><operation name="sayHello"><soap:operation soapAction="sayHello"/><input><soap:body encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" namespace="urn:examples:helloservice" use="encoded"/></input><output><soap:body encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" namespace="urn:examples:helloservice" use="encoded"/></output></operation></binding><service name="Hello_Service"><documentation>WSDL File for HelloService</documentation><port binding="tns:Hello_Binding" name="Hello_Port"><soap:address location="http://localhost:51515/SayHello/" /></port></service></definitions>';
var requestXML = '<Envelope xmlns="http://schemas.xmlsoap.org/soap/envelope/">' +
  '<Body>' +
  '<sayHello xmlns="http://www.examples.com/wsdl/HelloService.wsdl">' +
  '<firstName>Bob</firstName>' +
  '</sayHello>' +
  '</Body>' +
  '</Envelope>';

var responseXML = '<?xml version="1.0" encoding="utf-8"?>' +
  '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://www.examples.com/wsdl/HelloService.wsdl">' +
  '<soap:Body>' +
  '<tns:sayHelloResponse>' +
  '<tns:greeting>Bob</tns:greeting>' +
  '</tns:sayHelloResponse>' +
  '</soap:Body>' +
  '</soap:Envelope>';

var responseXMLChanged = '<?xml version="1.0" encoding="utf-8"?>' +
  '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://www.examples.com/wsdl/HelloService.wsdl">' +
  '<soap:Body>' +
  '<tns:sayHelloResponse>' +
  '<tns:greeting>John</tns:greeting>' +
  '</tns:sayHelloResponse>' +
  '</soap:Body>' +
  '</soap:Envelope>';

  var service = {
    Hello_Service: {
      Hello_Port: {
        sayHello: function (args) {
          return {
            greeting: args.firstName
          };
        }
      }
    }
  };

describe('server response event test', function () {

  before(function (done) {
    

    server = http.createServer(function(request,response) {
      response.end('404: Not Found: ' + request.url);
    });
    
    server.listen(51515, function () {
      var soapServer = soap.listen(server, '/SayHello', service, wsdl);
      
      soapServer.on('response', function(response, methodName){
        assert.equal(response.result, responseXML);
        assert.equal(methodName, 'sayHello');
        response.result = response.result.replace('Bob','John');
      });

      url = 'http://' + server.address().address + ':' + server.address().port;
      if (server.address().address === '0.0.0.0' || server.address().address === '::') {
        url = 'http://127.0.0.1:' + server.address().port;
      }
      done();
    });
  });

  after(function () {
    server.close();
  });

  it('should replace Bob with John', function (done) {
    request({
      url: url + '/SayHello',
      method: 'POST',
      headers: {
        SOAPAction: "sayHello",
        "Content-Type": 'text/xml; charset="utf-8"'
      },
      body: requestXML
    }, function (err, response, body) {
      if (err) {
        throw err;
      }
      assert.equal(body, responseXMLChanged);
      done();
    });
  });

});
