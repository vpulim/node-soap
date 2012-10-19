var EventEmitter = require('events').EventEmitter;
var util = require('util');
// Only support nodejs v0.6 and on so no need to look for older module location
var expat = require('../build/Release/node_expat.node');
var Stream = require('stream').Stream;

var Parser = function(encoding) {
  this.parser = new expat.Parser(encoding);
  this.parser.emit = this.emit.bind(this);

  //stream API
  this.writable = true;
  this.readable = true;
};
util.inherits(Parser, Stream);

Parser.prototype.parse = function(buf, isFinal) {
  return this.parser.parse(buf, isFinal);
};

Parser.prototype.setEncoding = function(encoding) {
  return this.parser.setEncoding(encoding);
};

Parser.prototype.getError = function() {
  return this.parser.getError();
};
Parser.prototype.stop = function() {
  return this.parser.stop();
};
Parser.prototype.pause = function() {
  return this.stop();
};
Parser.prototype.resume = function() {
  return this.parser.resume();
};

Parser.prototype.destroy = function() {
  this.parser.stop();
  this.end();
};

Parser.prototype.destroySoon = function() {
  this.destroy();
};

Parser.prototype.write = function(data) {
    try {
	this.parse(data);
    } catch (e) {
	this.emit('error', e);
	this.emit('close');
    }
};

Parser.prototype.end = function(data) {
    var error;
    try {
	this.parse(data || "", true);
    } catch (e) {
	error = e;
    }

    if (!error)
	this.emit('end');
    else
	this.emit('error', error);
    this.emit('close');
};

Parser.prototype.reset = function() {
    return this.parser.reset();
};
Parser.prototype.getCurrentLineNumber = function() {
    return this.parser.getCurrentLineNumber();
};
Parser.prototype.getCurrentColumnNumber = function() {
    return this.parser.getCurrentColumnNumber();
};
Parser.prototype.getCurrentByteIndex = function() {
    return this.parser.getCurrentByteIndex();
};

//Exports

exports.Parser = Parser;

exports.createParser = function(cb) {
  var parser = new Parser();
  if(cb)  { parser.on('startElement', cb); }
  return parser;
};
