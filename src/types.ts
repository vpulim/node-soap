import * as req from 'request';
import { HttpClient } from './http';

export interface IHeaders {
  [k: string]: any;
}

/** @deprecated use SoapMethod */
export type ISoapMethod = SoapMethod;
export type SoapMethod = (
  args: any,
  callback: (err: any, result: any, rawResponse: any, soapHeader: any, rawRequest: any) => void,
  options?: any,
  extraHeaders?: any
) => void;

export type SoapMethodAsync = (
  args: any,
  options?: any,
  extraHeaders?: any
) => Promise<[any, any, any, any]>;

export type ISoapServiceMethod = (
  args: any,
  callback?: (data: any) => void,
  headers?: any,
  req?: any
) => any;

// SOAP Fault 1.1 & 1.2
export interface ISoapFaultError {
  Fault: ISoapFault;
}

export type ISoapFault = ISoapFault11 | ISoapFault12;

// SOAP Fault 1.1
export interface ISoapFault11 {
  faultcode: number | string;
  faultstring: string;
  detail?: string;
  statusCode?: number;
}

// SOAP Fault 1.2
// 1.2 also supports additional, optional elements:
// Role, Node, Detail. Should be added when soap module implements them
// https://www.w3.org/TR/soap12/#soapfault
export interface ISoapFault12 {
  Code: { Value: string; Subcode?: { value: string } };
  Reason: { Text: string };
  statusCode?: number;
}

/** @deprecated use ISecurity */
export type Security = ISecurity;
export interface ISecurity {
  addOptions?(options: any): void;
  toXML?(): string;
  addHeaders?(headers: IHeaders): void;
  postProcess?(xml, envelopeKey): string;
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
  ignoredNamespaces?: boolean | string[] | { namespaces?: string[]; override?: boolean };
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
  wsdl_headers?: { [key: string]: any };
  /** custom options for the request module on WSDL requests. */
  wsdl_options?: { [key: string]: any };
  /** set proper headers for SOAP v1.2. */
  forceSoap12Headers?: boolean;
}

/** @deprecated use IOptions */
export type Option = IOptions;
export interface IOptions extends IWsdlBaseOptions {
  /** don't cache WSDL files, request them every time. */
  disableCache?: boolean;
  /** override the SOAP service's host specified in the .wsdl file. */
  endpoint?: string;
  /** set specific key instead of <pre><soap:Body></soap:Body></pre>. */
  envelopeKey?: string;
  /** provide your own http client that implements request(rurl, data, callback, exheaders, exoptions) */
  httpClient?: HttpClient;
  /** override the request module. */
  request?: req.RequestAPI<req.Request, req.CoreOptions, req.RequiredUriUrl>;
  stream?: boolean;
  // allows returning the underlying saxStream that parse the SOAP XML response
  returnSaxStream?: boolean;
  // wsdl options that only work for client
  customDeserializer?: any;
  /** if your wsdl operations contains names with Async suffix, you will need to override the default promise suffix to a custom one, default: Async. */
  overridePromiseSuffix?: string;
  /** @internal */
  WSDL_CACHE?;
}

export interface IOneWayOptions {
  responseCode?: number;
  emptyBody?: boolean;
}

export interface IServerOptions extends IWsdlBaseOptions {
  path: string;
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
