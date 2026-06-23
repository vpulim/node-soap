import * as sax from 'sax';
import { NamespaceContext } from '../nscontext';
import { IOptions } from '../types';
import * as elements from './elements';
export declare function trim(text: any): any;
interface IInitializedOptions extends IOptions {
    ignoredNamespaces?: string[];
}
export declare class WSDL {
    ignoredNamespaces: string[];
    ignoreBaseNameSpaces: boolean;
    valueKey: string;
    xmlKey: string;
    xmlnsInEnvelope: string;
    xmlnsInHeader: string;
    uri: string;
    definitions: elements.DefinitionsElement;
    options: IInitializedOptions;
    private callback;
    private services;
    private xml;
    private _includesWsdl;
    private _originalIgnoredNamespaces;
    constructor(definition: any, uri: string, options: IOptions);
    onReady(callback: (err: Error) => void): void;
    processIncludes(callback: any): void;
    describeServices(): {};
    toXML(): string;
    getSaxStream(xml: any): sax.SAXStream;
    xmlToObject(xml: any, callback?: any): any;
    /**
     * Look up a XSD type or element by namespace URI and name
     * @param {String} nsURI Namespace URI
     * @param {String} qname Local or qualified name
     * @returns {*} The XSD type/element definition
     */
    findSchemaObject(nsURI: string, qname: string): any;
    /**
     * Create document style xml string from the parameters
     * @param {String} name
     * @param {*} params
     * @param {String} nsPrefix
     * @param {String} nsURI
     * @param {String} type
     */
    objectToDocumentXML(name: string, params: any, nsPrefix: string, nsURI?: string, type?: string): any;
    /**
     * Create RPC style xml string from the parameters
     * @param {String} name
     * @param {*} params
     * @param {String} nsPrefix
     * @param {String} nsURI
     * @returns {string}
     */
    objectToRpcXML(name: string, params: any, nsPrefix: string, nsURI: string, isParts?: boolean): string;
    isIgnoredNameSpace(ns: string): boolean;
    filterOutIgnoredNameSpace(ns: string): string;
    /**
     * Convert an object to XML.  This is a recursive method as it calls itself.
     *
     * @param {Object} obj the object to convert.
     * @param {String} name the name of the element (if the object being traversed is
     * an element).
     * @param {String} nsPrefix the namespace prefix of the object I.E. xsd.
     * @param {String} nsURI the full namespace of the object I.E. http://w3.org/schema.
     * @param {Boolean} isFirst whether or not this is the first item being traversed.
     * @param {?} xmlnsAttr
     * @param {?} parameterTypeObject
     * @param {NamespaceContext} nsContext Namespace context
     */
    objectToXML(obj: any, name: string, nsPrefix: any, nsURI: string, isFirst?: boolean, xmlnsAttr?: any, schemaObject?: any, nsContext?: NamespaceContext): any;
    processAttributes(child: any, nsContext: NamespaceContext): string;
    /**
     * Look up a schema type definition
     * @param name
     * @param nsURI
     * @returns {*}
     */
    findSchemaType(name: any, nsURI: any): any;
    findChildSchemaObject(parameterTypeObj: any, childName: any, backtrace?: any): any;
    private _initializeOptions;
    private _processNextInclude;
    private _parse;
    private _fromXML;
    private _fromServices;
    private _xmlnsMap;
}
type WSDLCallback = (error: any, result?: WSDL) => any;
export declare function open_wsdl(uri: any, callback: WSDLCallback): any;
export declare function open_wsdl(uri: any, options: IOptions, callback: WSDLCallback): any;
export {};
