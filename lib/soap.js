var Client = require('./client').Client,
    Server = require('./server').Server,
    WSDL = require('./wsdl').WSDL,
    http = require('./http');

var _wsdlCache = {};

function _requestWSDL(url, callback) {
    var wsdl = _wsdlCache[url];
    if (wsdl) {
        callback(null, wsdl);
    }
    else {        
        http.request(url, null, function(err, response) {
            if (err) {
                callback(err);
            }
            else if (response && response.statusCode == 200){
                wsdl = new WSDL(response.body);
                _wsdlCache[url] = wsdl;
                callback(null, wsdl);                
            }
            else {
                callback(new Error('Invalid WSDL URL: '+url))
            }
        });   
    }    
}

function createClient(url, callback) {
    _requestWSDL(url, function(err, wsdl) {
        callback(err, wsdl && new Client(wsdl));        
    })
}

function listen(server, path, services, xml) {
    var wsdl = new WSDL(xml || services);
    return new Server(server, path, services, wsdl);
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
exports.createClient = createClient;
exports.listen = listen;
