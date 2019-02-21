'use strict';

var fs = require('fs'),
    join = require('path').join;

describe('ClientSSLSecurityPFX', function() {
  var ClientSSLSecurityPFX = require('../../').ClientSSLSecurityPFX;
  var pfx = __filename;

  it('should be function', function() {
    ClientSSLSecurityPFX.should.be.type('function');
  });

  describe('defaultOption param', function() {
    it('should be accepted as the second param', function() {
      new ClientSSLSecurityPFX(null, {});
    });

    it('should be used in addOptions', function() {
      var options = {};
      var defaultOptions = { foo: 5 };
      var instance = new ClientSSLSecurityPFX(null, defaultOptions);
      instance.addOptions(options);
      options.should.have.property("foo", 5);
    });
  });

  it('should throw if invalid pfk file is given', function () {
    var instanceCert = null;

    try {
      instanceCert = new ClientSSLSecurityPFX({});
    } catch (e) {
      //should happen!
      instanceCert = false;
    }

    if (instanceCert !== false) {
      throw new Error('accepted wrong pfk');
    }
  });

  xit('should be usable in a request', function (done) {
    var https = require('https');
    var pfkBuffer = fs.readFileSync(join(__dirname, '..', 'certs', 'client-password.pfx')),
      instance;

    instance = new ClientSSLSecurityPFX(pfkBuffer, 'test2test');
    var soptions = {
      host: 'localhost',
      port: 1338,
      requestCert: true,
      rejectUnauthorized: false,
      pfx: fs.readFileSync(join(__dirname, '..', 'certs', 'server-password.pfx')),
      passphrase: 'test2test',
    };
    var options = {
      port: 1338
    };
    instance.addOptions(options);

    var server = https.createServer(soptions, function(req, res) {
      req.socket.should.have.property('authorized', true);
      // Doesn't work in older versions of nodejs
      // req.socket.should.have.property('authorizationError', null);
      res.writeHead(200);
      res.end('OK');
    });

    server.listen(soptions.port, soptions.host, function() {
      var data = '';

      https.get(options, function(res) {
        res.on('data', function(data_) { data += data_; });
        res.on('end', function() {
          server.close();
          data.should.equal('OK');
          done();
        });
      });
    });
  });

  it('should accept a passphrase as argument for the pfx cert', function () {
    var pfkBuffer = fs.readFileSync(join(__dirname, '..', 'certs', 'client-password.pfx')),
      instance;

    instance = new ClientSSLSecurityPFX(pfkBuffer, 'test2est');
    instance.should.have.property("pfx", pfkBuffer);
    instance.should.have.property("passphrase", 'test2est');
  });

  it('should accept a Buffer as argument for the pfx cert', function () {
    var pfkBuffer = fs.readFileSync(join(__dirname, '..', 'certs', 'pfk-buffer.pfx')),
      instance;

    instance = new ClientSSLSecurityPFX(pfkBuffer);
    instance.should.have.property("pfx", pfkBuffer);
  });

  it('should return a blank when toXML is called', function () {
    var pfkBuffer = fs.readFileSync(join(__dirname, '..', 'certs', 'pfk-buffer.pfx')),
      instance;

    instance = new ClientSSLSecurityPFX(pfkBuffer);
    var xml = instance.toXML();
    xml.should.be.exactly('');
  });

  it('should accept a String as argument for the pfx cert', function () {
    var pfkBuffer = fs.readFileSync(join(__dirname, '..', 'certs', 'pfk-buffer.pfx')),
      instance;

    instance = new ClientSSLSecurityPFX(join(__dirname, '..', 'certs', 'pfk-buffer.pfx'));
    instance.should.have.property("pfx", pfkBuffer);
  });

  it('should have an options with addOptions', function () {
    var pfkBuffer = fs.readFileSync(join(__dirname, '..', 'certs', 'client-password.pfx')),
      instance;

    instance = new ClientSSLSecurityPFX(pfkBuffer, 'test2est');
    var options = { foo: 5 };
    instance.addOptions(options);
    options.should.have.property("pfx", pfkBuffer);
    options.should.have.property("passphrase", 'test2est');
    options.should.have.property("foo", 5);
  });
});
