"use strict";

module.exports = {
  BasicAuthSecurity: require('./BasicAuthSecurity')
, NtlmSecurity: require('./NtlmSecurity')
, ClientSSLSecurity: require('./ClientSSLSecurity')
, ClientSSLSecurityPFX: require('./ClientSSLSecurityPFX')
, WSSecurity: require('./WSSecurity')
, BearerSecurity: require('./BearerSecurity')
};
