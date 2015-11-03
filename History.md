0.11.0 / 2015-10-31
=================
* [ENHANCEMENT] Now passing request to services in server.js. (#769)
* [ENHANCEMENT] Adding the ability to add headers in client requests. (#770)
* [MAINTENANCE] Adding gitter badge to README and disabling issues. (#731)
* [FIX] Stop sending Object prototype methods as XML. (#699)

0.10.3 / 2015-10-23
=================
* [ENHANCEMENT] Adding createErroringStub to soap-stub. (#765)
* [ENHANCEMENT] `forceSoap12Headers` option to add SOAP v1.2 request headers. (#755)

0.10.2 / 2015-10-22
=================
* [ENHANCEMENT] Adding security to soap-stub. (#764)

0.10.1 / 2015-10-22
=================
* [ENHANCEMENT] Adding soap-stub. (#763)

0.10.0 / 2015-10-21
=================
* [FIX] xml namespace/element/type handling. (#756)

0.9.5 / 2015-10-15
=================
* [FIX] Allow circular XSD files to be loaded. (#745)
* [ENHANCEMENT] Timestamp is now optional. (#735)
* [DOC] Formatting History.md 0.9.4 notes.

0.9.4 / 2015-09-28
=================
* [MAINTENANCE] Adding node v4.0 to .travis.yml. (#729)
* [MAINTENANCE] Increasing mocha test timeout to 10 seconds. (#732)
* [FIX] Resolve element references when other types are referenced. (#725)
* [DOC] Update Readme.md
* [ENHANCEMENT] New Ignorebasenamespaces option. (#716)
* [ENHANCEMENT] Add optional statusCode on soap fault. (#715)
* [FIX] Fix for wsdl retrieval using soap.createClient with special options.httpClient. Before this, the specified client was not used when fetching the wsdl file. This fix will force the wsdl to use the specified httpClient. (#714)
* [FIX] Allow WSDL to be loaded from HTTPS sites. (#694)

0.9.3 / 2015-09-08
=================
* [ENHANCEMENT] Allow namespace overriding for elements. (#709)
* [MAINTENANCE] Disable travis emails.

0.9.2 / 2015-09-08
=================
* [ENHANCEMENT] Add support for xsd element ref. (#700)
* [MAINTENANCE] Moving travis build to containers.
* [MAINTENANCE] Add request sample for an operation without any parameters. (#703)
* [DOC] update spelling and formatting to clarify several sections of Readme. (#708)
* [ENHANCEMENT] Add the correct namespace alias for operations without parameters by simply removing the special case where input.parts is empty. If special logic is wanted for this case, it should be contained in objectToRpcXML in any case. (#703)
* [FIX] Fix a typo in WSDL#findChildParameterObject. (#686)
* [FIX] Fixed SOAP Fault errors not being raised as errors. (#676)
* [FIX] Use diffrent namespace styles for soap fault 1.1 and 1.2. (#674)

0.9.1 / 2015-05-30
=================
* [FIX] Received empty Strings are now returned as empty String rather than an empty Object. (#637)

* [FIX] Get current namespace when parent namespace is an empty String. Fixes #533. (#661)

* [DOC] Update README.md with  documentation for #660 introduced customization of `httpClient` and `request` libs in `client.options`. (#664)

* [FIX] Take configured "ignored namespaces" into account when processing `objectToXml()`. Fixes #537. (#662)

* [LIC] Update license attribute to follow the new [npm conventions](https://docs.npmjs.com/files/package.json#license). (#663)

* [ENHANCEMENT] Add ability to customize `http` client / `request` lib on client creation. (#660)

* [FIX] Support `xsi:type` Schema on Element. Fixes #606. (#639)

* [FIX] Make parsing of recursive Elements in `wsdl` work. (#658)

0.9.0 / 2015-05-18
=================
* [FIX] Fix to allow request options and headers to persist for all includes. Fix to properly handle when an import/include starts with a schema element. (#608)

* [FIX] Do not end request for keep-alive connections (#600)

* [ENHANCEMENT] Added Client 'response' event (#610)

* [FIX] If response is json, then error should not be thrown. Fix issue #580 (#581)

* [FIX] Sub-namespace should be correct regardless of order of enumeration i.e. should not be overriden by other prop's namespace (#607)

* [DOC] Added a section about Server Events to README.md (#596)

* [ENHANCEMENT] Added Server 'request' event (#595)

* [ENHANCEMENT] Add support for One-Way Operations (#590)

* [FIX] `lib/wsdl.js` util function `extend()` doesn't throw an Error when handling elements that are not objects. (#589)

* [ENHANCEMENT] ClientSSLSecurity now accepts a `ca`-certificate. (#588)

* [ENHANCEMENT] ClientSSLSecurity should be able to take a Buffer as `key` and `cert` parameter. Additionally the certificates are checked whether they are correct or not (starting with `-----BEGIN`). (#586)

* [ENHANCEMENT] Add support for sending NULL values (#578)

* [ENHANCEMENT] Follow 302 redirects, don't mix quotes (#577)

* [DOC] Update CONTRIBUTING.md

* [FIX] Respond with security timestamp if request had one (#579)


0.8.0 / 2015-02-17
=================
* [ENHANCEMENT] `node-soap` is now also compatible (and tested) with `node v0.12.0` and `io.js` too. (#571)

* [FIX] Adds support for attributes in the `SOAP Body` Element (fixes #386). (#574)

0.7.0 / 2015-02-10
=================
* [ENHANCEMENT] Server emits a `headers` event to globally handle SOAP Headers. (#564 )

* [ENHANCEMENT] A service method can send back a SOAP Fault response to a client by throwing an object that contains a `Fault` property. (#563)

* [FIX] Don't throw an Error if an `element` is not defined. (#562)

* [ENHANCEMENT] Added more primitive types (`['positiveInteger', 'nonPositiveInteger', 'negativeInteger', 'nonNegativeInteger']`). (#560)

* [FIX] Respect empty SOAP actions in operations. (#554)

* [ENHANCEMENT] The client now emits `message`,  `request` and `soapError` events. (#547, #559)

* [ENHANCEMENT] The server is now aware of the SOAP header(s) from incoming request. (#551)

* [ENHANCEMENT] Until now, only the SOAP Body was returned from the invoked client method. With this PR also the SOAP Header(s) will be returned. (#539)

0.6.1 / 2014-12-20
==================
* [ENHANCEMENT] Allow logging of received `XML` prior to parsing and processing it, which allows better debugging of incoming`XML`. (#524)

* [ENHANCEMENT] Add support for importing external `wsdl`. (#523)

* [FIX] Use correct namespaces for elements which consist of an array. (#522)

* [FIX] Use correct namespaces for elements which have a different base namespace. (#521)

* [FIX] Don't throw an `Error` when `typeElement` is undefined in `ExtensionElement#description` method. (#515)

* [FIX] Only supply `nonce` when a password digest is used to avoid `schema` validation errors. (#496)

* [FIX] Allow `wsdl:documentation` element under `wsdl:message`. (#508)

* [FIX] Use correct namespaces in sequences with imported elements. (#502)

* [FIX] Ignore default `tns` and disabled default `tns` specification in first element of the body. (#506)

* [ENHANCEMENT] Define `$xml` to pass plain `XML` object. (#485)
The `$xml` key is used to pass an `XML` Object to the request without adding a namespace or parsing the string.

* [FIX] Updated '#extend' method to avoid overriding properties and ensure the 'inheritance' of `<xsd:extension base=...>` usage. (#493)

0.6.0 / 2014-10-29
=================
* [ENHANCEMENT] Adding bearer security type Exporting security type for usage.
* [ENHANCEMENT] The qualified elementFormQualified must be respected only when the current element is not a global element. The namespace attribute is only needed if it's not included in the xmlns.
* [FIX] Remove automatic port appending to "Host" header.
* [FIX] Avoid creating soap:Header container when there are no children.
* [FIX] Allowing a 'null' argument for WSDL methods that take no arguments.
* [FIX] Wrong initialization of xmlns array when handling rpc stype wsdl.
* [FIX] Fault handling.  err should be used less frequently now.
* [FIX] Added checking if there is input and output for operations under bindings section.
* [FIX] XSD conflict with same namespace.

0.5.1 / 2014-07-11
=================
* [ENHANCEMENT] Add "defaults" parameter to BasicAuthSecurity's constructor
* [ENHANCEMENT]  Added possibility to set a custom `valueKey` for the parsed values from XML SOAP Response
* [FIX]  don't append port 80 to Host if not needed
* [FIX]  Remove possible existing BOM characters from XML String before passing it to `WSDL#_fromXML()` and parsing it.
* [FIX]  Handling nil attributes in response xml

0.5.0 / 2014-07-11
=================
* [ENHANCEMENT] Allowing namespace prefixes to be ignored via config.
* [ENHANCEMENT] wsdl should handle more types
* [FIX] Handle defined messages ending with "Response", "Out", or "Output"
* [FIX] Adding default attributesKey to server and allowing the property to be configurable fixing issue #406
* [FIX] Remove extra characters before and after soap envelope
* [FIX] Allow operations to not have definitions
* [FIX] Ignore unknown elements
* [FIX] Keep ns from top-level
* [FIX] Check status code of invocation response

0.4.7 / 2014-06-16
=================
* [ENHANCEMENT] Allow request elements to have both content and attributes.

0.4.6 / 2014-06-16
=================
* Fix for the `elementFormDefault` functionality.
* Fix determining the namespace for complex elements.
* Add support for the `elementFormDefault` schema attribute.
* Fixing duplicate code which had gotten introduced because of a merge.
* Added the ability to specify elements in a $value attribute for complex types.
* Allowing the property name "attributes" to be configurable.
* Fix for andling object arrays.
* Fix for WSDL and Schema interaction.
* Allowing response.xml to be optional in tests.
* Allowing request.xml and response.json to be optional for tests.
* Fix for adding an undefined XML namespace.
* Added some documentation on options object when calling createClient.
* Fix for namespaces in headers not being added appropriately.

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
* Added a deefault parameter to ClientSSLSecurity. #321
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
