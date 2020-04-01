import * as crypto from 'crypto';
import * as pify from 'pify';

export function passwordDigest(nonce: string, created: string, password: string): string {
  // digest = base64 ( sha1 ( nonce + created + password ) )
  const pwHash = crypto.createHash('sha1');

  const NonceBytes = Buffer.from(nonce || '', 'base64');
  const CreatedBytes = Buffer.from(created || '', 'utf8');
  const PasswordBytes = Buffer.from(password || '', 'utf8');
  const FullBytes = Buffer.concat([NonceBytes, CreatedBytes, PasswordBytes]);

  pwHash.update(FullBytes);
  return pwHash.digest('base64');
}

export const TNS_PREFIX = '__tns__'; // Prefix for targetNamespace

/**
 * Find a key from an object based on the value
 * @param {Object} Namespace prefix/uri mapping
 * @param {*} nsURI value
 * @returns {String} The matching key
 */
export function findPrefix(xmlnsMapping, nsURI) {
  for (const n in xmlnsMapping) {
    if (n === TNS_PREFIX) {
      continue;
    }
    if (xmlnsMapping[n] === nsURI) {
      return n;
    }
  }
}

export function splitQName<T>(nsName: T) {
  if (typeof nsName !== 'string') {
    return {
      prefix: TNS_PREFIX,
      name: nsName,
    };
  }

  const [topLevelName] = nsName.split('|');

  const prefixOffset = topLevelName.indexOf(':');

  return {
    prefix: topLevelName.substring(0, prefixOffset) || TNS_PREFIX,
    name: topLevelName.substring(prefixOffset + 1),
  };
}

export function xmlEscape(obj) {
  if (typeof obj === 'string') {
    if (obj.substr(0, 9) === '<![CDATA[' && obj.substr(-3) === ']]>') {
      return obj;
    }
    return obj
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  return obj;
}

export function promisifyAll(obj, suffix = 'Async') {
  const identifier = /^[a-z$_][a-z$_0-9]*$/i;

  if (obj.___promisified) {
    return obj;
  }

  const functionBlackListMap =
    Object.getOwnPropertyNames(Object.prototype)
      .reduce((map, functionName) => {
        map[functionName] = true
        return map
      }, {});

  for (const key of Object.getOwnPropertyNames(obj)) {
    if (functionBlackListMap[key] || !identifier.test(key)) {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(obj, key)

    if (!descriptor.get) {
      const func = obj[key]
      if (typeof func === 'function') {
        obj[`${key}${suffix}`] = pify(func, { multiArgs: true })
      }
    }
    obj.___promisified = true;
  }

  return obj;
}