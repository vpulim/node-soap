/// <reference types="node" />
import { IMTOMAttachments, IWSDLCache } from './types';
import { WSDL } from './wsdl';
export declare function passwordDigest(nonce: string, created: string, password: string): string;
export declare const TNS_PREFIX = "__tns__";
/**
 * Find a key from an object based on the value
 * @param {Object} Namespace prefix/uri mapping
 * @param {*} nsURI value
 * @returns {String} The matching key
 */
export declare function findPrefix(xmlnsMapping: any, nsURI: any): string;
export declare function splitQName<T>(nsName: T): {
    prefix: string;
    name: T;
} | {
    prefix: string;
    name: string;
};
export declare function xmlEscape(obj: any): any;
export declare function parseMTOMResp(payload: Buffer, boundary: string, callback: (err?: Error, resp?: IMTOMAttachments) => void): Promise<void>;
declare class DefaultWSDLCache implements IWSDLCache {
    private cache;
    constructor();
    has(key: string): boolean;
    get(key: string): WSDL;
    set(key: string, wsdl: WSDL): void;
    clear(): void;
}
export declare const wsdlCacheSingleton: DefaultWSDLCache;
export {};
