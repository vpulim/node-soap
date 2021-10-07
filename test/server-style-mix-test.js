'use strict';

var fs = require('fs');
var request = require('request');
var assert = require('assert');
var http = require('http');
var soap = require('..');
var server;
var url;

var path = 'test/wsdl/wsdl_style_mix.wsdl';
var wsdl = fs.readFileSync(path, 'utf8');;

/**
 * requested operation has 'document' style while the binding itself has 'rpc' style 
 **/
var requestXML = `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:hl7-org:v3">
   <soapenv:Header/>
   <soapenv:Body>
      <urn:hl7Message>
         <test></test>
      </urn:hl7Message>
   </soapenv:Body>
</soapenv:Envelope>`;

var responseXMLGood = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"  xmlns:tns="http://tempuri.org/" xmlns:urn="urn:hl7-org:v3"><soap:Body><urn:hl7Message xmlns:urn="urn:hl7-org:v3" xmlns="urn:hl7-org:v3"><urn:result></urn:result></urn:hl7Message></soap:Body></soap:Envelope>`;

var service = {
    HL7Service: {
        Hl7MessageBinding: {
            opHl7Message: function (args, callback) {
                callback({ result: {} });
            }
        }
    }
};

describe('server has mixed style', function () {

    before(function (done) {

        server = http.createServer(function (request, response) {
            response.end('404: Not Found: ' + request.url);
        });

        server.listen(51515, function () {
            soap.listen(server, '/', service, wsdl);

            url = 'http://' + server.address().address + ':' + server.address().port;
            if (server.address().address === '0.0.0.0' || server.address().address === '::') {
                url = 'http://127.0.0.1:' + server.address().port;
            }
            done();
        });
    });

    after(function () {
        server.close();
    });

    it('should return good response', function (done) {
        request({
            url: url,
            method: 'POST',
            headers: {
                SOAPAction: "urn:#opHl7Message",
                "Content-Type": 'text/xml; charset="utf-8"'
            },
            body: requestXML
        }, function (err, response, body) {
            if (err) {
                throw err;
            }
            assert.strictEqual(body, responseXMLGood);
            done();
        });
    });

});
