var http = require('http');
var soap = require('../..');
var inspect = require('util').inspect;
var url = require('url');
var path = require('path');
var ip2tele_client;
var cfg = require('./cfg.js');

if (process.argv[2] || process.argv[2] === 'fake') {
    var endpoint = 'http://127.0.0.1:' + cfg.fake_port + cfg.path + '?wsdl';
    var fake = 'fake';
} else {
    console.log('Usage : node ip2tele.js [fake]');
    console.log('[fake] call fake service instead of the real production server.');
}

soap.createClient(cfg.wsdl_file,
function(err, client) {
    ip2tele_client = client;
},
endpoint
);


var web_server = http.createServer(function(req, res) {
    var cSock = req.connection;
    var sAddr = res.socket.address();
    var QueryUserInfoRequest = {
        'UserInfo': {
            "IP": cSock.remoteAddress,
            "Port": cSock.remotePort,
            'ServerIP': sAddr.address,
            'ServerPort': sAddr.port,
            'SessionID': '',
            'SKey': ''
        },
        'ServerInfo': {
            'ServerID': cfg.ServerID,
            'TimeStamp': +new Date
        }
    }
    console.log(QueryUserInfoRequest);

    ip2tele_client.QueryUserInfoServiceApply.QueryUserInfoServiceApplyHttpPort.QueryUserInfoServiceApply(QueryUserInfoRequest,
    function(err, QueryUserInfoResponse, body) {
        if (err) console.log(err);
        var path = url.parse(req.url).pathname;
        console.log(QueryUserInfoResponse);
        var tele = QueryUserInfoResponse.UserInfo[0].UserName;
        var loc = 'http://61.181.22.71:81/tjuc/get_tele_b.show_tele?tele=' + tele;
        if (path === '/') {
            res.writeHead(200, {
                'Content-Type': 'text/html',
                'Transfer-Encoding': 'chunked'
            });
            res.write('<h2>This is a call to ' + (fake || 'real') + ' ip2tele web service</h2>');
            res.write('<h1>your tele is ' + tele + '</h1>');
            res.write('<br/>your request is <br/>' + inspect(QueryUserInfoRequest));
            res.end('<br/>your response is <br/>' + inspect(QueryUserInfoResponse));
        } else {
            res.writeHead(303, {
                "Location": loc
            });
            res.end();
        }
    });

}).listen(cfg.site_port);
