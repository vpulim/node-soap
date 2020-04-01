'use strict';

var fs = require('fs'),
  duplexify = require('duplexify'),
  should = require('should'),
  // stream = require('stream'),
  stream = require('readable-stream');

module.exports = function createSocketStream(file, length) {
  //Create a duplex stream
  var httpReqStream = new stream.PassThrough();
  var httpResStream = new stream.PassThrough();
  var socketStream = duplexify(httpReqStream, httpResStream);

  socketStream.req = httpReqStream;
  socketStream.res = httpResStream;

  var wsdl = fs.readFileSync(file).toString('utf8');
  //Should be able to read from stream the request
  socketStream.req.once('readable', function readRequest() {
    var chunk = socketStream.req.read();
    should.exist(chunk);

    var header =
      'HTTP/1.1 200 OK\r\nContent-Type: text/xml; charset=utf-8\r\nContent-Length: ' +
      length +
      '\r\n\r\n';

    //Now write the response with the wsdl
    var state = socketStream.res.write(header + wsdl);
  });

  return socketStream;
};
