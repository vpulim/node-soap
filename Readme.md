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

### soap.createClient(url, callback) - create a new SOAP client from a WSDL url. Also supports a local filesystem path.

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
              }

              // This is how to define an asynchronous function.
              MyAsyncFunction: function(args, callback) {
                  // do some work
                  callback({
                      name: args.name
                  })
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

### server logging

If the log method is defined it will be called with 'received' and 'replied'
along with data.

``` javascript
  server = soap.listen(...)
  server.log = function(type, data) {
    // type is 'received' or 'replied'
  };
```

### server security example using PasswordDigest

If server.authenticate is not defined no authentation will take place.

``` javascript
  server = soap.listen(...)
  server.authenticate = function(security) {
    var created, nonce, password, user, token;
    token = security.UsernameToken, user = token.Username,
            password = token.Password, nonce = token.Nonce, created = token.Created;
    return user === 'user' && password === soap.passwordDigest(nonce, created, 'password');
  };
```

### server connection authorization

This is called prior to soap service method
If the method is defined and returns false the incoming connection is
terminated.

``` javascript
  server = soap.listen(...)
  server.authorizeConnection = function(req) {
    return true; // or false
  };
```


## Client

An instance of Client is passed to the soap.createClient callback.  It is used to execute methods on the soap service.

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
* addOptions - a method that accepts an options arg that is eventually passed directly to `request`
* toXML - a method that reurns a string of XML.

By default there are 3 protocols:

####BasicAuthSecurity

``` javascript
  client.setSecurity(new soap.BasicAuthSecurity('username', 'password'));
```

####ClientSSLSecurity
_Note_: If you run into issues using this protocol, consider passing these options
as default request options to the constructor:
* rejectUnauthorized: false
* strictSSL: false
* secureOptions: constants.SSL_OP_NO_TLSv1_2//this is likely needed for node >= 10.0

``` javascript
  client.setSecurity(new soap.ClientSSLSecurity(
    '/path/to/key'
    , '/path/to/cert'
    , {/*default request options*/}
  ));
```

####WSSecurity

``` javascript
  client.setSecurity(new WSSecurity('username', 'password'))
```

### Client.*method*(args, callback) - call *method* on the SOAP service.

``` javascript
  client.MyFunction({name: 'value'}, function(err, result) {
      // result is a javascript object
  })
```
### Client.*service*.*port*.*method*(args, callback[, options]) - call a *method* using a specific *service* and *port*

``` javascript
  client.MyService.MyPort.MyFunction({name: 'value'}, function(err, result) {
      // result is a javascript object
  })
```
+#### Options (optional)
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

## WSSecurity

WSSecurity implements WS-Security.  UsernameToken and PasswordText/PasswordDigest is supported. An instance of WSSecurity is passed to Client.setSecurity.

``` javascript
  new WSSecurity(username, password, passwordType)
    //'PasswordDigest' or 'PasswordText' default is PasswordText
```

[downloads-image]: http://img.shields.io/npm/dm/soap.svg
[npm-url]: https://npmjs.org/package/soap
[npm-image]: http://img.shields.io/npm/v/soap.svg

[travis-url]: https://travis-ci.org/vpulim/node-soap
[travis-image]: http://img.shields.io/travis/vpulim/node-soap.svg
