'use strict';

var fs = require('fs'),
  duplexer = require('duplexer'),
  semver = require('semver'),
  should = require('should'),
  // stream = require('stream'),
  stream = require('readable-stream');

module.exports = function createSocketStream(file, length) {
  //Create a duplex stream

  var httpReqStream = new stream.PassThrough();
  var httpResStream = new stream.PassThrough();
  var socketStream = duplexer(httpReqStream, httpResStream);

  // Node 4.x requires cork/uncork
  socketStream.cork = function() {
  };

  socketStream.uncork = function() {
  };

  socketStream.destroy = function() {
  };

  // axios calls this
  socketStream.setKeepAlive = function() {
  };

  socketStream.req = httpReqStream;
  socketStream.res = httpResStream;

  var wsdl = fs.readFileSync(file).toString('utf8');
  //Should be able to read from stream the request
  socketStream.req.once('readable', function readRequest() {
    var chunk = socketStream.req.read();
    should.exist(chunk);

    var header = 'HTTP/1.1 200 OK\r\nContent-Type: text/xml; charset=utf-8\r\nContent-Length: ' + length + '\r\n\r\n';

    //This is for compatibility with old node releases <= 0.10
    //Hackish
    if(semver.lt(process.version, '0.11.0'))
    {
      socketStream.on('data', function(data) {
        socketStream.ondata(data,0,length + header.length);
      });
    }
    //Now write the response with the wsdl
    var state = socketStream.res.write(header+wsdl);
  });

  return socketStream;
};
