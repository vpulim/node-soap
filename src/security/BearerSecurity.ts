
import { deepmergeInto } from 'deepmerge-ts';
import { IHeaders, ISecurity } from '../types';

export class BearerSecurity implements ISecurity {
  private defaults;
  private _token: string;

  constructor(token: string, defaults?: any) {
    this._token = token;
    this.defaults = {};
    deepmergeInto(this.defaults, defaults);
  }

  public addHeaders(headers: IHeaders): void {
    headers.Authorization = 'Bearer ' + this._token;
  }

  public toXML(): string {
    return '';
  }

  public addOptions(options: any): void {
    deepmergeInto(options, this.defaults);
  }
}
