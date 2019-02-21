
import * as crypto from 'crypto';

export function passwordDigest(nonce: string, created: string, password: string): string {
  // digest = base64 ( sha1 ( nonce + created + password ) )
  const pwHash = crypto.createHash('sha1');

  const NonceBytes = Buffer.from(nonce || '', 'base64');
  const CreatedBytes = Buffer.from(created || '', 'utf8');
  const PasswordBytes = Buffer.from(password || '', 'utf8');
  const FullBytes = Buffer.concat([NonceBytes, CreatedBytes, PasswordBytes ]);

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
    if (n === TNS_PREFIX) { continue; }
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
