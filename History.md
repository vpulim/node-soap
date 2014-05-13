0.4.5 / 2014-05-13
=================
* Fixed: Unspecified binding style defaults to 'document' (#346, #208)
* Fixed: WSDL parse errors bubble up (#344)
* Fixed: AssertionError: Invalid child type when WSDL contains imports (#322, #337)
* Fixed: TargetNamespace not loaded when import in schema (#327, #325)

0.4.4 / 2014-04-16
=================
* Added namespace prefixes to SOAP headers. #307
* Provided more documentation around security protocols in the README. #321
* Added lodash. #321
* Added a default parameter to ClientSSLSecurity. #321
* Fix to reset the generated namespace number. #308
* Fixed maximum callstack errors on certain responses. #257

0.4.3 / 2014-04-07
=================
* Refactored WS-security. small modifications to  pull #275
* Updated readme to add documentation for passing options to a client request
* Added null check for portType and methods[methodname].output
* Fixed issue where requests that included compex types led to invalid request XML.
* Support for attributes array elements and support for complex extensions with array elements.
* Make sure callback is done asynchronously for a cached wsdl
* Added WSDL inheritance support (#133).

0.4.2 / 2014-03-13
=================
* Added the ability to inspect and clear soap headers.
* Reducing test wsdl size.
* No longer prefixing elements with a default namespace prefix i.e. xmlns.

0.4.1 / 2014-03-04
=================
Note: an error occurred publishing this version to npm.  This version was tagged, so it can be referrenced via git.
 * package; increased minor version to 0.4.1
 * Adding an npmignore on test/
 * Tests are linted
 * Attributes may be added to requests and parsed from responses
 * Tests were added for ssl and client authentication
 * Support for import elements in WSDL documents.
 * Version in server response matches package.json
 * Describe errors fixed on OutputElements.
 * Support for Fault handling.

0.4.0 / 2014-02-15
==================

 * package; increased minor version to 0.4 (xml parser change, tests)
 * remove execute privileges on files #216
 * add travis #219
 * add jshint for index.js #220
 * remove execute permissions on .gitignore #227
 * fixed; fix requests if SOAP service is not on port 80, do not crash on errors #228
 * fixed; undefined value for json in client method when message names end with Out or Output. #243
 * add non xmlns attributes to elements during response parsing #241
 * package; replace expat dependency with sax #246
 * fixed; "Uncaught TypeError: Cannot read property '0' of undefined" #248

0.3.2 / 2014-01-21
==================

 * fixed; http request callback fires twice on error #120
 * fixed; handle connection errors #192
 * package; include mocha in devDependencies
