'use strict';

var request = require('request');
var assert = require('assert');
var http = require('http');
var soap = require('..');
var server;
var url;

var wsdl = `<?xml version="1.0" encoding="utf-8"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:xs="http://www.w3.org/2001/XMLSchema" name="IHSDTPSClientservice" targetNamespace="http://SampleCompany.com/" xmlns:tns="http://SampleCompany.com/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:soapenc="http://schemas.xmlsoap.org/soap/encoding/" xmlns:mime="http://schemas.xmlsoap.org/wsdl/mime/" xmlns:ns1="urn:uHSD_Intf" xmlns:ns2="urn:uGlobalSOAPTypes">
  <types>
    <xs:schema targetNamespace="urn:uGlobalSOAPTypes" xmlns="urn:uGlobalSOAPTypes">
      <xs:complexType name="TSecurity">
        <xs:sequence>
          <xs:element name="UserName" type="xs:string"/>
          <xs:element name="Password" type="xs:string"/>
          <xs:element name="TID" type="xs:string"/>
        </xs:sequence>
      </xs:complexType>
    </xs:schema>
  </types>
  <message name="GetVersion0Request"/>
  <message name="GetVersion0Response">
    <part name="return" type="xs:string"/>
  </message>
  <message name="GetVersion0headerRequest">
    <part name="TSecurity" type="ns2:TSecurity"/>
  </message> 
  <portType name="IHSDTPSClient">
    <operation name="GetVersion">
      <input message="tns:GetVersion0Request"/>
      <output message="tns:GetVersion0Response"/>
    </operation>
  </portType>
  <binding name="IHSDTPSClientbinding" type="tns:IHSDTPSClient">
    <soap:binding style="rpc" transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="GetVersion">
      <soap:operation soapAction="urn:uHSD_Intf-IHSDTPSClient#GetVersion" style="rpc"/>
      <input message="tns:GetVersion0Request">
        <soap:body use="encoded" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" namespace="urn:uHSD_Intf-IHSDTPSClient"/>
        <soap:header xmlns:n1="http://schemas.xmlsoap.org/wsdl/" n1:required="true" use="encoded" message="tns:GetVersion0headerRequest" part="TSecurity" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" namespace="urn:uGlobalSOAPTypes"/>
      </input>
      <output message="tns:GetVersion0Response">
        <soap:body use="encoded" encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" namespace="urn:uHSD_Intf-IHSDTPSClient"/>
      </output>
    </operation>
  </binding>
  <service name="IHSDTPSClientservice">
    <port name="IHSDTPSClientPort" binding="tns:IHSDTPSClientbinding">
      <soap:address location="http://localhost:1024/soap" />
    </port>
  </service>
</definitions>
`;

var requestXML = `<?xml version="1.0" encoding="UTF-8"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:ns5="urn:CRMAAA-types" xmlns:ns9="urn:uOBI_Intf" xmlns:ns2="urn:uGlobalSOAPTypes" xmlns:ns1="urn:uHSD_Intf" xmlns:ns10="urn:uOBI_Intf-IOBIVODClient" xmlns:ns11="urn:uOBI_Intf-IOBISMSClient" xmlns:ns7="urn:uHSD_Intf-IHSDTPSClient"><SOAP-ENV:Header><ns2:TSecurity xsi:type="ns2:TSecurity"><UserName>dGVzdG==</UserName><Password>dGVzdG==</Password><TID>{001,MON,DVL,203,1}</TID></ns2:TSecurity></SOAP-ENV:Header><SOAP-ENV:Body SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><ns7:GetVersion></ns7:GetVersion></SOAP-ENV:Body></SOAP-ENV:Envelope>`;

var responseXMLGood = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://SampleCompany.com/" xmlns:ns1="urn:uHSD_Intf" xmlns:ns2="urn:uGlobalSOAPTypes"><soap:Body><tns:GetVersionResponse><tns:return>1.2.3.4</tns:return></tns:GetVersionResponse></soap:Body></soap:Envelope>`;

var responseXMLBad = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://SampleCompany.com/" xmlns:ns1="urn:uHSD_Intf" xmlns:ns2="urn:uGlobalSOAPTypes"><soap:Body><soap:Fault><soap:Code><soap:Value>SOAP-ENV:Server</soap:Value><soap:Subcode><soap:value>InternalServerError</soap:value></soap:Subcode></soap:Code><soap:Reason><soap:Text>TypeError: Cannot read property &apos;output&apos; of undefined</soap:Text></soap:Reason></soap:Fault></soap:Body></soap:Envelope>`;

var service = {
  IHSDTPSClientservice: {
    IHSDTPSClientPort: {
      GetVersion: function (args, callback, headers, req) {
        return {
          return: '1.2.3.4',
        };
      },
    },
  },
};

describe('server receive complex type test', function () {
  before(function (done) {
    server = http.createServer(function (request, response) {
      response.end('404: Not Found: ' + request.url);
    });

    server.listen(51515, function () {
      var soapServer = soap.listen(server, '/GetVersion', service, wsdl);

      soapServer.on('response', function (response, methodName) {
        assert.equal(methodName, 'GetVersion');
      });

      url = 'http://' + server.address().address + ':' + server.address().port;
      if (
        server.address().address === '0.0.0.0' ||
        server.address().address === '::'
      ) {
        url = 'http://127.0.0.1:' + server.address().port;
      }
      done();
    });
  });

  after(function () {
    server.close();
  });

  it('should return good response', function (done) {
    request(
      {
        url: url + '/GetVersion',
        method: 'POST',
        headers: {
          SOAPAction: 'urn:uHSD_Intf-IHSDTPSClient#GetVersion',
          'Content-Type': 'text/xml; charset="utf-8"',
        },
        body: requestXML,
      },
      function (err, response, body) {
        if (err) {
          throw err;
        }
        assert.equal(body, responseXMLGood);
        done();
      }
    );
  });
});
