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
