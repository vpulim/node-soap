This module lets you connect to web services using SOAP.  It also supports WS-Security using UsernameToken and plain text passwords.

## Install

Install with [npm](http://github.com/isaacs/npm):

    npm install soap

## API

### soap.getClient(url, callback) - create a new SOAP client from a WSDL url

    var soap = require('soap');
    var url = 'http://example.com/wsdl';
    var args = {name: 'value'};
    soap.getClient(url, function(err, client) {
        if (client) {
            client.MyFunction(args, function(err, result) {
                console.log(result);
            });
        }
    });

