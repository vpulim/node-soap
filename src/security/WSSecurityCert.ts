
import { v4 as uuid4 } from 'uuid';
import { SignedXml } from 'xml-crypto';
import { ISecurity } from '../types';

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

function dateStringForSOAP(date: Date): string {
  return date.getUTCFullYear() + '-' + ('0' + (date.getUTCMonth() + 1)).slice(-2) + '-' +
    ('0' + date.getUTCDate()).slice(-2) + 'T' + ('0' + date.getUTCHours()).slice(-2) + ":" +
    ('0' + date.getUTCMinutes()).slice(-2) + ":" + ('0' + date.getUTCSeconds()).slice(-2) + "Z";
}

function generateCreated(): string {
  return dateStringForSOAP(new Date());
}

function generateExpires(): string {
  return dateStringForSOAP(addMinutes(new Date(), 10));
}

function insertStr(src: string, dst: string, pos: number): string {
  return [dst.slice(0, pos), src, dst.slice(pos)].join('');
}

function generateId(): string {
  return uuid4().replace(/-/gm, '');
}

const oasisBaseUri = 'http://docs.oasis-open.org/wss/2004/01';

export interface IWSSecurityCertOptions {
  hasTimeStamp?: boolean;
  signatureTransformations?: string[];
}

export class WSSecurityCert implements ISecurity {
  private publicP12PEM: string;
  private signer: any;
  private x509Id: string;
  private hasTimeStamp: boolean;
  private signatureTransformations: string[];
  private created: string;
  private expires: string;

  constructor(privatePEM: any, publicP12PEM: any, password: any, options?: IWSSecurityCertOptions) {
    options = options || {};
    this.publicP12PEM = publicP12PEM.toString()
      .replace('-----BEGIN CERTIFICATE-----', '')
      .replace('-----END CERTIFICATE-----', '')
      .replace(/(\r\n|\n|\r)/gm, '');

    this.signer = new SignedXml();
    this.signer.signingKey = {
      key: privatePEM,
      passphrase: password,
    };
    this.x509Id = `x509-${generateId()}`;
    this.hasTimeStamp = typeof options.hasTimeStamp === 'undefined' ? true : !!options.hasTimeStamp;
    this.signatureTransformations = Array.isArray(options.signatureTransformations) ? options.signatureTransformations
      : ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/2001/10/xml-exc-c14n#'];

    this.signer.keyInfoProvider = {};
    this.signer.keyInfoProvider.getKeyInfo = (key) => {
      return `<wsse:SecurityTokenReference>` +
        `<wsse:Reference URI="#${this.x509Id}" ValueType="${oasisBaseUri}/oasis-200401-wss-x509-token-profile-1.0#X509v3"/>` +
        `</wsse:SecurityTokenReference>`;
    };
  }

  public postProcess(xml, envelopeKey) {
    this.created = generateCreated();
    this.expires = generateExpires();

    let timestampStr = '';
    if (this.hasTimeStamp) {
      timestampStr =
        `<Timestamp xmlns="${oasisBaseUri}/oasis-200401-wss-wssecurity-utility-1.0.xsd" Id="_1">` +
          `<Created>${this.created}</Created>` +
          `<Expires>${this.expires}</Expires>` +
        `</Timestamp>`;
    }

    const secHeader =
      `<wsse:Security xmlns:wsse="${oasisBaseUri}/oasis-200401-wss-wssecurity-secext-1.0.xsd" ` +
          `xmlns:wsu="${oasisBaseUri}/oasis-200401-wss-wssecurity-utility-1.0.xsd" ` +
          `soap:mustUnderstand="1">` +
      `<wsse:BinarySecurityToken ` +
          `EncodingType="${oasisBaseUri}/oasis-200401-wss-soap-message-security-1.0#Base64Binary" ` +
          `ValueType="${oasisBaseUri}/oasis-200401-wss-x509-token-profile-1.0#X509v3" ` +
          `wsu:Id="${this.x509Id}">${this.publicP12PEM}</wsse:BinarySecurityToken>` +
      timestampStr +
      `</wsse:Security>`;

    var xmlWithSec = insertStr(secHeader, xml, xml.indexOf('</soap:Header>'));

    var references = this.signatureTransformations;

    var bodyXpath = `//*[name(.)='${envelopeKey}:Body']`;
    if (!(this.signer.references.filter((ref) => (ref.xpath === bodyXpath)).length > 0)) {
      this.signer.addReference(bodyXpath, references);
    }

    var timestampXpath = `//*[name(.)='wsse:Security']/*[local-name(.)='Timestamp']`;
    if (this.hasTimeStamp && !(this.signer.references.filter((ref) => (ref.xpath === timestampXpath)).length > 0)) {
      this.signer.addReference(timestampXpath, references);
    }

    this.signer.computeSignature(xmlWithSec);

    return insertStr(this.signer.getSignatureXml(), xmlWithSec, xmlWithSec.indexOf('</wsse:Security>'));
  }
}
