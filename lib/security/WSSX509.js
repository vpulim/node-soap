"use strict";

var ursa = require('ursa');
var SignedXml = require('xml-crypto').SignedXml;
var path = require('path');
var assert=require('assert');

var a_second=1000;
var a_minute=60*a_second;
var an_hour=60*a_minute;
var a_day=24*an_hour



function created(){
    return new Date(Date.now()).toISOString();
}

function expires(){
  var date=new Date(Date.now()+(5*a_minute));
    return date.toISOString();
}

function WSSx509(privateKey, public1Key, password, encoding ){

      assert.ok(privateKey,'You mus provide a private key');
      assert.ok(public1Key,'You mus provide a public key');
      this.signer=true;
    this._privateKey = ursa.createPrivateKey(privateKey, password, encoding);
    this._publicKey = public1Key.toString().replace('-----END CERTIFICATE-----','').replace('-----BEGIN CERTIFICATE-----','').replace(/^(\r\n|\n|\r)|(\r\n|\n|\r)$/g,'');
    this._signer = new SignedXml();
    this._signer.signingKey = this._privateKey.toPrivatePem();

    var references = [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/2001/10/xml-exc-c14n#'
    ];

    this._signer.addReference("//*[local-name(.)='Body']", references);
    this._signer.addReference("//*[local-name(.)='Timestamp']", references);

    this._signer.keyInfoProvider = {};
    this._signer.keyInfoProvider.getKeyInfo = function(key){
        return '<wsse:SecurityTokenReference>' +
            '<wsse:Reference URI="#x509cert00" ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"/>' +
            '</wsse:SecurityTokenReference>';
    };


}



WSSx509.prototype.postProcess = function( xml ){

    var cert=this._publicKey;
    var securedXML;
    var secHeader = '<wsse:Security xmlns:ds="http://www.w3.org/2000/09/xmldsig#" '+
                      'xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" '+
                      'xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" '+
                      'xmlns:xenc="http://www.w3.org/2001/04/xmlenc#">'+
                        '<wsse:BinarySecurityToken '+
                        'EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary" '+
                        'ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3" '+
                        'wsu:Id="x509cert00">'+
                          cert+
                        '</wsse:BinarySecurityToken> '+
                        '<Timestamp xmlns="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" Id="_1"> '+
                          '<Created>' +
                            created()+
                          '</Created>'+
                          '<Expires>' +
                            expires()+
                          '</Expires>'+
                        '</Timestamp>'+
                      '</wsse:Security>';


    if(!/<soap:Header/.test(xml)){
      securedXML=xml.replace('<soap:Body',('<soap:Header>\n'+secHeader+'\n</soap:Header>\n<soap:Body'))
    }
    else{
      securedXML=xml.replace('</soap:Header>',('\n'+secHeader+'\n</soap:Header>'))
    }

    this._signer.computeSignature(securedXML);
    securedXML = securedXML.replace('</wsse:Security>',(this._signer.getSignatureXml()+'\n</wsse:Security>'))
    return securedXML;
};

module.exports = WSSx509;
