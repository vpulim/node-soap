#request-response-samples

This directory contains request / response samples.  This is the fastest way to
add tests, and it allows us to focus on higher level interfaces that should never
change.  We can change the guts of node-soap with more confidence as more samples
are added herein.

Follow this process to add samples herein:
1. Create a directory that combines the client method to invoke along with a
   test case name i.e. Operation__make_sure_short_is_returned_as_number.  This
   would invoke client.Operation under a "make sure short is returned as number"
   test case.
2. Add the following files within the directory just created:
  * request.json - This is the data fed to the client method being invoked
  * request.xml - This is the expected XML that should be sent to the server
  * response.xml - This is the XMl that the server responds with
  * response.json - This is the expected JSON from parsing the response XML
  * soap.wsdl - This is the WSDL that defines the operation and messages