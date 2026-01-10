const soap = require('..');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { deepEqual } = require('should');

const wsdl = fs.readFileSync(__dirname + '/wsdl/multi-service.wsdl', 'utf-8');

describe('SOAP Multi Service Binding', function () {
  let server;

  const serviceImpl = {
    Hello_Service: {
      Hello_Port: {
        sayHello: function (args) {
          return {
            greeting: args.firstName,
          };
        },
      },
    },
    Bye_Service: {
      Bye_Port: {
        sayBye: function (args) {
          return {
            bye: args.firstName,
          };
        },
      },
      Another_Bye_Port: {
        sayAnotherBye: function (args) {
          return {
            another_bye: args.firstName,
          };
        },
      },
    },
  };

  this.beforeAll(async function () {
    server = http.createServer(function (req, res) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.write('Hello');
      res.end();
    });

    server.listen(8001, function () {
      soap.listen(server, '/SayHello', serviceImpl, wsdl);
      soap.listen(server, '/SayBye', serviceImpl, wsdl);
      soap.listen(server, '/SayAnotherBye', serviceImpl, wsdl);
    });
  });

  this.afterAll(function () {
    server.close();
  });

  it('should resolve hello service binding in multi service WSDL', async function () {
    const client = await soap.createClientAsync(wsdl);
    assert.ok(client);
    const response = await client.sayHelloAsync({ firstName: 'Bob' });
    deepEqual(response[0], { greeting: 'Bob' });
  });

  it('should resolve bye service binding in multi service WSDL', async function () {
    const client = await soap.createClientAsync(wsdl);
    assert.ok(client);
    const response = await client.sayByeAsync({ firstName: 'Bob' });
    deepEqual(response[0], { bye: 'Bob' });
  });

  it('should resolve bye service with second binding in multi service WSDL', async function () {
    const client = await soap.createClientAsync(wsdl);
    assert.ok(client);
    const response = await client.sayAnotherByeAsync({ firstName: 'Bob' });
    deepEqual(response[0], { another_bye: 'Bob' });
  });
});
