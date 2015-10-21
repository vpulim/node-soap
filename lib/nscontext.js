'use strict';

module.exports = NamespaceContext;

/**
 * Scope for XML namespaces
 * @param {NamespaceScope} [parent] Parent scope
 * @returns {NamespaceScope}
 * @constructor
 */
function NamespaceScope(parent) {
  if (!(this instanceof NamespaceScope)) {
    return new NamespaceScope(parent);
  }
  this.parent = parent;
  this.namespaces = {};
}

/**
 * Namespace context that manages hierarchical scopes
 * @returns {NamespaceContext}
 * @constructor
 */
function NamespaceContext() {
  if (!(this instanceof NamespaceContext)) {
    return new NamespaceContext();
  }
  this.scopes = [];
  this.pushContext();
  this.prefixCount = 0;
}

/**
 * Look up the namespace URI by prefix
 * @param {String} prefix Namespace prefix
 * @param {Boolean} [localOnly] Search current scope only
 * @returns {String} Namespace URI
 */
NamespaceScope.prototype.getNamespaceURI = function(prefix, localOnly) {
  switch (prefix) {
    case 'xml':
      return 'http://www.w3.org/XML/1998/namespace';
    case 'xmlns':
      return 'http://www.w3.org/2000/xmlns/';
    default:
      var nsUri = this.namespaces[prefix];
      /*jshint -W116 */
      if (nsUri != null) {
        return nsUri.uri;
      } else if (!localOnly && this.parent) {
        return this.parent.getNamespaceURI(prefix);
      } else {
        return null;
      }
  }
};

NamespaceScope.prototype.getNamespaceMapping = function(prefix) {
  switch (prefix) {
    case 'xml':
      return {
        uri: 'http://www.w3.org/XML/1998/namespace',
        prefix: 'xml',
        declared: true
      };
    case 'xmlns':
      return {
        uri: 'http://www.w3.org/2000/xmlns/',
        prefix: 'xmlns',
        declared: true
      };
    default:
      var mapping = this.namespaces[prefix];
      /*jshint -W116 */
      if (mapping != null) {
        return mapping;
      } else if (this.parent) {
        return this.parent.getNamespaceMapping(prefix);
      } else {
        return null;
      }
  }
};

/**
 * Look up the namespace prefix by URI
 * @param {String} nsUri Namespace URI
 * @param {Boolean} [localOnly] Search current scope only
 * @returns {String} Namespace prefix
 */
NamespaceScope.prototype.getPrefix = function(nsUri, localOnly) {
  switch (nsUri) {
    case 'http://www.w3.org/XML/1998/namespace':
      return 'xml';
    case 'http://www.w3.org/2000/xmlns/':
      return 'xmlns';
    default:
      for (var p in this.namespaces) {
        if (this.namespaces[p].uri === nsUri) {
          return p;
        }
      }
      if (!localOnly && this.parent) {
        return this.parent.getPrefix(nsUri);
      } else {
        return null;
      }
  }
};

/**
 * Add a prefix/URI namespace mapping
 * @param {String} prefix Namespace prefix
 * @param {String} nsUri Namespace URI
 * @param {Boolean} [localOnly] Search current scope only
 * @returns {boolean} true if the mapping is added or false if the mapping
 * already exists
 */
NamespaceContext.prototype.addNamespace = function(prefix, nsUri, localOnly) {
  if (this.getNamespaceURI(prefix, localOnly) === nsUri) {
    return false;
  }
  if (this.currentScope) {
    this.currentScope.namespaces[prefix] = {
      uri: nsUri,
      prefix: prefix,
      declared: false
    };
    return true;
  }
  return false;
};

/**
 * Push a scope into the context
 * @returns {NamespaceScope} The current scope
 */
NamespaceContext.prototype.pushContext = function() {
  var scope = new NamespaceScope(this.currentScope);
  this.scopes.push(scope);
  this.currentScope = scope;
  return scope;
};

/**
 * Pop a scope out of the context
 * @returns {NamespaceScope} The removed scope
 */
NamespaceContext.prototype.popContext = function() {
  var scope = this.scopes.pop();
  if (scope) {
    this.currentScope = scope.parent;
  } else {
    this.currentScope = null;
  }
  return scope;
};

/**
 * Look up the namespace URI by prefix
 * @param {String} prefix Namespace prefix
 * @param {Boolean} [localOnly] Search current scope only
 * @returns {String} Namespace URI
 */
NamespaceContext.prototype.getNamespaceURI = function(prefix, localOnly) {
  return this.currentScope && this.currentScope.getNamespaceURI(prefix, localOnly);
};

/**
 * Look up the namespace prefix by URI
 * @param {String} nsURI Namespace URI
 * @param {Boolean} [localOnly] Search current scope only
 * @returns {String} Namespace prefix
 */
NamespaceContext.prototype.getPrefix = function(nsUri, localOnly) {
  return this.currentScope && this.currentScope.getPrefix(nsUri, localOnly);
};

/**
 * Register a namespace
 * @param {String} nsUri Namespace URI
 * @returns {String} The matching or generated namespace prefix
 */
NamespaceContext.prototype.registerNamespace = function(nsUri) {
  var prefix = this.getPrefix(nsUri);
  if (prefix) {
    // If the namespace has already mapped to a prefix
    return prefix;
  } else {
    // Try to generate a unique namespace
    while (true) {
      prefix = 'ns' + (++this.prefixCount);
      if (!this.getNamespaceURI(prefix)) {
        // The prefix is not used
        break;
      }
    }
  }
  this.addNamespace(prefix, nsUri, true);
  return prefix;
};

/**
 * Declare a namespace prefix/uri mapping
 * @param {String} prefix Namespace prefix
 * @param {String} nsUri Namespace URI
 * @returns {Boolean} true if the declaration is created
 */
NamespaceContext.prototype.declareNamespace = function(prefix, nsUri) {
  if (this.currentScope) {
    var mapping = this.currentScope.getNamespaceMapping(prefix);
    if (mapping && mapping.uri === nsUri && mapping.declared) {
      return false;
    }
    this.currentScope.namespaces[prefix] = {
      uri: nsUri,
      prefix: prefix,
      declared: true
    };
    return true;
  }
  return false;
};
