# Soap [![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Build Status][travis-image]][travis-url]
> A SOAP client and server for node.js.

This module lets you connect to web services using SOAP.  It also provides a server that allows you to run your own SOAP services.

## Features:

* Very simple API
* Handles both RPC and Document schema types
* Supports multiRef SOAP messages (thanks to [@kaven276](https://github.com/kaven276))
* Support for both synchronous and asynchronous method handlers
* WS-Security (currently only UsernameToken and PasswordText encoding is supported)

## Install

Install with [npm](http://github.com/isaacs/npm):

```
  npm install soap
```
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

#### Options

The `options` argument allows you to customize the client with the following properties:

- endpoint: to override the SOAP service's host specified in the `.wsdl` file.
- request: to override the [request](https://github.com/request/request) module.
- httpClient: to provide your own http client that implements `request(rurl, data, callback, exheaders, exoptions)`.

### soap.listen(*server*, *path*, *services*, *wsdl*) - create a new SOAP server that listens on *path* and provides *services*.
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
                  })
              },

              // This is how to receive incoming headers
              HeadersAwareFunction: function(args, cb, headers) {
                  return {
                      name: headers.Token
                  };
              }
          }
      }
  }

  var xml = require('fs').readFileSync('myservice.wsdl', 'utf8'),
      server = http.createServer(function(request,response) {
          response.end("404: Not Found: "+request.url)
      });

  server.listen(8000);
  soap.listen(server, '/wsdl', myService, xml);
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
        Value: "soap:Sender",
        Subcode: { value: "rpc:BadArguments" }
      },
      Reason: { Text: "Processing Error" }
    }
  };
```

To change the HTTP statusCode of the response include it on the fault.  The statusCode property will not be put on the xml message.

``` javascript
  throw {
    Fault: {
      Code: {
        Value: "soap:Sender",
        Subcode: { value: "rpc:BadArguments" }
      },
      Reason: { Text: "Processing Error" },
      statusCode: 500
    }
  };
```

### SOAP Headers

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
`node-soap` has several default security protocols.  You can easily add your own
as well.  The interface is quite simple.  Each protocol defines 2 methods:
* `addOptions` - a method that accepts an options arg that is eventually passed directly to `request`
* `toXML` - a method that returns a string of XML.

By default there are 3 protocols:

####BasicAuthSecurity

``` javascript
  client.setSecurity(new soap.BasicAuthSecurity('username', 'password'));
```

####ClientSSLSecurity
_Note_: If you run into issues using this protocol, consider passing these options
as default request options to the constructor:
* `rejectUnauthorized: false`
* `strictSSL: false`
* `secureOptions: constants.SSL_OP_NO_TLSv1_2` (this is likely needed for node >= 10.0)

``` javascript
  client.setSecurity(new soap.ClientSSLSecurity(
    '/path/to/key'
    , '/path/to/cert'
    , {/*default request options*/}
  ));
```

####WSSecurity

``` javascript
  client.setSecurity(new soap.WSSecurity('username', 'password'))
```

####BearerSecurity

``` javascript
  client.setSecurity(new soap.BearerSecurity('token'));
```

### Client.*method*(args, callback) - call *method* on the SOAP service.

``` javascript
  client.MyFunction({name: 'value'}, function(err, result, raw, soapHeader) {
      // result is a javascript object
      // raw is the raw response
      // soapHeader is the response soap header as a javascript object
  })
```
### Client.*service*.*port*.*method*(args, callback[, options]) - call a *method* using a specific *service* and *port*

``` javascript
  client.MyService.MyPort.MyFunction({name: 'value'}, function(err, result) {
      // result is a javascript object
  })
```
###Overriding the namespace prefix
`node-soap` is still working out some kinks regarding namespaces.  If you find that an element is given the wrong namespace prefix in the request body, you can add the prefix to it's name in the containing object.  I.E.:

```javascript
  client.MyService.MyPort.MyFunction({'ns1:name': 'value'}, function(err, result) {
      // request body sent with `<ns1:name`, regardless of what the namespace should have been.
  }, {timeout: 5000})
```


#### Options (optional)
 - Accepts any option that the request module accepts, see [here.](https://github.com/mikeal/request)
 - For example, you could set a timeout of 5 seconds on the request like this:
``` javascript
  client.MyService.MyPort.MyFunction({name: 'value'}, function(err, result) {
      // result is a javascript object
  }, {timeout: 5000})
```

### Client.*addSoapHeader*(soapHeader[, name, namespace, xmlns]) - add soapHeader to soap:Header node
#### Options

 - `soapHeader`     Object({rootName: {name: "value"}}) or strict xml-string

##### Optional parameters when first arg is object :
 - `name`           Unknown parameter (it could just a empty string)
 - `namespace`      prefix of xml namespace
 - `xmlns`          URI

### Client.*lastRequest* - the property that contains last full soap request for client logging

### Client Events
Client instances emit the following events:

* request - Emitted before a request is sent. The event handler receives the
entire Soap request (Envelope) including headers.
* message - Emitted before a request is sent. The event handler receives the
Soap body contents. Useful if you don't want to log /store Soap headers.
* soapError - Emitted when an erroneous response is received.
  Useful if you want to globally log errors.
* response - Emitted after a response is received. The event handler receives
the entire response body. This is emitted for all responses (both success and
errors).


## WSSecurity

WSSecurity implements WS-Security.  UsernameToken and PasswordText/PasswordDigest is supported. An instance of WSSecurity is passed to Client.setSecurity.

``` javascript
  new WSSecurity(username, password, options)
    //the 'options' object is optional and contains properties:
    //passwordType: 'PasswordDigest' or 'PasswordText' default is PasswordText
    //hasTimeStamp: true or false default is true
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

###Overriding the `value` key
By default, `node-soap` uses `$value` as key for any parsed XML value which may interfere with your other code as it
could be some reserved word, or the `$` in general cannot be used for a key to start with.

You can define your own `valueKey` by passing it in the `wsdl_options` to the createClient call like so:
```javascript
var wsdlOptions = {
  valueKey: 'theVal'
};

soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', wsdlOptions, function (err, client) {
  // your code
});
```

###Overriding the `xml` key
As `valueKey`, `node-soap` uses `$xml` as key. The xml key is used to pass XML Object without adding namespace or parsing the string.

Example :

```javascript
dom = {
     $xml: '<parentnode type="type"><childnode></childnode></parentnode>'
};
```

```xml
<tns:dom>
    <parentnode type="type">
          <childnode></childnode>
    </parentnode>
</tns:dom>
```

You can define your own `xmlKey` by passing it in the `wsdl_options` to the createClient call like so:
```javascript
var wsdlOptions = {
  xmlKey: 'theXml'
};

soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', wsdlOptions, function (err, client) {
  // your code
});
```

###Overriding the `attributes` key
You can achieve attributes like:
``` xml
<parentnode>
  <childnode name="childsname">
  </childnode>
</parentnode>
```
By attaching an attributes object to a node.
``` javascript
{
  parentnode: {
    childnode: {
      attributes: {
        name: 'childsname'
      }
    }
  }
}
```
However, "attributes" may be a reserved key for some systems that actually want a node
```xml
<attributes>
</attributes>
```

In this case you can configure the attributes key in the `wsdlOptions` like so.
```javascript
var wsdlOptions = {
  attributesKey: '$attributes'
};

soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', wsdlOptions, function (err, client) {
  client.*method*({
    parentnode: {
      childnode: {
        $attributes: {
          name: 'childsname'
        }
      }
    }
  });
});
```

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
