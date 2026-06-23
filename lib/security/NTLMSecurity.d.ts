import { IHeaders, ISecurity } from '../types';
export declare class NTLMSecurity implements ISecurity {
    private defaults;
    constructor(defaults: any);
    addHeaders(headers: IHeaders): void;
    toXML(): string;
    addOptions(options: any): void;
}
