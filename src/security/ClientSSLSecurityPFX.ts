import * as fs from 'fs';
import * as https from 'https';
import * as _ from 'lodash';
import { ISecurity } from '../types';

/**
 * activates SSL for an already existing client using a PFX cert
 *
 * @module ClientSSLSecurityPFX
 * @param {Buffer|String}   pfx
 * @param {String}   passphrase
 * @constructor
 */
export class ClientSSLSecurityPFX implements ISecurity {
  private pfx: Buffer;
  private defaults;
  private passphrase: string;

  constructor(pfx: string | Buffer, defaults?: any);
  constructor(pfx: string | Buffer, passphrase: string, defaults?: any) {
    if (typeof passphrase === 'object') {
      defaults = passphrase;
    }
    if (pfx) {
      if (Buffer.isBuffer(pfx)) {
        this.pfx = pfx;
      } else if (typeof pfx === 'string') {
        this.pfx = fs.readFileSync(pfx);
      } else {
        throw new Error('supplied pfx file should be a buffer or a file location');
      }
    }

    if (passphrase) {
      if (typeof passphrase === 'string') {
        this.passphrase = passphrase;
      }
    }
    this.defaults = {};
    _.merge(this.defaults, defaults);
  }

  public toXML(): string {
    return '';
  }

  public addOptions(options: any): void {
    options.pfx = this.pfx;
    if (this.passphrase) {
      options.passphrase = this.passphrase;
    }
    _.merge(options, this.defaults);
    options.agent = new https.Agent(options);
  }
}
