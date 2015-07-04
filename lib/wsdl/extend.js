/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 *
 */
"use strict";

module.exports = extend;

/**
 * What we want is to copy properties from one object to another one and avoid 
 * properties overriding. This way we ensure the 'inheritance' of 
 * <xsd:extension base=...> usage.
 *
 * NB: 'Element' (and subtypes) don't have any prototyped properties: there's 
 * no need to process a 'hasOwnProperties' call, we should just iterate over the 
 * keys.
 */
function extend(base, obj) {
  if(base !== null && typeof base === "object" && obj !== null && typeof obj === "object"){
    Object.keys(obj).forEach(function(key) {
      if(!base.hasOwnProperty(key))
        base[key] = obj[key];
    });
  }
  return base;
}
