"use strict";

module.exports = {
  BasicAuthSecurity: require('./BasicAuthSecurity')
, NTLMSecurity: require('./NTLMSecurity')
, ClientSSLSecurity: require('./ClientSSLSecurity')
, ClientSSLSecurityPFX: require('./ClientSSLSecurityPFX')
, WSSecurity: require('./WSSecurity')
, BearerSecurity: require('./BearerSecurity')
, WSSecurityCert: require('./WSSecurityCert')
};
