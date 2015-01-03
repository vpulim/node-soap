/**
 * Created by sguilly on 03/01/15.
 */

"use strict";

var soap = require('..'),
   assert = require('assert');

var ipCamera = '192.168.0.31';
var login = 'admin';
var password = 'TBD';

describe('SOAP ONVIF', function() {


  it('should read users from camera', function(done) {
    var called = false;

    soap.createClient(__dirname+'/wsdl/devicemgmt.wsdl', function(err, client) {

      assert.ok(client);
      assert.ok(!err);

      client.setSecurity(new soap.WSSecurity(login, password,'PasswordDigest'));
      client.setEndpoint('http://'+ipCamera+'/onvif/device_service');

      client.DeviceService.DevicePort.GetUsers(function(err,value)
      {

        assert.ok(value['User']);
        assert.ok(!err);

        called = true;
        done();

      });

    });
    assert(!called);
  });

  it('should read ntp from camera', function(done) {
    var called = false;

    soap.createClient(__dirname+'/wsdl/devicemgmt.wsdl', function(err, client) {

      assert.ok(client);
      assert.ok(!err);

      client.setSecurity(new soap.WSSecurity(login, password,'PasswordDigest'));
      client.setEndpoint('http://'+ipCamera+'/onvif/device_service');

      client.DeviceService.DevicePort.GetNTP(function(err,value)
      {

        assert.ok(value['NTPInformation']);
        assert.ok(!err);

        called = true;
        done();

      });

    });
    assert(!called);
  });

  it('should read date/time from camera', function(done) {
    var called = false;

    soap.createClient(__dirname+'/wsdl/devicemgmt.wsdl', function(err, client) {

      assert.ok(client);
      assert.ok(!err);

      client.setSecurity(new soap.WSSecurity(login, password,'PasswordDigest'));
      client.setEndpoint('http://'+ipCamera+'/onvif/device_service');

      client.DeviceService.DevicePort.GetSystemDateAndTime(function(err,value)
      {

        assert.ok(value['SystemDateAndTime']);
        assert.ok(!err);

        called = true;
        done();

      });

    });
    assert(!called);
  });

  it('should createPullPointSubscription', function(done) {
    var called = false;

    soap.createClient(__dirname+'/wsdl/event.wsdl', function(err, client) {

      assert.ok(client);
      assert.ok(!err);

      client.setSecurity(new soap.WSSecurity(login, password,'PasswordDigest'));
      client.setEndpoint('http://'+ipCamera+'/onvif/event_service');

      client.EventService.EventPort.CreatePullPointSubscription({InitialTerminationTime: 'PT10M'},function(err,value)
      {

        assert.ok(value['SubscriptionReference']);
        assert.ok(!err);

        called = true;
        done();

      });

    });
    assert(!called);
  });

});
