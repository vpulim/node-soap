var assert = require('assert');
var glob = require('glob');
var soap = require('..');
var fs = require('fs');
var path = require('path');

var instance;
var tests = {};

var xmlResponses = glob.sync('response-parsing/*', {cwd:__dirname})
  .filter(function(entry){
    return fs.statSync(path.resolve(__dirname, entry)).isDirectory();   
  });

module.exports = {
  'Response Parsing':tests
};

//generate the tests
xmlResponses.forEach(function(relativePath){
  var dir = path.resolve(__dirname, relativePath);
  var xmlResponse = path.resolve(dir, 'response.xml');
  var jsonResponse = path.resolve(dir, 'response.json');
  var wsdl = path.resolve(dir, 'soap.wsdl');
  var testname = path.basename(dir);

  tests[testname] = generateTest(xmlResponse, jsonResponse, wsdl);
});

function generateTest(xmlPath, jsonPath, wsdlPath){
  return function(done){
    soap.createClient(wsdlPath, function(err, client){
      var wsdl = client.wsdl;
      var responseXml = ""+fs.readFileSync(xmlPath);
      var proposedObj = wsdl.xmlToObject(responseXml);
      var expectedObj = require(jsonPath);
      assert.deepEqual(proposedObj, expectedObj);
      done();
    });
  };
}
