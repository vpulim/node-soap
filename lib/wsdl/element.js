/*
 * Copyright (c) 2011 Vinay Pulim <vinay@milewise.com>
 * MIT Licensed
 *
 */
/*jshint proto:true*/

"use strict";

var splitNSName = require('./split_ns_name');
var extend = require('./extend');

module.exports = Element;

function Element(nsName, attrs, options) {
  var parts = splitNSName(nsName);

  this.nsName = nsName;
  this.namespace = parts.namespace;
  this.name = parts.name;
  this.children = [];
  this.xmlns = {};

  this._initializeOptions(options);

  for (var key in attrs) {
    var match = /^xmlns:?(.*)$/.exec(key);
    if (match) {
      this.xmlns[match[1] ? match[1] : 'xmlns'] = attrs[key];
    }
    else {
      if(key === 'value') {
        this[this.valueKey] = attrs[key];
      } else {
        this['$' + key] = attrs[key];
      }
    }
  }
}

Element.prototype._initializeOptions = function (options) {
  if(options) {
    this.valueKey = options.valueKey || '$value';
    this.xmlKey = options.xmlKey || '$xml';
    this.ignoredNamespaces = options.ignoredNamespaces || [];
  } else {
    this.valueKey = '$value';
    this.xmlKey = '$xml';
    this.ignoredNamespaces = [];
  }
};

Element.prototype.deleteFixedAttrs = function() {
  this.children && this.children.length === 0 && delete this.children;
  this.xmlns && Object.keys(this.xmlns).length === 0 && delete this.xmlns;
  delete this.nsName;
  delete this.namespace;
  delete this.name;
};

Element.prototype.allowedChildren = [];

Element.prototype.startElement = function(stack, nsName, attrs, options) {
  if (!this.allowedChildren)
    return;

  var ChildClass = this.allowedChildren[splitNSName(nsName).name],
    element = null;

  if (ChildClass) {
    stack.push(new ChildClass(nsName, attrs, options));
  }
  else {
    this.unexpected(nsName);
  }

};

Element.prototype.endElement = function(stack, nsName) {
  if (this.nsName === nsName) {
    if (stack.length < 2)
      return;
    var parent = stack[stack.length - 2];
    if (this !== stack[0]) {
      extend(stack[0].xmlns, this.xmlns);
      // delete this.xmlns;
      parent.children.push(this);
      parent.addChild(this);
    }
    stack.pop();
  }
};

Element.prototype.addChild = function(child) {
  return;
};

Element.prototype.unexpected = function(name) {
  throw new Error('Found unexpected element (' + name + ') inside ' + this.nsName);
};

Element.prototype.description = function(definitions) {
  return this.$name || this.name;
};

Element.prototype.init = function() {
};

Element.createSubClass = function() {
  var root = this;
  var subElement = function() {
    root.apply(this, arguments);
    this.init();
  };
  // inherits(subElement, root);
  subElement.prototype.__proto__ = root.prototype;
  return subElement;
};

