/// <reference types="node" />
import * as req from 'axios';
import { ReadStream } from 'fs';
export interface IHeaders {
    [k: string]: any;
}
export interface IExOptions {
    [key: string]: any;
}
export interface IHttpClient {
    request(rurl: string, data: any, callback: (error: any, res?: any, body?: any) => any, exheaders?: IHeaders, exoptions?: IExOptions, caller?: any): req.AxiosPromise;
    requestStream?(rurl: string, data: any, exheaders?: IHeaders, exoptions?: IExOptions, caller?: any): req.AxiosPromise<ReadStream>;
}
/** @deprecated use SoapMethod */
export declare type ISoapMethod = SoapMethod;
export declare type SoapMethod = (args: any, callback: (err: any, result: any, rawResponse: any, soapHeader: any, rawRequest: any, mtomAttachments?: IMTOMAttachments) => void, options?: any, extraHeaders?: any, mtomAttachments?: IMTOMAttachments) => void;
export declare type SoapMethodAsync = (args: any, options?: any, extraHeaders?: any) => Promise<[any, any, any, any, IMTOMAttachments?]>;
export declare type ISoapServiceMethod = (args: any, callback?: (data: any) => void, headers?: any, req?: any, res?: any, sender?: any) => any;
export interface ISoapFaultError {
    Fault: ISoapFault;
}
export declare type ISoapFault = ISoapFault11 | ISoapFault12;
export interface ISoapFault11 {
    faultcode: number | string;
    faultstring: string;
    detail?: string;
    statusCode?: number;
}
export interface ISoapFault12 {
    Code: {
        Value: string;
        Subcode?: {
            Value: string;
        };
    };
    Reason: {
        Text: string;
    };
    statusCode?: number;
}
/** @deprecated use ISecurity */
export declare type Security = ISecurity;
export interface ISecurity {
    addOptions?(options: any): void;
    toXML?(): string;
    addHeaders?(headers: IHeaders): void;
    postProcess?(xml: any, envelopeKey: any): string;
}
export interface IServicePort {
    [methodName: string]: ISoapServiceMethod;
}
export interface IService {
    [portName: string]: IServicePort;
}
export interface IServices {
    [serviceName: string]: IService;
}
export interface IXmlAttribute {
    name: string;
    value: string;
}
export interface IWsdlBaseOptions {
    attributesKey?: string;
    valueKey?: string;
    xmlKey?: string;
    overrideRootElement?: {
        namespace: string;
        xmlnsAttributes?: IXmlAttribute[];
    };
    ignoredNamespaces?: boolean | string[] | {
        namespaces?: string[];
        override?: boolean;
    };
    ignoreBaseNameSpaces?: boolean;
    /** escape special XML characters in SOAP message (e.g. &, >, < etc), default: true. */
    escapeXML?: boolean;
    /** return an Invalid XML SOAP fault on a bad request, default: false. */
    returnFault?: boolean;
    handleNilAsNull?: boolean;
    /** if your wsdl operations contains names with non identifier characters ([^a-z$_0-9]), replace them with _. Note: if using this option, clients using wsdls with two operations like soap:method and soap-method will be overwritten. Then, use bracket notation instead (client['soap:method']()). */
    normalizeNames?: boolean;
    /** to preserve leading and trailing whitespace characters in text and cdata. */
    preserveWhitespace?: boolean;
    /** provides support for nonstandard array semantics. If true, JSON arrays of the form {list: [{elem: 1}, {elem: 2}]} are marshalled into xml as <list><elem>1</elem></list> <list><elem>2</elem></list>. If false, marshalls into <list> <elem>1</elem> <elem>2</elem> </list>. Default: true. */
    namespaceArrayElements?: boolean;
    useEmptyTag?: boolean;
    strict?: boolean;
    /** custom HTTP headers to be sent on WSDL requests. */
    wsdl_headers?: {
        [key: string]: any;
    };
    /** custom options for the request module on WSDL requests. */
    wsdl_options?: {
        [key: string]: any;
    };
    /** set proper headers for SOAP v1.2. */
    forceSoap12Headers?: boolean;
}
/** @deprecated use IOptions */
export declare type Option = IOptions;
export interface IOptions extends IWsdlBaseOptions {
    /** don't cache WSDL files, request them every time. */
    disableCache?: boolean;
    /** override the SOAP service's host specified in the .wsdl file. */
    endpoint?: string;
    /** set specific key instead of <pre><soap:Body></soap:Body></pre>. */
    envelopeKey?: string;
    /** provide your own http client that implements request(rurl, data, callback, exheaders, exoptions) */
    httpClient?: IHttpClient;
    /** override the request module. */
    request?: req.AxiosInstance;
    stream?: boolean;
    returnSaxStream?: boolean;
    customDeserializer?: any;
    /** if your wsdl operations contains names with Async suffix, you will need to override the default promise suffix to a custom one, default: Async. */
    overridePromiseSuffix?: string;
    /** handle MTOM soapAttachments in response */
    parseReponseAttachments?: boolean;
}
export interface IOneWayOptions {
    responseCode?: number;
    emptyBody?: boolean;
}
export interface IServerOptions extends IWsdlBaseOptions {
    path: string | RegExp;
    services: IServices;
    xml?: string;
    uri?: string;
    callback?: (err: any, res: any) => void;
    /** suppress the full stack trace for error messages. */
    suppressStack?: boolean;
    oneWay?: IOneWayOptions;
    /** A boolean for controlling chunked transfer encoding in response. Some client (such as Windows 10's MDM enrollment SOAP client) is sensitive to transfer-encoding mode and can't accept chunked response. This option let user disable chunked transfer encoding for such a client. Default to true for backward compatibility. */
    enableChunkedEncoding?: boolean;
}
export interface IMTOMAttachments {
    parts: Array<{
        body: Buffer;
        headers: {
            [key: string]: string;
        };
    }>;
}
