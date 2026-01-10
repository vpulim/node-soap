[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Coveralls Status][coveralls-image]][coveralls-url]

[![Support][buy-me-a-coffee-image]][buy-me-a-coffee-url]

# Sponsors

[**Travel Axis**](https://www.linkedin.com/company/travel-axis) is proud to support this project by contributing engineering resources.  
The company is building [**Helix**](https://www.midoffice.app), a SaaS platform designed to transform the travel management industry.

# SOAP client and server for node.js.

This module lets you connect to web services using SOAP. It also provides a server that allows you to run your own SOAP services.

<!-- Run `npm run toc` to update below section -->
<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Features](#features)
- [Install](#install)
- [Support](#support)
- [Module](#module)
  - [soap.createClient(url[, options], callback) - create a new SOAP client from a WSDL url. Also supports a local filesystem path.](#soapcreateclienturl-options-callback---create-a-new-soap-client-from-a-wsdl-url-also-supports-a-local-filesystem-path)
  - [soap.createClientAsync(url[, options]) - create a new SOAP client from a WSDL url. Also supports a local filesystem path.](#soapcreateclientasyncurl-options---create-a-new-soap-client-from-a-wsdl-url-also-supports-a-local-filesystem-path)
  - [soap.listen(_server_, _path_, _services_, _wsdl_, _callback_) - create a new SOAP server that listens on _path_ and provides _services_.](#soaplistenserver-path-services-wsdl-callback---create-a-new-soap-server-that-listens-on-path-and-provides-services)
  - [soap.listen(_server_, _options_) - create a new SOAP server that listens on _path_ and provides _services_.](#soaplistenserver-options---create-a-new-soap-server-that-listens-on-path-and-provides-services)
  - [Server Logging](#server-logging)
  - [Server Events](#server-events)
  - [Server Response on one-way calls](#server-response-on-one-way-calls)
  - [SOAP Fault](#soap-fault)
  - [Server security example using PasswordDigest](#server-security-example-using-passworddigest)
  - [Server connection authorization](#server-connection-authorization)
- [SOAP Headers](#soap-headers)
  - [Received SOAP Headers](#received-soap-headers)
  - [Outgoing SOAP Headers](#outgoing-soap-headers)
- [Client](#client)
  - [Client.describe() - description of services, ports and methods as a JavaScript object](#clientdescribe---description-of-services-ports-and-methods-as-a-javascript-object)
  - [Client.setSecurity(security) - use the specified security protocol](#clientsetsecuritysecurity---use-the-specified-security-protocol)
  - [Client._method_(args, callback, options) - call _method_ on the SOAP service.](#clientmethodargs-callback-options---call-method-on-the-soap-service)
  - [Client.*method*Async(args, options) - call _method_ on the SOAP service.](#clientmethodasyncargs-options---call-method-on-the-soap-service)
  - [Client._service_._port_._method_(args, callback[, options[, extraHeaders]]) - call a _method_ using a specific _service_ and _port_](#clientserviceportmethodargs-callback-options-extraheaders---call-a-method-using-a-specific-service-and-port)
  - [Overriding the namespace prefix](#overriding-the-namespace-prefix)
  - [Client._lastRequest_ - the property that contains last full soap request for client logging](#clientlastrequest---the-property-that-contains-last-full-soap-request-for-client-logging)
  - [Client.setEndpoint(url) - overwrite the SOAP service endpoint address](#clientsetendpointurl---overwrite-the-soap-service-endpoint-address)
  - [Client Events](#client-events)
  - [_request_](#request)
  - [_message_](#message)
  - [_soapError_](#soaperror)
  - [_response_](#response)
- [WSDL](#wsdl)
- [WSDL.constructor(wsdl, baseURL, options):](#wsdlconstructorwsdl-baseurl-options)
  - [wsdl.xmlToObject(xml):](#wsdlxmltoobjectxml)
  - [wsdl.objectToXML(object, typeName, namespacePrefix, namespaceURI, ...):](#wsdlobjecttoxmlobject-typename-namespaceprefix-namespaceuri-)
- [Security](#security)
  - [BasicAuthSecurity](#basicauthsecurity)
  - [BearerSecurity](#bearersecurity)
  - [ClientSSLSecurity](#clientsslsecurity)
  - [ClientSSLSecurityPFX](#clientsslsecuritypfx)
  - [WSSecurity](#wssecurity)
  - [WSSecurityCert](#wssecuritycert)
  - [WSSecurityPlusCert](#wssecuritypluscert)
  - [WSSecurityCertWithToken](#wssecuritycertwithtoken)
  - [NTLMSecurity](#ntlmsecurity)
- [Handling XML Attributes, Value and XML (wsdlOptions).](#handling-xml-attributes-value-and-xml-wsdloptions)
  - [Overriding the `value` key](#overriding-the-value-key)
  - [Overriding the `xml` key](#overriding-the-xml-key)
  - [Overriding the `attributes` key](#overriding-the-attributes-key)
  - [Overriding imports relative paths](#overriding-imports-relative-paths)
  - [Overriding import locations](#overriding-import-locations)
  - [Specifying the exact namespace definition of the root element](#specifying-the-exact-namespace-definition-of-the-root-element)
  - [Overriding element key specification in XML](#overriding-element-key-specification-in-xml)
  - [Custom Deserializer](#custom-deserializer)
  - [Changing the tag formats to use self-closing (empty element) tags](#changing-the-tag-formats-to-use-self-closing-empty-element-tags)
- [Handling "ignored" namespaces](#handling-ignored-namespaces)
- [Handling "ignoreBaseNameSpaces" attribute](#handling-ignorebasenamespaces-attribute)
- [Contributors](#contributors)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Features

- Very simple API
- Handles both RPC and Document schema types
- Supports multiRef SOAP messages (thanks to [@kaven276](https://github.com/kaven276))
- Support for both synchronous and asynchronous method handlers
- WS-Security UsernameToken Profile 1.0
- Supports [Express](http://expressjs.com/) based web server (body parser middleware can be used)

## Install

```
  npm install soap
```

## Support

Community support is available through GitHub issues tab.
Paid support can be provided as well, please contact one of the active maintainers.

## Module

### soap.createClient(url[, options], callback) - create a new SOAP client from a WSDL url. Also supports a local filesystem path.

- `url` (_string_): A HTTP/HTTPS URL, XML or a local filesystem path.
- `options` (_Object_):
  - `endpoint` (_string_): Override the host specified by the SOAP service in the WSDL file.
  - `envelopeKey` (_string_): Set a custom envelope key. (**Default:** `'soap'`)
  - `preserveWhitespace` (_boolean_): Preserve any leading and trailing whitespace characters in text and cdata.
  - `escapeXML` (_boolean_): Escape special XML characters (e.g. `&`, `>`, `<` etc) in SOAP messages. (**Default:** `true`)
  - `suppressStack` (_boolean_): Suppress the full stack trace for error messages.
  - `returnFault` (_boolean_): Return an `Invalid XML` SOAP fault upon a bad request. (**Default:** `false`)
  - `forceSoap12Headers` (_boolean_): Enable SOAP 1.2 compliance.
  - `httpClient` (_Object_): Override the built-in HttpClient object with your own. Must implement `request(rurl, data, callback, exheaders, exoptions)`.
  - `request` (_Object_): Override the default request module ([Axios](https://axios-http.com/) as of `v0.40.0`).
  - `wsdl_headers` (_Object_): Set HTTP headers with values to be sent on WSDL requests.
  - `wsdl_options` (_Object_): Set options for the request module on WSDL requests. If using the default request module, see [Request Config | Axios Docs](https://axios-http.com/docs/req_config).
  - `disableCache` (_boolean_): Prevents caching WSDL files and option objects.
  - `wsdlCache` (_IWSDLCache_): Custom cache implementation. If not provided, defaults to caching WSDLs indefinitely.
  - `overridePromiseSuffix` (_string_): Override the default method name suffix of WSDL operations for Promise-based methods. If any WSDL operation name ends with `Async', you must use this option. (**Default:** `Async`)
  - `normalizeNames` (_boolean_): Replace non-identifier characters (`[^a-z$_0-9]`) with `_` in WSDL operation names. Note: Clients using WSDLs with two operations like `soap:method` and `soap-method` will be overwritten. In this case, you must use bracket notation instead (`client['soap:method']()`).
  - `namespaceArrayElements` (_boolean_): Support non-standard array semantics. JSON arrays of the form `{list: [{elem: 1}, {elem: 2}]}` will be marshalled into XML as `<list><elem>1</elem></list> <list><elem>2</elem></list>`. If `false`, it would be marshalled into `<list> <elem>1</elem> <elem>2</elem> </list>`. (**Default:** `true`)
  - `stream` (_boolean_): Use streams to parse the XML SOAP responses. (**Default:** `false`)
  - `returnSaxStream` (_boolean_): Return the SAX stream, transferring responsibility of parsing XML to the end user. Only valid when the _stream_ option is set to `true`. (**Default:** `false`)
  - `parseReponseAttachments` (_boolean_): Treat response as multipart/related response with MTOM attachment. Reach attachments on the `lastResponseAttachments` property of SoapClient. (**Default:** `false`)
  - `encoding` (_string_): Response data enconding, used with `parseReponseAttachments`. (**Default:** `utf8`)
  - `forceUseSchemaXmlns` (_boolean_): Force to use schema xmlns when schema prefix not found, this is needed when schema prefix is different for the same namespace in different files, for example wsdl and in imported xsd file fir complex types (**Default** `false`)
- `callback` (_Function_):
  - `err` (_Error_ | _\<AggregateError\>_)
  - `result` (_Any_)
- Returns: `Client`

#### Example

HTTP/HTTPS:

```javascript
var soap = require('soap');
var url = 'http://example.com/wsdl?wsdl';
var args = { name: 'value' };

soap.createClient(url, {}, function (err, client) {
  client.MyFunction(args, function (err, result) {
    console.log(result);
  });
});
```

XML string format:

```javascript
var soap = require('soap');
var xml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/">
       <message name="MyFunctionRequest"/>
       <message name="MyFunctionResponse"/>
    
       <portType name="MyFunctionPortType">
          <operation name="MyFunction">
             <input message="MyFunctionRequest"/>
             <output message="MyFunctionResponse"/>
          </operation>
       </portType>
    
       <binding name="MyFunctionBinding" type="MyFunctionPortType">
          <soap:binding style="rpc" transport="http://schemas.xmlsoap.org/soap/http"/>
          <operation name="MyFunction">
             <soap:operation soapAction="MyFunction"/>
             <input><soap:body use="encoded"/></input>
             <output><soap:body use="encoded"/></output>
          </operation>
       </binding>
    
       <service name="MyService">
          <port binding="MyFunctionBinding" name="MyFunctionPort">
             <soap:address location="http://www.examples.com/MyFunction/" />
          </port>
       </service>
    </definitions>
  `;
var args = { name: 'value' };

soap.createClient(xml, {}, function (err, client) {
  client.MyFunction(args, function (err, result) {
    console.log(result);
  });
});
```

Note: for versions of node >0.10.X, you may need to specify `{connection: 'keep-alive'}` in SOAP headers to avoid truncation of longer chunked responses.

### soap.createClientAsync(url[, options]) - create a new SOAP client from a WSDL url. Also supports a local filesystem path.

Construct a `Promise<Client>` with the given WSDL file.

- `url` (_string_): A HTTP/HTTPS URL, XML or a local filesystem path.
- `options` (_Object_): See [soap.createClient(url[, options], callback)](#soapcreateclienturl-options-callback---create-a-new-soap-client-from-a-wsdl-url-also-supports-a-local-filesystem-path) for a description.
- Returns: `Promise<Client>`

#### Example

```javascript
var soap = require('soap');
var url = 'http://example.com/wsdl?wsdl';
var args = { name: 'value' };

// then/catch
soap
  .createClientAsync(url)
  .then((client) => {
    return client.MyFunctionAsync(args);
  })
  .then((result) => {
    console.log(result);
  });

// async/await
var client = await soap.createClientAsync(url);
var result = await client.MyFunctionAsync(args);
console.log(result[0]);
```

Note: for versions of node >0.10.X, you may need to specify `{connection: 'keep-alive'}` in SOAP headers to avoid truncation of longer chunked responses.

### soap.listen(_server_, _path_, _services_, _wsdl_, _callback_) - create a new SOAP server that listens on _path_ and provides _services_.

### soap.listen(_server_, _options_) - create a new SOAP server that listens on _path_ and provides _services_.

- `server` (_Object_): A [http](https://nodejs.org/api/http.html) server or [Express](http://expressjs.com/) framework based server.
- `path` (_string_)
- `options` (_Object_): An object containing _server options_ and [WSDL Options](#handling-xml-attributes-value-and-xml-wsdloptions)
  - `path` (_string_)
  - `services` (_Object_)
  - `xml` (_string_)
  - `uri` (_string_)
  - `pfx` (_string_ | _Buffer_): The private key, certificate and CA certs of the server in PFX or PKCS12 format. (Mutually exclusive with the key, cert and ca options.)
  - `key` (_string_ | _Buffer_): The private key of the server in PEM format. (Could be an array of keys). (Required)
  - `passphrase` (_string_): The passphrase for the private key or pfx.
  - `cert` (_string_ | _Buffer_): The certificate key of the server in PEM format. (Could be an array of certs). (Required)
  - `ca` (_string[]_ | _Buffer[]_): Trusted certificates in PEM format. If this is omitted several well known "root" CAs will be used, like VeriSign. These are used to authorize connections.
  - `crl` (_string_ | _string[]_: PEM encoded CRLs (Certificate Revocation List)
  - `ciphers` (_string_): A description of the ciphers to use or exclude, separated by `:`. The default cipher suite is:
  - `enableChunkedEncoding` (_boolean_): Controls chunked transfer encoding in response. Some clients (such as Windows 10's MDM enrollment SOAP client) are sensitive to transfer-encoding mode and can't accept chunked response. This option lets users disable chunked transfer encoding for such clients. (**Default:** `true`)
- `services` (_Object_)
- `wsdl` (_string_): An XML string that defines the service.
- `callback` (_Function_): A function to run after the server has been initialized.
- Returns: `Server`

#### Example

```javascript
var myService = {
  MyService: {
    MyPort: {
      MyFunction: function (args) {
        return {
          name: args.name,
        };
      },

      // This is how to define an asynchronous function with a callback.
      MyAsyncFunction: function (args, callback) {
        // do some work
        callback({
          name: args.name,
        });
      },

      // This is how to define an asynchronous function with a Promise.
      MyPromiseFunction: function (args) {
        return new Promise((resolve) => {
          // do some work
          resolve({
            name: args.name,
          });
        });
      },

      // This is how to receive incoming headers
      HeadersAwareFunction: function (args, cb, headers) {
        return {
          name: headers.Token,
        };
      },

      // You can also inspect the original `req`
      reallyDetailedFunction: function (args, cb, headers, req) {
        console.log('SOAP `reallyDetailedFunction` request from ' + req.connection.remoteAddress);
        return {
          name: headers.Token,
        };
      },
    },
  },
};

var xml = require('fs').readFileSync('myservice.wsdl', 'utf8');

//http server example
var server = http.createServer(function (request, response) {
  response.end('404: Not Found: ' + request.url);
});

server.listen(8000);
soap.listen(server, '/wsdl', myService, xml, function () {
  console.log('server initialized');
});

//express server example
var app = express();
//body parser middleware are supported (optional)
app.use(
  bodyParser.raw({
    type: function () {
      return true;
    },
    limit: '5mb',
  }),
);
app.listen(8001, function () {
  //Note: /wsdl route will be handled by soap module
  //and all other routes & middleware will continue to work
  soap.listen(app, '/wsdl', myService, xml, function () {
    console.log('server initialized');
  });
});
```

```javascript
var xml = require('fs').readFileSync('myservice.wsdl', 'utf8');

soap.listen(server, {
  // Server options.
  path: '/wsdl',
  services: myService,
  xml: xml,

  // WSDL options.
  attributesKey: 'theAttrs',
  valueKey: 'theVal',
  xmlKey: 'theXml',
});
```

### Server Logging

If the `log` method is defined, it will be called with:

- `type`: 'received', 'replied', 'info' or 'error'.
- `data`: The data to be logged which will be an XML for 'received' and 'replied' or a message for the other types.
- `req`: The original request object

```javascript
  server = soap.listen(...)
  server.log = function(type, data, req) {
    // type is 'received', 'replied', 'info' or 'error'
  };
```

### Server Events

Server instances emit the following events:

- request - Emitted for every received messages.
  The signature of the callback is `function(request, methodName)`.
- response - Emitted before sending SOAP response.
  The signature of the callback is `function(response, methodName)`.
- headers - Emitted when the SOAP Headers are not empty.
  The signature of the callback is `function(headers, methodName)`.

The sequence order of the calls is `request`, `headers` and then the dedicated
service method.

### Server Response on one-way calls

The so called one-way (or asynchronous) calls occur when an operation is called with no output defined in WSDL.
The server sends a response (defaults to status code 200 with no body) to the client disregarding the result of the operation.

You can configure the response to match the appropriate client expectation to the SOAP standard implementation.
Pass in `oneWay` object in server options. Use the following keys:
`emptyBody`: if true, returns an empty body, otherwise no content at all (default is false)
`responseCode`: default statusCode is 200, override it with this options (for example 202 for SAP standard compliant response)

### SOAP Fault

A service method can reply with a SOAP Fault to a client by `throw`ing an
object with a `Fault` property.

```javascript
throw {
  Fault: {
    Code: {
      Value: 'soap:Sender',
      Subcode: { value: 'rpc:BadArguments' },
    },
    Reason: { Text: 'Processing Error' },
  },
};
```

To change the HTTP statusCode of the response include it on the fault. The statusCode property will not be put on the xml message.

```javascript
throw {
  Fault: {
    Code: {
      Value: 'soap:Sender',
      Subcode: { value: 'rpc:BadArguments' },
    },
    Reason: { Text: 'Processing Error' },
    statusCode: 500,
  },
};
```

### Server security example using PasswordDigest

If `server.authenticate` is not defined then no authentication will take place.

Asynchronous authentication:

```javascript
  server = soap.listen(...)
  server.authenticate = function(security, callback) {
    var created, nonce, password, user, token;
    token = security.UsernameToken, user = token.Username,
            password = token.Password, nonce = token.Nonce, created = token.Created;

    myDatabase.getUser(user, function (err, dbUser) {
      if (err || !dbUser) {
        callback(false);
        return;
      }

      callback(password === soap.passwordDigest(nonce, created, dbUser.password));
    });
  };
```

Synchronous authentication:

```javascript
  server = soap.listen(...)
  server.authenticate = function(security) {
    var created, nonce, password, user, token;
    token = security.UsernameToken, user = token.Username,
            password = token.Password, nonce = token.Nonce, created = token.Created;
    return user === 'user' && password === soap.passwordDigest(nonce, created, 'password');
  };
```

### Server connection authorization

The `server.authorizeConnection` method is called prior to the soap service method.
If the method is defined and returns `false` then the incoming connection is
terminated.

```javascript
  server = soap.listen(...)
  server.authorizeConnection = function(req) {
    return true; // or false
  };
```

## SOAP Headers

### Received SOAP Headers

A service method can look at the SOAP headers by providing a 3rd arguments.

```javascript
  {
      HeadersAwareFunction: function(args, cb, headers) {
          return {
              name: headers.Token
          };
      }
  }
```

It is also possible to subscribe to the 'headers' event.
The event is triggered before the service method is called, and only when the
SOAP Headers are not empty.

```javascript
  server = soap.listen(...)
  server.on('headers', function(headers, methodName) {
    // It is possible to change the value of the headers
    // before they are handed to the service method.
    // It is also possible to throw a SOAP Fault
  });
```

First parameter is the Headers object;
second parameter is the name of the SOAP method that will called
(in case you need to handle the headers differently based on the method).

### Outgoing SOAP Headers

Both client & server can define SOAP headers that will be added to what they send.
They provide the following methods to manage the headers.

#### _addSoapHeader_(soapHeader[, name, namespace, xmlns]) - add soapHeader to soap:Header node

##### Parameters

- `soapHeader` Object({rootName: {name: 'value'}}), strict xml-string,
  or function (server only)

For servers only, `soapHeader` can be a function, which allows headers to be
dynamically generated from information in the request. This function will be
called with the following arguments for each received request:

- `methodName` The name of the request method
- `args` The arguments of the request
- `headers` The headers in the request
- `req` The original request object

The return value of the function must be an Object({rootName: {name: 'value'}})
or strict xml-string, which will be inserted as an outgoing header of the
response to that request.

For example:

```javascript
  server = soap.listen(...);
  server.addSoapHeader(function(methodName, args, headers, req) {
    console.log('Adding headers for method', methodName);
    return {
      MyHeader1: args.SomeValueFromArgs,
      MyHeader2: headers.SomeRequestHeader
    };
    // or you can return "<MyHeader1>SomeValue</MyHeader1>"
  });
```

##### Returns

The index where the header is inserted.

##### Optional parameters when first arg is object :

- `name` Unknown parameter (it could just a empty string)
- `namespace` prefix of xml namespace
- `xmlns` URI

#### _changeSoapHeader_(index, soapHeader[, name, namespace, xmlns]) - change an already existing soapHeader

##### Parameters

- `index` index of the header to replace with provided new value
- `soapHeader` Object({rootName: {name: 'value'}}), strict xml-string
  or function (server only)

See `addSoapHeader` for how to pass a function into `soapHeader`.

#### _getSoapHeaders_() - return all defined headers

#### _clearSoapHeaders_() - remove all defined headers

## Client

An instance of `Client` is passed to the `soap.createClient` callback. It is used to execute methods on the soap service.

### Client.describe() - description of services, ports and methods as a JavaScript object

```javascript
client.describe(); // returns
{
  MyService: {
    MyPort: {
      MyFunction: {
        input: {
          name: 'string';
        }
      }
    }
  }
}
```

### Client.setSecurity(security) - use the specified security protocol

See [Security](#security) for example usage.

### Client._method_(args, callback, options) - call _method_ on the SOAP service.

- `args` (_Object_): Arguments that generate an XML document inside of the SOAP Body section.
- `callback` (_Function_)
- `options` (_Object_): Set options for the request module on WSDL requests. If using the default request module, see [Request Config | Axios Docs](https://axios-http.com/docs/req_config). Additional options supported by `node-soap` are documented below:
  - `forever` (_boolean_): Enables keep-alive connections and pools them
  - `attachments` (_Array_): array of attachment objects. This converts the request into MTOM: _headers['Content-Type']='multipart/related; type="application/xop+xml"; start= ... '_

  ```
  [{
        mimetype: content mimetype,
        contentId: part id,
        name: file name,
        body: binary data
   },
    ...
  ]
  ```

  - `forceMTOM` (_boolean_): Send the request as MTOM even if you don't have attachments.
  - `forceGzip` (_boolean_): Force transfer-encoding in gzip. (**Default:** `false`)

#### Example

```javascript
client.MyFunction({ name: 'value' }, function (err, result, rawResponse, soapHeader, rawRequest) {
  // result is a javascript object
  // rawResponse is the raw xml response string
  // soapHeader is the response soap header as a javascript object
  // rawRequest is the raw xml request string
});
```

### Client.*method*Async(args, options) - call _method_ on the SOAP service.

- `args` (_Object_): Arguments that generate an XML document inside of the SOAP Body section.
- `options` (_Object_): See [Client._method_(args, callback, options) - call _method_ on the SOAP service.](#clientmethodargs-callback-options---call-method-on-the-soap-service) for a description.

#### Example

```javascript
client.MyFunctionAsync({ name: 'value' }).then((result) => {
  // result is a javascript array containing result, rawResponse, soapheader, and rawRequest
  // result is a javascript object
  // rawResponse is the raw xml response string
  // soapHeader is the response soap header as a javascript object
  // rawRequest is the raw xml request string
});
```

##### Example with JSON for the `args`

The example above uses `{name: 'value'}` as the args. This may generate a SOAP messages such as:

```javascript
<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
   <soapenv:Body>
      <Request xmlns="http://www.example.com/v1">
          <name>value</name>
      </Request>
   </soapenv:Body>
</soapenv:Envelope>
```

Note that the "Request" element in the output above comes from the WSDL. If an element in `args` contains no namespace prefix, the default namespace is assumed. Otherwise, you must add the namespace prefixes to the element names as necessary (e.g., `ns1:name`).

Currently, when supplying JSON args, elements may not contain both child elements and a text value, even though that is allowed in the XML specification.

##### Example with XML String for the `args`

You may pass in a fully-formed XML string instead the individual elements in JSON `args` and attributes that make up the XML. The XML string should not contain an XML declaration (e.g., `<?xml version="1.0" encoding="UTF-8"?>`) or a document type declaration (e.g., `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Frameset//EN" "http://www.w3.org/TR/html4/frameset.dtd">`).

```
 var args = { _xml: "<ns1:MyRootElement xmlns:ns1="http://www.example.com/v1/ns1">
                        <ChildElement>elementvalue</ChildElement>
                     </ns1:MyRootElement>"
            };
```

You must specify all of the namespaces and namespace prefixes yourself. The element(s) from the WSDL are not utilized as they were in the "Example with JSON as the `args`" example above, which automatically populated the "Request" element.

### Client._service_._port_._method_(args, callback[, options[, extraHeaders]]) - call a _method_ using a specific _service_ and _port_

- `args` (_Object_): Arguments that generate an XML document inside of the SOAP Body section.
- `callback` (_Function_)
- `options` (_Object_): See [Client._method_(args, callback, options) - call _method_ on the SOAP service.](#clientmethodargs-callback-options---call-method-on-the-soap-service) for a description.
- `extraHeaders` (_Object_): Sets HTTP headers for the WSDL request.

#### Example

```javascript
client.MyService.MyPort.MyFunction({ name: 'value' }, function (err, result) {
  // result is a javascript object
});
```

#### Options (optional)

- Accepts any option that the request module accepts, see [here.](https://github.com/mikeal/request)
- For example, you could set a timeout of 5 seconds on the request like this:

```javascript
client.MyService.MyPort.MyFunction(
  { name: 'value' },
  function (err, result) {
    // result is a javascript object
  },
  { timeout: 5000 },
);
```

- You can measure the elapsed time on the request by passing the time option:

```javascript
client.MyService.MyPort.MyFunction(
  { name: 'value' },
  function (err, result) {
    // client.lastElapsedTime - the elapsed time of the last request in milliseconds
  },
  { time: true },
);
```

- Also, you could pass your soap request through a debugging proxy such as [Fiddler](http://www.telerik.com/fiddler) or [Betwixt](https://github.com/kdzwinel/betwixt).

```javascript
client.MyService.MyPort.MyFunction(
  { name: 'value' },
  function (err, result) {
    // client.lastElapsedTime - the elapsed time of the last request in milliseconds
  },
  {
    proxy: {
      protocol: 'https',
      host: '127.0.0.1',
      port: 9000,
      auth: {
        username: 'mikeymike',
        password: 'rapunz3l',
      },
    },
  },
);
```

- You can modify xml (string) before call:

```javascript
client.MyService.MyPort.MyFunction(
  { name: 'value' },
  function (err, result) {
    // client.lastElapsedTime - the elapsed time of the last request in milliseconds
  },
  {
    postProcess: function (_xml) {
      return _xml.replace('text', 'newtext');
    },
  },
);
```

#### Extra Headers (optional)

Object properties define extra HTTP headers to be sent on the request.

- Add custom User-Agent:

```javascript
client.addHttpHeader('User-Agent', `CustomUserAgent`);
```

#### Alternative method call using callback-last pattern

To align method call signature with node' standard callback-last patter and event allow promisification of method calls, the following method signatures are also supported:

```javascript
client.MyService.MyPort.MyFunction({ name: 'value' }, options, function (err, result) {
  // result is a javascript object
});

client.MyService.MyPort.MyFunction({ name: 'value' }, options, extraHeaders, function (err, result) {
  // result is a javascript object
});
```

### Overriding the namespace prefix

`node-soap` is still working out some kinks regarding namespaces. If you find that an element is given the wrong namespace prefix in the request body, you can add the prefix to it's name in the containing object. I.E.:

```javascript
client.MyService.MyPort.MyFunction(
  { 'ns1:name': 'value' },
  function (err, result) {
    // request body sent with `<ns1:name`, regardless of what the namespace should have been.
  },
  { timeout: 5000 },
);
```

- Remove namespace prefix of param

```javascript
client.MyService.MyPort.MyFunction(
  { ':name': 'value' },
  function (err, result) {
    // request body sent with `<name`, regardless of what the namespace should have been.
  },
  { timeout: 5000 },
);
```

### Client._lastRequest_ - the property that contains last full soap request for client logging

### Client.setEndpoint(url) - overwrite the SOAP service endpoint address

### Client Events

Client instances emit the following events:

### _request_

Emitted before a request is sent. The event handler has the signature `(xml, eid)`.

- _xml_ - The entire Soap request (Envelope) including headers.
- _eid_ - The exchange id.

### _message_

Emitted before a request is sent, but only the body is passed to the event handler. Useful if you don't want to log /store Soap headers. The event handler has the signature `(message, eid)`.

- _message_ - Soap body contents.
- _eid_ - The exchange id.

### _soapError_

Emitted when an erroneous response is received. Useful if you want to globally log errors. The event handler has the signature `(error, eid)`.

- _error_ - An error object which also contains the resoponse.
- _eid_ - The exchange id.

### _response_

Emitted after a response is received. This is emitted for all responses (both success and errors). The event handler has the signature `(body, response, eid)`

- _body_ - The SOAP response body.
- _response_ - The entire `IncomingMessage` response object.
- _eid_ - The exchange id.

An 'exchange' is a request/response couple.
Event handlers receive the exchange id in all events.
The exchange id is the same for the requests events and the responses events, this way you can use it to retrieve the matching request
when an response event is received.

By default exchange ids are generated by using node-uuid but you can use options in client calls to pass your own exchange id.

Example :

```javascript
client.MyService.MyPort.MyFunction(args, function (err, result) {}, { exchangeId: myExchangeId });
```

## WSDL

A WSDL instance can also be instantiated directly when you want to (un)marshal
messages without doing SOAP calls. This can be used when a WSDL does not contain
bindings for services (e.g. some Windows Communication Foundation SOAP web
services).

## WSDL.constructor(wsdl, baseURL, options):

Construct a WSDL instance from either the WSDL content or the URL to the WSDL.

#### Parameters

- wsdl: a WSDL string or an URL to the WSDL
- baseURL: base URL for the SOAP API
- options: options (see source for details), use `{}` as default.

### wsdl.xmlToObject(xml):

Unmarshal XML to object.

#### Parameters:

- xml: SOAP response (XML) to unmarshal

#### Returns:

Object containing the object types from the xml as keys.

### wsdl.objectToXML(object, typeName, namespacePrefix, namespaceURI, ...):

Marshal an object to XML

#### Parameters:

- object: Object to marshal
- typeName: type (as per the wsdl) of the object
- namespacePrefix: namespace prefix
- namespaceURI: URI of the namespace

#### Returns:

XML representation of object.

#### Example:

```typescript
// Abstracted from a real use case
import { AxiosInstance } from 'axios';
import { WSDL } from 'soap';
import { IProspectType } from './types';

// A WSDL in a string.
const WSDL_CONTENT = "...";

const httpClient: AxiosInstance = /* ... instantiate ... */;
const baseURL = 'http://example.org/SoapService.svc';

const wsdl = new WSDL(WSDL_CONTENT, baseURL, {});

async function sampleGetCall(): IProspectType | undefined {
    const res = await httpClient.get(`${baseURL}/GetProspect`);

    const object = wsdl.xmlToObject(res.data);

    if (!object.ProspectType) {
      // Response did not contain the expected type
      return undefined;
    }
    // Optionally, unwrap and set defaults for some fields
    // Ensure that the object meets the expected prototype
    // Finally cast and return the result.
    return object.ProspectType as IProspectType;
}

async function samplePostCall(prospect: IProspectType) {
  // objectToXML(object, typeName, namespacePrefix, namespaceURI, ...)
  const objectBody = wsdl.objectToXML(obj, 'ProspectType', '', '');
  const data = `<?xml version="1.0" ?>${body}`;

  const res = await httpClient.post(`${baseURL}/ProcessProspect`, data);
  // Optionally, deserialize request and return response status.
}
```

## Security

`node-soap` has several default security protocols. You can easily add your own
as well. The interface is quite simple. Each protocol defines these optional methods:

- `addOptions(options)` - a method that accepts an options arg that is eventually passed directly to `request`.
- `addHeaders(headers)` - a method that accepts an argument with HTTP headers, to add new ones.
- `toXML()` - a method that returns a string of XML to be appended to the SOAP headers. Not executed if `postProcess` is also defined.
- `postProcess(xml, envelopeKey)` - a method that receives the the assembled request XML plus envelope key, and returns a processed string of XML. Executed before `options.postProcess`.

### BasicAuthSecurity

```javascript
client.setSecurity(new soap.BasicAuthSecurity('username', 'password'));
```

### BearerSecurity

```javascript
client.setSecurity(new soap.BearerSecurity('token'));
```

### ClientSSLSecurity

_Note_: If you run into issues using this protocol, consider passing these options
as default request options to the constructor:

- `rejectUnauthorized: false`
- `strictSSL: false`
- `secureOptions: constants.SSL_OP_NO_TLSv1_2` (this is likely needed for node >= 10.0)

If you want to reuse tls sessions, you can use the option `forever: true`.

```javascript
client.setSecurity(
  new soap.ClientSSLSecurity(
    '/path/to/key',
    'path/to/cert',
    '/path/to/ca-cert' /*or an array of buffer: [fs.readFileSync('/path/to/ca-cert/1', 'utf8'),
                'fs.readFileSync('/path/to/ca-cert/2', 'utf8')], */,
    {
      /*default request options like */
      // strictSSL: true,
      // rejectUnauthorized: false,
      // hostname: 'some-hostname'
      // secureOptions: constants.SSL_OP_NO_TLSv1_2,
      // forever: true,
    },
  ),
);
```

### ClientSSLSecurityPFX

_Note_: If you run into issues using this protocol, consider passing these options
as default request options to the constructor:

- `rejectUnauthorized: false`
- `strictSSL: false`
- `secureOptions: constants.SSL_OP_NO_TLSv1_2` (this is likely needed for node >= 10.0)

If you want to reuse tls sessions, you can use the option `forever: true`.

```javascript
client.setSecurity(
  new soap.ClientSSLSecurityPFX(
    '/path/to/pfx/cert', // or a buffer: [fs.readFileSync('/path/to/pfx/cert', 'utf8'),
    'path/to/optional/passphrase',
    {
      /*default request options like */
      // strictSSL: true,
      // rejectUnauthorized: false,
      // hostname: 'some-hostname'
      // secureOptions: constants.SSL_OP_NO_TLSv1_2,
      // forever: true,
    },
  ),
);
```

### WSSecurity

`WSSecurity` implements WS-Security. UsernameToken and PasswordText/PasswordDigest is supported.

```javascript
var options = {
  hasNonce: true,
  actor: 'actor',
};
var wsSecurity = new soap.WSSecurity('username', 'password', options);
client.setSecurity(wsSecurity);
```

the `options` object is optional and can contain the following properties:

- `passwordType`: 'PasswordDigest' or 'PasswordText' (default: `'PasswordText'`)
- `hasTimeStamp`: adds Timestamp element (default: `true`)
- `hasTokenCreated`: adds Created element (default: `true`)
- `hasNonce`: adds Nonce element (default: `false`)
- `mustUnderstand`: adds mustUnderstand=1 attribute to security tag (default: `false`)
- `actor`: if set, adds Actor attribute with given value to security tag (default: `''`)
- `appendElement`: A string containing XML element to append to the end of the WSSecurity element. This can be used to add custom elements like certificates or other security tokens (default: `''`)

### WSSecurityCert

WS-Security X509 Certificate support.

```javascript
var privateKey = fs.readFileSync(privateKeyPath);
var publicKey = fs.readFileSync(publicKeyPath);
var password = ''; // optional password
var options = {
  hasTimeStamp: true,
  additionalReferences: ['wsa:Action', 'wsa:ReplyTo', 'wsa:To'],
  signerOptions: {
    prefix: 'ds',
    attrs: { Id: 'Signature' },
    existingPrefixes: {
      wsse: 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd',
    },
  },
};
var wsSecurity = new soap.WSSecurityCert(privateKey, publicKey, password, options);
client.setSecurity(wsSecurity);
```

The `options` object is optional and can contain the following properties:

- `hasTimeStamp`: Includes Timestamp tags (default: `true`)
- `signatureTransformations`: sets the Reference Transforms Algorithm (default ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/2001/10/xml-exc-c14n#']). Type is a string array
- `signatureAlgorithm`: set to `http://www.w3.org/2001/04/xmldsig-more#rsa-sha256` to use sha256
- `digestAlgorithm`: set to `http://www.w3.org/2000/09/xmldsig#sha1` to use sha1 (default `http://www.w3.org/2001/04/xmlenc#sha256`)
- `additionalReferences` : (optional) Array of Soap headers that need to be signed. This need to be added using `client.addSoapHeader('header')`
- `excludeReferencesFromSigning`: (Optional) An array of SOAP element names to exclude from signing (e.g., `Body`, `Timestamp`, `To`, `Action`).
- `signerOptions`: (optional) passes options to the XML Signer package - from (https://github.com/yaronn/xml-crypto)
  - `existingPrefixes`: (optional) A hash of prefixes and namespaces prefix: namespace that shouldn't be in the signature because they already exist in the xml (default: `{ 'wsse': 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd' }`)
  - `prefix`: (optional) Adds this value as a prefix for the generated signature tags.
  - `attrs`: (optional) A hash of attributes and values attrName: value to add to the signature root node
  - `idMode`: (optional) either 'wssecurity' to generate wsse-scoped reference Id on <Body> or undefined for an unscoped reference Id
- `appendElement`: (optional) A string containing XML element to append to the end of the WSSecurity element. This can be used to add custom elements like certificates or other security tokens.

### WSSecurityPlusCert

Use WSSecurity and WSSecurityCert together.

```javascript
var wsSecurity = new soap.WSSecurity(/* see WSSecurity above */);
var wsSecurityCert = new soap.WSSecurityCert(/* see WSSecurityCert above */);
var wsSecurityPlusCert = new soap.WSSecurityPlusCert(wsSecurity, wsSecurityCert);
client.setSecurity(wsSecurityPlusCert);
```

#### Option examples

`hasTimeStamp:true`

```xml
<soap:Header>
    <wsse:Security soap:mustUnderstand="1">
        <wsse:BinarySecurityToken>XXX</wsse:BinarySecurityToken>
        <!-- The Timestamp group of tags are added and signed -->
        <Timestamp xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" Id="Timestamp">
            <Created>2019-10-01T08:17:50Z</Created>
            <Expires>2019-10-01T08:27:50Z</Expires>
        </Timestamp>
        <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
            <SignedInfo>
                ...
                <Reference URI="#Timestamp">
                    <Transforms>
                        <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
                        <Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
                    </Transforms>
                    <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
                    <DigestValue>XyZ=</DigestValue>
                </Reference>
            </SignedInfo>
        </Signature>
    </wsse:Security>
</soap:Header>
```

`additionalReferences: ['To']`

```XML
<soap:Header>
    <To Id="To">localhost.com</To>
    <wsse:Security soap:mustUnderstand="1">
        <wsse:BinarySecurityToken>XXX</wsse:BinarySecurityToken>
        <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
            <SignedInfo>
                <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
                <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
                <!-- The "To" tag is signed and added as a reference -->
                <Reference URI="#To">
                    <Transforms>
                        <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
                        <Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
                    </Transforms>
                    <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
                    <DigestValue>XYZ</DigestValue>
                </Reference>
            </SignedInfo>
            <SignatureValue>
                Rf6M4F4puQuQHJIPtJz1CZIVvF3qOdpEEcuAiooWkX5ecnAHSf3RW3sOIzFUWW7VOOncJcts/3xr8DuN4+8Wm9hx1MoOcWJ6kyRIdVNbQWLseIcAhxYCntRY57T2TBXzpb0UPA56pry1+TEcnIQXhdIzG5YT+tTVTp+SZHHcnlP5Y+yqnIOH9wzgRvAovbydTYPCODF7Ana9K/7CSGDe7vpVT85CUYUcJE4DfTxaRa9gKkKrBdPN9vFVi0WfxtMF4kv23cZRCZzS5+CoLfPlx3mq65gVXsqH01RLbktNJq9VaQKcZUgapmUCMzrYhqyzUQJ8HrSHqe+ya2GsjlB0VQ==
            </SignatureValue>
            <KeyInfo>
                <wsse:SecurityTokenReference
                        xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
                    <wsse:Reference URI="#x509-c5c0d213676f4a6ba5e6fa58074eb57a"
                                    ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"/>
                </wsse:SecurityTokenReference>
            </KeyInfo>
        </Signature>
    </wsse:Security>
</soap:Header>
```

`signerOptions.prefix:'ds'`

```XML
<soap:Header>
    <To Id="To">localhost.com</To>
    <wsse:Security soap:mustUnderstand="1">
        <wsse:BinarySecurityToken>XXX</wsse:BinarySecurityToken>
        <!-- Signature and children tags are given the prefix defined. -->
        <ds:Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
            <ds:SignedInfo>
                <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
                <ds:SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
                <ds:Reference URI="#To">
                    <ds:Transforms>
                        <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
                        <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
                    </ds:Transforms>
                    <ds:DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
                    <ds:DigestValue>XYZ</DigestValue>
                </ds:Reference>
            </ds:SignedInfo>
            <ds:SignatureValue>
                Rf6M4F4puQuQHJIPtJz1CZIVvF3qOdpEEcuAiooWkX5ecnAHSf3RW3sOIzFUWW7VOOncJcts/3xr8DuN4+8Wm9hx1MoOcWJ6kyRIdVNbQWLseIcAhxYCntRY57T2TBXzpb0UPA56pry1+TEcnIQXhdIzG5YT+tTVTp+SZHHcnlP5Y+yqnIOH9wzgRvAovbydTYPCODF7Ana9K/7CSGDe7vpVT85CUYUcJE4DfTxaRa9gKkKrBdPN9vFVi0WfxtMF4kv23cZRCZzS5+CoLfPlx3mq65gVXsqH01RLbktNJq9VaQKcZUgapmUCMzrYhqyzUQJ8HrSHqe+ya2GsjlB0VQ==
            </ds:SignatureValue>
            <ds:KeyInfo>
                <wsse:SecurityTokenReference
                        xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
                    <wsse:Reference URI="#x509-c5c0d213676f4a6ba5e6fa58074eb57a"
                                    ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"/>
                </wsse:SecurityTokenReference>
            </ds:KeyInfo>
        </ds:Signature>
    </wsse:Security>
</soap:Header>
```

`signerOptions.attrs:{ Id: 'signature-100', foo:'bar'}`

```xml
<soap:Header>
    <wsse:Security soap:mustUnderstand="1">
        <wsse:BinarySecurityToken>XXX</wsse:BinarySecurityToken>
        <!-- The Timestamp group of tags are added and signed -->
        <Timestamp xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" Id="Timestamp">
            <Created>2019-10-01T08:17:50Z</Created>
            <Expires>2019-10-01T08:27:50Z</Expires>
        </Timestamp>
        <Signature Id="signature-100" foo="bar" xmlns="http://www.w3.org/2000/09/xmldsig#">
            <SignedInfo>
                ...
                <Reference URI="#Timestamp">
                    <Transforms>
                        <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
                        <Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
                    </Transforms>
                    <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
                    <DigestValue>XyZ=</DigestValue>
                </Reference>
            </SignedInfo>
        </Signature>
    </wsse:Security>
</soap:Header>
```

`appendElement: '<custom:Element>test</custom:Element>'`

```xml
<soap:Header>
    <wsse:Security soap:mustUnderstand="1">
        <wsse:BinarySecurityToken>XXX</wsse:BinarySecurityToken>
        <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
            <SignedInfo>
                ...
            </SignedInfo>
        </Signature>
        <!-- Custom element is appended to the end of the security block -->
        <custom:MyCustomElement xmlns:custom="http://example.com/custom">
          foo
        </custom:MyCustomElement>
    </wsse:Security>
</soap:Header>
```

### WSSecurityCertWithToken

WS-Security X509 Certificate support. Just like WSSecurityCert, except that it accepts the input properties as a single object, with two properties added `username` and `password`. Which if added, will add a UsernameToken Element to the xml security element.

```xml
<wsse:UsernameToken>
  <wsse:Username>someusername</wsse:Username>
  <wsse:Password>someusername's password</wsse:Password>
</wsse:UsernameToken>
```

### NTLMSecurity

Parameter invocation:

```javascript
client.setSecurity(new soap.NTLMSecurity('username', 'password', 'domain', 'workstation'));
```

This can also be set up with a JSON object, substituting values as appropriate, for example:

```javascript
var loginData = { username: 'username', password: 'password', domain: 'domain', workstation: 'workstation' };
client.setSecurity(new soap.NTLMSecurity(loginData));
```

## Handling XML Attributes, Value and XML (wsdlOptions).

Sometimes it is necessary to override the default behaviour of `node-soap` in order to deal with the special requirements
of your code base or a third library you use. Therefore you can use the `wsdlOptions` Object, which is passed in the
`#createClient()` method and could have any (or all) of the following contents:

```javascript
var wsdlOptions = {
  attributesKey: 'theAttrs',
  valueKey: 'theVal',
  xmlKey: 'theXml',
};
```

If nothing (or an empty Object `{}`) is passed to the `#createClient()` method, the `node-soap` defaults (`attributesKey: 'attributes'`, `valueKey: '$value'` and `xmlKey: '$xml'`) are used.

### Overriding the `value` key

By default, `node-soap` uses `$value` as the key for any parsed XML value which may interfere with your other code as it
could be some reserved word, or the `$` in general cannot be used for a key to start with.

You can define your own `valueKey` by passing it in the `wsdl_options` to the createClient call:

```javascript
var wsdlOptions = {
  valueKey: 'theVal',
};

soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', wsdlOptions, function (err, client) {
  // your code
});
```

### Overriding the `xml` key

By default, `node-soap` uses `$xml` as the key to pass through an XML string as is; without parsing or namespacing it. It overrides all the other content that the node might have otherwise had.

For example :

```javascript
{
  dom: {
    nodeone: {
      $xml: '<parentnode type="type"><childnode></childnode></parentnode>',
      siblingnode: 'Cant see me.'
    },
    nodetwo: {
      parentnode: {
        attributes: {
          type: 'type'
        },
        childnode: ''
      }
    }
  }
};
```

could become

```xml
<tns:dom>
  <tns:nodeone>
    <parentnode type="type">
      <childnode></childnode>
    </parentnode>
  </tns:nodeone>
  <tns:nodetwo>
    <tns:parentnode type="type">
      <tns:childnode></tns:childnode>
    </tns:parent>
  </tns:nodetwo>
</tns:dom>
```

You can define your own `xmlKey` by passing it in the `wsdl_options` object to the createClient call:

```javascript
var wsdlOptions = {
  xmlKey: 'theXml',
};

soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', wsdlOptions, function (err, client) {
  // your code
});
```

### Overriding the `attributes` key

By default, `node-soap` uses `attributes` as the key to define a nodes attributes.

```javascript
{
  parentnode: {
    childnode: {
      attributes: {
        name: 'childsname'
      },
      $value: 'Value'
    }
  }
}
```

could become

```xml
<parentnode>
  <childnode name="childsname">Value</childnode>
</parentnode>
```

However, `attributes` may be a reserved key for some systems that actually want a node called `attributes`

```xml
<attributes>
</attributes>
```

You can define your own `attributesKey` by passing it in the `wsdl_options` object to the createClient call:

```javascript
var wsdlOptions = {
  attributesKey: '$attributes',
};

soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', wsdlOptions, function (err, client) {
  client.method({
    parentnode: {
      childnode: {
        $attributes: {
          name: 'childsname',
        },
        $value: 'Value',
      },
    },
  });
});
```

### Overriding imports relative paths

By default, WSDL and schema files import other schemas and types using relative paths.

However in some systems (i.e. NetSuite) when the wsdl is downloaded for offline caching, all files are flattened under a single directory and all the imports fail.
Passing this option allows `node-soap` to correctly load all files.

```javascript
var options ={
    wsdl_options = { fixedPath: true }
};
soap.createClient(__dirname+'/wsdl/fixedPath/netsuite.wsdl', options, function(err, client) {
    // your code
});
```

### Overriding import locations

You can override the URIs or paths of imports in the WSDL by specifying a `overrideImportLocation` function in the WSDL options.

```javascript
const options ={
    wsdl_options = {
        overrideImportLocation: (location) => {
          return 'https://127.0.0.1/imported-service.wsdl';
        }
    }
};
soap.createClient('https://127.0.0.1/service.wsdl', options, function(err, client) {
    // your code
});
```

### Specifying the exact namespace definition of the root element

In rare cases, you may want to precisely control the namespace definition that is included in the root element.

You can specify the namespace definitions by setting the `overrideRootElement` key in the `wsdlOptions` like so:

```javascript
var wsdlOptions = {
  overrideRootElement: {
    namespace: 'xmlns:tns',
    xmlnsAttributes: [
      {
        name: 'xmlns:ns2',
        value: 'http://tempuri.org/',
      },
      {
        name: 'xmlns:ns3',
        value: 'http://sillypets.com/xsd',
      },
    ],
  },
};
```

To see it in practice, have a look at the sample files in: [test/request-response-samples/addPets\_\_force_namespaces](https://github.com/vpulim/node-soap/tree/master/test/request-response-samples/addPets__force_namespaces)

### Overriding element key specification in XML

In very rare cases ([external implementation isn't matching exactly the WSDL spec?](https://github.com/vpulim/node-soap/pull/1189)),
you may want to override element XML keys in requests and/or responses.

You can specify the key definitions by setting the `overrideElementKey` key in the `wsdlOptions` like so:

```javascript
var wsdlOptions = {
  overrideElementKey: {
    Nom: 'Name',
    Commande: 'Order',
    SillyResponse: 'DummyResponse'
  };
};
```

Test sample files covering this are in [test/request-response-samples/Dummy\_\_ref_element_should_have_correct_namespace_with_overrideElementKey](https://github.com/vpulim/node-soap/tree/master/test/request-response-samples/Dummy__ref_element_should_have_correct_namespace_with_overrideElementKey)

### Custom Deserializer

Sometimes it's useful to handle deserialization in your code instead of letting node-soap do it.
For example if the soap response contains dates that are not in a format recognized by javascript, you might want to use your own function to handle them.

To do so, you can pass a `customDeserializer` object in `options`. The properties of this object are the types that your deserializer handles itself.

Example :

```javascript

   var wsdlOptions = {
     customDeserializer: {

       // this function will be used to any date found in soap responses
       date: function (text, context) {
         /* text is the value of the xml element.
           context contains the name of the xml element and other infos :
             {
                 name: 'lastUpdatedDate',
                 object: {},
                 schema: 'xsd:date',
                 id: undefined,
                 nil: false
             }

          */
         return text;
       }
     }
   };

   soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', wsdlOptions, function (err, client) {
     ...
   });

```

### Changing the tag formats to use self-closing (empty element) tags

The XML specification specifies that there is no semantic difference between `<Tag></Tag>` and `<Tag />`, and node-soap defaults to using the `<Tag></Tag>` format. But if your web service is particular, or if there is a stylistic preference, the `useEmptyTag` option causes tags with no contents to use the `<Tag />` format instead.

```javascript
var wsdlOptions = {
  useEmptyTag: true,
};
```

For example: `{ MyTag: { attributes: { MyAttr: 'value' } } }` is:

- **Without useEmptyTag**: `<MyTag MyAttr="value"></MyTag>`
- **With useEmptyTag set to true**: `<MyTag MyAttr="value" />`

## Handling "ignored" namespaces

If an Element in a `schema` definition depends on an Element which is present in the same namespace, normally the `tns:`
namespace prefix is used to identify this Element. This is not much of a problem as long as you have just one `schema` defined
(inline or in a separate file). If there are more `schema` files, the `tns:` in the generated `soap` file resolved mostly to the parent `wsdl` file,
which was obviously wrong.

`node-soap` now handles namespace prefixes which shouldn't be resolved (because it's not necessary) as so called `ignoredNamespaces`
which default to an Array of 3 Strings (`['tns', 'targetNamespace', 'typedNamespace']`).

If this is not sufficient for your purpose you can easily add more namespace prefixes to this Array, or override it in its entirety
by passing an `ignoredNamespaces` object within the `options` you pass in `soap.createClient()` method.

A simple `ignoredNamespaces` object, which only adds certain namespaces could look like this:

```
var options = {
  ignoredNamespaces: {
    namespaces: ['namespaceToIgnore', 'someOtherNamespace']
  }
}
```

This would extend the `ignoredNamespaces` of the `WSDL` processor to `['tns', 'targetNamespace', 'typedNamespace', 'namespaceToIgnore', 'someOtherNamespace']`.

If you want to override the default ignored namespaces you would simply pass the following `ignoredNamespaces` object within the `options`:

```
var options = {
    ignoredNamespaces: {
      namespaces: ['namespaceToIgnore', 'someOtherNamespace'],
      override: true
    }
  }
```

This would override the default `ignoredNamespaces` of the `WSDL` processor to `['namespaceToIgnore', 'someOtherNamespace']`. (This shouldn't be necessary, anyways).

## Handling "ignoreBaseNameSpaces" attribute

If an Element in a `schema` definition depends has a basenamespace defined but the request does not need that value, for example you have a "sentJob" with basenamespace "v20"
but the request need only: <sendJob> set in the tree structure, you need to set the ignoreBaseNameSpaces to true. This is set because in a lot of workaround the wsdl structure is not correctly
set or the webservice bring errors.

By default the attribute is set to true.
An example to use:

A simple `ignoredNamespaces` object, which only adds certain namespaces could look like this:

```
var options = {
ignoredNamespaces: true
}
```

## Contributors

- Author: [Vinay Pulim](https://github.com/vpulim)
- Active maintainers:
  - [Vasily Martynov](https://github.com/w666)
- Previous maintainers (not active for a long time):
  - [Joe Spencer](https://github.com/jsdevel)
  - [Heinz Romirer](https://github.com/herom)
- [All Contributors](https://github.com/vpulim/node-soap/graphs/contributors)

[downloads-image]: http://img.shields.io/npm/dm/soap.svg
[npm-url]: https://npmjs.org/package/soap
[npm-image]: http://img.shields.io/npm/v/soap.svg
[coveralls-url]: https://coveralls.io/r/vpulim/node-soap
[coveralls-image]: http://img.shields.io/coveralls/vpulim/node-soap/master.svg
[buy-me-a-coffee-url]: https://coff.ee/vasily.m
[buy-me-a-coffee-image]: https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png
