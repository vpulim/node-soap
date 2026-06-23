/// <reference types="node" />
import { AxiosResponseHeaders, RawAxiosResponseHeaders } from 'axios';
import { EventEmitter } from 'events';
import { IHeaders, IMTOMAttachments, IOptions, ISecurity } from './types';
import { WSDL } from './wsdl';
export interface ISoapError extends Error {
    response?: any;
    body?: any;
}
export interface Client {
    emit(event: 'request', xml: string, eid: string): boolean;
    emit(event: 'message', message: string, eid: string): boolean;
    emit(event: 'soapError', error: any, eid: string): boolean;
    emit(event: 'response', body: any, response: any, eid: string): boolean;
    /** Emitted before a request is sent. */
    on(event: 'request', listener: (xml: string, eid: string) => void): this;
    /** Emitted before a request is sent, but only the body is passed to the event handler. Useful if you don't want to log /store Soap headers. */
    on(event: 'message', listener: (message: string, eid: string) => void): this;
    /** Emitted when an erroneous response is received. */
    on(event: 'soapError', listener: (error: any, eid: string) => void): this;
    /** Emitted after a response is received. This is emitted for all responses (both success and errors). */
    on(event: 'response', listener: (body: any, response: any, eid: string) => void): this;
}
export declare class Client extends EventEmitter {
    [method: string]: any;
    /** contains last full soap request for client logging */
    lastRequest?: string;
    lastMessage?: string;
    lastEndpoint?: string;
    lastRequestHeaders?: any;
    lastResponse?: any;
    lastResponseHeaders?: AxiosResponseHeaders | RawAxiosResponseHeaders;
    lastElapsedTime?: number;
    lastResponseAttachments: IMTOMAttachments;
    wsdl: WSDL;
    private httpClient;
    private soapHeaders;
    private httpHeaders;
    private bodyAttributes;
    private endpoint;
    private security;
    private SOAPAction;
    private streamAllowed;
    private returnSaxStream;
    private normalizeNames;
    private overridePromiseSuffix;
    constructor(wsdl: WSDL, endpoint?: string, options?: IOptions);
    /** add soapHeader to soap:Header node */
    addSoapHeader(soapHeader: any, name?: string, namespace?: any, xmlns?: string): number;
    changeSoapHeader(index: any, soapHeader: any, name?: any, namespace?: any, xmlns?: any): void;
    /** return all defined headers */
    getSoapHeaders(): string[];
    /** remove all defined headers */
    clearSoapHeaders(): void;
    addHttpHeader(name: string, value: any): void;
    getHttpHeaders(): IHeaders;
    clearHttpHeaders(): void;
    addBodyAttribute(bodyAttribute: any, name?: string, namespace?: string, xmlns?: string): void;
    getBodyAttributes(): any[];
    clearBodyAttributes(): void;
    /** overwrite the SOAP service endpoint address */
    setEndpoint(endpoint: string): void;
    /** description of services, ports and methods as a JavaScript object */
    describe(): any;
    /** use the specified security protocol */
    setSecurity(security: ISecurity): void;
    setSOAPAction(SOAPAction: string): void;
    private _initializeServices;
    private _initializeOptions;
    private _defineService;
    private _definePort;
    private _promisifyMethod;
    private _defineMethod;
    private _processSoapHeader;
    private _invoke;
}
