'use strict';

const assert = require('assert');
const soap = require('..');

const soap11 = 'http://schemas.xmlsoap.org/soap/envelope/';
const soap12 = 'http://www.w3.org/2003/05/soap-envelope';
const custom = 'urn:example:soap-envelope';

const wsdl = `<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:tns="urn:counter"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
    targetNamespace="urn:counter">
  <message name="CounterInput"/>
  <message name="CounterOutput"><part name="count" type="xsd:int"/></message>
  <portType name="CounterPortType">
    <operation name="GetCount"><input message="tns:CounterInput"/><output message="tns:CounterOutput"/></operation>
  </portType>
  <binding name="CounterBinding" type="tns:CounterPortType">
    <soap:binding style="rpc" transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="GetCount">
      <soap:operation soapAction="GetCount"/>
      <input><soap:body use="literal" namespace="urn:counter"/></input>
      <output><soap:body use="literal" namespace="urn:counter"/></output>
    </operation>
  </binding>
  <service name="Counter">
    <port name="CounterPort" binding="tns:CounterBinding"><soap:address location="http://example.test/"/></port>
  </service>
</definitions>`;

describe('wsdl_options.acceptedEnvelopeURIs', () => {
  const cases = [
    ['recognizes SOAP 1.1 by default', undefined, soap11, 7],
    ['recognizes SOAP 1.2 by default', undefined, soap12, 7],
    ['requires a custom URI to be configured', undefined, custom, '7'],
    ['recognizes a configured custom URI', [custom], custom, 7],
    ['replaces the default URIs with the configured list', [custom], soap11, '7'],
    ['skips WSDL body lookup with an empty list', [], soap11, '7'],
    ['recognizes explicitly configured SOAP 1.1', [soap11, soap12], soap11, 7],
    ['recognizes explicitly configured SOAP 1.2', [soap11, soap12], soap12, 7],
  ];

  for (const [title, acceptedEnvelopeURIs, uri, expected] of cases) {
    it(title, async () => {
      const options = { disableCache: true };
      if (acceptedEnvelopeURIs !== undefined) {
        options.wsdl_options = { acceptedEnvelopeURIs };
      }
      const client = await soap.createClientAsync(wsdl, options);
      const prefix = uri === custom ? 'soap' : 'env';
      const xml = `<${prefix}:Envelope xmlns:${prefix}="${uri}"><${prefix}:Body><GetCountResponse><count>7</count></GetCountResponse></${prefix}:Body></${prefix}:Envelope>`;
      assert.strictEqual(client.wsdl.xmlToObject(xml).Body.GetCountResponse.count, expected);
    });
  }
});
