import * as fs from 'fs';
import * as https from 'https';
import * as _ from 'lodash';
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
export class ClientSSLSecurity implements ISecurity {
  private key: Buffer;
  private cert: Buffer;
  private ca;
  private defaults;
  private agent: https.Agent;

  constructor(key: string | Buffer, cert: string | Buffer, defaults?: any);
  constructor(
    key: string | Buffer,
    cert: string | Buffer,
    ca?: Buffer | string | any[],
    defaults?: any
  ) {
    if (key) {
      if (Buffer.isBuffer(key)) {
        this.key = key;
      } else if (typeof key === 'string') {
        this.key = fs.readFileSync(key);
      } else {
        throw new Error('key should be a buffer or a string!');
      }
    }

    if (cert) {
      if (Buffer.isBuffer(cert)) {
        this.cert = cert;
      } else if (typeof cert === 'string') {
        this.cert = fs.readFileSync(cert);
      } else {
        throw new Error('cert should be a buffer or a string!');
      }
    }

    if (ca) {
      if (Buffer.isBuffer(ca) || Array.isArray(ca)) {
        this.ca = ca;
      } else if (typeof ca === 'string') {
        this.ca = fs.readFileSync(ca);
      } else {
        defaults = ca;
        this.ca = null;
      }
    }

    this.defaults = {};
    _.merge(this.defaults, defaults);

    this.agent = null;
  }

  public toXML(): string {
    return '';
  }

  public addOptions(options: any): void {
    let httpsAgent = null;

    options.key = this.key;
    options.cert = this.cert;
    options.ca = this.ca;
    _.merge(options, this.defaults);

    if (!!options.forever) {
      if (!this.agent) {
        options.keepAlive = true;

        this.agent = new https.Agent(options);
      }

      httpsAgent = this.agent;
    } else {
      httpsAgent = new https.Agent(options);
    }

    options.agent = httpsAgent;
  }
}
