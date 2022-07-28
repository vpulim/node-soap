/// <reference types="node" />
import { ISecurity } from '../types';
/**
 * activates SSL for an already existing client
 *
 * @module ClientSSLSecurity
 * @param {Buffer|String}   key
 * @param {Buffer|String}   cert
 * @param {Buffer|String|Array}   [ca]
 * @param {Object}          [defaults]
 * @constructor
 */
export declare class ClientSSLSecurity implements ISecurity {
    private key;
    private cert;
    private ca;
    private defaults;
    private agent;
    constructor(key: string | Buffer, cert: string | Buffer, ca?: Buffer | string | any[] | any, defaults?: any);
    toXML(): string;
    addOptions(options: any): void;
}
