
import * as crypto from 'crypto';
import { IMTOMAttachments } from './types';
const MultipartParser = require('formidable/lib/multipart_parser.js').MultipartParser;

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

export function xmlEscape(obj) {
  if (typeof (obj) === 'string') {
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

export function parseMTOMResp(payload: Buffer, boundary: string): IMTOMAttachments{
  const resp: IMTOMAttachments = {
    parts:[]
  };
  let headerName = "", headerValue = "", data: Buffer;
  let partIndex = 0;
  const parser = new MultipartParser();


  parser.initWithBoundary(boundary)
  parser.onPartBegin = function() {
    resp.parts[partIndex] = {
      body:null,
      headers:{}
    };
    data = Buffer.from('');
  }

  parser.onHeaderField = function(b: Buffer, start: number, end: number) {
    headerName = b.slice(start, end).toString()
  };

  parser.onHeaderValue = function(b: Buffer, start: number, end: number) {
    headerValue = b.slice(start, end).toString()
  }

  parser.onHeaderEnd = function() {
    resp.parts[partIndex].headers[headerName.toLowerCase()] = headerValue;
  }

  parser.onHeadersEnd = function() {}

  parser.onPartData = function(b: Buffer, start: number, end: number) {
      data = Buffer.concat([data, b.slice(start, end)]);
  }

  parser.onPartEnd = function() {
    resp.parts[partIndex].body = data;
    partIndex++;
  }

  parser.onEnd = function() {}
  parser.write(payload);

  return resp;
}