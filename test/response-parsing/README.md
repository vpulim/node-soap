This directory contains test cases for sample response parsing.  Since node-soap
generates the request XML, we can focus on the response aspect here.  This
directory contains child directories that each contain 3 files:


* response.json  This is the expected output of parsing response.xml
* response.xml  This is what the server is expected to respond back with
* soap.wsdl  This is the wsdl used to construct clients

The name of each directory herein should reflect the reason for it's addition.