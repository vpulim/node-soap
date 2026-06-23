import { ISecurity } from '../types';
import { WSSecurity } from './WSSecurity';
import { WSSecurityCert } from './WSSecurityCert';
export declare class WSSecurityPlusCert implements ISecurity {
    private readonly wsSecurity;
    private readonly wsSecurityCert;
    constructor(wsSecurity: WSSecurity, wsSecurityCert: WSSecurityCert);
    postProcess(xml: string, envelopeKey: string): string;
}
