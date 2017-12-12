/// <reference types="node" />

import { EventEmitter } from 'events';
import * as BluebirdPromise from 'bluebird';

export interface ISoapMethod {
    (args: any, callback: (err: any, result: any, raw: any, soapHeader: any) => void, options?: any, extraHeaders?: any): void;
}

export interface ISoapServiceMethod {
    (args:any, callback?: (data: any) => void, headers?: any, req?: any): any;
}

// SOAP Fault 1.1 & 1.2
export type ISoapFault = ISoapFault12 | ISoapFault11;

// SOAP Fault 1.1
export interface ISoapFault11 {
    Fault: {
        faultcode: number | string;
        faultstring: string;
        detail?: string;
        statusCode?: number;
    };
}

// SOAP Fault 1.2
// 1.2 also supports additional, optional elements:
// Role, Node, Detail. Should be added when soap module implements them
// https://www.w3.org/TR/soap12/#soapfault
export interface ISoapFault12 {
    Fault: {
        Code: { Value: string; Subcode?: { Value: string; }; };
        Reason: { Text: string; };
        statusCode?: number;
    };
}

export interface ISecurity {
    addOptions(options: any): void;
    toXML(): string;
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
    overrideRootElement?: { namespace: string; xmlnsAttributes?: IXmlAttribute[]; };
    ignoredNamespaces?: boolean | string[] | { namespaces?: string[]; override?: boolean; };
    ignoreBaseNameSpaces?: boolean;
    escapeXML?: boolean;
    returnFault?: boolean;
    handleNilAsNull?: boolean;
    wsdl_headers?: { [key: string]: any };
    wsdl_options?: { [key: string]: any };
}

export interface IOptions extends IWsdlBaseOptions {
    disableCache?: boolean;
    endpoint?: string;
    envelopeKey?: string;
    httpClient?: HttpClient;
    request?: (options: any, callback?: (error: any, res: any, body: any) => void) => void;
    stream?: boolean;
    // wsdl options that only work for client
    forceSoap12Headers?: boolean;
    customDeserializer?: any;
    [key: string]: any;
}

export interface IServerOptions extends IWsdlBaseOptions {
    path: string;
    services: IServices;
    xml?: string;
    uri?: string;
    suppressStack?: boolean;
    [key: string]: any;
}

export interface Definitions {
    descriptions: object;
    ignoredNamespaces: string[];
    messages: WsdlMessages;
    portTypes: WsdlPortTypes;
    bindings: WsdlBindings;
    services: WsdlServices;
    schemas: WsdlSchemas;
    valueKey: string;
    xmlKey: string;
    xmlns: WsdlXmlns;
    '$targetNamespace': string;
    '$name': string;
}

export interface XsdTypeBase {
    ignoredNamespaces: string[];
    valueKey: string;
    xmlKey: string;
    xmlns?: WsdlXmlns,
}


export interface WsdlSchemas {
    [prop: string]: WsdlSchema;
}
export interface WsdlSchema extends XsdTypeBase {
    children: any[];
    complexTypes?: WsdlElements;
    elements?: WsdlElements;
    includes: any[];
    name: string;
    nsName: string;
    prefix: string;
    types?: WsdlElements;
    xmlns: WsdlXmlns;
}
export interface WsdlElements {
    [prop: string]: XsdElement;
}
export type XsdElement = XsdElementType | XsdComplexType;

export interface WsdlXmlns {
    wsu?: string;
    wsp?: string;
    wsam?: string;
    soap?: string;
    tns?: string;
    xsd?: string;
    __tns__?: string;
    [prop: string]: string | void;
}

export interface XsdComplexType extends XsdTypeBase {
    children: XsdElement[] | void;
    name: string;
    nsName: string;
    prefix: string;
    '$name': string;
    [prop: string]: any;
}

export interface XsdElementType extends XsdTypeBase {
    children: XsdElement[] | void;
    name: string;
    nsName: string;
    prefix: string;
    targetNSAlias: string;
    targetNamespace: string;
    '$lookupType': string;
    '$lookupTypes': any[];
    '$name': string;
    '$type': string;
    [prop: string]: any;
}

export interface WsdlMessages {
    [prop: string]: WsdlMessage;
}
export interface WsdlMessage extends XsdTypeBase {
    element: XsdElement;
    parts: { [prop: string]: any };
    '$name': string;
}

export interface WsdlPortTypes {
    [prop: string]: WsdlPortType;
}
export interface WsdlPortType extends XsdTypeBase {
    methods: { [prop: string]: XsdElement }
}

export interface WsdlBindings {
    [prop: string]: WsdlBinding;
}
export interface WsdlBinding extends XsdTypeBase {
    methods: WsdlElements;
    style: string;
    transport: string;
    topElements: {[prop: string]: any};
}

export interface WsdlServices {
    [prop: string]: WsdlService;
}
export interface WsdlService extends XsdTypeBase {
    ports: {[prop: string]: any};
}

export class WSDL {
    constructor(definition: any, uri: string, options?: IOptions);
    ignoredNamespaces: string[];
    ignoreBaseNameSpaces: boolean;
    valueKey: string;
    xmlKey: string;
    xmlnsInEnvelope: string;
    onReady(callback: (err:Error) => void): void;
    processIncludes(callback: (err:Error) => void): void;
    describeServices(): { [k: string]: any };
    toXML(): string;
    xmlToObject(xml: any, callback?: (err:Error, result:any) => void): any;
    findSchemaObject(nsURI: string, qname: string): XsdElement | null | undefined;
    objectToDocumentXML(name: string, params: any, nsPrefix?: string, nsURI?: string, type?: string): any;
    objectToRpcXML(name: string, params: any, nsPrefix?: string, nsURI?: string, isParts?: any): string;
    isIgnoredNameSpace(ns: string): boolean;
    filterOutIgnoredNameSpace(ns: string): string;
    objectToXML(obj: any, name: string, nsPrefix?: any, nsURI?: string, isFirst?: boolean, xmlnsAttr?: any, schemaObject?: any, nsContext?: any): string;
    processAttributes(child: any, nsContext: any): string;
    findSchemaType(name: any, nsURI: any): any;
    findChildSchemaObject(parameterTypeObj: any, childName: any, backtrace?: any): any;
    uri: string;
    definitions: Definitions;
}

export class Client extends EventEmitter {
    constructor(wsdl: WSDL, endpoint?: string, options?: IOptions);
    addBodyAttribute(bodyAttribute: any, name?: string, namespace?: string, xmlns?: string): void;
    addHttpHeader(name: string, value: any): void;
    addSoapHeader(soapHeader: any, name?: string, namespace?: any, xmlns?: string): number;
    changeSoapHeader(index: number, soapHeader: any, name?: string, namespace?: string, xmlns?: string): void;
    clearBodyAttributes(): void;
    clearHttpHeaders(): void;
    clearSoapHeaders(): void;
    describe(): any;
    getBodyAttributes(): any[];
    getHttpHeaders(): { [k:string]: string };
    getSoapHeaders(): string[];
    setEndpoint(endpoint: string): void;
    setSOAPAction(action: string): void;
    setSecurity(security: ISecurity): void;
    wsdl: WSDL;
    [method: string]: ISoapMethod | WSDL | Function;
}

export function createClient(url: string, callback: (err: any, client: Client) => void): void;
export function createClient(url: string, options: IOptions, callback: (err: any, client: Client) => void): void;
export function createClientAsync(url: string, options?: IOptions, endpoint?: string): BluebirdPromise<Client>;

export class Server extends EventEmitter {
    constructor(server: any, path: string, services: IServices, wsdl: WSDL, options: IServerOptions);
    path: string;
    services: IServices;
    wsdl: WSDL;
    addSoapHeader(soapHeader: any, name?: string, namespace?: any, xmlns?: string): number;
    changeSoapHeader(index: any, soapHeader: any, name?: any, namespace?: any, xmlns?: any): void;
    getSoapHeaders(): string[];
    clearSoapHeaders(): void;
    log(type: string, data: any): any;
    authorizeConnection(req: any): boolean;
    authenticate(security: ISecurity): boolean;
}

export function listen(server: any, path: string, service: any, wsdl: string): Server;
export function listen(server: any, options: IServerOptions): Server;

export class HttpClient {
    constructor(options?: IOptions);
    buildRequest(rurl: string, data: any | string, exheaders?: { [key: string]: any }, exoptions?: { [key: string]: any }): any;
    handleResponse(req: any, res: any, body: any | string): any | string;
    request(rurl: string, data: any | string, callback: (err: any, res: any, body: any | string) => void, exheaders?: { [key: string]: any }, exoptions?: { [key: string]: any }): any;
    requestStream(rurl: string, data: any | string, exheaders?: { [key: string]: any }, exoptions?: { [key: string]: any }): any;
}

export class BasicAuthSecurity implements ISecurity {
    constructor(username: string, password: string, defaults?: any);
    addHeaders(headers: any): void;
    addOptions(options: any): void;
    toXML(): string;
}

export class BearerSecurity implements ISecurity {
    constructor(token: string, defaults?: any);
    addHeaders(headers: any): void;
    addOptions(options: any): void;
    toXML(): string;
}

export class WSSecurity implements ISecurity {
    constructor(username: string, password: string, options?: any);
    addOptions(options: any): void;
    toXML(): string;
}

export class WSSecurityCert implements ISecurity {
    constructor(privatePEM: any, publicP12PEM: any, password: any);
    addOptions(options: any): void;
    toXML(): string;
}

export class ClientSSLSecurity implements ISecurity {
    constructor(key: string | Buffer, cert: string | Buffer, ca?: string | any[] | Buffer, defaults?: any);
    constructor(key: string | Buffer, cert: string | Buffer, defaults?: any);
    addOptions(options: any): void;
    toXML(): string;
}

export class ClientSSLSecurityPFX implements ISecurity {
    constructor(pfx: string | Buffer, passphrase: string, defaults?: any);
    constructor(pfx: string | Buffer, defaults?: any);
    addOptions(options: any): void;
    toXML(): string;
}

export function passwordDigest(nonce: string, created: string, password: string): string;

// Below are added for backwards compatibility for previous @types/soap users.
export interface Security extends ISecurity {}
export interface SoapMethod extends ISoapMethod {}
export interface Option extends IOptions {}
