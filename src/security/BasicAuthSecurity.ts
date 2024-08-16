
import { deepmergeInto } from 'deepmerge-ts';
import { IHeaders, ISecurity } from '../types';

export class BasicAuthSecurity implements ISecurity {
  private _username: string;
  private _password: string;
  private defaults;

  constructor(username: string, password: string, defaults?: any) {
    this._username = username;
    this._password = password;
    this.defaults = {};
    deepmergeInto(this.defaults, defaults);
  }

  public addHeaders(headers: IHeaders): void {
    headers.Authorization = 'Basic ' + Buffer.from((this._username + ':' + this._password) || '').toString('base64');
  }

  public toXML(): string {
    return '';
  }

  public addOptions(options: any): void {
    deepmergeInto(options, this.defaults);
  }
}
