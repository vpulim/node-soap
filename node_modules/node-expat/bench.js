var util = require('util');
var node_xml = require("node-xml");
var libxml = require("libxmljs");
var expat = require('node-expat');
var sax = require('sax');

function NodeXmlParser() {
    var parser = new node_xml.SaxParser(function(cb) { });
    this.parse = function(s) {
	parser.parseString(s);
    };
}
function LibXmlJsParser() {
    var parser = new libxml.SaxPushParser(function(cb) { });
    this.parse = function(s) {
	parser.push(s, false);
    };
}
function SaxParser() {
    var parser = sax.parser();
	this.parse = function(s) {
	parser.write(s).close();
	}
}
function ExpatParser() {
    var parser = new expat.Parser();
    this.parse = function(s) {
	parser.parse(s, false);
    };
}

//var p = new NodeXmlParser();
//var p = new LibXmlJsParser();
//var p = new SaxParser();
var p = new ExpatParser();
p.parse("<r>");
var nEl = 0;
function d() {
    p.parse("<foo bar='baz'>quux</foo>");
    nEl++;
    setTimeout(d, 0);
}
d();

var its =[];
setInterval(function() {
    util.puts(nEl + " el/s");
	its.push(nEl);
    nEl = 0;
}, 1000);

process.on('SIGINT', function () {
	var average = 0;
	its.forEach(function (v){
		average += v;
	});
	average /= its.length;
	util.puts("Average: " + average + " el/s");
	process.exit(0);
});