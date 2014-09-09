"use strict";

var _ = require('lodash');

function BearerSecurity(token, defaults) {
	this._token = token;
	this.defaults = {};
	_.merge(this.defaults, defaults);
}

BearerSecurity.prototype.addHeaders = function(headers) {
	headers.Authorization = "Bearer " + this._token;
};

BearerSecurity.prototype.toXML = function() {
	return '';
};

BearerSecurity.prototype.addOptions = function(options) {
  _.merge(options, this.defaults);
};

module.exports = BearerSecurity;
