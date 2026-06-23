import { IWsdlBaseOptions } from '../types';
export interface IWsdlXmlns {
    wsu?: string;
    wsp?: string;
    wsam?: string;
    soap?: string;
    tns?: string;
    xsd?: string;
    __tns__?: string;
    [prop: string]: string | void;
}
export interface IXmlNs {
    [key: string]: string;
}
export declare class Element {
    readonly allowedChildren?: {
        [k: string]: typeof Element;
    };
    $name?: string;
    $targetNamespace?: any;
    children: Element[];
    ignoredNamespaces: any;
    strict: boolean;
    name?: string;
    nsName?: any;
    prefix?: string;
    schemaXmlns?: any;
    definitionsXmlns?: IXmlNs;
    valueKey: string;
    xmlKey: any;
    xmlns?: IXmlNs;
    constructor(nsName: string, attrs: any, options?: IWsdlBaseOptions, schemaAttrs?: any);
    deleteFixedAttrs(): void;
    startElement(stack: Element[], nsName: string, attrs: any, options: IWsdlBaseOptions, schemaXmlns: any): void;
    endElement(stack: Element[], nsName: string): void;
    addChild(child: Element): void;
    unexpected(name: string): void;
    description(definitions?: DefinitionsElement, xmlns?: IXmlNs): any;
    init(): void;
    private _initializeOptions;
}
export declare class UnexpectedElement extends Element {
    startElement(stack: Element[], nsName: string, attrs: any, options: IWsdlBaseOptions, schemaXmlns: any): void;
}
export declare class ElementElement extends Element {
    readonly allowedChildren: {
        [k: string]: typeof Element;
    };
    $minOccurs?: string;
    $maxOccurs?: string;
    $type?: string;
    $ref?: string;
    targetNSAlias?: string;
    targetNamespace?: string;
    $lookupType?: string;
    $lookupTypes?: any[];
    description(definitions: DefinitionsElement, xmlns?: IXmlNs): {};
}
export declare class AnyElement extends Element {
}
export declare class InputElement extends Element {
    readonly allowedChildren: {
        [k: string]: typeof Element;
    };
    use: string;
    encodingStyle: string;
    $type: string;
    $lookupType: string;
    targetNSAlias?: string;
    targetNamespace?: string;
    parts?: any;
    addChild(child: Element): void;
}
export declare class OutputElement extends Element {
    readonly allowedChildren: {
        [k: string]: typeof Element;
    };
    targetNSAlias?: string;
    targetNamespace?: string;
    use?: string;
    encodingStyle?: string;
    $lookupTypes: any;
    addChild(child: Element): void;
}
export declare class SimpleTypeElement extends Element {
    readonly allowedChildren: {
        [k: string]: typeof Element;
    };
    description(definitions: DefinitionsElement): {};
}
export declare class RestrictionElement extends Element {
    readonly allowedChildren: {
        [k: string]: typeof Element;
    };
    $base: string;
    description(definitions?: DefinitionsElement, xmlns?: IXmlNs): any;
}
export declare class ExtensionElement extends Element {
    readonly allowedChildren: {
        [k: string]: typeof Element;
    };
    $base: string;
    description(definitions: DefinitionsElement, xmlns?: IXmlNs): {};
}
export declare class ChoiceElement extends Element {
    readonly allowedChildren: {
        [k: string]: typeof Element;
    };
    description(definitions: DefinitionsElement, xmlns: IXmlNs): {};
}
export declare class EnumerationElement extends Element {
    description(): string;
}
export declare class ComplexTypeElement extends Element {
    readonly allowedChildren: {
        [k: string]: typeof Element;
    };
    description(definitions: DefinitionsElement, xmlns: IXmlNs): {};
}
export declare class ComplexContentElement extends Element {
    readonly allowedChildren: {
        [k: string]: typeof Element;
    };
    description(definitions: DefinitionsElement, xmlns: IXmlNs): any;
}
export declare class SimpleContentElement extends Element {
    readonly allowedChildren: {
        [k: string]: typeof Element;
    };
    description(definitions: DefinitionsElement, xmlns: IXmlNs): {};
}
export declare class SequenceElement extends Element {
    readonly allowedChildren: {
        [k: string]: typeof Element;
    };
    description(definitions: DefinitionsElement, xmlns: IXmlNs): {};
}
export declare class AttributeElement extends Element {
    static Symbol: symbol;
    $type?: string;
    $use?: string;
    description(definitions: DefinitionsElement): {
        type: string;
        required: boolean;
    };
}
export declare class AllElement extends Element {
    readonly allowedChildren: {
        [k: string]: typeof Element;
    };
    description(definitions: DefinitionsElement, xmlns: IXmlNs): {};
}
export declare class MessageElement extends Element {
    readonly allowedChildren: {
        [k: string]: typeof Element;
    };
    element: ElementElement;
    parts: any;
    postProcess(definitions: DefinitionsElement): void;
    description(definitions: DefinitionsElement): {};
    /**
     * Takes a given namespaced String(for example: 'alias:property') and creates a lookupType
     * object for further use in as first (lookup) `parameterTypeObj` within the `objectToXML`
     * method and provides an entry point for the already existing code in `findChildSchemaObject`.
     *
     * @method _createLookupTypeObject
     * @param {String}            nsString          The NS String (for example "alias:type").
     * @param {Object}            xmlns       The fully parsed `wsdl` definitions object (including all schemas).
     * @returns {Object}
     * @private
     */
    private _createLookupTypeObject;
    /**
     * Iterates through the element and every nested child to find any defined `$type`
     * property and returns it in a underscore ('_') separated String (using '^' as default
     * value if no `$type` property was found).
     *
     * @method _getNestedLookupTypeString
     * @param {Object}            element         The element which (probably) contains nested `$type` values.
     * @returns {String}
     * @private
     */
    private _getNestedLookupTypeString;
}
export declare class DocumentationElement extends Element {
}
export interface IInclude {
    namespace: string;
    location: string;
}
export declare class SchemaElement extends Element {
    readonly allowedChildren: {
        [k: string]: typeof Element;
    };
    complexTypes: {
        [name: string]: ComplexTypeElement;
    };
    types: {
        [name: string]: SimpleTypeElement;
    };
    elements: {
        [name: string]: ElementElement;
    };
    includes: IInclude[];
    $elementFormDefault: any;
    merge(source: SchemaElement): this;
    addChild(child: Element): void;
}
export declare class TypesElement extends Element {
    readonly allowedChildren: {
        [k: string]: typeof Element;
    };
    schemas: {
        [name: string]: SchemaElement;
    };
    addChild(child: any): void;
}
export declare class OperationElement extends Element {
    readonly allowedChildren: {
        [k: string]: typeof Element;
    };
    input: InputElement;
    output: OutputElement;
    inputSoap: any;
    outputSoap: any;
    style: string;
    soapAction: string;
    $soapAction?: string;
    $style?: string;
    addChild(child: any): void;
    postProcess(definitions: DefinitionsElement, tag: string): void;
    description(definitions: DefinitionsElement): {
        input: any;
        output: any;
    };
}
export declare class PortTypeElement extends Element {
    readonly allowedChildren: {
        [k: string]: typeof Element;
    };
    methods: {
        [name: string]: OperationElement;
    };
    postProcess(definitions: DefinitionsElement): void;
    description(definitions: DefinitionsElement): {};
}
export interface ITopElement {
    methodName: string;
    outputName: string;
}
export interface ITopElements {
    [name: string]: ITopElement;
}
export declare class BindingElement extends Element {
    readonly allowedChildren: {
        [k: string]: typeof Element;
    };
    topElements?: ITopElements;
    transport: string;
    style: string;
    methods: {
        [name: string]: OperationElement;
    };
    $type?: string;
    addChild(child: any): void;
    postProcess(definitions: DefinitionsElement): void;
    description(definitions: DefinitionsElement): {};
}
export declare class PortElement extends Element {
    readonly allowedChildren: {
        [k: string]: typeof Element;
    };
    location: any;
    addChild(child: any): void;
}
export interface IPort {
    location: string;
    binding: BindingElement;
}
export declare class ServiceElement extends Element {
    readonly allowedChildren: {
        [k: string]: typeof Element;
    };
    ports: {
        [name: string]: IPort;
    };
    postProcess(definitions: DefinitionsElement): void;
    description(definitions: DefinitionsElement): {};
}
export declare class DefinitionsElement extends Element {
    readonly allowedChildren: {
        [k: string]: typeof Element;
    };
    complexTypes: any;
    messages: {
        [name: string]: MessageElement;
    };
    portTypes: {
        [name: string]: PortTypeElement;
    };
    bindings: {
        [name: string]: BindingElement;
    };
    services: {
        [name: string]: ServiceElement;
    };
    schemas: {
        [name: string]: SchemaElement;
    };
    descriptions: {
        types: {
            [key: string]: Element;
        };
        elements: {
            [key: string]: Element;
        };
    };
    init(): void;
    addChild(child: any): void;
}
export declare class BodyElement extends Element {
    $use?: string;
    $encodingStyle?: string;
}
export declare class IncludeElement extends Element {
    $schemaLocation?: any;
    $location?: any;
    $namespace?: any;
}
export declare class ImportElement extends Element {
    $schemaLocation?: any;
    $location?: any;
    $namespace?: any;
}
