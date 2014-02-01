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
##Benchmark

	C:\node-soap>node benchmark
	go expat for the 100th time.
	go sax for the 100th time.
	go expat for the 200th time.
	go sax for the 200th time.
	go expat for the 300th time.
	go sax for the 300th time.
	go expat for the 400th time.
	go sax for the 400th time.
	go expat for the 500th time.
	go sax for the 500th time.
	go expat for the 600th time.
	go sax for the 600th time.
	go expat for the 700th time.
	go sax for the 700th time.
	go expat for the 800th time.
	go sax for the 800th time.
	go expat for the 900th time.
	go sax for the 900th time.
	1000 times using expat: 15810ms
	1000 times using sax: 15825ms

They finish equal on Windows 8.1 AMD 64bit