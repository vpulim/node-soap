/// <reference types="node" />
import { ISecurity } from '../types';
import { IWSSecurityCertOptions } from './WSSecurityCert';
export declare class WSSecurityCertWithToken implements ISecurity {
    private publicP12PEM;
    private signer;
    private signerOptions;
    private x509Id;
    private hasTimeStamp;
    private signatureTransformations;
    private created;
    private expires;
    private additionalReferences;
    private username;
    private password;
    constructor(props: {
        privateKey: Buffer;
        publicKey: string;
        keyPassword?: string;
        username: string;
        password: string;
        options?: IWSSecurityCertOptions;
    });
    postProcess(xml: any, envelopeKey: any): string;
}
