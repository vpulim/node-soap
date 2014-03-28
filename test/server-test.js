var fs = require('fs'),
    soap = require('..'),
    assert = require('assert'),
    request = require('request'),
    http = require('http');

var service = {
    StockQuoteService: {
        StockQuotePort: {
            GetLastTradePrice: function(args) {
                if (args.tickerSymbol == 'trigger error') {
                   throw new Error('triggered server error');
                } else {
                    return { price: 19.56 };
                }
            }
        }
    }
}

var server = null;
module.exports = {
    beforeEach: function() {
        var wsdl = fs.readFileSync(__dirname+'/wsdl/strict/stockquote.wsdl', 'utf8');
        server = http.createServer(function(req, res) {
            res.statusCode = 404;
            res.end();
        });
        server.listen(15099);
        soap.listen(server, '/stockquote', service, wsdl);
    },
    afterEach: function(done) {
        if (!server) return done()
        server.close(function() {
            server = null;
            done();
        });
    },

    'SOAP Server': {

        'should be running': function(done) {
            request('http://localhost:15099', function(err, res, body) {
                assert.ok(!err);
                done();
            })
        },

        'should 404 on non-WSDL path': function(done) {
            request('http://localhost:15099', function(err, res, body) {
                assert.ok(!err);
                assert.equal(res.statusCode, 404);
                done();
            })
        },

        'should server up WSDL': function(done) {
            request('http://localhost:15099/stockquote?wsdl', function(err, res, body) {
                assert.ok(!err);
                assert.equal(res.statusCode, 200);
                assert.ok(body.length);
                done();
            })
        },

        'should return a valid error if the server stops responding': function(done) {
            soap.createClient('http://localhost:15099/stockquote?wsdl', function(err, client) {
                assert.ok(!err);
                server.close(function() {
                  server = null;
                  client.GetLastTradePrice({ tickerSymbol: 'trigger error' }, function(err, response, body) {
                      assert.ok(err);
                      done();
                  });
                });
            });
        },

        'should return complete client description': function(done) {
            soap.createClient('http://localhost:15099/stockquote?wsdl', function(err, client) {
                assert.ok(!err);
                var description = client.describe(),
                    expected = { input: { tickerSymbol: "string" }, output:{ price: "float" } };
                assert.deepEqual(expected , description.StockQuoteService.StockQuotePort.GetLastTradePrice );
                done();
            });
        },

        'should return correct results': function(done) {
            soap.createClient('http://localhost:15099/stockquote?wsdl', function(err, client) {
                assert.ok(!err);
                client.GetLastTradePrice({ tickerSymbol: 'AAPL'}, function(err, result) {
                    assert.ok(!err);
                    assert.equal(19.56, parseFloat(result.price));
                    done();
                });
            });
        },

        'should include response and body in error object': function(done) {
            soap.createClient('http://localhost:15099/stockquote?wsdl', function(err, client) {
                assert.ok(!err);
                client.GetLastTradePrice({ tickerSymbol: 'trigger error' }, function(err, response, body) {
                    assert.ok(err);
                    assert.strictEqual(err.response, response);
                    assert.strictEqual(err.body, body);
                    done();
                });
            });
        },
    }
}
