
"use strict";
var crypto = require('crypto');
var moment = require('moment');
var moment = require('moment-timezone');

exports.passwordDigest = function passwordDigest(nonce, created, password) {
  // digest = base64 ( sha1 ( nonce + created + password ) )
  var pwHash = crypto.createHash('sha1');
  var rawNonce = new Buffer(nonce || '', 'base64').toString('binary');
  pwHash.update(rawNonce + created + password);
  return pwHash.digest('base64');
};


var TNS_PREFIX = '__tns__'; // Prefix for targetNamespace

exports.TNS_PREFIX = TNS_PREFIX;

/**
 * Find a key from an object based on the value
 * @param {Object} Namespace prefix/uri mapping
 * @param {*} nsURI value
 * @returns {String} The matching key
 */
exports.findPrefix = function (xmlnsMapping, nsURI) {
  for (var n in xmlnsMapping) {
    if (n === TNS_PREFIX) continue;
    if (xmlnsMapping[n] === nsURI) {
      return n;
    }
  }
};

/** 
 * Create a date object from a value that can be a string or object.
 * @param {(String|Object)} The original string or object to convert to a date.
 * @param {*} The value to use if parsing fails.
 * @param {String} The optional format to use when parsing with moment.js
 * @return {Object} The date established by parsing the input or the default value if this fails.
 */
exports.parseDate = function (value, defaultValue, momentDateTimeFormat, overrideTimeZone) {
  var momentDate = momentDateTimeFormat ? moment(value, momentDateTimeFormat) : moment(value);
  if (overrideTimeZone) {
    momentDate.tz(overrideTimeZone);
  }
  // This check needs to be updated once moment stops defaulting to the Date constructor if it fails to parse.
  if (momentDate.toString().toLowerCase !== 'invalid date') {
    return momentDate.toDate();
  }
  return defaultValue;
};