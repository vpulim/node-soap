'use strict';

const fs = require('fs'),
  soap = require('../lib/soap'),
  http = require('http'),
  assert = require('assert');

let server;
const servicePath = '/SayHello';
let url;
const wsdl = fs.readFileSync(__dirname + '/wsdl/hello.wsdl', 'utf-8');
const serviceImplementation = {
  Hello_Service: {
    Hello_Port: {
      sayHello: function (args) {
        return {
          greeting: args.firstName
        };
      }
    }
  }
};

describe('SOAP Client', function () {

  before(function (done) {
    // start test soap server (hello.wsdl)
    server = http.createServer(function (request, response) {
      response.end('404: Not Found: ' + request.url);
    });
    console.log('test server is created');

    server.listen(54454, function () {
      soap.listen(server, servicePath, serviceImplementation, wsdl);
      url = 'http://' + server.address().address + ':' + server.address().port;
      if (server.address().address === '0.0.0.0' || server.address().address === '::') {
        url = 'http://127.0.0.1:' + server.address().port;
      }
      console.log('test server is listening in', url);
      done();
    });
  });

  after(function () {
    server.close();
    console.log('server is closed');
  });

  it('lastElapsedTime is computed', function (done) {
    soap.createClientAsync(__dirname + '/wsdl/hello.wsdl', { endpoint: `${url}${servicePath}` }).then(function (client) {
      assert.ok(client);
      console.log('client created:', client.describe());
      client.sayHelloAsync({ firstName: 'LastElapsedTime Tester' }, { time: true }).then(() => {
        assert.ok(Object.prototype.hasOwnProperty.call(client, 'lastElapsedTime'));
        assert.ok(typeof client.lastElapsedTime === 'number');
        console.log('api finished in ms:', client.lastElapsedTime);
        assert.ok(client.lastElapsedTime > 0);
        done();
      });
    });
  });

});
