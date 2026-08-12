const fs = require('fs');
const soap = require('../');
const path = require('path');
var http = require('http');
var jsdiff = require('diff');
var assert = require('assert');

let server;
let port;

function normalizeWhiteSpace(raw) {
  var normalized = raw.replace(/\r\n|\r|\n/g, ''); // strip line endings
  normalized = normalized.replace(/\s\s+/g, ' '); // convert whitespace to spaces
  normalized = normalized.replace(/> </g, '><'); // get rid of spaces between elements
  return normalized;
}

var requestContext = {
  //set these two within each test
  expectedRequest: null,
  responseToSend: null,
  doneHandler: null,
  requestHandler: function (req, res) {
    var chunks = [];
    req.on('data', function (chunk) {
      // ignore eol on sample files.
      chunks.push(chunk.toString().replace(/\r?\n$/m, ''));
    });
    req.on('end', function () {
      if (!requestContext.expectedRequest) return res.end(requestContext.responseToSend);

      var actualRequest = normalizeWhiteSpace(chunks.join(''));
      var expectedRequest = normalizeWhiteSpace(requestContext.expectedRequest);

      if (actualRequest !== expectedRequest) {
        var diff = jsdiff.diffChars(actualRequest, expectedRequest);
        var comparison = '';
        diff.forEach(function (part) {
          var color = 'grey';
          if (part.added) {
            color = 'green';
          }
          if (part.removed) {
            color = 'red';
          }
          comparison += part.value[color];
        });
        console.log(comparison);
      }

      assert.equal(actualRequest, expectedRequest);

      if (!requestContext.responseToSend) return requestContext.doneHandler();
      if (requestContext.responseHttpHeaders) {
        for (const headerKey in requestContext.responseHttpHeaders) {
          res.setHeader(headerKey, requestContext.responseHttpHeaders[headerKey]);
        }
      }
      res.end(requestContext.responseToSend);

      requestContext.expectedRequest = null;
      requestContext.responseToSend = null;
    });
  },
};

describe('SOAP Client schema does not change', () => {
  before(function (done) {
    server = http.createServer(requestContext.requestHandler);
    server.listen(0, function (e) {
      if (e) return done(e);
      port = server.address().port;
      done();
    });
  });
  it('should not change the schema', (done) => {
    const tpath = path.join(__dirname, 'request-response-samples', 'RetrieveFareQuoteDateRange__should_handle_child_namespaces');
    const wsdlPath = path.resolve(tpath, 'soap.wsdl');
    const requestJSON = require(path.resolve(tpath, 'request.json'));
    const requestXML = fs.readFileSync(path.resolve(tpath, 'request.xml'), { encoding: 'utf8' });
    const responseJSON = require(path.resolve(tpath, 'response.json'));
    const responseXML = fs.readFileSync(path.resolve(tpath, 'response.xml'), { encoding: 'utf8' });
    const methodName = 'RetrieveFareQuoteDateRange';

    requestContext.expectedRequest = requestXML;
    requestContext.responseToSend = responseXML;
    soap.createClient(
      wsdlPath,
      { disableCache: true },
      function (err, client) {
        if (err) {
          throw err;
        }
        //throw more meaningful error
        if (typeof client[methodName] !== 'function') {
          throw new Error('method ' + methodName + ' does not exists in wsdl specified in test wsdl: ' + wsdlPath);
        }
        const typeBefore = client?.wsdl?.definitions?.schemas?.['http://tempuri.org/Service/Request']?.complexTypes?.TransactionInfo?.children?.[0]?.children?.[2]?.$type;

        cbCaller(client, methodName, requestJSON, responseJSON, null, {}, null, done);

        const typeAfter = client?.wsdl?.definitions?.schemas?.['http://tempuri.org/Service/Request']?.complexTypes?.TransactionInfo?.children?.[0]?.children?.[2]?.$type;
        assert.equal(typeBefore, typeAfter);
      },
      'http://localhost:' + port + '/Message/Message.dll?Handler=Default',
    );
  });
});

function cbCaller(client, methodName, requestJSON, responseJSON, responseSoapHeaderJSON, options, attachmentParts, done) {
  client[methodName](
    requestJSON,
    function (err, json, body, soapHeader) {
      if (requestJSON) {
        if (err) {
          assert.notEqual('undefined: undefined', err.message);
          assert.deepEqual(err.root, responseJSON);
        } else {
          // assert.deepEqual(json, responseJSON);
          assert.deepEqual(json ?? null, responseJSON);
          if (responseSoapHeaderJSON) {
            assert.deepEqual(soapHeader, responseSoapHeaderJSON);
          }
          if (client.lastResponseAttachments) {
            assert.deepEqual(client.lastResponseAttachments.parts, attachmentParts);
          }
        }
      }
      done();
    },
    options,
  );
}
