'use strict';

var fs = require('fs');
var soap = require('..');
var assert = require('assert');
var http = require('http');


describe('post data concat test', function () {
    it('should consider the situation about multi-byte character between two tcp packets', function (done) {
        var check = function (a, b) {
            if (a && b) {
                assert(a === b);
                done();
            }
        };

        var wsdl = 'test/wsdl/default_namespace.wsdl';
        var server = http.createServer(function (req, res) { });
        var xml = fs.readFileSync(wsdl, 'utf8');
        var service = {
            MyService: {
                MyServicePort: {
                    MyOperation: function (arg) {
                        console.log(arg);
                        check(arg, postdata);
                        return "0";
                    }
                }
            }
        };

        server.listen(51515);
        soap.listen(server, '/wsdl', service, xml);

        var postdata = "";
        for (var i = 0; i < 20000; i++) {
            postdata += "测试";
        }

        soap.createClient(wsdl, {
            endpoint: 'http://localhost:51515/wsdl'
        }, function (error, client) {
            assert(!error);
            client.MyOperation(postdata, function (error, response) {
                server.close();
            });
        });

    });
});

