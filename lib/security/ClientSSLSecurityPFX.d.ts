/// <reference types="node" />
import { ISecurity } from '../types';
/**
 * activates SSL for an already existing client using a PFX cert
 *
 * @module ClientSSLSecurityPFX
 * @param {Buffer|String}   pfx
 * @param {String}   passphrase
 * @constructor
 */
export declare class ClientSSLSecurityPFX implements ISecurity {
    private pfx;
    private defaults;
    private passphrase;
    constructor(pfx: string | Buffer, defaults?: any);
    constructor(pfx: string | Buffer, passphrase: string, defaults?: any);
    toXML(): string;
    addOptions(options: any): void;
}
