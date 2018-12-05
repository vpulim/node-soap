"use strict";
var customDeserializer = {
  DateTime: function (text) { return new Date(text); },
  TimeHourMinute: function (text) {
    // Return number of minutes since midnight
    var results = text.split(':').map(function (t) { return parseInt(t, 10); });
    return results[0] * 60 + results[1];
  },
  NestedSimpleType: function (text) {
    // Return number of minutes since midnight
    var results = text.split(':').map(function (t) { return parseInt(t, 10); });
    return results[0] * 60 + results[1];
  }
};

module.exports = customDeserializer;
