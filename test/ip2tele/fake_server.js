var cfg = require('./cfg.js');
var soap = require('../..');
var path = require('path');
var http = require('http');
var QueryString = require('querystring');
var Request = require('request');
var fs = require('fs');

var SoapServices = {
    'QueryUserInfoServiceApply': {
        'QueryUserInfoServiceApplyHttpPort': {
            'QueryUserInfoServiceApply': function(args) {
                console.log('received args = ');
                console.log(args);
                return ({
                    'tns:ServerInfo': {
                        'ResultCode': '0',
                        'Description': 'success'
                    },
                    'tns:UserInfo': {
                        'UserName': '15620001781'
                    }
                });
            }
        }
    }
}

var server = http.createServer(function(req, res) {
    res.end("404: Not Found: " + request.url);
});


server.listen(cfg.fake_port);
var wsdl_string = require('fs').readFileSync(path.resolve(cfg.wsdl_file), 'utf8');
var soap_server = soap.listen(server, cfg.path, SoapServices, wsdl_string);
soap_server.logger_req = function(xml, req, res) {
    req.__time = +new Date;
    var cip = req.connection.remoteAddress;
    var filename = 'logs/svr-' + req.__time + '-' + cip + '-req.log.xml';
    var ws = fs.createWriteStream(filename);
    ws.write(xml);
    ws.end();
};
soap_server.logger_res = function(xml, req, res) {
    var cip = req.connection.remoteAddress;
    var filename = 'logs/svr-' + req.__time + '-' + cip + '-res.log.xml';
    var ws = fs.createWriteStream(filename);
    ws.write(xml);
    ws.end();
};

var defLog = false;
setTimeout(function() {
    if (!defLog) return;
    var def = soap_server.wsdl.definitions;
    var message = def.messages[Object.keys(def.messages)[0]];
    var service = def.services[Object.keys(def.services)[0]];
    var binding = def.bindings[Object.keys(def.bindings)[0]];
    var portType = def.portTypes[Object.keys(def.portTypes)[0]];
    console.log(def);
    console.log('\nmessage=');
    console.log(message);
    console.log('\nservice=');
    console.log(service);
    console.log('\nbinding=');
    console.log(binding);
    console.log('\nportType=');
    console.log(portType);
    console.log('\nbinding.method=');
    console.log(binding.methods[Object.keys(binding.methods)[0]]);
    console.log('\nportType.method=');
    console.log(portType.methods[Object.keys(portType.methods)[0]]);
},
0);

if (process.argv[2]) {
    switch (process.argv[2].toLowerCase()) {
    case 'deflog':
        defLog = true;
        break;
    }
} else {
    console.log("Usage: node fake_server.js [deflog]");
    console.log('[deflog] will log parsed wsdl definition parts;');
    console.log();
}
