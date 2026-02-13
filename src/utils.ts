import * as crypto from 'crypto';
import { IMTOMAttachments, IWSDLCache } from './types';
import { WSDL } from './wsdl';

// ---------------------------------------------------------------------------
// Utility functions extracted from lodash (https://lodash.com/)
// MIT License – Copyright JS Foundation and other contributors
// ---------------------------------------------------------------------------

// --- START lodash replacement ---

export function isObject(value: unknown): value is object {
  const type = typeof value;
  return value != null && (type === 'object' || type === 'function');
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

export function merge<T>(target: T, ...sources: any[]): T {
  return mergeWith(target, ...sources, undefined);
}

export function mergeWith<T>(target: T, ...args: any[]): T {
  const customizer: ((a: any, b: any, key: string) => any) | undefined = args.pop();
  const sources: any[] = args;

  for (const source of sources) {
    if (source == null) {
      continue;
    }
    for (const key of Object.keys(source)) {
      baseMergeValue(target as any, source, key, customizer);
    }
  }
  return target;
}

function baseMergeValue(target: Record<string, any>, source: Record<string, any>, key: string, customizer?: (a: any, b: any, key: string) => any): void {
  const srcValue = source[key];
  const objValue = target[key];

  if (customizer) {
    const customResult = customizer(objValue, srcValue, key);
    if (customResult !== undefined) {
      target[key] = customResult;
      return;
    }
  }

  if (srcValue === undefined) {
    return;
  }

  if (isPlainObject(srcValue)) {
    if (isPlainObject(objValue)) {
      for (const k of Object.keys(srcValue)) {
        baseMergeValue(objValue as Record<string, any>, srcValue as Record<string, any>, k, customizer);
      }
    } else {
      target[key] = merge({}, srcValue);
    }
  } else if (Array.isArray(srcValue)) {
    if (Array.isArray(objValue)) {
      for (let i = 0; i < srcValue.length; i++) {
        if (isPlainObject(srcValue[i]) && isPlainObject(objValue[i])) {
          merge(objValue[i], srcValue[i]);
        } else if (srcValue[i] !== undefined) {
          objValue[i] = srcValue[i];
        }
      }
    } else {
      target[key] = srcValue.slice();
    }
  } else {
    target[key] = srcValue;
  }
}

export function defaults<T>(target: T, ...sources: any[]): T {
  for (const source of sources) {
    if (source == null) {
      continue;
    }
    for (const key of Object.keys(source)) {
      if ((target as any)[key] === undefined) {
        (target as any)[key] = source[key];
      }
    }
  }
  return target;
}

export function defaultsDeep<T>(target: T, ...sources: any[]): T {
  for (const source of sources) {
    if (source == null) {
      continue;
    }
    for (const key of Object.keys(source)) {
      const tVal = (target as any)[key];
      const sVal = source[key];
      if (isPlainObject(tVal) && isPlainObject(sVal)) {
        defaultsDeep(tVal, sVal);
      } else if (tVal === undefined) {
        (target as any)[key] = sVal;
      }
    }
  }
  return target;
}

export function pickBy<T extends Record<string, any>>(object: T, predicate: (value: any, key: string) => boolean): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(object)) {
    if (predicate(object[key], key)) {
      (result as any)[key] = object[key];
    }
  }
  return result;
}

export function once<T extends (...args: any[]) => any>(func: T): T {
  let called = false;
  let result: ReturnType<T>;
  return function (this: any, ...args: Parameters<T>): ReturnType<T> {
    if (!called) {
      called = true;
      result = func.apply(this, args);
    }
    return result;
  } as T;
}

// --- END lodash replacement ---

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

  const [topLevelName] = nsName.split('|', 1);

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
    return obj.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  return obj;
}

export function parseMTOMResp(payload: Buffer, boundary: string, callback: (err?: Error, resp?: IMTOMAttachments) => void) {
  return import('formidable')
    .then(({ MultipartParser }) => {
      const resp: IMTOMAttachments = {
        parts: [],
      };
      let headerName = '';
      let headerValue = '';
      let data: Buffer;
      let partIndex = 0;
      const parser = new MultipartParser();

      parser.initWithBoundary(boundary);
      parser.on('data', ({ name, buffer, start, end }) => {
        switch (name) {
          case 'partBegin':
            resp.parts[partIndex] = {
              body: null,
              headers: {},
            };
            data = Buffer.from('');
            break;
          case 'headerField':
            headerName = buffer.slice(start, end).toString();
            break;
          case 'headerValue':
            headerValue = buffer.slice(start, end).toString();
            break;
          case 'headerEnd':
            resp.parts[partIndex].headers[headerName.toLowerCase()] = headerValue;
            break;
          case 'partData':
            data = Buffer.concat([data, buffer.slice(start, end)]);
            break;
          case 'partEnd':
            resp.parts[partIndex].body = data;
            partIndex++;
            break;
        }
      });

      parser.write(payload);

      return callback(null, resp);
    })
    .catch(callback);
}

class DefaultWSDLCache implements IWSDLCache {
  private cache: {
    [key: string]: WSDL;
  };
  constructor() {
    this.cache = {};
  }

  public has(key: string): boolean {
    return !!this.cache[key];
  }

  public get(key: string): WSDL {
    return this.cache[key];
  }

  public set(key: string, wsdl: WSDL) {
    this.cache[key] = wsdl;
  }

  public clear() {
    this.cache = {};
  }
}
export const wsdlCacheSingleton = new DefaultWSDLCache();
