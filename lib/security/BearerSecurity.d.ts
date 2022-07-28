import { IHeaders, ISecurity } from '../types';
export declare class BearerSecurity implements ISecurity {
    private defaults;
    private _token;
    constructor(token: string, defaults?: any);
    addHeaders(headers: IHeaders): void;
    toXML(): string;
    addOptions(options: any): void;
}
