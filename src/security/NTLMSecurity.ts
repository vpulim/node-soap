
import { deepmergeInto } from 'deepmerge-ts';
import { IHeaders, ISecurity } from '../types';

export class NTLMSecurity implements ISecurity {
  private defaults;

  constructor(defaults: any);
  constructor(username: any, password?: string, domain?: string, workstation?: string) {
    if (typeof username === 'object') {
      this.defaults = username;
      this.defaults.ntlm = true;
    } else {
      this.defaults = {
        ntlm: true,
        username: username,
        password: password,
        domain: domain,
        workstation: workstation,
      };
    }
  }

  public addHeaders(headers: IHeaders): void {
    headers.Connection = 'keep-alive';
  }

  public toXML(): string {
    return '';
  }

  public addOptions(options: any): void {
    deepmergeInto(options, this.defaults);
  }
}
