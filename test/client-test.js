'use strict';

var fs = require('fs'),
  soap = require('..'),
  http = require('http'),
  stream = require('stream'),
  assert = require('assert'),
  _ = require('lodash'),
  sinon = require('sinon'),
  wsdl = require('../lib/wsdl');

[
  { suffix: '', options: {} },
  { suffix: ' (with streaming)', options: { stream: true } },
].forEach(function (meta) {
  describe('SOAP Client' + meta.suffix, function () {
    it('should error on invalid host', function (done) {
      soap.createClient('http://localhost:1', meta.options, function (err, client) {
        assert.ok(err);
        done();
      });
    });

    it('should detect uppercase schemas as urls', function (done) {
      soap.createClient('HTTP://localhost:1', function (err, client) {
        assert.ok(err)
        // ECONNREFUSED indicates that the WSDL path is being evaluated as a URL
        // If instead ENOENT is returned, the WSDL path is being evaluated (incorrectly)
        // as a file system path
        assert.equal(err.code, 'ECONNREFUSED');

        done();
      });
    });

    it('should add and clear soap headers', function (done) {
      soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
        assert.ok(client);
        assert.ok(!client.getSoapHeaders());

        var i1 = client.addSoapHeader('about-to-change-1');
        var i2 = client.addSoapHeader('about-to-change-2');

        assert.ok(i1 === 0);
        assert.ok(i2 === 1);
        assert.ok(client.getSoapHeaders().length === 2);

        client.changeSoapHeader(0, 'header1');
        client.changeSoapHeader(1, 'header2');
        assert.ok(client.getSoapHeaders()[0] === 'header1');
        assert.ok(client.getSoapHeaders()[1] === 'header2');

        client.clearSoapHeaders();
        assert.ok(!client.getSoapHeaders());
        done();
      });
    });

    it('should issue async callback for cached wsdl', function (done) {
      var called = false;
      soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
        assert.ok(client);
        assert.ifError(err);
        called = true;
        done();
      });
      assert(!called);
    });

    it('should allow customization of httpClient', function (done) {
      var myHttpClient = {
        request: function () { }
      };
      soap.createClient(__dirname + '/wsdl/default_namespace.wsdl',
        Object.assign({ httpClient: myHttpClient }, meta.options),
        function (err, client) {
          assert.ok(client);
          assert.ifError(err);
          assert.equal(client.httpClient, myHttpClient);
          done();
        });
    });

    it('should allow customization of request for http client', function (done) {
      var myRequest = function () {
      };
      soap.createClient(__dirname + '/wsdl/default_namespace.wsdl',
        Object.assign({ request: myRequest }, meta.options),
        function (err, client) {
          assert.ok(client);
          assert.ifError(err);
          assert.equal(client.httpClient._request, myRequest);
          done();
        });
    });


    it('should allow customization of envelope', function (done) {
      soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', Object.assign({ envelopeKey: 'soapenv' }, meta.options), function (err, client) {
        assert.ok(client);
        assert.ifError(err);

        client.MyOperation({}, function (err, result) {
          assert.notEqual(client.lastRequest.indexOf('xmlns:soapenv='), -1);
          done();
        });
      });
    });


    it('should allow passing in XML strings', function (done) {
      soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', Object.assign({ envelopeKey: 'soapenv' }, meta.options), function (err, client) {
        assert.ok(client);
        assert.ifError(err);

        var xmlStr = '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">\n\t<head>\n\t\t<title>404 - Not Found</title>\n\t</head>\n\t<body>\n\t\t<h1>404 - Not Found</h1>\n\t\t<script type="text/javascript" src="http://gp1.wpc.edgecastcdn.net/00222B/beluga/pilot_rtm/beluga_beacon.js"></script>\n\t</body>\n</html>';
        client.MyOperation({ _xml: xmlStr }, function (err, result, raw, soapHeader) {
          assert.ok(err);
          assert.notEqual(raw.indexOf('html'), -1);
          done();
        });
      });
    });

    it('should set binding style to "document" by default if not explicitly set in WSDL, per SOAP spec', function (done) {
      soap.createClient(__dirname + '/wsdl/binding_document.wsdl', meta.options, function (err, client) {
        assert.ok(client);
        assert.ifError(err);

        assert.ok(client.wsdl.definitions.bindings.mySoapBinding.style === 'document');
        done();
      });
    });


    it('should allow disabling the wsdl cache', function (done) {
      var spy = sinon.spy(wsdl, 'open_wsdl');
      var options = Object.assign({ disableCache: true }, meta.options);
      soap.createClient(__dirname + '/wsdl/binding_document.wsdl', options, function (err1, client1) {
        assert.ok(client1);
        assert.ok(!err1);
        soap.createClient(__dirname + '/wsdl/binding_document.wsdl', options, function (err2, client2) {
          assert.ok(client2);
          assert.ok(!err2);
          assert.ok(spy.calledTwice);
          wsdl.open_wsdl.restore();
          done();
        });
      });
    });

    describe('Binary attachments handling', function () {
      var server = null;
      var hostname = '127.0.0.1';
      var port = 15099;
      var baseUrl = 'http://' + hostname + ':' + port;
      var attachment = {
        mimetype: 'image/png',
        contentId: 'file_0',
        name: 'nodejs.png',
        body: fs.createReadStream(__dirname + '/static/nodejs.png')
      };

      function parsePartHeaders(part) {
        const headersAndBody = part.split(/\r\n\r\n/);
        const headersParts = headersAndBody[0].split(/\r\n/);
        const headers = {};
        headersParts.forEach(header => {
          let index;
          if ((index = header.indexOf(':')) > -1) {
            headers[header.substring(0, index)] = header.substring(index + 1).trim();
          }
        });
        return headers;
      }

      it('should send binary attachments using XOP + MTOM', function (done) {
        server = http.createServer((req, res) => {
          const bufs = [];
          req.on('data', function (chunk) {
            bufs.push(chunk);
          });
          req.on('end', function () {
            const body = Buffer.concat(bufs).toString().trim();
            const headers = req.headers;
            const boundary = headers['content-type'].match(/boundary="?([^"]*"?)/)[1];
            const parts = body.split(new RegExp('--' + boundary + '-{0,2}'))
              .filter(part => part)
              .map(parsePartHeaders);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ contentType: headers['content-type'], parts: parts }), 'utf8');
          });
        }).listen(port, hostname, function () {

          soap.createClient(__dirname + '/wsdl/attachments.wsdl', meta.options, function (initError, client) {
            assert.ifError(initError);

            client.MyOperation({}, function (error, response, body) {
              assert.ifError(error);
              const contentType = {};
              body.contentType.split(/;\s?/).forEach(dir => {
                const keyValue = dir.match(/(.*)="?([^"]*)?/);
                if (keyValue && keyValue.length > 2) {
                  contentType[keyValue[1].trim()] = keyValue[2].trim();
                } else {
                  contentType.rootType = dir;
                }
              });
              assert.equal(contentType.rootType, 'multipart/related');

              /* does not handle attachements */
              // assert.equal(body.parts.length, 2);

              // const dataHeaders = body.parts[0];
              // assert(dataHeaders['Content-Type'].indexOf('application/xop+xml') > -1);
              // assert.equal(dataHeaders['Content-ID'], contentType.start);

              // const attachmentHeaders = body.parts[1];
              // assert.equal(attachmentHeaders['Content-Type'], attachment.mimetype);
              // assert.equal(attachmentHeaders['Content-Transfer-Encoding'], 'binary');
              // assert.equal(attachmentHeaders['Content-ID'], '<' + attachment.contentId + '>');
              // assert(attachmentHeaders['Content-Disposition'].indexOf(attachment.name) > -1);

              server.close();
              done();
            }, { attachments: [attachment] });
          }, baseUrl);
        });
      });
    });

    describe('SOAP 1.2 and MTOM binary data', function () {
      var server = null;
      var hostname = '127.0.0.1';
      var port = 15099;
      var baseUrl = 'http://' + hostname + ':' + port;

      var attachment = {
        mimetype: 'image/png',
        contentId: 'file_0',
        name: 'nodejs.png',
        body: fs.createReadStream(__dirname + '/static/nodejs.png')
      };

      function parsePartHeaders(part) {
        const headersAndBody = part.split(/\r\n\r\n/);
        const headersParts = headersAndBody[0].split(/\r\n/);
        const headers = {};
        headersParts.forEach(header => {
          let index;
          if ((index = header.indexOf(':')) > -1) {
            headers[header.substring(0, index)] = header.substring(index + 1).trim();
          }
        });
        return headers;
      }

      before(function (done) {
        server = http.createServer(function (req, res) {
          var bufs = [];
          req.on('data', function (chunk) {
            bufs.push(chunk);
          });
          req.on('end', function () {
            const body = Buffer.concat(bufs).toString().trim();
            const headers = req.headers;
            const boundary = headers['content-type'].match(/boundary="?([^"]*"?)/)[1];
            const parts = body.split(new RegExp('--' + boundary + '-{0,2}'))
              .filter(part => part)
              .map(parsePartHeaders);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ contentType: headers['content-type'], parts: parts }), 'utf8');
          });
        }).listen(port, hostname, done);
      });

      after(function (done) {
        server.close();
        server = null;
        done();
      });

      it('Should preserve SOAP 1.2 "action" header when sending MTOM request', function (done) {
        soap.createClient(__dirname + '/wsdl/attachments.wsdl', Object.assign({ forceSoap12Headers: true }, meta.options), function (initError, client) {
          assert.ifError(initError);

          client.MyOperation({}, function (error, response, body, soapHeader, rawRequest) {
            assert.ifError(error);
            assert(body.contentType.indexOf('action') > -1);
            done();
          }, { attachments: [attachment] })
        }, baseUrl)
      })

      it('Should send MTOM request even without attachment', function (done) {
        soap.createClient(__dirname + '/wsdl/attachments.wsdl', Object.assign({ forceSoap12Headers: true }, meta.options), function (initError, client) {
          assert.ifError(initError);

          client.MyOperation({}, function (error, response, body, soapHeader, rawRequest) {
            assert.ifError(error);
            const contentType = {};
            body.contentType.split(/;\s?/).forEach(dir => {
              const keyValue = dir.match(/(.*)="?([^"]*)?/);
              if (keyValue && keyValue.length > 2) {
                contentType[keyValue[1].trim()] = keyValue[2].trim();
              } else {
                contentType.rootType = dir;
              }
            });
            assert.equal(contentType.rootType, 'multipart/related');
            /** does not handle attachements */
            // assert.equal(body.parts.length, 1);

            // const dataHeaders = body.parts[0];
            // assert(dataHeaders['Content-Type'].indexOf('application/xop+xml') > -1);
            // assert.equal(dataHeaders['Content-ID'], contentType.start);
            done();
          }, { forceMTOM: true })
        }, baseUrl)
      })
    })

    describe('Headers in request and last response', function () {
      var server = null;
      var hostname = '127.0.0.1';
      var port = 15099;
      var baseUrl = 'http://' + hostname + ':' + port;

      before(function (done) {
        server = http.createServer(function (req, res) {
          var status_value = (req.headers['test-header'] === 'test') ? 'pass' : 'fail';

          res.setHeader('status', status_value);
          res.statusCode = 200;
          res.write(JSON.stringify({ tempResponse: 'temp' }), 'utf8');
          res.end();
        }).listen(port, hostname, done);
      });

      after(function (done) {
        server.close();
        server = null;
        done();
      });

      it('should append `:' + port + '` to the Host header on for a request to a service on that port', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          assert.ok(client);
          assert.ifError(err);

          client.MyOperation({}, function () {
            assert.notEqual(client.lastRequestHeaders.Host.indexOf(':' + port), -1);
            done();
          }, null, { 'test-header': 'test' });
        }, baseUrl);
      });

      it('should not append `:80` to the Host header on for a request to a service without a port explicitly defined', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          assert.ok(client);
          assert.ifError(err);

          client.MyOperation({}, function () {
            assert.equal(client.lastRequestHeaders.Host.indexOf(':80'), -1);
            done();
          }, null, { 'test-header': 'test' });
        }, 'http://127.0.0.1');
      });

      it('should not append `:443` to the Host header if endpoints runs on `https`', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          assert.ok(client);
          assert.ifError(err);

          client.MyOperation({}, function () {
            assert.equal(client.lastRequestHeaders.Host.indexOf(':443'), -1);
            done();
          }, null, { 'test-header': 'test' });
        }, 'https://127.0.0.1');
      });

      it('should append a port to the Host header if explicitly defined', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          assert.ok(client);
          assert.ifError(err);

          client.MyOperation({}, function () {
            assert.ok(client.lastRequestHeaders.Host.indexOf(':443') > -1);
            done();
          }, null, { 'test-header': 'test' });
        }, 'https://127.0.0.1:443');
      });


      it('should have xml request modified', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          assert.ok(client);
          assert.ifError(err);

          client.MyOperation({}, function (err, result) {
            assert.ok(result);
            assert.ok(client.lastResponse);
            assert.ok(client.lastResponseHeaders);

            done();
          }, {
            postProcess: function (_xml) {
              return _xml.replace('soap', 'SOAP');
            }
          }
          );
        }, baseUrl);
      });

      it('should have the correct extra header in the request', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          assert.ok(client);
          assert.ifError(err);

          client.MyOperation({}, function (err, result) {
            assert.ok(result);
            assert.ok(client.lastResponseHeaders);
            assert.equal(client.lastResponseHeaders.status, 'pass');

            done();
          }, null, { 'test-header': 'test' });
        }, baseUrl);
      });

      it('should have the wrong extra header in the request', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          assert.ok(client);
          assert.ifError(err);

          client.MyOperation({}, function (err, result) {
            assert.ok(result);
            assert.ok(client.lastResponseHeaders);
            assert.equal(client.lastResponseHeaders.status, 'fail');

            done();
          }, null, { 'test-header': 'testBad' });
        }, baseUrl);
      });

      it('should have lastResponse and lastResponseHeaders after the call', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          assert.ok(client);
          assert.ifError(err);

          client.MyOperation({}, function (err, result) {
            assert.ok(result);
            assert.ok(client.lastResponse);
            assert.ok(client.lastResponseHeaders);

            done();
          }, null, { 'test-header': 'test' });
        }, baseUrl);
      });

      it('should remove add httpHeaders after the call', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          assert.ok(client);
          assert.ifError(err);

          client.addHttpHeader('foo', 'bar');
          assert.equal(client.getHttpHeaders().foo, 'bar');

          client.clearHttpHeaders();
          assert.equal(client.getHttpHeaders(), null);

          client.MyOperation({}, function (err, result) {
            assert.ok(result);
            assert.equal(client.lastRequestHeaders.foo, undefined);

            done();
          });
        }, baseUrl);
      });

      it('should have rawRequest available in the callback', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          assert.ok(client);
          assert.ifError(err);

          client.MyOperation({}, function (err, result, rawResponse, headers, rawRequest) {
            assert.ok(rawRequest);
            assert.ok(typeof rawRequest === 'string');

            done();
          }, null, { 'test-header': 'test' });
        }, baseUrl);
      });

      it('should have lastElapsedTime after a call with the time option passed', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          assert.ok(client);
          assert.ifError(err);

          client.MyOperation({}, function (err, result) {
            assert.ok(result);
            assert.ok(client.lastResponse);
            assert.ok(client.lastResponseHeaders);
            assert.ok(client.lastElapsedTime);

            done();
          }, { time: true }, { 'test-header': 'test' });
        }, baseUrl);
      });

      it('should add http headers in method call options', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          assert.ok(client);
          assert.ifError(err);

          client.MyOperation({}, function (err, result) {
            assert.ok(result);
            assert.ok(client.lastRequestHeaders['test-header']);
            assert.ok(client.lastRequestHeaders['options-test-header']);

            done();
          }, { headers: { 'options-test-header': 'test' } }, { 'test-header': 'test' });
        }, baseUrl);
      });

      it('should not return error in the call and return the json in body', function (done) {
        soap.createClient(__dirname + '/wsdl/json_response.wsdl', meta.options, function (err, client) {
          assert.ok(client);
          assert.ifError(err);

          client.MyOperation({}, function (err, result, body) {
            assert.ok(result);
            assert.ifError(err);
            assert.ok(body);
            done();
          }, null, { "test-header": 'test' });
        }, baseUrl);
      });

      it('should add proper headers for soap12', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace_soap12.wsdl', Object.assign({ forceSoap12Headers: true }, meta.options), function (err, client) {
          assert.ok(client);
          assert.ifError(err);

          client.MyOperation({}, function (err, result) {
            assert.ok(result);
            assert.ok(client.lastRequestHeaders);
            assert.ok(client.lastRequest);
            assert.equal(client.lastRequestHeaders['Content-Type'], 'application/soap+xml; charset=utf-8; action="MyOperation"');
            assert.notEqual(client.lastRequest.indexOf('xmlns:soap=\"http://www.w3.org/2003/05/soap-envelope\"'), -1);
            assert(!client.lastRequestHeaders.SOAPAction);
            done();
          }, null, { 'test-header': 'test' });
        }, baseUrl);
      });

      it('should allow calling the method with args, callback, options and extra headers', function (done) {
        soap.createClient(__dirname + '/wsdl/json_response.wsdl', meta.options, function (err, client) {
          assert.ok(client);
          assert.ifError(err);

          client.MyOperation({}, function (err, result, body) {
            assert.ifError(err);
            assert.ok(result);
            assert.ok(body.tempResponse === 'temp');
            assert.ok(client.lastResponseHeaders.status === 'pass');
            assert.ok(client.lastRequestHeaders['options-test-header'] === 'test');

            done();
          }, { headers: { 'options-test-header': 'test' } }, { 'test-header': 'test' });
        }, baseUrl);
      });

      it('should allow calling the method with only a callback', function (done) {
        soap.createClient(__dirname + '/wsdl/json_response.wsdl', meta.options, function (err, client) {
          assert.ok(client);
          assert.ifError(err);

          client.MyOperation(function (err, result, body) {
            assert.ifError(err);
            assert.ok(result);
            assert.ok(body.tempResponse === 'temp');
            assert.ok(client.lastResponseHeaders.status === 'fail');

            done();
          });
        }, baseUrl);
      });

      it('should allow calling the method with args, options and callback last', function (done) {
        soap.createClient(__dirname + '/wsdl/json_response.wsdl', meta.options, function (err, client) {
          assert.ok(client);
          assert.ifError(err);

          client.MyOperation({}, { headers: { 'options-test-header': 'test' } }, function (err, result, body) {
            assert.ifError(err);
            assert.ok(result);
            assert.ok(body.tempResponse === 'temp');
            assert.ok(client.lastResponseHeaders.status === 'fail');
            assert.ok(client.lastRequestHeaders['options-test-header'] === 'test');

            done();
          });
        }, baseUrl);
      });

      it('should allow calling the method with args, options, extra headers and callback last', function (done) {
        soap.createClient(__dirname + '/wsdl/json_response.wsdl', meta.options, function (err, client) {
          assert.ok(client);
          assert.ifError(err);

          client.MyOperation({}, { headers: { 'options-test-header': 'test' } }, { 'test-header': 'test' }, function (err, result, body) {
            assert.ifError(err);
            assert.ok(result);
            assert.ok(body.tempResponse === 'temp');
            assert.ok(client.lastResponseHeaders.status === 'pass');
            assert.ok(client.lastRequestHeaders['options-test-header'] === 'test');

            done();
          });
        }, baseUrl);
      });
    });

    it('should add soap headers', function (done) {
      soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
        assert.ok(client);
        assert.ok(!client.getSoapHeaders());
        var soapheader = {
          'esnext': false,
          'moz': true,
          'boss': true,
          'node': true,
          'validthis': true,
          'globals': {
            'EventEmitter': true,
            'Promise': true
          }
        };

        client.addSoapHeader(soapheader);

        assert.ok(client.getSoapHeaders()[0] === '<esnext>false</esnext><moz>true</moz><boss>true</boss><node>true</node><validthis>true</validthis><globals><EventEmitter>true</EventEmitter><Promise>true</Promise></globals>');
        done();
      });
    });

    it('should add dynamic soap headers', function (done) {
      soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
        assert.ok(client);
        assert.ok(!client.getSoapHeaders());
        let random;
        function dynamicHeader(method, location, soapAction, args) {
          random = Math.floor(Math.random() * 65536);
          return {
            TeSt_location: location,
            TeSt_action: soapAction,
            TeSt_random: random
          };
        }

        client.addSoapHeader(dynamicHeader);
        assert.ok(typeof client.getSoapHeaders()[0] === 'function');
        client.MyOperation({}, function (err, result) {
          assert.notEqual(client.lastRequest.indexOf('<TeSt_location>http://www.example.com/v1</TeSt_location>'), -1);
          assert.notEqual(client.lastRequest.indexOf('<TeSt_action>MyOperation</TeSt_action>'), -1);
          assert.notEqual(client.lastRequest.indexOf(`<TeSt_random>${random}</TeSt_random>`), -1);
          done();
        });
      });
    });

    it('should add soap headers with a namespace', function (done) {
      soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
        assert.ok(client);
        assert.ok(!client.getSoapHeaders());

        client.addSoapHeader({ header1: 'content' }, null, null, 'http://example.com');

        assert.ok(client.getSoapHeaders().length === 1);
        assert.ok(client.getSoapHeaders()[0] === '<header1 xmlns="http://example.com">content</header1>');

        client.clearSoapHeaders();
        assert.ok(!client.getSoapHeaders());
        done();
      });
    });

    it('should add http headers', function (done) {
      soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
        assert.ok(client);
        assert.ok(!client.getHttpHeaders());

        client.addHttpHeader('foo', 'bar');

        assert.ok(client.getHttpHeaders());
        assert.equal(client.getHttpHeaders().foo, 'bar');

        client.clearHttpHeaders();
        assert.equal(client.getHttpHeaders(), null);
        done();
      });
    });

    describe('Namespace number', function () {
      var server = null;
      var hostname = '127.0.0.1';
      var port = 15099;
      var baseUrl = 'http://' + hostname + ':' + port;

      before(function (done) {
        server = http.createServer(function (req, res) {
          res.statusCode = 200;
          res.write(JSON.stringify({ tempResponse: 'temp' }), 'utf8');
          res.end();
        }).listen(port, hostname, done);
      });

      after(function (done) {
        server.close();
        server = null;
        done();
      });

      it('should reset the namespace number', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          assert.ok(client);

          var data = {
            attributes: {
              xsi_type: {
                type: 'Ty',
                xmlns: 'xmlnsTy'
              }
            }
          };

          var message = '<Request xsi:type="ns1:Ty" xmlns:ns1="xmlnsTy" xmlns="http://www.example.com/v1"></Request>';
          client.MyOperation(data, function (err, result) {
            assert.ok(client.lastRequest);
            assert.ok(client.lastMessage);
            assert.ok(client.lastEndpoint);
            assert.equal(client.lastMessage, message);

            delete data.attributes.xsi_type.namespace;
            client.MyOperation(data, function (err, result) {
              assert.ok(client.lastRequest);
              assert.ok(client.lastMessage);
              assert.ok(client.lastEndpoint);
              assert.equal(client.lastMessage, message);

              done();
            });
          });
        }, baseUrl);
      });

      it("should handle xsi:type without xmlns", function (done) {
        soap.createClient(
          __dirname + "/wsdl/default_namespace.wsdl",
          meta.options,
          function (err, client) {
            assert.ok(client);

            var data = {
              element: {
                attributes: {
                  xsi_type: {
                    type: "Ty",
                  },
                },
                $value: "Hello World",
              },
            };

            var message =
              '<Request xmlns="http://www.example.com/v1"><element xsi:type="Ty">Hello World</element></Request>';

            client.MyOperation(data, function (err, result) {
              assert.ok(client.lastRequest);
              assert.ok(client.lastMessage);
              assert.ok(client.lastEndpoint);
              console.log(client.lastMessage)
              assert.strictEqual(client.lastMessage, message);
              done();
            });
          },
          baseUrl
        );
      });
    });

    describe('Follow even non-standard redirects', function () {
      var server1 = null;
      var server2 = null;
      var server3 = null;
      var hostname = '127.0.0.1';
      var port = 15099;
      var baseUrl = 'http://' + hostname + ':' + port;

      before(function (done) {
        server1 = http.createServer(function (req, res) {
          res.statusCode = 301;
          res.setHeader('Location', 'http://' + hostname + ':' + (port + 1));
          res.end();
        }).listen(port, hostname, function () {
          server2 = http.createServer(function (req, res) {
            res.statusCode = 302;
            res.setHeader('Location', 'http://' + hostname + ':' + (port + 2));
            res.end();
          }).listen((port + 1), hostname, function () {
            server3 = http.createServer(function (req, res) {
              res.statusCode = 401;
              res.write(JSON.stringify({ tempResponse: 'temp' }), 'utf8');
              res.end();
            }).listen((port + 2), hostname, done);
          });
        });
      });

      after(function (done) {
        server1.close();
        server2.close();
        server3.close();
        server1 = null;
        server2 = null;
        server3 = null;
        done();
      });

      it('should return an error', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          client.MyOperation({}, function (err, result) {
            assert.ok(err);
            assert.ok(err.response);
            assert.equal(err.body, '{"tempResponse":"temp"}');
            done();
          });
        }, baseUrl);
      });
    });

    // TODO:
    // It seems to be an invalid test case that should be removed.
    // It verifies that error should be returned when receiving incorrect response and it's irrelevant to http status code.
    describe('Handle invalid http response', function () {
      var server = null;
      var hostname = '127.0.0.1';
      var port = 15099;
      var baseUrl = 'http://' + hostname + ':' + port;

      before(function (done) {
        server = http.createServer(function (req, res) {
          res.statusCode = 401; // This test case is nothing to do with status code. Set to 200 doesn't break test.
          res.write(JSON.stringify({ tempResponse: 'temp' }), 'utf8');
          res.end();
        }).listen(port, hostname, done);
      });

      after(function (done) {
        server.close();
        server = null;
        done();
      });

      it('should return an error', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          client.MyOperation({}, function (err, result) {
            assert.ok(err);
            assert.ok(err.response);
            assert.ok(err.response.data);
            done();
          });
        }, baseUrl);
      });

      it('should emit a \'soapError\' event', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          client.on('soapError', function (err) {
            assert.ok(err);
          });
          client.MyOperation({}, function (err, result) {
            done();
          });
        }, baseUrl);
      });
    });

    describe('Handle non-success http status codes without response body', function () {
      var server = null;
      var hostname = '127.0.0.1';
      var port = 15099;
      var baseUrl = `http://${hostname}:${port}`;

      before(function (done) {
        server = http.createServer(function (req, res) {
          res.statusCode = 404;
          res.end();
        }).listen(port, hostname, done);
      });

      after(function (done) {
        server.close();
        server = null;
        done();
      });

      it('should return an error', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          client.MyOperation({}, function (err, result) {
            assert.ok(err);
            assert.ok(err.response);
            done();
          });
        }, baseUrl);
      });

      it('should emit a \'soapError\' event', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          client.on('soapError', function (err) {
            assert.ok(err);
          });
          client.MyOperation({}, function (err, result) {
            done();
          });
        }, baseUrl);
      });
    });

    describe('Handle HTML answer from non-SOAP server', function () {
      var server = null;
      var hostname = '127.0.0.1';
      var port = 15099;
      var baseUrl = 'http://' + hostname + ':' + port;

      before(function (done) {
        server = http.createServer(function (req, res) {
          res.statusCode = 200;
          res.write('<html><body></body></html>', 'utf8');
          res.end();
        }).listen(port, hostname, done);
      });

      after(function (done) {
        server.close();
        server = null;
        done();
      });

      it('should return an error', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          client.MyOperation({}, function (err, result) {
            assert.ok(err);
            assert.ok(err.response);
            assert.ok(err.body);
            done();
          });
        }, baseUrl);
      });
    });

    describe('Client Events', function () {
      var server = null;
      var hostname = '127.0.0.1';
      var port = 15099;
      var baseUrl = 'http://' + hostname + ":" + port;

      before(function (done) {
        server = http.createServer(function (req, res) {
          res.statusCode = 200;
          fs.createReadStream(__dirname + '/soap-failure.xml').pipe(res);
        }).listen(port, hostname, done);
      });

      after(function (done) {
        server.close();
        server = null;
        done();
      });


      it('Should emit the "message" event with Soap Body string and an exchange id', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          var didEmitEvent = false;
          client.on('message', function (xml, eid) {
            didEmitEvent = true;
            // Should contain only message body
            assert.equal(typeof xml, 'string');
            assert.equal(xml.indexOf('soap:Envelope'), -1);
            assert.ok(eid);
          });

          client.MyOperation({}, function () {
            assert.ok(didEmitEvent);
            done();
          });
        }, baseUrl);
      });

      it('Should emit the "request" event with entire XML message and an exchange id', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          var didEmitEvent = false;
          client.on('request', function (xml, eid) {
            didEmitEvent = true;
            // Should contain entire soap message
            assert.equal(typeof xml, 'string');
            assert.notEqual(xml.indexOf('soap:Envelope'), -1);
            assert.ok(eid);
          });

          client.MyOperation({}, function () {
            assert.ok(didEmitEvent);
            done();
          });
        }, baseUrl);
      });

      it('Should emit the "response" event with Soap Body string and Response object and an exchange id', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          var didEmitEvent = false;
          client.on('response', function (xml, response, eid) {
            didEmitEvent = true;
            // Should contain entire soap message
            assert.equal(typeof xml, 'string');
            assert.equal(xml.indexOf('soap:Envelope'), -1);
            assert.ok(response);
            assert.ok(eid);
          });

          client.MyOperation({}, function () {
            assert.ok(didEmitEvent);
            done();
          });
        }, baseUrl);
      });

      it('Should emit the "request" and "response" events with the same generated exchange id if none is given', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          var didEmitRequestEvent = false;
          var didEmitResponseEvent = false;
          var requestEid, responseEid;

          client.on('request', function (xml, eid) {
            didEmitRequestEvent = true;
            requestEid = eid;
            assert.ok(eid);
          });

          client.on('response', function (xml, response, eid) {
            didEmitResponseEvent = true;
            responseEid = eid;
            assert.ok(eid);
          });

          client.MyOperation({}, function () {
            assert.ok(didEmitRequestEvent);
            assert.ok(didEmitResponseEvent);
            assert.equal(responseEid, requestEid);
            done();
          });
        }, baseUrl);
      });

      it('Should emit the "request" and "response" events with the given exchange id', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          var didEmitRequestEvent = false;
          var didEmitResponseEvent = false;
          var requestEid, responseEid;

          client.on('request', function (xml, eid) {
            didEmitRequestEvent = true;
            requestEid = eid;
            assert.ok(eid);
          });

          client.on('response', function (xml, response, eid) {
            didEmitResponseEvent = true;
            responseEid = eid;
            assert.ok(eid);
          });

          client.MyOperation({}, function () {
            assert.ok(didEmitRequestEvent);
            assert.ok(didEmitResponseEvent);
            assert.equal('unit', requestEid);
            assert.equal(responseEid, requestEid);
            done();
          }, { exchangeId: 'unit' });
        }, baseUrl);
      });

      it('should emit a \'soapError\' event with an exchange id', function (done) {
        soap.createClient(__dirname + '/wsdl/default_namespace.wsdl', meta.options, function (err, client) {
          var didEmitEvent = false;
          client.on('soapError', function (err, eid) {
            didEmitEvent = true;
            assert.ok(err.root.Envelope.Body.Fault);
            assert.ok(eid);
          });
          client.MyOperation({}, function (err, result) {
            assert.ok(didEmitEvent);
            done();
          });
        }, baseUrl);
      });

    });

    [200, 500].forEach(statusCode => {
      it('should return error in the call when Fault was returned (status code ' + statusCode + ')', function (done) {
        var server = null;
        var hostname = '127.0.0.1';
        var port = 15099;
        var baseUrl = 'http://' + hostname + ':' + port;

        server = http.createServer(function (req, res) {
          res.statusCode = statusCode;
          res.write("<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?><SOAP-ENV:Envelope SOAP-ENV:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\"\n  xmlns:SOAP-ENV=\"http://schemas.xmlsoap.org/soap/envelope/\"\n  xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\"\n  xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"\n  xmlns:SOAP-ENC=\"http://schemas.xmlsoap.org/soap/encoding/\">\n<SOAP-ENV:Body><SOAP-ENV:Fault><faultcode xsi:type=\"xsd:string\">Test</faultcode><faultactor xsi:type=\"xsd:string\"></faultactor><faultstring xsi:type=\"xsd:string\">test error</faultstring><detail xsi:type=\"xsd:string\">test detail</detail></SOAP-ENV:Fault></SOAP-ENV:Body></SOAP-ENV:Envelope>");
          res.end();
        }).listen(port, hostname, function () {
          soap.createClient(__dirname + '/wsdl/json_response.wsdl', meta.options, function (err, client) {
            assert.ok(client);
            assert.ifError(err);

            client.MyOperation({}, function (err, result, body) {
              server.close();
              server = null;
              assert.ok(err);
              assert.strictEqual(err.message, 'Test: test error: "test detail"');
              assert.ok(result);
              assert.ok(body);
              done();
            });
          }, baseUrl);
        });

      });
    });

    it('should return error in the call when Body was returned empty', function (done) {
      var server = null;
      var hostname = '127.0.0.1';
      var port = 15099;
      var baseUrl = 'http://' + hostname + ':' + port;

      server = http.createServer(function (req, res) {
        res.statusCode = 200;
        res.write("<soapenv:Envelope xmlns:soapenv='http://schemas.xmlsoap.org/soap/envelope/'><soapenv:Body/></soapenv:Envelope>");
        res.end();
      }).listen(port, hostname, function () {
        soap.createClient(__dirname + '/wsdl/empty_body.wsdl', meta.options, function (err, client) {
          assert.ok(client);
          assert.ifError(err);

          client.MyOperation({}, function (err, result, body, responseSoapHeaders) {
            server.close();
            server = null;
            assert.ifError(err);
            assert.ok(!responseSoapHeaders);
            assert.ok(result);
            assert.ok(body);
            done();
          });
        }, baseUrl);
      });
    });

    describe('Method invocation', function () {

      it('shall generate correct payload for methods with string parameter', function (done) {
        // Mock the http post function in order to easy be able to validate the generated payload
        var stringParameterValue = 'MY_STRING_PARAMETER_VALUE';
        var expectedSoapBody = '<sstringElement xmlns="http://www.BuiltinTypes.com/">' + stringParameterValue + '</sstringElement>';
        var request = null;
        var mockRequestHandler = function (_request) {
          request = _request;
          return Promise.resolve(request);
        };
        var options = Object.assign({ request: mockRequestHandler, }, meta.options);
        soap.createClient(__dirname + '/wsdl/builtin_types.wsdl', options, function (err, client) {
          assert.ok(client);

          // Call the method
          client.StringOperation(stringParameterValue, () => { });

          // Analyse and validate the generated soap body
          var requestBody = request.data;
          var soapBody = requestBody.match(/<soap:Body>(.*)<\/soap:Body>/)[1];
          assert.ok(soapBody === expectedSoapBody);
          done();
        });
      });

      it('shall generate correct payload for methods with array parameter', function (done) {
        soap.createClient(__dirname + '/wsdl/list_parameter.wsdl', function (err, client) {
          assert.ok(client);
          var pathToArrayContainer = 'TimesheetV201511Mobile.TimesheetV201511MobileSoap.AddTimesheet.input.input.PeriodList';
          var arrayParameter = _.get(client.describe(), pathToArrayContainer)['PeriodType[]'];
          assert.ok(arrayParameter);
          client.AddTimesheet({ input: { PeriodList: { PeriodType: [{ PeriodId: '1' }] } } }, function () {
            var sentInputContent = client.lastRequest.substring(client.lastRequest.indexOf('<input>') + '<input>'.length, client.lastRequest.indexOf('</input>'));
            assert.equal(sentInputContent, '<PeriodList><PeriodType><PeriodId>1</PeriodId></PeriodType></PeriodList>');
            done();
          });
        });
      });

      it('shall generate correct payload for methods with array parameter with colon override', function (done) {
        soap.createClient(__dirname + '/wsdl/array_namespace_override.wsdl', function (err, client) {
          assert.ok(client);
          var pathToArrayContainer = 'SampleArrayServiceImplService.SampleArrayServiceImplPort.createWebOrder.input.order';
          var arrayParameter = _.get(client.describe(), pathToArrayContainer)['orderDetails[]'];
          assert.ok(arrayParameter);
          const input = {
            ':clientId': 'test',
            ':order': {
              ':orderDetails': {
                ':unitNo': 1234,
                ':items': [{ ':itemDesc': 'item1' }, { ':itemDesc': 'item2' }]
              },
            },
          };
          client.createWebOrder(input, function () {
            var sentInputContent = client.lastRequest.substring(client.lastRequest.indexOf('<items>'), client.lastRequest.lastIndexOf('</items>') + '</items>'.length);
            assert.equal(sentInputContent, '<items><itemDesc>item1</itemDesc></items><items><itemDesc>item2</itemDesc></items>');
            done();
          });
        });
      });

      it('shall generate correct payload for methods with array parameter with parent namespace', function (done) {
        soap.createClient(__dirname + '/wsdl/array_namespace_override.wsdl', function (err, client) {
          assert.ok(client);
          var pathToArrayContainer = 'SampleArrayServiceImplService.SampleArrayServiceImplPort.createWebOrder.input.order';
          var arrayParameter = _.get(client.describe(), pathToArrayContainer)['orderDetails[]'];
          assert.ok(arrayParameter);
          const input = {
            ':clientId': 'test',
            ':order': {
              'orderDetails': {
                ':unitNo': 1234,
                'items': [{ ':itemDesc': 'item1' }, { ':itemDesc': 'item2' }]
              },
            },
          };
          client.createWebOrder(input, function () {
            var sentInputContent = client.lastRequest.substring(client.lastRequest.indexOf('<ns1:items>'), client.lastRequest.lastIndexOf('</ns1:items>') + '</ns1:items>'.length);
            assert.equal(sentInputContent, '<ns1:items><itemDesc>item1</itemDesc></ns1:items><ns1:items><itemDesc>item2</itemDesc></ns1:items>');
            done();
          });
        });
      });

      it('shall generate correct payload for methods with array parameter when individual array elements are not namespaced', function (done) {
        // used for servers that cannot aggregate individually namespaced array elements
        soap.createClient(__dirname + '/wsdl/list_parameter.wsdl', { disableCache: true, namespaceArrayElements: false }, function (err, client) {
          assert.ok(client);
          var pathToArrayContainer = 'TimesheetV201511Mobile.TimesheetV201511MobileSoap.AddTimesheet.input.input.PeriodList';
          var arrayParameter = _.get(client.describe(), pathToArrayContainer)['PeriodType[]'];
          assert.ok(arrayParameter);
          client.AddTimesheet({ input: { PeriodList: { PeriodType: [{ PeriodId: '1' }, { PeriodId: '2' }] } } }, function () {
            var sentInputContent = client.lastRequest.substring(client.lastRequest.indexOf('<input>') + '<input>'.length, client.lastRequest.indexOf('</input>'));
            assert.equal(sentInputContent, '<PeriodList><PeriodType><PeriodId>1</PeriodId><PeriodId>2</PeriodId></PeriodType></PeriodList>');
            done();
          });
        });
      });

      it('shall generate correct payload for methods with array parameter when individual array elements are namespaced', function (done) {
        // this is the default behavior for array element namespacing
        soap.createClient(__dirname + '/wsdl/list_parameter.wsdl', { disableCache: true, namespaceArrayElements: true }, function (err, client) {
          assert.ok(client);
          assert.ok(client.wsdl.options.namespaceArrayElements === true);
          var pathToArrayContainer = 'TimesheetV201511Mobile.TimesheetV201511MobileSoap.AddTimesheet.input.input.PeriodList';
          var arrayParameter = _.get(client.describe(), pathToArrayContainer)['PeriodType[]'];
          assert.ok(arrayParameter);
          client.AddTimesheet({ input: { PeriodList: { PeriodType: [{ PeriodId: '1' }, { PeriodId: '2' }] } } }, function () {
            var sentInputContent = client.lastRequest.substring(client.lastRequest.indexOf('<input>') + '<input>'.length, client.lastRequest.indexOf('</input>'));
            assert.equal(sentInputContent, '<PeriodList><PeriodType><PeriodId>1</PeriodId></PeriodType><PeriodType><PeriodId>2</PeriodId></PeriodType></PeriodList>');
            done();
          });
        });
      });

      it('shall generate correct payload for recursively-defined types', function (done) {
        soap.createClient(__dirname + '/wsdl/recursive2.wsdl', function (err, client) {
          if (err) {
            return void done(err);
          }

          assert.ok(client);
          client.AddAttribute({
            "Requests": {
              "AddAttributeRequest": [
                {
                  "RequestIdx": 1,
                  "Identifier": {
                    "SystemNamespace": "bugrepro",
                    "ResellerId": 1,
                    "CustomerNum": "860692",
                    "AccountUid": "80a6e559-4d65-11e7-bd5b-0050569a12d7"
                  },
                  "Attr": {
                    "AttributeId": 716,
                    "IsTemplateAttribute": 0,
                    "ReadOnly": 0,
                    "CanBeModified": 1,
                    "Name": "domain",
                    "AccountElements": {
                      "AccountElement": [
                        {
                          "ElementId": 1693,
                          "Name": "domain",
                          "Value": "foo",
                          "ReadOnly": 0,
                          "CanBeModified": 1
                        }
                      ]
                    }
                  },
                  "RequestedBy": "blah",
                  "RequestedByLogin": "system"
                }
              ]
            }
          }, function () {
            var sentInputContent = client.lastRequest.substring(client.lastRequest.indexOf('<Requests>') + '<Requests>'.length, client.lastRequest.indexOf('</Requests>'));
            assert.equal(
              sentInputContent,
              '<AddAttributeRequest><RequestIdx>1</RequestIdx><Identifier><SystemNamespace>bugrepro</SystemNamespace><ResellerId>1</ResellerId><CustomerNum>860692</CustomerNum><AccountUid>80a6e559-4d65-11e7-bd5b-0050569a12d7</AccountUid></Identifier><Attr><AttributeId>716</AttributeId><IsTemplateAttribute>0</IsTemplateAttribute><ReadOnly>0</ReadOnly><CanBeModified>1</CanBeModified><Name>domain</Name><AccountElements><AccountElement><ElementId>1693</ElementId><Name>domain</Name><Value>foo</Value><ReadOnly>0</ReadOnly><CanBeModified>1</CanBeModified></AccountElement></AccountElements></Attr><RequestedBy>blah</RequestedBy><RequestedByLogin>system</RequestedByLogin></AddAttributeRequest>');
            done();
          });
        });
      });

      it('should resolve cross schema references', function () {
        return soap.createClientAsync(__dirname + '/wsdl/cross_schema.wsdl')
          .then(function (client) {
            return assert.deepStrictEqual(client.describe().Service.Service.Operation.output, {
              OperationReturn: {
                result: 'xs:string',
                targetNSAlias: 'ns1',
                targetNamespace: 'http://response.ws2.example.it'
              }
            });
          });
      });
    });


    describe('Client created with createClientAsync', function () {
      it('should error on invalid host', function (done) {
        soap.createClientAsync('http://localhost:1', meta.options)
          .then(function (client) { })
          .catch(function (err) {
            assert.ok(err);
            done();
          });
      });

      it('should add and clear soap headers', function (done) {
        soap.createClientAsync(__dirname + '/wsdl/default_namespace.wsdl', meta.options).then(function (client) {
          assert.ok(client);
          assert.ok(!client.getSoapHeaders());

          var i1 = client.addSoapHeader('about-to-change-1');
          var i2 = client.addSoapHeader('about-to-change-2');

          assert.ok(i1 === 0);
          assert.ok(i2 === 1);
          assert.ok(client.getSoapHeaders().length === 2);

          client.changeSoapHeader(0, 'header1');
          client.changeSoapHeader(1, 'header2');
          assert.ok(client.getSoapHeaders()[0] === 'header1');
          assert.ok(client.getSoapHeaders()[1] === 'header2');

          client.clearSoapHeaders();
          assert.ok(!client.getSoapHeaders());
          done();
        });
      });

      it('should issue async promise for cached wsdl', function (done) {
        var called = false;
        soap.createClientAsync(__dirname + '/wsdl/default_namespace.wsdl', meta.options).then(function (client) {
          assert.ok(client);
          called = true;
          done();
        });
        assert(!called);
      });

      it('should allow customization of httpClient', function (done) {
        var myHttpClient = {
          request: function () { }
        };
        soap.createClientAsync(__dirname + '/wsdl/default_namespace.wsdl',
          Object.assign({ httpClient: myHttpClient }, meta.options))
          .then(function (client) {
            assert.ok(client);
            assert.equal(client.httpClient, myHttpClient);
            done();
          });
      });

      it('should allow customization of request for http client', function (done) {
        var myRequest = function () {
        };
        soap.createClientAsync(
          __dirname + '/wsdl/default_namespace.wsdl',
          Object.assign({ request: myRequest }, meta.options)
        ).then(function (client) {
          assert.ok(client);
          assert.equal(client.httpClient._request, myRequest);
          done();
        });
      });

      it('should set binding style to "document" by default if not explicitly set in WSDL, per SOAP spec', function (done) {
        soap.createClientAsync(__dirname + '/wsdl/binding_document.wsdl', meta.options)
          .then(function (client) {
            assert.ok(client);
            assert.ok(client.wsdl.definitions.bindings.mySoapBinding.style === 'document');
            done();
          });
      });

      it('should allow passing in XML strings', function (done) {
        soap.createClientAsync(__dirname + '/wsdl/default_namespace.wsdl', Object.assign({ envelopeKey: 'soapenv' }, meta.options))
          .then(function (client) {
            assert.ok(client);
            var xmlStr = '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">\n\t<head>\n\t\t<title>404 - Not Found</title>\n\t</head>\n\t<body>\n\t\t<h1>404 - Not Found</h1>\n\t\t<script type="text/javascript" src="http://gp1.wpc.edgecastcdn.net/00222B/beluga/pilot_rtm/beluga_beacon.js"></script>\n\t</body>\n</html>';
            return client.MyOperationAsync({ _xml: xmlStr });
          })
          .then(function ([result, raw, soapHeader]) { })
          .catch(function (err) {
            done();
          });
      });

      it('should allow customization of envelope', function (done) {
        var client;
        soap.createClientAsync(__dirname + '/wsdl/default_namespace.wsdl', Object.assign({ envelopeKey: 'soapenv' }, meta.options))
          .then(function (createdClient) {
            assert.ok(createdClient);
            client = createdClient;
            return client.MyOperationAsync({});
          })
          .then(function (response) { })
          .catch(function (err) {
            assert.notEqual(client.lastRequest.indexOf('xmlns:soapenv='), -1);
            done();
          });
      });

      it('should add soap headers', function (done) {
        soap.createClientAsync(__dirname + '/wsdl/default_namespace.wsdl', meta.options)
          .then(function (client) {
            assert.ok(client);
            assert.ok(!client.getSoapHeaders());
            var soapheader = {
              'esnext': false,
              'moz': true,
              'boss': true,
              'node': true,
              'validthis': true,
              'globals': {
                'EventEmitter': true,
                'Promise': true
              }
            };

            client.addSoapHeader(soapheader);

            assert.ok(client.getSoapHeaders()[0] === '<esnext>false</esnext><moz>true</moz><boss>true</boss><node>true</node><validthis>true</validthis><globals><EventEmitter>true</EventEmitter><Promise>true</Promise></globals>');
            done();
          });
      });

      it('should allow disabling the wsdl cache', function (done) {
        var spy = sinon.spy(wsdl, 'open_wsdl');
        var options = Object.assign({ disableCache: true }, meta.options);
        soap.createClientAsync(__dirname + '/wsdl/binding_document.wsdl', options)
          .then(function (client) {
            assert.ok(client);
            return soap.createClientAsync(__dirname + '/wsdl/binding_document.wsdl', options);
          })
          .then(function (client) {
            assert.ok(client);
            assert.ok(spy.calledTwice);
            wsdl.open_wsdl.restore();
            done();
          });
      });

      it('should add http headers', function (done) {
        soap.createClientAsync(__dirname + '/wsdl/default_namespace.wsdl', meta.options)
          .then(function (client) {
            assert.ok(client);
            assert.ok(!client.getHttpHeaders());

            client.addHttpHeader('foo', 'bar');

            assert.ok(client.getHttpHeaders());
            assert.equal(client.getHttpHeaders().foo, 'bar');

            client.clearHttpHeaders();
            assert.equal(client.getHttpHeaders(), null);
            done();
          });
      });

    });

    describe('Client created with option normalizeNames', function () {

      it('should create node-style method with normalized name (a valid Javascript identifier)', function (done) {
        soap.createClient(__dirname + '/wsdl/non_identifier_chars_in_operation.wsdl', Object.assign({ normalizeNames: true }, meta.options), function (err, client) {
          assert.ok(client);
          assert.ifError(err);
          client.prefixed_MyOperation({}, function (err, result) {
            // only need to check that a valid request is generated, response isn't needed
            assert.ok(client.lastRequest);
            done();
          });
        });
      });

      it('should create node-style method with non-normalized name on Client.service.port.method style invocation', function (done) {
        soap.createClient(__dirname + '/wsdl/non_identifier_chars_in_operation.wsdl', meta.options, function (err, client) {
          assert.ok(client);
          assert.ifError(err);
          /*jshint -W069 */
          assert.throws(function () { client.MyService.MyServicePort['prefixed_MyOperation']({}); }, TypeError);
          /*jshint +W069 */
          client.MyService.MyServicePort['prefixed-MyOperation']({}, function (err, result) {
            // only need to check that a valid request is generated, response isn't needed
            assert.ok(client.lastRequest);
            done();
          });
        });
      });

      it('should create promise-style method with normalized name (a valid Javascript identifier)', function (done) {
        soap.createClient(__dirname + '/wsdl/non_identifier_chars_in_operation.wsdl', Object.assign({ normalizeNames: true }, meta.options), function (err, client) {
          assert.ok(client);
          assert.ifError(err);
          client.prefixed_MyOperationAsync({})
            .then(function (result) { })
            .catch(function (err) {
              // only need to check that a valid request is generated, response isn't needed
              assert.ok(client.lastRequest);
              done();
            });
        });
      });

      it('should not create methods with invalid Javascript identifier', function (done) {
        soap.createClient(__dirname + '/wsdl/non_identifier_chars_in_operation.wsdl', Object.assign({ normalizeNames: true }, meta.options), function (err, client) {
          assert.ok(client);
          assert.ifError(err);
          assert.throws(function () { client['prefixed-MyOperationAsync']({}); }, TypeError);
          assert.throws(function () { client['prefixed-MyOperation']({}); }, TypeError);
          done();
        });
      });

      it('should create node-style method with invalid Javascript identifier if option normalizeNames is not used', function (done) {
        soap.createClient(__dirname + '/wsdl/non_identifier_chars_in_operation.wsdl', meta.options, function (err, client) {
          assert.ok(client);
          assert.ifError(err);
          client['prefixed-MyOperation']({}, function (err, result) {
            // only need to check that a valid request is generated, response isn't needed
            assert.ok(client.lastRequest);
            done();
          });
        });
      });

      it('does not create a promise-style method with invalid Javascript identifier if option normalizeNames is not used', function (done) {
        soap.createClient(__dirname + '/wsdl/non_identifier_chars_in_operation.wsdl', meta.options, function (err, client) {
          assert.ok(client);
          assert.ifError(err);
          assert.throws(function () { client['prefixed-MyOperationAsync']({}); }, TypeError);
          done();
        });
      });
    });
  });
});

it('shall generate correct header for custom defined header arguments', function (done) {
  soap.createClientAsync(__dirname + '/wsdl/default_namespace.wsdl').then(function (client) {
    client.addSoapHeader('test-header-namespace')
    client.wsdl.xmlnsInHeader = 'xmlns="https://example.com/v1"';
    var expectedDefinedHeader = '<soap:Header xmlns="https://example.com/v1">';

    client.MyOperation(function (err, result, rawResponse, soapHeader, rawRequest) {
      var definedSoapHeader = client.lastRequest.match(/<soap:Header xmlns=("(.*?)">)/)[0];
      assert.ok(definedSoapHeader === expectedDefinedHeader);
      done();
    });
  });
});

it('should create async client without options', function (done) {
  soap.createClientAsync(__dirname + '/wsdl/default_namespace.wsdl').then(function (client) {
    assert.ok(client);
    done();
  });
});

it('should add namespace to array of objects', function (done) {
  soap.createClientAsync(__dirname + '/wsdl/PurchaseRequestService.wsdl').then(function (client) {
    const input = {
      errorProcessingLevel: "ALL",
      groupBy: "SUPPLIER",
      initiateApprovalAfterRequisitionImport: "N",
      interfaceSourceCode: "ABC",
      purchaseRequestPayload: {
        ApproverEmail: "abc@gmail.com",
        ApproverId: "idname",
        PurchaseRequestInputReqLineInterface:
          [
            {
              Amount: "600.00",
              GroupCode: "supplier",
              ItemDescription: "test1",
              LineTypeId: 6,
              ProductType: "SERVICES",
              RequestedDeliveryDate: "2021-02-26",

            },
            {
              Amount: "400.00",
              GroupCode: "supplier",
              ItemDescription: "test2",
              LineTypeId: 7,
              ProductType: "SERVICES",
              RequestedDeliveryDate: "2021-02-28",
            },
          ],
      },
      RequisitioningBUName: "BU",
      requisitioningBUName: "BU",
    };
    client.setSecurity(new soap.BasicAuthSecurity('username', 'password'));
    client.createRequisition(input, function (err, result, rawResponse, soapHeader, rawRequest) {
      const match = rawRequest.match(/<ns1:PurchaseRequestInputReqLineInterface xmlns:.{3}="(.*?)">/);
      if (match && match.length) {
        assert.ok(match[0])
      } else {
        assert.ok(null, `Array object don't have namesapce`)
      }
      done();
    });
  });
});


describe('Client using stream and returnSaxStream', () => {
  let server = null;
  let hostname = '127.0.0.1';
  let port = 15099;
  let baseUrl = 'http://' + hostname + ':' + port;
  const envelope = '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'
    + ' xmlns:xsd="http://www.w3.org/2001/XMLSchema"'
    + ' xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'
    + '<soap:Body><Response>Hello</Response></soap:Body></soap:Envelope>'

  before(function (done) {
    server = http.createServer(function (req, res) {
      res.statusCode = 200;
      res.write(envelope, 'utf8');
      res.end();
    }).listen(port, hostname, done);
  });

  after(function (done) {
    server.close();
    server = null;
    done();
  });

  it('should return the saxStream', (done) => {
    soap.createClient(__dirname + '/wsdl/default_namespace.wsdl',
      { stream: true, returnSaxStream: true }, (err, client) => {
        assert.ok(client);
        assert.ifError(err);

        client.MyOperation({}, (err, result) => {
          const { saxStream } = result
          assert.ok(saxStream instanceof stream.Stream);
          assert.ok(typeof saxStream.on === 'function');
          assert.ok(typeof saxStream.pipe === 'function');

          saxStream.on('text', (text) => {
            assert.ok(text === 'Hello')
          })

          done();
        }, null, null);
      }, baseUrl);
  });
});

describe('Client posting complex body', () => {
  let server = null;
  let hostname = '127.0.0.1';
  let port = 15099;
  let baseUrl = 'http://' + hostname + ':' + port;
  const envelope = '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'
    + ' xmlns:xsd="http://www.w3.org/2001/XMLSchema"'
    + ' xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'
    + '<soap:Body><Response>Hello</Response></soap:Body></soap:Envelope>'

  before(function (done) {
    server = http.createServer(function (req, res) {
      res.statusCode = 200;
      res.write(envelope, 'utf8');
      res.end();
    }).listen(port, hostname, done);
  });

  after(function (done) {
    server.close();
    server = null;
    done();
  });

  it('should serialize complex body', function (done) {
    soap.createClient(__dirname + '/wsdl/complex/registration-common.wsdl', function (err, client) {
      if (err) {
        return void done(err);
      }
      assert.ok(client);

      var requestBody = {
        id: 'ID00000000000000000000000000000000',
        lastName: 'Doe',
        firstName: 'John',
        dateOfBirth: '1970-01-01',
        correspondenceLanguage: 'ENG',
        emailAddress: 'jdoe@doe.com',
        lookupPermission: 'ALLOWED',
        companyAddress: {
          address: {
            streetName: 'Street',
            postalCode: 'Code',
            city: 'City',
            countryCode: 'US'
          },
          companyName: 'ACME'
        }
      }

      client.registerUser(requestBody, function (err, result) {
        assert.ok(client.lastRequest);
        assert.ok(client.lastMessage);
        assert.ok(client.lastEndpoint);

        console.log(client.lastMessage);
        const expectedBody = '<registrationMessages:registerUserRequest xmlns:registrationMessages="http://test-soap.com/api/registration/messages" xmlns="http://test-soap.com/api/registration/messages"><registrationMessages:id>ID00000000000000000000000000000000</registrationMessages:id><registrationMessages:lastName>Doe</registrationMessages:lastName><registrationMessages:firstName>John</registrationMessages:firstName><registrationMessages:dateOfBirth>1970-01-01</registrationMessages:dateOfBirth><registrationMessages:correspondenceLanguage>ENG</registrationMessages:correspondenceLanguage><registrationMessages:emailAddress>jdoe@doe.com</registrationMessages:emailAddress><registrationMessages:lookupPermission>ALLOWED</registrationMessages:lookupPermission><registrationMessages:companyAddress><ct:address xmlns:ct="http://test-soap.com/api/common/types"><ct:streetName>Street</ct:streetName><ct:postalCode>Code</ct:postalCode><ct:city>City</ct:city><ct:countryCode>US</ct:countryCode></ct:address><ct:companyName xmlns:ct="http://test-soap.com/api/common/types">ACME</ct:companyName></registrationMessages:companyAddress></registrationMessages:registerUserRequest>';
        assert.strictEqual(client.lastMessage, expectedBody);

        done();
      });
    }, baseUrl);
  });


  it('should resolve promise on async invoke postProcess', function (done) {
    soap.createClient(__dirname + '/wsdl/complex/registration-common.wsdl', function (err, client) {
      if (err) {
        return void done(err);
      }
      assert.ok(client);

      var requestBody = {
        id: 'ID00000000000000000000000000000000',
        lastName: 'Doe',
        firstName: 'John',
        dateOfBirth: '1970-01-01',
        correspondenceLanguage: 'ENG',
        emailAddress: 'jdoe@doe.com',
        lookupPermission: 'ALLOWED',
        companyAddress: {
          address: {
            streetName: 'Street',
            postalCode: 'Code',
            city: 'City',
            countryCode: 'US'
          },
          companyName: 'ACME'
        }
      }

      client.registerUser(requestBody, {
        postProcess: async (xml) => {
          const testString = await new Promise(resolve => setTimeout(resolve("Jane"), 3000));

          xml = xml.replace("John", testString)
          return xml;
        }
      }, function (err, result) {
        assert.ok(client.lastRequest);
        const expectedBody = '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"  xmlns:tns="http://test-soap.com/api/registration" xmlns:registrationMessages="http://test-soap.com/api/registration/messages" xmlns:commonMessages="http://test-soap.com/api/common/messages"><soap:Body><registrationMessages:registerUserRequest xmlns:registrationMessages="http://test-soap.com/api/registration/messages" xmlns="http://test-soap.com/api/registration/messages"><registrationMessages:id>ID00000000000000000000000000000000</registrationMessages:id><registrationMessages:lastName>Doe</registrationMessages:lastName><registrationMessages:firstName>Jane</registrationMessages:firstName><registrationMessages:dateOfBirth>1970-01-01</registrationMessages:dateOfBirth><registrationMessages:correspondenceLanguage>ENG</registrationMessages:correspondenceLanguage><registrationMessages:emailAddress>jdoe@doe.com</registrationMessages:emailAddress><registrationMessages:lookupPermission>ALLOWED</registrationMessages:lookupPermission><registrationMessages:companyAddress><ct:address xmlns:ct="http://test-soap.com/api/common/types"><ct:streetName>Street</ct:streetName><ct:postalCode>Code</ct:postalCode><ct:city>City</ct:city><ct:countryCode>US</ct:countryCode></ct:address><ct:companyName xmlns:ct="http://test-soap.com/api/common/types">ACME</ct:companyName></registrationMessages:companyAddress></registrationMessages:registerUserRequest></soap:Body></soap:Envelope>'
        assert.strictEqual(client.lastRequest, expectedBody);

        done();
      });
    }, baseUrl);
  })

  it('should resolve sync invoke postProcess', function (done) {
    soap.createClient(__dirname + '/wsdl/complex/registration-common.wsdl', function (err, client) {
      if (err) {
        return void done(err);
      }
      assert.ok(client);

      var requestBody = {
        id: 'ID00000000000000000000000000000000',
        lastName: 'Doe',
        firstName: 'John',
        dateOfBirth: '1970-01-01',
        correspondenceLanguage: 'ENG',
        emailAddress: 'jdoe@doe.com',
        lookupPermission: 'ALLOWED',
        companyAddress: {
          address: {
            streetName: 'Street',
            postalCode: 'Code',
            city: 'City',
            countryCode: 'US'
          },
          companyName: 'ACME'
        }
      }

      client.registerUser(requestBody, {
        postProcess: (xml) => {
          const testString = "Jane"

          xml = xml.replace("John", testString)
          return xml;
        }
      }, function (err, result) {
        assert.ok(client.lastRequest);
        const expectedBody = '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"  xmlns:tns="http://test-soap.com/api/registration" xmlns:registrationMessages="http://test-soap.com/api/registration/messages" xmlns:commonMessages="http://test-soap.com/api/common/messages"><soap:Body><registrationMessages:registerUserRequest xmlns:registrationMessages="http://test-soap.com/api/registration/messages" xmlns="http://test-soap.com/api/registration/messages"><registrationMessages:id>ID00000000000000000000000000000000</registrationMessages:id><registrationMessages:lastName>Doe</registrationMessages:lastName><registrationMessages:firstName>Jane</registrationMessages:firstName><registrationMessages:dateOfBirth>1970-01-01</registrationMessages:dateOfBirth><registrationMessages:correspondenceLanguage>ENG</registrationMessages:correspondenceLanguage><registrationMessages:emailAddress>jdoe@doe.com</registrationMessages:emailAddress><registrationMessages:lookupPermission>ALLOWED</registrationMessages:lookupPermission><registrationMessages:companyAddress><ct:address xmlns:ct="http://test-soap.com/api/common/types"><ct:streetName>Street</ct:streetName><ct:postalCode>Code</ct:postalCode><ct:city>City</ct:city><ct:countryCode>US</ct:countryCode></ct:address><ct:companyName xmlns:ct="http://test-soap.com/api/common/types">ACME</ct:companyName></registrationMessages:companyAddress></registrationMessages:registerUserRequest></soap:Body></soap:Envelope>'
        assert.strictEqual(client.lastRequest, expectedBody);

        done();
      });
    }, baseUrl);
  })
});
