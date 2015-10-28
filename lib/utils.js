
"use strict";
var crypto = require('crypto');
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
exports.findPrefix = function(xmlnsMapping, nsURI) {
  for (var n in xmlnsMapping) {
    if (n === TNS_PREFIX) continue;
    if (xmlnsMapping[n] === nsURI)
      return n;
  }
};

/**
* Sign an envelope
* @param {EnvelopeSigner[]} signers Array of signers
* @param {String} envelope The envelope to sign
* @param {*} options Options to pass to the signer
* @param {Function} callback Function to be called once the envelope is signed
*/
exports.sign = function(signers, envelope, options, callback) {
  var next, handled;
  signers = signers.slice();
  function returnCallback(error, envelope){
    if(handled) {
      return;
    }
    handled = true;
    callback(error,envelope);
  }
  next = function(error, envelope) {
    if(handled) {
      return;
    }
    var signer;
    if (error) {
      return returnCallback(error, envelope);
    }
    signer = signers.shift();
    if(!signer) {
      return returnCallback(null, envelope);
    }
    try{
      signer(envelope, options, next);
    }catch(error){
      returnCallback(error,envelope);
    }
  };
  next(null, envelope);
};

/**
* @callback EnvelopeSigner
* @param {String} envelope The envelope to sign
* @param {*} options
* @param {NodeCallback} callback
*/

/**
* @callback NodeCallback
* @param {*|null} error
* @param {String} envelope
*/
