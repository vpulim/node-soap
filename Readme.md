# Soap [![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Coveralls Status][coveralls-image]][coveralls-url] [![Gitter chat][gitter-image]][gitter-url]

> A SOAP client and server for node.js.

This module lets you connect to web services using SOAP.  It also provides a server that allows you to run your own SOAP services.

<!-- Run `npm run toc` to update below section -->
<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Features:](#features)
- [Install](#install)
- [Why can't I file an issue?](#why-cant-i-file-an-issue)
- [Where can I find help?](#where-can-i-find-help)
- [Module](#module)
  - [soap.createClient(url[, options], callback) - create a new SOAP client from a WSDL url. Also supports a local filesystem path.](#soapcreateclienturl-options-callback---create-a-new-soap-client-from-a-wsdl-url-also-supports-a-local-filesystem-path)
  - [soap.createClientAsync(url[, options]) - create a new SOAP client from a WSDL url. Also supports a local filesystem path.](#soapcreateclientasyncurl-options---create-a-new-soap-client-from-a-wsdl-url-also-supports-a-local-filesystem-path)
  - [soap.listen(*server*, *path*, *services*, *wsdl*) - create a new SOAP server that listens on *path* and provides *services*.](#soaplistenserver-path-services-wsdl---create-a-new-soap-server-that-listens-on-path-and-provides-services)
  - [Options](#options)
  - [Server Logging](#server-logging)
  - [Server Events](#server-events)
  - [SOAP Fault](#soap-fault)
  - [Server security example using PasswordDigest](#server-security-example-using-passworddigest)
  - [Server connection authorization](#server-connection-authorization)
- [SOAP Headers](#soap-headers)
  - [Received SOAP Headers](#received-soap-headers)
  - [Outgoing SOAP Headers](#outgoing-soap-headers)
- [Client](#client)
  - [Client.describe() - description of services, ports and methods as a JavaScript object](#clientdescribe---description-of-services-ports-and-methods-as-a-javascript-object)
  - [Client.setSecurity(security) - use the specified security protocol](#clientsetsecuritysecurity---use-the-specified-security-protocol)
  - [Client.*method*(args, callback) - call *method* on the SOAP service.](#clientmethodargs-callback---call-method-on-the-soap-service)
  - [Client.*method*Async(args) - call *method* on the SOAP service.](#clientmethodasyncargs---call-method-on-the-soap-service)
  - [Client.*service*.*port*.*method*(args, callback[, options[, extraHeaders]]) - call a *method* using a specific *service* and *port*](#clientserviceportmethodargs-callback-options-extraheaders---call-a-method-using-a-specific-service-and-port)
  - [Overriding the namespace prefix](#overriding-the-namespace-prefix)
  - [Client.*lastRequest* - the property that contains last full soap request for client logging](#clientlastrequest---the-property-that-contains-last-full-soap-request-for-client-logging)
  - [Client.setEndpoint(url) - overwrite the SOAP service endpoint address](#clientsetendpointurl---overwrite-the-soap-service-endpoint-address)
  - [Client Events](#client-events)
- [Security](#security)
  - [BasicAuthSecurity](#basicauthsecurity)
  - [BearerSecurity](#bearersecurity)
  - [ClientSSLSecurity](#clientsslsecurity)
  - [WSSecurity](#wssecurity)
  - [WSSecurityCert](#wssecuritycert)
- [Handling XML Attributes, Value and XML (wsdlOptions).](#handling-xml-attributes-value-and-xml-wsdloptions)
  - [Overriding the `value` key](#overriding-the-value-key)
  - [Overriding the `xml` key](#overriding-the-xml-key)
  - [Overriding the `attributes` key](#overriding-the-attributes-key)
  - [Specifying the exact namespace definition of the root element](#specifying-the-exact-namespace-definition-of-the-root-element)
  - [Custom Deserializer](#custom-deserializer)
- [Handling "ignored" namespaces](#handling-ignored-namespaces)
- [Handling "ignoreBaseNameSpaces" attribute](#handling-ignorebasenamespaces-attribute)
- [soap-stub](#soap-stub)
  - [Example](#example)
- [Contributors](#contributors)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Features:

* Very simple API
* Handles both RPC and Document schema types
* Supports multiRef SOAP messages (thanks to [@kaven276](https://github.com/kaven276))
* Support for both synchronous and asynchronous method handlers
* WS-Security (currently only UsernameToken and PasswordText encoding is supported)
* Supports [express](http://expressjs.com/) based web server(body parser middleware can be used)

## Install

Install with [npm](http://github.com/isaacs/npm):

```
  npm install soap
```

## Why can't I file an issue?

We've disabled issues in the repository and are now solely reviewing pull requests.  The reasons why we disabled issues can be found here [#731](https://github.com/vpulim/node-soap/pull/731).

## Where can I find help?

Community support can be found on gitter:

[![Gitter chat][gitter-image]][gitter-url]

If you're looking for professional help you can contact the maintainers through this [google form](https://docs.google.com/forms/d/e/1FAIpQLSdj5EXxd5flcukLInmpFQhEvQYeERaReFFh9F0nqC_4EUmeLg/viewform).

## Module

### soap.createClient(url[, options], callback) - create a new SOAP client from a WSDL url. Also supports a local filesystem path.

``` javascript
  var soap = require('soap');
  var url = 'http://example.com/wsdl?wsdl';
  var args = {name: 'value'};
  soap.createClient(url, function(err, client) {
      client.MyFunction(args, function(err, result) {
          console.log(result);
      });
  });
```
This client has a built in WSDL cache. You can use the `disableCache` option to disable it.

### soap.createClientAsync(url[, options]) - create a new SOAP client from a WSDL url. Also supports a local filesystem path.

``` javascript
  var soap = require('soap');
  var url = 'http://example.com/wsdl?wsdl';
  var args = {name: 'value'};
  soap.createClientAsync(url).then((client) => {
    return client.MyFunctionAsync(args);
  }).then((result) => {
    console.log(result);
  });
```

This client has a built in WSDL cache. You can use the `disableCache` option to disable it.

#### Options

The `options` argument allows you to customize the client with the following properties:

- endpoint: to override the SOAP service's host specified in the `.wsdl` file.
- envelopeKey: to set specific key instead of `<pre><<b>soap</b>:Body></<b>soap</b>:Body></pre>`.
- escapeXML: escape special XML characters in SOAP message (e.g. `&`, `>`, `<` etc), default: `true`.
- suppressStack: suppress the full stack trace for error messages.
- returnFault: return an `Invalid XML` SOAP fault on a bad request, default: `false`.
- forceSoap12Headers: to set proper headers for SOAP v1.2.
- httpClient: to provide your own http client that implements `request(rurl, data, callback, exheaders, exoptions)`.
- request: to override the [request](https://github.com/request/request) module.
- wsdl_headers: custom HTTP headers to be sent on WSDL requests.
- wsdl_options: custom options for the request module on WSDL requests.
- disableCache: don't cache WSDL files, request them every time.

Note: for versions of node >0.10.X, you may need to specify `{connection: 'keep-alive'}` in SOAP headers to avoid truncation of longer chunked responses.

### soap.listen(*server*, *path*, *services*, *wsdl*) - create a new SOAP server that listens on *path* and provides *services*.
*server* can be a [http](https://nodejs.org/api/http.html) Server or [express](http://expressjs.com/) framework based server
*wsdl* is an xml string that defines the service.

``` javascript
  var myService = {
      MyService: {
          MyPort: {
              MyFunction: function(args) {
                  return {
                      name: args.name
                  };
              },

              // This is how to define an asynchronous function.
              MyAsyncFunction: function(args, callback) {
                  // do some work
                  callback({
                      name: args.name
                  });
              },

              // This is how to receive incoming headers
              HeadersAwareFunction: function(args, cb, headers) {
                  return {
                      name: headers.Token
                  };
              },

              // You can also inspect the original `req`
              reallyDetailedFunction: function(args, cb, headers, req) {
                  console.log('SOAP `reallyDetailedFunction` request from ' + req.connection.remoteAddress);
                  return {
                      name: headers.Token
                  };
              }
          }
      }
  };

  var xml = require('fs').readFileSync('myservice.wsdl', 'utf8');

  //http server example
  var server = http.createServer(function(request,response) {
      response.end('404: Not Found: ' + request.url);
  });

  server.listen(8000);
  soap.listen(server, '/wsdl', myService, xml);

  //express server example
  var app = express();
  //body parser middleware are supported (optional)
  app.use(bodyParser.raw({type: function(){return true;}, limit: '5mb'}));
  app.listen(8001, function(){
      //Note: /wsdl route will be handled by soap module
      //and all other routes & middleware will continue to work
      soap.listen(app, '/wsdl', myService, xml);
  });

```

### Options
You can pass in server and [WSDL Options](#handling-xml-attributes-value-and-xml-wsdloptions)
using an options hash.

Server options include the below: 
`pfx`: A string or Buffer containing the private key, certificate and CA certs of the server in PFX or PKCS12 format. (Mutually exclusive with the key, cert and ca options.)
`key`: A string or Buffer containing the private key of the server in PEM format. (Could be an array of keys). (Required)
`passphrase`: A string of passphrase for the private key or pfx.
`cert`: A string or Buffer containing the certificate key of the server in PEM format. (Could be an array of certs). (Required)
`ca`: An array of strings or Buffers of trusted certificates in PEM format. If this is omitted several well known "root" CAs will be used, like VeriSign. These are used to authorize connections.
`crl` : Either a string or list of strings of PEM encoded CRLs (Certificate Revocation List)
`ciphers`: A string describing the ciphers to use or exclude, separated by  :. The default cipher suite is:

``` javascript
var xml = require('fs').readFileSync('myservice.wsdl', 'utf8');

soap.listen(server, {
    // Server options.
    path: '/wsdl',
    services: myService,
    xml: xml,

    // WSDL options.
    attributesKey: 'theAttrs',
    valueKey: 'theVal',
    xmlKey: 'theXml'
});
```

### Server Logging

If the `log` method is defined it will be called with 'received' and 'replied'
along with data.

``` javascript
  server = soap.listen(...)
  server.log = function(type, data) {
    // type is 'received' or 'replied'
  };
```

### Server Events

Server instances emit the following events:

* request - Emitted for every received messages.
  The signature of the callback is `function(request, methodName)`.
* headers - Emitted when the SOAP Headers are not empty.
  The signature of the callback is `function(headers, methodName)`.

The sequence order of the calls is `request`, `headers` and then the dedicated
service method.

### SOAP Fault

A service method can reply with a SOAP Fault to a client by `throw`ing an
object with a `Fault` property.

``` javascript
  throw {
    Fault: {
      Code: {
        Value: 'soap:Sender',
        Subcode: { value: 'rpc:BadArguments' }
      },
      Reason: { Text: 'Processing Error' }
    }
  };
```

To change the HTTP statusCode of the response include it on the fault.  The statusCode property will not be put on the xml message.

``` javascript
  throw {
    Fault: {
      Code: {
        Value: 'soap:Sender',
        Subcode: { value: 'rpc:BadArguments' }
      },
      Reason: { Text: 'Processing Error' },
      statusCode: 500
    }
  };
```

### Server security example using PasswordDigest

If `server.authenticate` is not defined then no authentication will take place.

``` javascript
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

``` javascript
  server = soap.listen(...)
  server.authorizeConnection = function(req) {
    return true; // or false
  };
```


## SOAP Headers

### Received SOAP Headers

A service method can look at the SOAP headers by providing a 3rd arguments.

``` javascript
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

``` javascript
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


#### *addSoapHeader*(soapHeader[, name, namespace, xmlns]) - add soapHeader to soap:Header node
##### Parameters
 - `soapHeader`     Object({rootName: {name: 'value'}}) or strict xml-string

##### Returns
The index where the header is inserted.

##### Optional parameters when first arg is object :
 - `name`           Unknown parameter (it could just a empty string)
 - `namespace`      prefix of xml namespace
 - `xmlns`          URI

#### *changeSoapHeader*(index, soapHeader[, name, namespace, xmlns]) - change an already existing soapHeader
##### Parameters
 - `index`          index of the header to replace with provided new value
 - `soapHeader`     Object({rootName: {name: 'value'}}) or strict xml-string

#### *getSoapHeaders*() - return all defined headers

#### *clearSoapHeaders*() - remove all defined headers


## Client

An instance of `Client` is passed to the `soap.createClient` callback.  It is used to execute methods on the soap service.

### Client.describe() - description of services, ports and methods as a JavaScript object

``` javascript
  client.describe() // returns
    {
      MyService: {
        MyPort: {
          MyFunction: {
            input: {
              name: 'string'
            }
          }
        }
      }
    }
```

### Client.setSecurity(security) - use the specified security protocol

### Client.*method*(args, callback) - call *method* on the SOAP service.

``` javascript
  client.MyFunction({name: 'value'}, function(err, result, raw, soapHeader) {
      // result is a javascript object
      // raw is the raw response
      // soapHeader is the response soap header as a javascript object
  })
```

The `args` argument allows you to supply arguments that generate an XML document inside of the SOAP Body section.

### Client.*method*Async(args) - call *method* on the SOAP service.

``` javascript
  client.MyFunctionAsync({name: 'value'}).then((result) => {
    // result is a javascript object
  })
```

The `args` argument allows you to supply arguments that generate an XML document inside of the SOAP Body section.

##### Example with JSON for the `args`
The example above uses `{name: 'value'}` as the args. This may generate a SOAP messages such as:

``` javascript
<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
   <soapenv:Body>
      <Request xmlns="http://www.example.com/v1">
          <name>value</name>
      </Request>
   </soapenv:Body>
</soapenv:Envelope>
```

Note that the "Request" element in the output above comes from the WSDL.  If an element in `args` contains no namespace prefix, the default namespace is assumed.  Otherwise, you must add the namespace prefixes to the element names as necessary (e.g., `ns1:name`).

Currently, when supplying JSON args, elements may not contain both child elements and a text value, even though that is allowed in the XML specification.

##### Example with XML String for the `args`
You may pass in a fully-formed XML string instead the individual elements in JSON `args` and attributes that make up the XML.  The XML string should not contain an XML declaration (e.g., `<?xml version="1.0" encoding="UTF-8"?>`) or a document type declaration (e.g., `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Frameset//EN" "http://www.w3.org/TR/html4/frameset.dtd">`).

```
 var args = { _xml: "<ns1:MyRootElement xmlns:ns1="http://www.example.com/v1/ns1">
                        <ChildElement>elementvalue</ChildElement>
                     </ns1:MyRootElement>"
            };
```
You must specify all of the namespaces and namespace prefixes yourself.  The element(s) from the WSDL are not utilized as they were in  the "Example with JSON as the `args`" example above, which automatically populated the "Request" element.

### Client.*service*.*port*.*method*(args, callback[, options[, extraHeaders]]) - call a *method* using a specific *service* and *port*

``` javascript
  client.MyService.MyPort.MyFunction({name: 'value'}, function(err, result) {
      // result is a javascript object
  })
```

#### Options (optional)
 - Accepts any option that the request module accepts, see [here.](https://github.com/mikeal/request)
 - For example, you could set a timeout of 5 seconds on the request like this:
``` javascript
  client.MyService.MyPort.MyFunction({name: 'value'}, function(err, result) {
      // result is a javascript object
  }, {timeout: 5000})
```

- You can measure the elapsed time on the request by passing the time option:
``` javascript
  client.MyService.MyPort.MyFunction({name: 'value'}, function(err, result) {
      // client.lastElapsedTime - the elapsed time of the last request in milliseconds
  }, {time: true})
```

- Also, you could pass your soap request through a debugging proxy such as [Fiddler](http://www.telerik.com/fiddler) or [Betwixt](https://github.com/kdzwinel/betwixt).
``` javascript
  client.MyService.MyPort.MyFunction({name: 'value'}, function(err, result) {
      // client.lastElapsedTime - the elapsed time of the last request in milliseconds
  }, {proxy: 'http://localhost:8888'})
```

- You can modify xml (string) before call:
 ``` javascript
   client.MyService.MyPort.MyFunction({name: 'value'}, function(err, result) {
       // client.lastElapsedTime - the elapsed time of the last request in milliseconds
   }, {postProcess: function(_xml) {
     return _xml.replace('text', 'newtext');
   }})
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
client.MyService.MyPort.MyFunction({name: 'value'}, options, function (err, result) {
  // result is a javascript object
})

client.MyService.MyPort.MyFunction({name: 'value'}, options, extraHeaders, function (err, result) {
  // result is a javascript object
})
```

### Overriding the namespace prefix
`node-soap` is still working out some kinks regarding namespaces.  If you find that an element is given the wrong namespace prefix in the request body, you can add the prefix to it's name in the containing object.  I.E.:

```javascript
  client.MyService.MyPort.MyFunction({'ns1:name': 'value'}, function(err, result) {
      // request body sent with `<ns1:name`, regardless of what the namespace should have been.
  }, {timeout: 5000})
```

- Remove namespace prefix of param

```javascript
  client.MyService.MyPort.MyFunction({':name': 'value'}, function(err, result) {
      // request body sent with `<name`, regardless of what the namespace should have been.
  }, {timeout: 5000})
```

### Client.*lastRequest* - the property that contains last full soap request for client logging

### Client.setEndpoint(url) - overwrite the SOAP service endpoint address

### Client Events
Client instances emit the following events:

* request - Emitted before a request is sent. The event handler receives the
entire Soap request (Envelope) including headers. The second parameter is the exchange id.
* message - Emitted before a request is sent. The event handler receives the
Soap body contents. Useful if you don't want to log /store Soap headers. The second parameter is the exchange id.
* soapError - Emitted when an erroneous response is received.
  Useful if you want to globally log errors.
  The second parameter is the exchange id.
* response - Emitted after a response is received. The event handler receives
the SOAP response body as well as the entire `IncomingMessage` response object.
The third parameter is the exchange id.
This is emitted for all responses (both success and errors).

An 'exchange' is a request/response couple.
Event handlers receive the exchange id in all events.
The exchange id is the same for the requests events and the responses events, this way you can use it to retrieve the matching request
when an response event is received.

By default exchange ids are generated by using node-uuid but you can use options in client calls to pass your own exchange id.

Example :

```javascript
  client.MyService.MyPort.MyFunction(args , function(err, result) {

  }, {exchangeId: myExchangeId})
```


## Security

`node-soap` has several default security protocols.  You can easily add your own
as well.  The interface is quite simple. Each protocol defines 2 methods:
* `addOptions` - a method that accepts an options arg that is eventually passed directly to `request`
* `toXML` - a method that returns a string of XML.

### BasicAuthSecurity

``` javascript
  client.setSecurity(new soap.BasicAuthSecurity('username', 'password'));
```

### BearerSecurity

``` javascript
  client.setSecurity(new soap.BearerSecurity('token'));
```

### ClientSSLSecurity

_Note_: If you run into issues using this protocol, consider passing these options
as default request options to the constructor:
* `rejectUnauthorized: false`
* `strictSSL: false`
* `secureOptions: constants.SSL_OP_NO_TLSv1_2` (this is likely needed for node >= 10.0)

``` javascript
client.setSecurity(new soap.ClientSSLSecurity(
                '/path/to/key',
                'path/to/cert',
                '/path/to/ca-cert',  /*or an array of buffer: [fs.readFileSync('/path/to/ca-cert/1', 'utf8'),
                'fs.readFileSync('/path/to/ca-cert/2', 'utf8')], */
                {   /*default request options like */
                    // strictSSL: true,
                    // rejectUnauthorized: false,
                    // hostname: 'some-hostname'
                    // secureOptions: constants.SSL_OP_NO_TLSv1_2,
                },
      ));
```
### WSSecurity

`WSSecurity` implements WS-Security. UsernameToken and PasswordText/PasswordDigest is supported.

``` javascript
  var options = {
    hasNonce: true,
    actor: 'actor'
  };
  var wsSecurity = new soap.WSSecurity('username', 'password', options)
  client.setSecurity(wsSecurity);
```
the `options` object is optional and can contain the following properties:
* `passwordType`: 'PasswordDigest' or 'PasswordText' (default: `'PasswordText'`)
* `hasTimeStamp`: adds Timestamp element (default: `true`)
* `hasTokenCreated`: adds Created element (default: `true`)
* `hasNonce`: adds Nonce element (default: `false`)
* `mustUnderstand`: adds mustUnderstand=1 attribute to security tag (default: `false`)
* `actor`: if set, adds Actor attribute with given value to security tag (default: `''`)

### WSSecurityCert

WS-Security X509 Certificate support.

``` javascript
  var privateKey = fs.readFileSync(privateKeyPath);
  var publicKey = fs.readFileSync(publicKeyPath);
  var password = ''; // optional password
  var wsSecurity = new soap.WSSecurityCert(privateKey, publicKey, password);
  client.setSecurity(wsSecurity);
```

## Handling XML Attributes, Value and XML (wsdlOptions).
Sometimes it is necessary to override the default behaviour of `node-soap` in order to deal with the special requirements
of your code base or a third library you use. Therefore you can use the `wsdlOptions` Object, which is passed in the
`#createClient()` method and could have any (or all) of the following contents:
```javascript
var wsdlOptions = {
  attributesKey: 'theAttrs',
  valueKey: 'theVal',
  xmlKey: 'theXml'
}
```
If nothing (or an empty Object `{}`) is passed to the `#createClient()` method, the `node-soap` defaults (`attributesKey: 'attributes'`, `valueKey: '$value'` and `xmlKey: '$xml'`) are used.

### Overriding the `value` key
By default, `node-soap` uses `$value` as the key for any parsed XML value which may interfere with your other code as it
could be some reserved word, or the `$` in general cannot be used for a key to start with.

You can define your own `valueKey` by passing it in the `wsdl_options` to the createClient call:
```javascript
var wsdlOptions = {
  valueKey: 'theVal'
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
  xmlKey: 'theXml'
};

soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', wsdlOptions, function (err, client) {
  // your code
});
```

### Overriding the `attributes` key
By default, `node-soap` uses `attributes` as the key to define a nodes attributes.

``` javascript
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
``` xml
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
  attributesKey: '$attributes'
};

soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', wsdlOptions, function (err, client) {
  client.method({
    parentnode: {
      childnode: {
        $attributes: {
          name: 'childsname'
        },
        $value: 'Value'
      }
    }
  });
});
```
### Specifying the exact namespace definition of the root element
In rare cases, you may want to precisely control the namespace definition that is included in the root element.

You can specify the namespace definitions by setting the `overrideRootElement` key in the `wsdlOptions` like so:
```javascript
var wsdlOptions = {
  overrideRootElement: {
    namespace: 'xmlns:tns',
    xmlnsAttributes: [{
      name: 'xmlns:ns2',
      value: "http://tempuri.org/"
    }, {
      name: 'xmlns:ns3',
      value: "http://sillypets.com/xsd"
    }]
  }
};
```

To see it in practice, have a look at the sample files in: [test/request-response-samples/addPets__force_namespaces](https://github.com/vpulim/node-soap/tree/master/test/request-response-samples/addPets__force_namespaces)

### Custom Deserializer

Sometimes it's useful to handle deserialization in your code instead of letting node-soap do it.
For example if the soap response contains dates that are not in a format recognized by javascript, you might want to use your own function to handle them.

To do so, you can pass a `customDeserializer` object in `options`. The properties of this object are the types that your deserializer handles itself.

Example :
```javascript

   var wsdlOptions = {
     customDeserializer = {

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
  useEmptyTag: true
};
```

For example: `{ MyTag: { attributes: { MyAttr: 'value' } } }` is:

* **Without useEmptyTag**: `<MyTag MyAttr="value"></MyTag>`
* **With useEmptyTag set to true**: `<MyTag MyAttr="value" />`

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

## soap-stub

Unit testing services that use soap clients can be very cumbersome.  In order to get
around this you can use `soap-stub` in conjunction with `sinon` to stub soap with
your clients.

### Example

```javascript
// test-initialization-script.js
var sinon = require('sinon');
var soapStub = require('soap/soap-stub');

var urlMyApplicationWillUseWithCreateClient = 'http://path-to-my-wsdl';
var clientStub = {
  SomeOperation: sinon.stub()
};

clientStub.SomeOperation.respondWithError = soapStub.createErroringStub({..error json...});
clientStub.SomeOperation.respondWithSuccess = soapStub.createRespondingStub({..success json...});

soapStub.registerClient('my client alias', urlMyApplicationWillUseWithCreateClient, clientStub);

// test.js
var soapStub = require('soap/soap-stub');

describe('myService', function() {
  var clientStub;
  var myService;

  beforeEach(function() {
    clientStub = soapStub.getStub('my client alias');
    soapStub.reset();
    myService.init(clientStub);
  });

  describe('failures', function() {
    beforeEach(function() {
      clientStub.SomeOperation.respondWithError();
    });

    it('should handle error responses', function() {
      myService.somethingThatCallsSomeOperation(function(err, response) {
        // handle the error response.
      });
    });
  });
});
```


## Contributors

 * Author: [Vinay Pulim](https://github.com/vpulim)
 * Maintainers:
   - [Joe Spencer](https://github.com/jsdevel)
   - [Heinz Romirer](https://github.com/herom)
 * [All Contributors](https://github.com/vpulim/node-soap/graphs/contributors)

[downloads-image]: http://img.shields.io/npm/dm/soap.svg
[npm-url]: https://npmjs.org/package/soap
[npm-image]: http://img.shields.io/npm/v/soap.svg

[travis-url]: https://travis-ci.org/vpulim/node-soap
[travis-image]: http://img.shields.io/travis/vpulim/node-soap.svg

[gitter-url]: https://gitter.im/vpulim/node-soap
[gitter-image]: https://badges.gitter.im/vpulim/node-soap.png

[coveralls-url]: https://coveralls.io/r/vpulim/node-soap
[coveralls-image]: http://img.shields.io/coveralls/vpulim/node-soap/master.svg
