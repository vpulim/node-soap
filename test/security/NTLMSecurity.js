'use strict';

describe('NTLMSecurity', function () {
  var NTLMSecurity = require('../../').NTLMSecurity;
  var username = 'admin';
  var password = 'password1234';
  var domain = 'LOCAL';
  var workstation = 'MACHINE';

  it('is a function', function () {
    NTLMSecurity.should.be.type('function');
  });

  describe('constructor', function () {
    it('should optionally accept an options object as the first parameter', function () {
      var options = {
        username: username,
        password: password,
        domain: domain,
        workstation: workstation,
      };
      var instance = new NTLMSecurity(options);
      instance.defaults.should.have.property('username', options.username);
      instance.defaults.should.have.property('password', options.password);
      instance.defaults.should.have.property('domain', options.domain);
      instance.defaults.should.have.property('workstation', options.workstation);
      instance.defaults.should.have.property('ntlm', true);
    });

    it('should work with httpAgent and ntlm options together', function () {
      var options = {
        username: username,
        password: password,
        domain: domain,
        workstation: workstation,
        ntlm: true,
      };

      var events = require('events');
      var util = require('util');
      var stream = require('readable-stream');
      var duplexer = require('duplexer');
      var httpClient = require('../../lib/http.js').HttpClient;

      function CustomAgent(options, socket) {
        var self = this;
        events.EventEmitter.call(this);
        self.requests = [];
        self.maxSockets = 1;
        self.proxyStream = socket;
        self.options = options || {};
        self.proxyOptions = {};
      }

      util.inherits(CustomAgent, events.EventEmitter);

      CustomAgent.prototype.addRequest = function (req, options) {
        req.onSocket(this.proxyStream);
      };

      var httpReqStream = new stream.PassThrough();
      var httpResStream = new stream.PassThrough();
      var socketStream = duplexer(httpReqStream, httpResStream);

      socketStream.cork = function () {};
      socketStream.uncork = function () {};
      socketStream.destroy = function () {};
      socketStream.setKeepAlive = function () {};

      class MyHttpClient extends httpClient {
        constructor(options, socket) {
          super(options);
          this.agent = new CustomAgent(options, socket);
        }
      }

      var client = new MyHttpClient(options, socketStream);
      options.httpAgent = client.agent;

      var instance = new NTLMSecurity(options);
      instance.defaults.should.have.property('username', options.username);
      instance.defaults.should.have.property('password', options.password);
      instance.defaults.should.have.property('domain', options.domain);
      instance.defaults.should.have.property('workstation', options.workstation);
      instance.defaults.should.have.property('ntlm', true);
      instance.defaults.should.have.property('httpAgent', options.httpAgent);

      // Instrumentation
      //console.log(instance);
    });

    it('should work with httpsAgent and ntlm options together', function () {
      var ClientSSLSecurity = require('../../').ClientSSLSecurity;
      var instance = new ClientSSLSecurity(null, null, null, { ntlm: true });

      var firstOptions = { forever: true };
      var secondOptions = { forever: true };

      instance.addOptions(firstOptions);
      instance.addOptions(secondOptions);

      firstOptions.httpsAgent.should.equal(secondOptions.httpsAgent);
      firstOptions.forever.should.equal(secondOptions.forever);
      firstOptions.ntlm.should.equal(secondOptions.ntlm);
      firstOptions.ntlm.should.equal(true);
      instance.defaults.should.have.property('ntlm', true);
      instance.agent.should.equal(firstOptions.httpsAgent);

      // Instrumentation
      //console.log(firstOptions);
      //console.log(secondOptions)
      //console.log(instance);
    });

    it('should accept valid variables', function () {
      var instance = new NTLMSecurity(username, password, domain, workstation);
      instance.defaults.should.have.property('username', username);
      instance.defaults.should.have.property('password', password);
      instance.defaults.should.have.property('domain', domain);
      instance.defaults.should.have.property('workstation', workstation);
      instance.defaults.should.have.property('ntlm', true);
    });
  });

  describe('addHeaders', function () {
    it("should set connection as 'keep-alive'", function () {
      var headers = {};
      var instance = new NTLMSecurity(username, password);
      instance.addHeaders(headers);
      headers.should.have.property('Connection', 'keep-alive');
    });
  });

  describe('defaultOption param', function () {
    it('is used in addOptions', function () {
      var options = {};
      var instance = new NTLMSecurity(username, password);
      instance.addOptions(options);
      options.should.have.property('username', username);
      options.should.have.property('password', password);
    });
  });
});
