var fs = require('fs'),
    soap = require('..'),
    assert = require('assert'),
    request = require('request'),
    http = require('http');

var service = { 
    StockQuoteService: { 
        StockQuotePort: { 
            GetLastTradePrice: function(args) {
                return { price: 19.56 };
            }
        }
    }
}

module.exports = {
    'SOAP Server': {

        'should start': function(done) {
            var wsdl = fs.readFileSync(__dirname+'/stockquote.wsdl', 'utf8'),
                server = http.createServer(function(req, res) {
                    res.statusCode = 404;
                    res.end();
                });
            server.listen(15099);
            soap.listen(server, '/stockquote', service, wsdl);
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

        'should return correct results': function(done) {
            soap.createClient('http://localhost:15099/stockquote?wsdl', function(err, client) {
                assert.ok(!err);
                client.GetLastTradePrice({ tickerSymbol: 'AAPL'}, function(err, result) {
                    assert.ok(!err);
                    assert.equal(19.56, parseFloat(result.price));
                    done();
                });            
            });
        }
    }
}