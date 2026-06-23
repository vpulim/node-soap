"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportElement = exports.IncludeElement = exports.BodyElement = exports.DefinitionsElement = exports.ServiceElement = exports.PortElement = exports.BindingElement = exports.PortTypeElement = exports.OperationElement = exports.TypesElement = exports.SchemaElement = exports.DocumentationElement = exports.MessageElement = exports.AllElement = exports.AttributeElement = exports.SequenceElement = exports.SimpleContentElement = exports.ComplexContentElement = exports.ComplexTypeElement = exports.EnumerationElement = exports.ChoiceElement = exports.ExtensionElement = exports.RestrictionElement = exports.SimpleTypeElement = exports.OutputElement = exports.InputElement = exports.AnyElement = exports.ElementElement = exports.UnexpectedElement = exports.Element = void 0;
const assert_1 = require("assert");
const debug_1 = require("debug");
const _ = require("lodash");
const utils_1 = require("../utils");
const debug = (0, debug_1.default)('node-soap');
const Primitives = {
    string: 1,
    boolean: 1,
    decimal: 1,
    float: 1,
    double: 1,
    anyType: 1,
    byte: 1,
    int: 1,
    long: 1,
    short: 1,
    negativeInteger: 1,
    nonNegativeInteger: 1,
    positiveInteger: 1,
    nonPositiveInteger: 1,
    unsignedByte: 1,
    unsignedInt: 1,
    unsignedLong: 1,
    unsignedShort: 1,
    duration: 0,
    dateTime: 0,
    time: 0,
    date: 0,
    gYearMonth: 0,
    gYear: 0,
    gMonthDay: 0,
    gDay: 0,
    gMonth: 0,
    hexBinary: 0,
    base64Binary: 0,
    anyURI: 0,
    QName: 0,
    NOTATION: 0,
};
class Element {
    constructor(nsName, attrs, options, schemaAttrs) {
        this.allowedChildren = {};
        this.children = [];
        const parts = (0, utils_1.splitQName)(nsName);
        this.nsName = nsName;
        this.prefix = parts.prefix;
        this.name = parts.name;
        this.children = [];
        this.xmlns = {};
        this.schemaXmlns = {};
        this._initializeOptions(options);
        for (const key in attrs) {
            const match = /^xmlns:?(.*)$/.exec(key);
            if (match) {
                this.xmlns[match[1] ? match[1] : utils_1.TNS_PREFIX] = attrs[key];
            }
            else {
                if (key === 'value') {
                    this[this.valueKey] = attrs[key];
                }
                else {
                    this['$' + key] = attrs[key];
                }
            }
        }
        for (const schemaKey in schemaAttrs) {
            const schemaMatch = /^xmlns:?(.*)$/.exec(schemaKey);
            if (schemaMatch && schemaMatch[1]) {
                this.schemaXmlns[schemaMatch[1]] = schemaAttrs[schemaKey];
            }
        }
        if (this.$targetNamespace !== undefined) {
            // Add targetNamespace to the mapping
            this.xmlns[utils_1.TNS_PREFIX] = this.$targetNamespace;
        }
        this.init();
    }
    deleteFixedAttrs() {
        this.children && this.children.length === 0 && delete this.children;
        this.xmlns && Object.keys(this.xmlns).length === 0 && delete this.xmlns;
        delete this.nsName;
        delete this.prefix;
        delete this.name;
    }
    startElement(stack, nsName, attrs, options, schemaXmlns) {
        if (!this.allowedChildren) {
            return;
        }
        let ChildClass = this.allowedChildren[(0, utils_1.splitQName)(nsName).name];
        if (ChildClass == null && !this.strict) {
            ChildClass = UnexpectedElement;
        }
        if (ChildClass) {
            const child = new ChildClass(nsName, attrs, options, schemaXmlns);
            child.init();
            const root = stack[0];
            if (root instanceof DefinitionsElement) {
                child.definitionsXmlns = root.xmlns;
            }
            stack.push(child);
        }
        else {
            this.unexpected(nsName);
        }
    }
    endElement(stack, nsName) {
        if (this.nsName === nsName) {
            if (stack.length < 2) {
                return;
            }
            const parent = stack[stack.length - 2];
            if (this !== stack[0]) {
                _.defaultsDeep(stack[0].xmlns, this.xmlns);
                // delete this.xmlns;
                parent.children.push(this);
                parent.addChild(this);
            }
            stack.pop();
        }
    }
    addChild(child) {
        return;
    }
    unexpected(name) {
        throw new Error('Found unexpected element (' + name + ') inside ' + this.nsName);
    }
    description(definitions, xmlns) {
        return this.$name || this.name;
    }
    init() {
    }
    _initializeOptions(options) {
        if (options) {
            this.valueKey = options.valueKey || '$value';
            this.xmlKey = options.xmlKey || '$xml';
            this.ignoredNamespaces = options.ignoredNamespaces || [];
            this.strict = options.strict || false;
        }
        else {
            this.valueKey = '$value';
            this.xmlKey = '$xml';
            this.ignoredNamespaces = [];
            this.strict = false;
        }
    }
}
exports.Element = Element;
class UnexpectedElement extends Element {
    startElement(stack, nsName, attrs, options, schemaXmlns) {
        const child = new UnexpectedElement(nsName, attrs, options, schemaXmlns);
        child.init();
        stack.push(child);
    }
}
exports.UnexpectedElement = UnexpectedElement;
class ElementElement extends Element {
    constructor() {
        super(...arguments);
        this.allowedChildren = buildAllowedChildren([
            'annotation',
            'complexType',
            'simpleType',
        ]);
    }
    description(definitions, xmlns) {
        let element = {};
        let name = this.$name;
        // Check minOccurs / maxOccurs attributes to see if this element is a list
        // These are default values for an element
        let minOccurs = 1;
        let maxOccurs = 1;
        if (this.$maxOccurs === 'unbounded') {
            maxOccurs = Infinity;
        }
        else if (Boolean(this.$maxOccurs)) {
            maxOccurs = parseInt(this.$maxOccurs, 10);
        }
        if (Boolean(this.$minOccurs)) {
            minOccurs = parseInt(this.$minOccurs, 10);
        }
        const isMany = maxOccurs > 1;
        if (isMany && name) {
            name += '[]';
        }
        if (xmlns && xmlns[utils_1.TNS_PREFIX]) {
            this.$targetNamespace = xmlns[utils_1.TNS_PREFIX];
        }
        let type = this.$type || this.$ref;
        if (type) {
            type = (0, utils_1.splitQName)(type);
            const typeName = type.name;
            const useSchemaXmlns = !!findNs(type.prefix, this.definitionsXmlns, definitions.xmlns) ||
                !!findNs(this.targetNSAlias, this.definitionsXmlns, definitions.xmlns);
            const ns = findNs(type.prefix, xmlns, this.xmlns, useSchemaXmlns ? this.schemaXmlns : undefined, this.definitionsXmlns, definitions.xmlns);
            const schema = definitions.schemas[ns];
            const typeElement = schema && (this.$type ? schema.complexTypes[typeName] || schema.types[typeName] : schema.elements[typeName]);
            const typeStorage = this.$type ? definitions.descriptions.types : definitions.descriptions.elements;
            if (ns && definitions.schemas[ns]) {
                xmlns = definitions.schemas[ns].xmlns;
            }
            if (typeElement && !(typeName in Primitives)) {
                if (!(typeName in typeStorage)) {
                    let elem = {};
                    typeStorage[typeName] = elem;
                    const description = typeElement.description(definitions, xmlns);
                    if (typeof description === 'string') {
                        elem = description;
                    }
                    else {
                        Object.keys(description).forEach((key) => {
                            elem[key] = description[key];
                        });
                        const $attributes = description[AttributeElement.Symbol];
                        if ($attributes) {
                            elem[AttributeElement.Symbol] = $attributes;
                        }
                    }
                    if (this.$ref) {
                        element = elem;
                    }
                    else {
                        element[name] = elem;
                    }
                    if (typeof elem === 'object') {
                        elem.targetNSAlias = type.prefix;
                        elem.targetNamespace = ns;
                    }
                    typeStorage[typeName] = elem;
                }
                else {
                    if (this.$ref) {
                        // Differentiate between a ref for an array of elements and a ref for a single element
                        if (isMany) {
                            const refTypeName = typeName + '[]';
                            typeStorage[refTypeName] = typeStorage[typeName];
                            element[refTypeName] = typeStorage[refTypeName];
                        }
                        else {
                            element = typeStorage[typeName];
                        }
                    }
                    else {
                        element[name] = typeStorage[typeName];
                    }
                }
            }
            else {
                element[name] = this.$type;
            }
        }
        else {
            const children = this.children;
            element[name] = {};
            for (const child of children) {
                if (child instanceof ComplexTypeElement || child instanceof SimpleTypeElement) {
                    element[name] = child.description(definitions, xmlns);
                }
            }
        }
        return element;
    }
}
exports.ElementElement = ElementElement;
class AnyElement extends Element {
}
exports.AnyElement = AnyElement;
class InputElement extends Element {
    constructor() {
        super(...arguments);
        this.allowedChildren = buildAllowedChildren([
            'body',
            'documentation',
            'header',
            'SecuritySpecRef',
        ]);
    }
    addChild(child) {
        if (child instanceof BodyElement) {
            this.use = child.$use;
            if (this.use === 'encoded') {
                this.encodingStyle = child.$encodingStyle;
            }
            this.children.pop();
        }
    }
}
exports.InputElement = InputElement;
class OutputElement extends Element {
    constructor() {
        super(...arguments);
        this.allowedChildren = buildAllowedChildren([
            'body',
            'documentation',
            'header',
            'SecuritySpecRef',
        ]);
    }
    addChild(child) {
        if (child instanceof BodyElement) {
            this.use = child.$use;
            if (this.use === 'encoded') {
                this.encodingStyle = child.$encodingStyle;
            }
            this.children.pop();
        }
    }
}
exports.OutputElement = OutputElement;
class SimpleTypeElement extends Element {
    constructor() {
        super(...arguments);
        this.allowedChildren = buildAllowedChildren([
            'restriction',
        ]);
    }
    description(definitions) {
        for (const child of this.children) {
            if (child instanceof RestrictionElement) {
                return [this.$name, child.description()].filter(Boolean).join('|');
            }
        }
        return {};
    }
}
exports.SimpleTypeElement = SimpleTypeElement;
class RestrictionElement extends Element {
    constructor() {
        super(...arguments);
        this.allowedChildren = buildAllowedChildren([
            'all',
            'choice',
            'enumeration',
            'sequence',
            'attribute',
        ]);
    }
    description(definitions, xmlns) {
        const children = this.children;
        let desc;
        let isFirstChild = false;
        const $attributes = {};
        for (const child of children) {
            if (child instanceof AttributeElement) {
                $attributes[child.$name] = child.description(definitions);
                continue;
            }
            if (!isFirstChild && (child instanceof SequenceElement || child instanceof ChoiceElement)) {
                isFirstChild = true;
                desc = child.description(definitions, xmlns);
            }
        }
        if (Object.keys($attributes).length > 0) {
            desc = desc ?? {};
            desc[AttributeElement.Symbol] = $attributes;
        }
        if (desc && this.$base) {
            const type = (0, utils_1.splitQName)(this.$base);
            const typeName = type.name;
            const ns = findNs(type.prefix, xmlns, this.definitionsXmlns, definitions.xmlns);
            const schema = definitions.schemas[ns];
            const typeElement = schema && (schema.complexTypes[typeName] || schema.types[typeName] || schema.elements[typeName]);
            desc.getBase = () => {
                return typeElement.description(definitions, schema.xmlns);
            };
            if (typeElement) {
                const baseDescription = typeElement.description(definitions, schema.xmlns);
                if (baseDescription[AttributeElement.Symbol]) {
                    _.defaults($attributes, baseDescription[AttributeElement.Symbol]);
                }
                desc = _.defaults(desc, baseDescription);
            }
            return desc;
        }
        const restrictions = this.children.map((child) => {
            return child.description();
        }).join(',');
        return [this.$base, restrictions].filter(Boolean).join('|');
    }
}
exports.RestrictionElement = RestrictionElement;
class ExtensionElement extends Element {
    constructor() {
        super(...arguments);
        this.allowedChildren = buildAllowedChildren([
            'all',
            'choice',
            'sequence',
        ]);
    }
    description(definitions, xmlns) {
        let desc = {};
        for (const child of this.children) {
            if (child instanceof SequenceElement || child instanceof ChoiceElement) {
                desc = child.description(definitions, xmlns);
            }
        }
        if (this.$base) {
            const type = (0, utils_1.splitQName)(this.$base);
            const typeName = type.name;
            const ns = findNs(type.prefix, xmlns, this.definitionsXmlns, definitions.xmlns);
            const schema = definitions.schemas[ns];
            if (typeName in Primitives) {
                return this.$base;
            }
            else {
                const typeElement = schema && (schema.complexTypes[typeName] ||
                    schema.types[typeName] ||
                    schema.elements[typeName]);
                if (typeElement) {
                    const base = typeElement.description(definitions, schema.xmlns);
                    desc = typeof base === 'string' ? base : _.defaults(base, desc);
                }
            }
        }
        return desc;
    }
}
exports.ExtensionElement = ExtensionElement;
class ChoiceElement extends Element {
    constructor() {
        super(...arguments);
        this.allowedChildren = buildAllowedChildren([
            'any',
            'choice',
            'element',
            'sequence',
        ]);
    }
    description(definitions, xmlns) {
        const choice = {};
        for (const child of this.children) {
            const description = child.description(definitions, xmlns);
            for (const key in description) {
                choice[key] = description[key];
            }
        }
        return choice;
    }
}
exports.ChoiceElement = ChoiceElement;
class EnumerationElement extends Element {
    // no children
    description() {
        return this[this.valueKey];
    }
}
exports.EnumerationElement = EnumerationElement;
class ComplexTypeElement extends Element {
    constructor() {
        super(...arguments);
        this.allowedChildren = buildAllowedChildren([
            'all',
            'annotation',
            'choice',
            'complexContent',
            'sequence',
            'simpleContent',
            'attribute',
        ]);
    }
    description(definitions, xmlns) {
        let ret = {};
        let isFirstChild = false;
        const $attributes = {};
        const children = this.children || [];
        for (const child of children) {
            if (child instanceof AttributeElement) {
                $attributes[child.$name] = child.description(definitions);
                continue;
            }
            if (!isFirstChild && (child instanceof ChoiceElement ||
                child instanceof SequenceElement ||
                child instanceof AllElement ||
                child instanceof SimpleContentElement ||
                child instanceof ComplexContentElement)) {
                isFirstChild = true;
                ret = child.description(definitions, xmlns);
            }
        }
        if (Object.keys($attributes).length > 0) {
            ret[AttributeElement.Symbol] = $attributes;
        }
        return ret;
    }
}
exports.ComplexTypeElement = ComplexTypeElement;
class ComplexContentElement extends Element {
    constructor() {
        super(...arguments);
        this.allowedChildren = buildAllowedChildren([
            'extension',
            'restriction',
        ]);
    }
    description(definitions, xmlns) {
        for (const child of this.children) {
            if (child instanceof ExtensionElement || child instanceof RestrictionElement) {
                return child.description(definitions, xmlns);
            }
        }
        return {};
    }
}
exports.ComplexContentElement = ComplexContentElement;
class SimpleContentElement extends Element {
    constructor() {
        super(...arguments);
        this.allowedChildren = buildAllowedChildren([
            'extension',
        ]);
    }
    description(definitions, xmlns) {
        for (const child of this.children) {
            if (child instanceof ExtensionElement) {
                return child.description(definitions, xmlns);
            }
        }
        return {};
    }
}
exports.SimpleContentElement = SimpleContentElement;
class SequenceElement extends Element {
    constructor() {
        super(...arguments);
        this.allowedChildren = buildAllowedChildren([
            'any',
            'choice',
            'element',
            'sequence',
        ]);
    }
    description(definitions, xmlns) {
        const sequence = {};
        for (const child of this.children) {
            if (child instanceof AnyElement) {
                continue;
            }
            const description = child.description(definitions, xmlns);
            for (const key in description) {
                sequence[key] = description[key];
            }
        }
        return sequence;
    }
}
exports.SequenceElement = SequenceElement;
class AttributeElement extends Element {
    description(definitions) {
        return {
            type: this.$type,
            required: this.$use === 'required',
        };
    }
}
exports.AttributeElement = AttributeElement;
AttributeElement.Symbol = Symbol('$attributes');
class AllElement extends Element {
    constructor() {
        super(...arguments);
        this.allowedChildren = buildAllowedChildren([
            'choice',
            'element',
        ]);
    }
    description(definitions, xmlns) {
        const sequence = {};
        for (const child of this.children) {
            if (child instanceof AnyElement) {
                continue;
            }
            const description = child.description(definitions, xmlns);
            for (const key in description) {
                sequence[key] = description[key];
            }
        }
        return sequence;
    }
}
exports.AllElement = AllElement;
class MessageElement extends Element {
    constructor() {
        super(...arguments);
        this.allowedChildren = buildAllowedChildren([
            'part',
            'documentation',
        ]);
        this.element = null;
        this.parts = null;
    }
    postProcess(definitions) {
        let part = null;
        const children = this.children || [];
        for (const child of children) {
            if (child.name === 'part') {
                part = child;
                break;
            }
        }
        if (!part) {
            return;
        }
        if (part.$element) {
            let lookupTypes = [];
            delete this.parts;
            const nsName = (0, utils_1.splitQName)(part.$element);
            const ns = findNs(nsName.prefix, this.definitionsXmlns, definitions.xmlns);
            let schema = definitions.schemas[ns];
            this.element = schema.elements[nsName.name];
            if (!this.element) {
                debug(nsName.name + ' is not present in wsdl and cannot be processed correctly.');
                return;
            }
            this.element.targetNSAlias = nsName.prefix;
            this.element.targetNamespace = ns;
            // set the optional $lookupType to be used within `client#_invoke()` when
            // calling `wsdl#objectToDocumentXML()
            this.element.$lookupType = part.$element;
            const elementChildren = this.element.children;
            // get all nested lookup types (only complex types are followed)
            if (elementChildren.length > 0) {
                for (const child of elementChildren) {
                    lookupTypes.push(this._getNestedLookupTypeString(child));
                }
            }
            // if nested lookup types where found, prepare them for furter usage
            if (lookupTypes.length > 0) {
                lookupTypes = lookupTypes.
                    join('_').
                    split('_').
                    filter(function removeEmptyLookupTypes(type) {
                    return type !== '^';
                });
                const schemaXmlns = definitions.schemas[this.element.targetNamespace].xmlns;
                for (let i = 0; i < lookupTypes.length; i++) {
                    lookupTypes[i] = this._createLookupTypeObject(lookupTypes[i], schemaXmlns);
                }
            }
            this.element.$lookupTypes = lookupTypes;
            if (this.element.$type) {
                const type = (0, utils_1.splitQName)(this.element.$type);
                const typeNs = findNs(type.prefix, schema.xmlns, this.definitionsXmlns, definitions.xmlns);
                if (typeNs) {
                    if (type.name in Primitives) {
                        // this.element = this.element.$type;
                    }
                    else {
                        // first check local mapping of ns alias to namespace
                        schema = definitions.schemas[typeNs];
                        const ctype = schema.complexTypes[type.name] || schema.types[type.name] || schema.elements[type.name];
                        if (ctype) {
                            this.parts = ctype.description(definitions, schema.xmlns);
                        }
                    }
                }
            }
            else {
                const method = this.element.description(definitions, schema.xmlns);
                this.parts = method[nsName.name];
            }
            this.children.splice(0, 1);
        }
        else {
            // rpc encoding
            this.parts = {};
            delete this.element;
            for (let i = 0; part = this.children[i]; i++) {
                if (part.name === 'documentation') {
                    // <wsdl:documentation can be present under <wsdl:message>
                    continue;
                }
                (0, assert_1.ok)(part.name === 'part', 'Expected part element');
                const nsName = (0, utils_1.splitQName)(part.$type);
                const ns = findNs(nsName.prefix, this.definitionsXmlns, definitions.xmlns);
                const type = nsName.name;
                const schemaDefinition = definitions.schemas[ns];
                if (typeof schemaDefinition !== 'undefined') {
                    this.parts[part.$name] = definitions.schemas[ns].types[type] || definitions.schemas[ns].complexTypes[type];
                }
                else {
                    this.parts[part.$name] = part.$type;
                }
                if (typeof this.parts[part.$name] === 'object') {
                    this.parts[part.$name].prefix = nsName.prefix;
                    this.parts[part.$name].xmlns = ns;
                }
                this.children.splice(i--, 1);
            }
        }
        this.deleteFixedAttrs();
    }
    description(definitions) {
        if (this.element) {
            return this.element && this.element.description(definitions);
        }
        const desc = {};
        desc[this.$name] = this.parts;
        return desc;
    }
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
    _createLookupTypeObject(nsString, xmlns) {
        const splittedNSString = (0, utils_1.splitQName)(nsString);
        const nsAlias = splittedNSString.prefix;
        const splittedName = splittedNSString.name.split('#');
        const type = splittedName[0];
        const name = splittedName[1];
        return {
            $namespace: xmlns[nsAlias],
            $type: nsAlias + ':' + type,
            $name: name,
        };
    }
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
    _getNestedLookupTypeString(element) {
        let resolvedType = '^';
        const excluded = this.ignoredNamespaces.concat('xs'); // do not process $type values wich start with
        if (element.hasOwnProperty('$type') && typeof element.$type === 'string') {
            if (excluded.indexOf(element.$type.split(':')[0]) === -1) {
                resolvedType += ('_' + element.$type + '#' + element.$name);
            }
        }
        if (element.children.length > 0) {
            element.children.forEach((child) => {
                const resolvedChildType = this._getNestedLookupTypeString(child).replace(/\^_/, '');
                if (resolvedChildType && typeof resolvedChildType === 'string') {
                    resolvedType += ('_' + resolvedChildType);
                }
            });
        }
        return resolvedType;
    }
}
exports.MessageElement = MessageElement;
class DocumentationElement extends Element {
}
exports.DocumentationElement = DocumentationElement;
class SchemaElement extends Element {
    constructor() {
        super(...arguments);
        this.allowedChildren = buildAllowedChildren([
            'complexType',
            'element',
            'import',
            'include',
            'simpleType',
        ]);
        this.complexTypes = {};
        this.types = {};
        this.elements = {};
        this.includes = [];
    }
    merge(source) {
        (0, assert_1.ok)(source instanceof SchemaElement);
        _.merge(this.complexTypes, source.complexTypes);
        _.merge(this.types, source.types);
        _.merge(this.elements, source.elements);
        _.merge(this.xmlns, source.xmlns);
        // Merge attributes from source without overwriting our's
        _.merge(this, _.pickBy(source, (value, key) => {
            return key.startsWith('$') && !this.hasOwnProperty(key);
        }));
        return this;
    }
    addChild(child) {
        if (child.$name in Primitives) {
            return;
        }
        if (child instanceof IncludeElement || child instanceof ImportElement) {
            const location = child.$schemaLocation || child.$location;
            if (location) {
                this.includes.push({
                    namespace: child.$namespace || child.$targetNamespace || this.$targetNamespace,
                    location: location,
                });
            }
        }
        else if (child instanceof ComplexTypeElement) {
            this.complexTypes[child.$name] = child;
        }
        else if (child instanceof ElementElement) {
            this.elements[child.$name] = child;
        }
        else if (child instanceof SimpleTypeElement) {
            this.types[child.$name] = child;
        }
        this.children.pop();
        // child.deleteFixedAttrs();
    }
}
exports.SchemaElement = SchemaElement;
class TypesElement extends Element {
    constructor() {
        super(...arguments);
        this.allowedChildren = buildAllowedChildren([
            'documentation',
            'schema',
        ]);
        this.schemas = {};
    }
    // fix#325
    addChild(child) {
        (0, assert_1.ok)(child instanceof SchemaElement);
        const targetNamespace = child.$targetNamespace || child.includes[0]?.namespace;
        if (!this.schemas.hasOwnProperty(targetNamespace)) {
            this.schemas[targetNamespace] = child;
        }
        else {
            console.error('Target-Namespace "' + targetNamespace + '" already in use by another Schema!');
        }
    }
}
exports.TypesElement = TypesElement;
class OperationElement extends Element {
    constructor() {
        super(...arguments);
        this.allowedChildren = buildAllowedChildren([
            'documentation',
            'fault',
            'input',
            'operation',
            'output',
        ]);
        this.input = null;
        this.output = null;
        this.inputSoap = null;
        this.outputSoap = null;
        this.style = '';
        this.soapAction = '';
    }
    addChild(child) {
        if (child instanceof OperationElement) {
            this.soapAction = child.$soapAction || '';
            this.style = child.$style || '';
            this.children.pop();
        }
    }
    postProcess(definitions, tag) {
        const children = this.children;
        for (let i = 0, child; child = children[i]; i++) {
            if (child.name !== 'input' && child.name !== 'output') {
                continue;
            }
            if (tag === 'binding') {
                this[child.name] = child;
                children.splice(i--, 1);
                continue;
            }
            const messageName = (0, utils_1.splitQName)(child.$message).name;
            const message = definitions.messages[messageName];
            if (message) {
                message.postProcess(definitions);
                if (message.element) {
                    definitions.messages[message.element.$name] = message;
                    this[child.name] = message.element;
                }
                else {
                    this[child.name] = message;
                }
                children.splice(i--, 1);
            }
        }
        this.deleteFixedAttrs();
    }
    description(definitions) {
        const inputDesc = this.input ? this.input.description(definitions) : null;
        const outputDesc = this.output ? this.output.description(definitions) : null;
        return {
            input: inputDesc && inputDesc[Object.keys(inputDesc)[0]],
            output: outputDesc && outputDesc[Object.keys(outputDesc)[0]],
        };
    }
}
exports.OperationElement = OperationElement;
class PortTypeElement extends Element {
    constructor() {
        super(...arguments);
        this.allowedChildren = buildAllowedChildren([
            'documentation',
            'operation',
        ]);
        this.methods = {};
    }
    postProcess(definitions) {
        const children = this.children;
        if (typeof children === 'undefined') {
            return;
        }
        for (let i = 0, child; child = children[i]; i++) {
            if (child.name !== 'operation') {
                continue;
            }
            child.postProcess(definitions, 'portType');
            this.methods[child.$name] = child;
            children.splice(i--, 1);
        }
        delete this.$name;
        this.deleteFixedAttrs();
    }
    description(definitions) {
        const methods = {};
        for (const name in this.methods) {
            const method = this.methods[name];
            methods[name] = method.description(definitions);
        }
        return methods;
    }
}
exports.PortTypeElement = PortTypeElement;
class BindingElement extends Element {
    constructor() {
        super(...arguments);
        this.allowedChildren = buildAllowedChildren([
            'binding',
            'documentation',
            'operation',
            'SecuritySpec',
        ]);
        this.transport = '';
        this.style = '';
        this.methods = {};
    }
    addChild(child) {
        if (child.name === 'binding') {
            this.transport = child.$transport;
            this.style = child.$style;
            this.children.pop();
        }
    }
    postProcess(definitions) {
        const type = (0, utils_1.splitQName)(this.$type).name;
        const portType = definitions.portTypes[type];
        const style = this.style;
        const children = this.children;
        if (portType) {
            portType.postProcess(definitions);
            this.methods = portType.methods;
            for (let i = 0, child; child = children[i]; i++) {
                if (child.name !== 'operation') {
                    continue;
                }
                child.postProcess(definitions, 'binding');
                children.splice(i--, 1);
                child.style || (child.style = style);
                const method = this.methods[child.$name];
                if (method) {
                    method.style = child.style;
                    method.soapAction = child.soapAction;
                    method.inputSoap = child.input || null;
                    method.outputSoap = child.output || null;
                    method.inputSoap && method.inputSoap.deleteFixedAttrs();
                    method.outputSoap && method.outputSoap.deleteFixedAttrs();
                }
            }
        }
        delete this.$name;
        delete this.$type;
        this.deleteFixedAttrs();
    }
    description(definitions) {
        const methods = {};
        for (const name in this.methods) {
            const method = this.methods[name];
            methods[name] = method.description(definitions);
        }
        return methods;
    }
}
exports.BindingElement = BindingElement;
class PortElement extends Element {
    constructor() {
        super(...arguments);
        this.allowedChildren = buildAllowedChildren([
            'address',
            'documentation',
        ]);
        this.location = null;
    }
    addChild(child) {
        if (child.name === 'address' && typeof (child.$location) !== 'undefined') {
            this.location = child.$location;
        }
    }
}
exports.PortElement = PortElement;
class ServiceElement extends Element {
    constructor() {
        super(...arguments);
        this.allowedChildren = buildAllowedChildren([
            'documentation',
            'port',
        ]);
        this.ports = {};
    }
    postProcess(definitions) {
        const children = this.children;
        const bindings = definitions.bindings;
        if (children && children.length > 0) {
            for (let i = 0, child; child = children[i]; i++) {
                if (child.name !== 'port') {
                    continue;
                }
                const bindingName = (0, utils_1.splitQName)(child.$binding).name;
                const binding = bindings[bindingName];
                if (binding) {
                    binding.postProcess(definitions);
                    this.ports[child.$name] = {
                        location: child.location,
                        binding: binding,
                    };
                    children.splice(i--, 1);
                }
            }
        }
        delete this.$name;
        this.deleteFixedAttrs();
    }
    description(definitions) {
        const ports = {};
        for (const name in this.ports) {
            const port = this.ports[name];
            ports[name] = port.binding.description(definitions);
        }
        return ports;
    }
}
exports.ServiceElement = ServiceElement;
class DefinitionsElement extends Element {
    constructor() {
        super(...arguments);
        this.allowedChildren = buildAllowedChildren([
            'binding',
            'documentation',
            'import',
            'message',
            'portType',
            'service',
            'types',
        ]);
        this.messages = {};
        this.portTypes = {};
        this.bindings = {};
        this.services = {};
        this.schemas = {};
        this.descriptions = {
            types: {},
            elements: {},
        };
    }
    init() {
        if (this.name !== 'definitions') {
            this.unexpected(this.nsName);
        }
    }
    addChild(child) {
        if (child instanceof TypesElement) {
            // Merge types.schemas into definitions.schemas
            _.merge(this.schemas, child.schemas);
        }
        else if (child instanceof MessageElement) {
            this.messages[child.$name] = child;
        }
        else if (child.name === 'import') {
            const schemaElement = new SchemaElement(child.$namespace, {});
            schemaElement.init();
            this.schemas[child.$namespace] = schemaElement;
            this.schemas[child.$namespace].addChild(child);
        }
        else if (child instanceof PortTypeElement) {
            this.portTypes[child.$name] = child;
        }
        else if (child instanceof BindingElement) {
            if (child.transport === 'http://schemas.xmlsoap.org/soap/http' ||
                child.transport === 'http://www.w3.org/2003/05/soap/bindings/HTTP/') {
                this.bindings[child.$name] = child;
            }
        }
        else if (child instanceof ServiceElement) {
            this.services[child.$name] = child;
        }
        else if (child instanceof DocumentationElement) {
        }
        this.children.pop();
    }
}
exports.DefinitionsElement = DefinitionsElement;
class BodyElement extends Element {
}
exports.BodyElement = BodyElement;
class IncludeElement extends Element {
}
exports.IncludeElement = IncludeElement;
class ImportElement extends Element {
}
exports.ImportElement = ImportElement;
const ElementTypeMap = {
    // group: [GroupElement, 'element group'],
    all: AllElement,
    any: AnyElement,
    binding: BindingElement,
    body: BodyElement,
    choice: ChoiceElement,
    complexContent: ComplexContentElement,
    complexType: ComplexTypeElement,
    definitions: DefinitionsElement,
    documentation: DocumentationElement,
    element: ElementElement,
    enumeration: EnumerationElement,
    extension: ExtensionElement,
    fault: Element,
    import: ImportElement,
    include: IncludeElement,
    input: InputElement,
    message: MessageElement,
    operation: OperationElement,
    output: OutputElement,
    port: PortElement,
    portType: PortTypeElement,
    restriction: RestrictionElement,
    schema: SchemaElement,
    sequence: SequenceElement,
    service: ServiceElement,
    simpleContent: SimpleContentElement,
    simpleType: SimpleTypeElement,
    types: TypesElement,
    attribute: AttributeElement,
};
function buildAllowedChildren(elementList) {
    const rtn = {};
    for (const element of elementList) {
        rtn[element.replace(/^_/, '')] = ElementTypeMap[element] || Element;
    }
    return rtn;
}
/**
 * Return the first matching namespace for the provided prefix.
 */
function findNs(prefix, ...xmlnss) {
    for (const xmlns of xmlnss) {
        if (xmlns?.[prefix]) {
            return xmlns[prefix];
        }
    }
}
//# sourceMappingURL=elements.js.map