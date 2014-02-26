var fs = require('fs'),
    soap = require('..'),
    https = require('https'),
    constants = require('constants'),
    assert = require('assert');

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

var sslOptions = {
  key: fs.readFileSync(__dirname + '/certs/agent2-key.pem'),
  cert: fs.readFileSync(__dirname + '/certs/agent2-cert.pem')
};

module.exports = {
  'SSL SOAP Client': {
    'should connect to an SSL server': function(done) {
      // setup server and listen
      var server = https.createServer(sslOptions, function(req, res) {
        res.statusCode = 404;
        res.end();
      }).listen(51515);

      var wsdl = fs.readFileSync(__dirname + '/wsdl/strict/stockquote.wsdl', 'utf8');
      var soapServer = soap.listen(server, '/stockquote', service, wsdl);

      // test client
      soap.createClient(__dirname + '/wsdl/strict/stockquote.wsdl', function(err, client) {
        assert.ok(!err);
        client.setEndpoint('https://localhost:51515/stockquote');
        client.setSecurity({
          addOptions:function(options){
            options.cert = sslOptions.cert,
            options.key = sslOptions.key,
            options.rejectUnauthorized = false;
            options.secureOptions = constants.SSL_OP_NO_TLSv1_2;
            options.strictSSL = false;
            options.agent = new https.Agent(options);
          },
          toXML:function(){return '';}
        });

        client.GetLastTradePrice({ tickerSymbol: 'AAPL'}, function(err, result) {
          assert.ok(!err);
          assert.equal(19.56, parseFloat(result.price));
          done();
        });
      });
    }
  }
}
