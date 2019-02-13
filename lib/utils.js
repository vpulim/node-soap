
"use strict";
var crypto = require('crypto');
exports.passwordDigest = function passwordDigest(nonce, created, password) {
  // digest = base64 ( sha1 ( nonce + created + password ) )
  var pwHash = crypto.createHash('sha1');
  
  var NonceBytes = Buffer.from(nonce || '', 'base64');
    var CreatedBytes = Buffer.from(created || '','utf8');
  var PasswordBytes = Buffer.from(password || '', 'utf8');
  var FullBytes = Buffer.concat([NonceBytes, CreatedBytes, PasswordBytes ]);
 
  pwHash.update(FullBytes);
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
exports.findPrefix = function(xmlnsMapping, nsURI) {
  for (var n in xmlnsMapping) {
    if (n === TNS_PREFIX) continue;
    if (xmlnsMapping[n] === nsURI) {
      return n;
    }
  }
};
