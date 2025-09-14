'use strict';

exports.ignoreBaseNameSpaces = true;
exports.envelopeKey = "soapenv";

exports.ignoredNamespaces = {
    "namespaces": ["targetNamespace", "typedNamespace"],
    "override": "true"
  };

exports.overrideRootElement = {
    "namespace": "xmlns:ns0",
    "xmlnsAttributes": [{
      "name": "xmlns:urn",
      "value": "urn:company-com:document:company:rfc:functions"
    }]
  };
