This module lets you connect to web services using SOAP.  It also provides a server that allows you to run your own SOAP services.

Current limitations:

* Only a few XSD Schema types are supported
* Only WS-Security is supported using UsernameToken and PasswordText encoding

## Install

Install with [npm](http://github.com/isaacs/npm):

    npm install soap

## Module

### soap.createClient(url, callback) - create a new SOAP client from a WSDL url

    var soap = require('soap');
    var url = 'http://example.com/wsdl?wsdl';
    var args = {name: 'value'};
    soap.createClient(url, function(err, client) {
        client.MyFunction(args, function(err, result) {
            console.log(result);
        });
    });

### soap.listen(*server*, *path*, *services*, *wsdl*) - create a new SOAP server that listens on *path* and provides *services*. *wsdl* is an xml string that defines the service.

    var myService = { 
        MyService: { 
            MyPort: { 
                MyFunction: function(args) {
                    return {
                        name: args.name
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

## Client

An instance of Client is passed to the soap.createClient callback.  It is used to execute methods on the soap service.

### Client.describe() - description of services, ports and methods as a JavaScript object

    client.describe() => 
        { MyService: {
            MyPort: {
                MyFunction: {
                    input: {
                        name: 'string'
                    }
                }}}}

### Client.setSecurity(security) - use the specified security protocol (see WSSecurity below)

    client.setSecurity(new WSSecurity('username', 'password'))
    
### Client.*method*(args, callback) - call *method* on the SOAP service.  

    client.MyFunction({name: 'value'}, function(err, result) {
        // result is a javascript object        
    })
    
### Client.*service*.*port*.*method*(args, callback) - call a *method* using a specific *service* and *port*

    client.MyService.MyPort.MyFunction({name: 'value'}, function(err, result) {
        // result is a javascript object                
    })

## WSSecurity

WSSecurity implements WS-Security.  Currently, only UsernameToken and PasswordText is supported. An instance of WSSecurity is passed to Client.setSecurity.

    new WSSecurity(username, password)