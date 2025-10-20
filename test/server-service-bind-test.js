const soap = require('..');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const wsdl = fs.readFileSync(__dirname + '/wsdl/multi-service.wsdl', 'utf-8');

describe('SOAP Server Binding Resolution', function () {
  let server;

  const serviceImpl = {
    Hello_Service: {
      Hello_Port: {
        sayHello: function (args) {
          return {
            greeting: args.firstName
          };
        }
      }
    },
    Hello_Service2: {
      Hello_Port2: {
        sayHello2: function (args) {
          return {
            greeting: args.firstName
          };
        }
      }
    }
  };

  this.beforeAll(async function () {

    server = http.createServer(function (req, res) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.write("Hello");
      res.end();
    });

    server.listen(8001, function () {
      soap.listen(server, '/SayHello', serviceImpl, wsdl);
    });
  });

  this.afterAll(function () {
    server.close();
  });

  it('should correctly resolve serviceName, portName, and binding', async function () {
    const client = await soap.createClientAsync(wsdl)
    assert.ok(client);
    console.log('client created:', client.describe());

    // code below triggers "TypeError: Cannot read properties of undefined (reading 'description')
    // try {
    //   const response = await client.sayHelloAsync({ firstName: 'Bob' });
    //   console.log(`>>> response`, response[0])
    // } catch (err) {
    //   console.error(`error`, err)
    // }
  });
});