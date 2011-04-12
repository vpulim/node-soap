var Client = require('./client').Client,
    WSDL = require('./wsdl').WSDL,
    http = require('./http');

var _wsdlCache = {};

function service(url, callback) {
    var wsdl = _wsdlCache[url];
    if (wsdl) {
        callback(null, new Client(wsdl));
    }
    else {        
        http.request(url, null, function(err, response) {
            if (err) {
                callback(err);
            }
            else if (response && response.statusCode == 200){
                wsdl = new WSDL(response.body);
                _wsdlCache[url] = wsdl;
                callback(null, new Client(wsdl));                
            }
            else {
                callback(new Error('Invalid WSDL URL: '+url))
            }
        });   
    }
}

function WSSecurity(username, password) {
	this._username = username;
	this._password = password;    
}

WSSecurity.prototype.toXML = function() {
    return  "<wsse:Security xmlns:wsse=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\">" +
	        "<wsse:UsernameToken>" +
	        "<wsse:Username>"+this._username+"</wsse:Username>" + 
	        "<wsse:Password>"+this._password+"</wsse:Password>" +
	        "</wsse:UsernameToken>" +
	        "</wsse:Security>"
}

exports.WSSecurity = WSSecurity;
exports.service = service;

if (process.argv[1] === __filename) {
    var url = 'http://www.webservicex.net/ConvertTemperature.asmx?wsdl';
    service(url, function(error, client) {
        // console.log(require('sys').inspect(client.describe(), true, 10));
        var args = {
            Temperature: 80.0,
            FromUnit: 'degreeFahrenheit',
            ToUnit: 'degreeCelsius'
        };
        client.ConvertTemp(args, function(error, response) {
            console.log(require('sys').inspect(response, true, 10));
        });
    });
}