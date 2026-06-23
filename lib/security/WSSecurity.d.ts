import { ISecurity } from '../types';
export interface IWSSecurityOptions {
    passwordType?: string;
    hasTimeStamp?: boolean;
    hasNonce?: boolean;
    hasTokenCreated?: boolean;
    actor?: string;
    mustUnderstand?: any;
    envelopeKey?: string;
}
export declare class WSSecurity implements ISecurity {
    private _username;
    private _password;
    private _passwordType;
    private _hasTimeStamp;
    private _hasNonce;
    private _hasTokenCreated;
    private _actor;
    private _mustUnderstand;
    private _envelopeKey;
    constructor(username: string, password: string, options?: string | IWSSecurityOptions);
    toXML(): string;
}
