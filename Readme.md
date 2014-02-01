This fork adds an option to run node-soap in Expat or Sax mode.

``` javascript
var soap = require('soap');
var url = 'https://secure.myclang.com/app/api/soap/public/index.php?wsdl';

soap.createClient(url, {parser: 'sax'}, function(err, client) {
    console.log('client created using sax', process.hrtime());
});

soap.createClient(url, {parser: 'expat'}, function(err, client) {
    console.log('client created using expat', process.hrtime());
});
```

