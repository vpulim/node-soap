import { v4 as uuidv4 } from 'uuid';
import { SignedXml } from 'xml-crypto';
import { ISecurity } from '../types';
import { IWSSecurityCertOptions, IXmlSignerOptions } from './WSSecurityCert';

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

function dateStringForSOAP(date: Date): string {
  return date.getUTCFullYear() + '-' + ('0' + (date.getUTCMonth() + 1)).slice(-2) + '-' +
    ('0' + date.getUTCDate()).slice(-2) + 'T' + ('0' + date.getUTCHours()).slice(-2) + ':' +
    ('0' + date.getUTCMinutes()).slice(-2) + ':' + ('0' + date.getUTCSeconds()).slice(-2) + 'Z';
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
  return uuidv4().replace(/-/gm, '');
}

function resolvePlaceholderInReferences(references: any[], bodyXpath: string) {
  for (const ref of references) {
    if (ref.xpath === bodyXpathPlaceholder) {
      ref.xpath = bodyXpath;
    }
  }
}

const oasisBaseUri = 'http://docs.oasis-open.org/wss/2004/01';
const bodyXpathPlaceholder = '[[bodyXpath]]';



export class WSSecurityCertWithToken implements ISecurity {
  private publicP12PEM: string;
  private signer: any;
  private signerOptions: IXmlSignerOptions = {};
  private x509Id: string;
  private hasTimeStamp: boolean;
  private signatureTransformations: string[];
  private created: string;
  private expires: string;
  private additionalReferences: string[] = [];
  private username: string;
  private password: string;

  constructor(props: {privateKey: any, publicKey: any, keyPassword: any, username: string, password: string, options?: IWSSecurityCertOptions}) {
    this.publicP12PEM = props.publicKey.toString()
      .replace('-----BEGIN CERTIFICATE-----', '')
      .replace('-----END CERTIFICATE-----', '')
      .replace(/(\r\n|\n|\r)/gm, '');
    this.username = props.username;
    this.password = props.password;

    this.signer = new SignedXml();
    const opts = props.options || {}
    if (opts.signatureAlgorithm === 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256') {
      this.signer.signatureAlgorithm = opts.signatureAlgorithm;
      this.signer.addReference(
        bodyXpathPlaceholder,
        ['http://www.w3.org/2001/10/xml-exc-c14n#'],
        'http://www.w3.org/2001/04/xmlenc#sha256',
      );
    }

    if (opts.additionalReferences && opts.additionalReferences.length > 0) {
      this.additionalReferences = opts.additionalReferences;
    }

    if (opts.signerOptions) {
      const { signerOptions } = props.options;
      this.signerOptions = signerOptions;
      if (!this.signerOptions.existingPrefixes) {
        this.signerOptions.existingPrefixes = {};
      }
      if (this.signerOptions.existingPrefixes && !this.signerOptions.existingPrefixes.wsse) {
        this.signerOptions.existingPrefixes.wsse = `${oasisBaseUri}/oasis-200401-wss-wssecurity-secext-1.0.xsd`;
      }
    } else {
      this.signerOptions = { existingPrefixes: { wsse: `${oasisBaseUri}/oasis-200401-wss-wssecurity-secext-1.0.xsd` } };
    }

    this.signer.signingKey = {
      key: props.privateKey,
      passphrase: props.keyPassword,
    };
    this.x509Id = `x509-${generateId()}`;
    this.hasTimeStamp = typeof opts.hasTimeStamp === 'undefined' ? true : !! opts.hasTimeStamp;
    this.signatureTransformations = Array.isArray(opts.signatureTransformations) ? opts.signatureTransformations
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
    let usernameToken = ''
    if(this.username ) {
      usernameToken = `<wsse:UsernameToken wsu:Id="SecurityToken-${this.created}" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">` + 
      `<wsse:Username>${this.username}</wsse:Username> ` + 
      `<wsse:Password>${this.password}</wsse:Password> ` +
      `</wsse:UsernameToken>`
    }
    const secHeader =
      `<wsse:Security xmlns:wsse="${oasisBaseUri}/oasis-200401-wss-wssecurity-secext-1.0.xsd" ` +
      `xmlns:wsu="${oasisBaseUri}/oasis-200401-wss-wssecurity-utility-1.0.xsd" ` +
      `${envelopeKey}:mustUnderstand="1">` +
      `<wsse:BinarySecurityToken ` +
      `EncodingType="${oasisBaseUri}/oasis-200401-wss-soap-message-security-1.0#Base64Binary" ` +
      `ValueType="${oasisBaseUri}/oasis-200401-wss-x509-token-profile-1.0#X509v3" ` +
      `wsu:Id="${this.x509Id}">${this.publicP12PEM}</wsse:BinarySecurityToken>` +
      usernameToken +
      timestampStr +
      `</wsse:Security>`;

    const xmlWithSec = insertStr(secHeader, xml, xml.indexOf(`</${envelopeKey}:Header>`));

    const references = this.signatureTransformations;

    const bodyXpath = `//*[name(.)='${envelopeKey}:Body']`;
    resolvePlaceholderInReferences(this.signer.references, bodyXpath);

    if (!(this.signer.references.filter((ref) => (ref.xpath === bodyXpath)).length > 0)) {
      this.signer.addReference(bodyXpath, references);
    }

    for (const name of this.additionalReferences) {
      const xpath = `//*[name(.)='${name}']`;
      if (!(this.signer.references.filter((ref) => (ref.xpath === xpath)).length > 0)) {
        this.signer.addReference(xpath, references);
      }
    }

    const timestampXpath = `//*[name(.)='wsse:Security']/*[local-name(.)='Timestamp']`;
    if (this.hasTimeStamp && !(this.signer.references.filter((ref) => (ref.xpath === timestampXpath)).length > 0)) {
      this.signer.addReference(timestampXpath, references);
    }

    this.signer.computeSignature(xmlWithSec, this.signerOptions);

    return insertStr(this.signer.getSignatureXml(), xmlWithSec, xmlWithSec.indexOf('</wsse:Security>'));
  }
}
