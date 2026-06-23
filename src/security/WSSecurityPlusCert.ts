import {ISecurity} from '../types';
import {WSSecurity} from './WSSecurity';
import {WSSecurityCert} from './WSSecurityCert';

export class WSSecurityPlusCert implements ISecurity {
  constructor(private readonly wsSecurity: WSSecurity, private readonly wsSecurityCert: WSSecurityCert) {}

  public postProcess(xml: string, envelopeKey: string) {
    const securityXml = this.wsSecurity.toXML();
    const endOfHeader = xml.indexOf(`</${envelopeKey}:Header>`);
    xml = [xml.slice(0, endOfHeader), securityXml, xml.slice(endOfHeader)].join('');

    return this.wsSecurityCert.postProcess(xml, envelopeKey);
  }
}
