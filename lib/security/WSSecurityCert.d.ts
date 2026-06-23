import { ISecurity } from '../types';
export interface IWSSecurityCertOptions {
    hasTimeStamp?: boolean;
    signatureTransformations?: string[];
    signatureAlgorithm?: string;
    digestAlgorithm?: string;
    additionalReferences?: string[];
    signerOptions?: IXmlSignerOptions;
}
export interface IXmlSignerOptions {
    prefix?: string;
    attrs?: {
        [key: string]: string;
    };
    existingPrefixes?: {
        [key: string]: string;
    };
    idMode?: 'wssecurity';
}
export declare class WSSecurityCert implements ISecurity {
    private publicP12PEM;
    private signer;
    private signerOptions;
    private x509Id;
    private hasTimeStamp;
    private signatureTransformations;
    private created;
    private expires;
    private additionalReferences;
    constructor(privatePEM: any, publicP12PEM: any, password: any, options?: IWSSecurityCertOptions);
    postProcess(xml: string, envelopeKey: string): string;
}
