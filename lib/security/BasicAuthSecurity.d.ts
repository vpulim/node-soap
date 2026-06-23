import { IHeaders, ISecurity } from '../types';
export declare class BasicAuthSecurity implements ISecurity {
    private _username;
    private _password;
    private defaults;
    constructor(username: string, password: string, defaults?: any);
    addHeaders(headers: IHeaders): void;
    toXML(): string;
    addOptions(options: any): void;
}
