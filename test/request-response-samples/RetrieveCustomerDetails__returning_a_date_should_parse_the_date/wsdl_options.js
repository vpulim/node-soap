'use strict';

exports.customDeserializer = {
  date: function (text, context) {
    return text;
  },
};

exports.ignoreBaseNameSpaces = false;
