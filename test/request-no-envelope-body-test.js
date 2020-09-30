'use strict';

var request = require('request');
var assert = require('assert');
var http = require('http');
var soap = require('../');
var server;
var port;

describe('No envelope and body elements', function () {
  var wsdl =
    '<definitions name="HelloService" targetNamespace="http://www.examples.com/wsdl/HelloService.wsdl" xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:tns="http://www.examples.com/wsdl/HelloService.wsdl" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><message name="SayHelloRequest"><part name="firstName" type="xsd:string"/></message><message name="SayHelloResponse"><part name="greeting" type="xsd:string"/></message><portType name="Hello_PortType"><operation name="sayHello"><input message="tns:SayHelloRequest"/><output message="tns:SayHelloResponse"/></operation></portType><binding name="Hello_Binding" type="tns:Hello_PortType"><soap:binding style="rpc" transport="http://schemas.xmlsoap.org/soap/http"/><operation name="sayHello"><soap:operation soapAction="sayHello"/><input><soap:body encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" namespace="urn:examples:helloservice" use="encoded"/></input><output><soap:body encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" namespace="urn:examples:helloservice" use="encoded"/></output></operation></binding><service name="Hello_Service"><documentation>WSDL File for HelloService</documentation><port binding="tns:Hello_Binding" name="Hello_Port"><soap:address location="http://localhost:51515/SayHello/" /></port></service></definitions>';
  before(function (done) {
    server = http
      .createServer(function (req, res) {
        res.statusCode = 404;
        res.end();
      })
      .listen(51515, function () {
        var soapServer = soap.listen(
          server,
          '/SayHello',
          {
            Hello_Service: {
              Hello_Port: {
                sayHello: function (args) {
                  return {
                    greeting: args.firstName,
                  };
                },
              },
            },
          },
          wsdl
        );
        done();
      });
  });

  after(function () {
    server.close();
  });

  it('should throw an error when Body and Envelope are missing', function (done) {
    var requestXML =
      '<sayHello xmlns="http://www.examples.com/wsdl/HelloService.wsdl"><firstName>tarun</firstName></sayHello>';
    var url =
      'http://' + server.address().address + ':' + server.address().port;

    if (
      server.address().address === '0.0.0.0' ||
      server.address().address === '::'
    ) {
      url = 'http://127.0.0.1:' + server.address().port;
    }

    request(
      {
        url: url + '/SayHello',
        method: 'POST',
        headers: {
          SOAPAction: 'sayHello',
          'Content-Type': 'text/xml; charset="utf-8"',
        },
        body: requestXML,
      },
      function (err, response, body) {
        if (err) {
          throw err;
        }
        assert.equal(
          body.indexOf('Failed to parse the SOAP Message body') !== -1,
          true
        );
        done();
      }
    );
  });
});
