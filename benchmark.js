var soap = require('./lib/soap');
var url = 'test.xml';

var n = 1000, i = {sax: 0, expat: 0};

var go = function (parser) {
  if (i[parser] === 0) {
    console.time(n + ' times using ' + parser);
  }

  soap.createClient(url, {parser: parser}, function(err, client) {
    i[parser]++;
    if (i[parser] < n) {
      if (i[parser] % 100 === 0) {
        console.log('go ' + parser + ' for the ' + i[parser] + 'th time.');
      }
      setTimeout(function() {
        go(parser);
      }, 0);
    }
    else {
      console.timeEnd(n + ' times using ' + parser);
    }
  });
};

//run two series in parallel
go('expat');
go('sax');
