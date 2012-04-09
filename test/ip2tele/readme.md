Document Style web service request and response test
----------

Introduction of Business
=====

  The test suite establish a web server, when browser access this web server from cellular mobile network of Tianjin CHINA UNICOM, the web server will make request to a web service that can tell which mobile number is accessing the web server. So any mobile site can easily determine the client's mobile number.

test remarks
===== 
  The production ip2tele web service is located at 3rd-party which can not guarantee availability all the time, but I provide a fake\_server(fake\_server.js), you can start the fake server and call ip2tele with args to specify call fake server instead of the real server.

	# for normal case to ask for production web-service at 3rd-party's
	node ip2tele.js
	
	# for closed test case to ask for fake web service withing this testing suite
	node fake_server.js &
	node ip2tele.js fake
	
  When you use your mobile phone to access the web server, the response page will tell you your mobile number and all the json request/response text.

  Since the WSDL use document style binding, I test the node\-soap module for document style. Notice that this soap module can allow single part message, server javascript will get only the internal contents of the top Element, but without the Element name. And client javascript should send internal contents of the top Element only, without TopElement:{internal content} form.