exports.customDeserializer = {
  DateTime: (text) => new Date(text),
  TimeHourMinute: (text) => {
    // Return number of minutes since midnight
    const results = text.split(':').map(t => parseInt(t, 10));
    return results[0] * 60 + results[1];
  },
  NestedSimpleType: (text) => {
    // Return number of minutes since midnight
    const results = text.split(':').map(t => parseInt(t, 10));
    return results[0] * 60 + results[1];
  }
};
