var EventEmitter = require('events'),
  assert = require('assert'),
  soap = require('..');

describe('request emit error event when create soap client', function () {
  it('should catch error event', function (done) {
    var baseUrl = 'http://never_found';
    var httpClient = {
      request: function() {
        var req = new EventEmitter();
        process.nextTick(function () {
          req.emit('error', new Error('mock error'));
        });
        return req;
      }
    };
    soap.createClient(
      baseUrl + '/wsdl/empty_body.wsdl',
      { httpClient: httpClient },
      function (err) {
        assert(err && err.message === 'mock error');
        done();
      }, baseUrl);
  });
});
