/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 *
 */

"use strict";

module.exports = splitNSName;

function splitNSName(nsName) {
  var i = typeof nsName === 'string' ? nsName.indexOf(':') : -1;
  return i < 0 ? {namespace: 'xmlns', name: nsName} : {namespace: nsName.substring(0, i), name: nsName.substring(i + 1)};
}
