import * as crypto from 'crypto';
import { ISecurity } from '../types';
import { passwordDigest, xmlEscape } from '../utils';

const validPasswordTypes = ['PasswordDigest', 'PasswordText'];

export interface IWSSecurityOptions {
  passwordType?: string;
  hasTimeStamp?: boolean;
  hasNonce?: boolean;
  hasTokenCreated?: boolean;
  actor?: string;
  mustUnderstand?;
}

export class WSSecurity implements ISecurity {
  private _username: string;
  private _password: string;
  private _passwordType: string;
  private _hasTimeStamp: boolean;
  private _hasNonce: boolean;
  private _hasTokenCreated: boolean;
  private _actor: string;
  private _mustUnderstand: boolean;

  constructor(username: string, password: string, options?: string | IWSSecurityOptions) {
    options = options || {};
    this._username = username;
    this._password = password;
    // must account for backward compatibility for passwordType String param as well as object options defaults: passwordType = 'PasswordText', hasTimeStamp = true
    if (typeof options === 'string') {
      this._passwordType = options ? options : 'PasswordText';
      options = {};
    } else {
      this._passwordType = options.passwordType ? options.passwordType : 'PasswordText';
    }

    if (validPasswordTypes.indexOf(this._passwordType) === -1) {
      this._passwordType = 'PasswordText';
    }

    this._hasTimeStamp =
      options.hasTimeStamp || typeof options.hasTimeStamp === 'boolean'
        ? !!options.hasTimeStamp
        : true;
    /*jshint eqnull:true */
    if (options.hasNonce != null) {
      this._hasNonce = !!options.hasNonce;
    }
    this._hasTokenCreated =
      options.hasTokenCreated || typeof options.hasTokenCreated === 'boolean'
        ? !!options.hasTokenCreated
        : true;
    if (options.actor != null) {
      this._actor = options.actor;
    }
    if (options.mustUnderstand != null) {
      this._mustUnderstand = !!options.mustUnderstand;
    }
  }

  public toXML(): string {
    // avoid dependency on date formatting libraries
    function getDate(d) {
      function pad(n) {
        return n < 10 ? '0' + n : n;
      }
      return (
        d.getUTCFullYear() +
        '-' +
        pad(d.getUTCMonth() + 1) +
        '-' +
        pad(d.getUTCDate()) +
        'T' +
        pad(d.getUTCHours()) +
        ':' +
        pad(d.getUTCMinutes()) +
        ':' +
        pad(d.getUTCSeconds()) +
        'Z'
      );
    }
    const now = new Date();
    const created = getDate(now);
    let timeStampXml = '';
    if (this._hasTimeStamp) {
      const expires = getDate(new Date(now.getTime() + 1000 * 600));
      timeStampXml =
        '<wsu:Timestamp wsu:Id="Timestamp-' +
        created +
        '">' +
        '<wsu:Created>' +
        created +
        '</wsu:Created>' +
        '<wsu:Expires>' +
        expires +
        '</wsu:Expires>' +
        '</wsu:Timestamp>';
    }

    let password;
    let nonce;
    if (this._hasNonce || this._passwordType !== 'PasswordText') {
      // nonce = base64 ( sha1 ( created + random ) )
      const nHash = crypto.createHash('sha1');
      nHash.update(created + Math.random());
      nonce = nHash.digest('base64');
    }
    if (this._passwordType === 'PasswordText') {
      password =
        '<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">' +
        xmlEscape(this._password) +
        '</wsse:Password>';
      if (nonce) {
        password +=
          '<wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">' +
          nonce +
          '</wsse:Nonce>';
      }
    } else {
      /* Specific Testcase for passwordDigest calculation cover this code
    /* istanbul ignore next */
      password =
        '<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">' +
        passwordDigest(nonce, created, this._password) +
        '</wsse:Password>' +
        '<wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">' +
        nonce +
        '</wsse:Nonce>';
    }

    return (
      '<wsse:Security ' +
      (this._actor ? 'soap:actor="' + this._actor + '" ' : '') +
      (this._mustUnderstand ? 'soap:mustUnderstand="1" ' : '') +
      'xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">' +
      timeStampXml +
      '<wsse:UsernameToken xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd" wsu:Id="SecurityToken-' +
      created +
      '">' +
      '<wsse:Username>' +
      xmlEscape(this._username) +
      '</wsse:Username>' +
      password +
      (this._hasTokenCreated ? '<wsu:Created>' + created + '</wsu:Created>' : '') +
      '</wsse:UsernameToken>' +
      '</wsse:Security>'
    );
  }
}
