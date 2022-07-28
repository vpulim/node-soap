"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
exports.ImportElement = exports.IncludeElement = exports.BodyElement = exports.DefinitionsElement = exports.ServiceElement = exports.PortElement = exports.BindingElement = exports.PortTypeElement = exports.OperationElement = exports.TypesElement = exports.SchemaElement = exports.DocumentationElement = exports.AnnotationElement = exports.MessageElement = exports.AllElement = exports.SequenceElement = exports.SimpleContentElement = exports.ComplexContentElement = exports.ComplexTypeElement = exports.EnumerationElement = exports.ChoiceElement = exports.ExtensionElement = exports.RestrictionElement = exports.SimpleTypeElement = exports.OutputElement = exports.InputElement = exports.AnyElement = exports.ElementElement = exports.Element = void 0;
var assert_1 = require("assert");
var debugBuilder = require("debug");
var _ = require("lodash");
var utils_1 = require("../utils");
var debug = debugBuilder('node-soap');
var Primitives = {
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
    NOTATION: 0
};
var Element = /** @class */ (function () {
    function Element(nsName, attrs, options, schemaAttrs) {
        this.allowedChildren = {};
        this.children = [];
        var parts = utils_1.splitQName(nsName);
        this.nsName = nsName;
        this.prefix = parts.prefix;
        this.name = parts.name;
        this.children = [];
        this.xmlns = {};
        this.schemaXmlns = {};
        this._initializeOptions(options);
        for (var key in attrs) {
            var match = /^xmlns:?(.*)$/.exec(key);
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
        for (var schemaKey in schemaAttrs) {
            var schemaMatch = /^xmlns:?(.*)$/.exec(schemaKey);
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
    Element.prototype.deleteFixedAttrs = function () {
        this.children && this.children.length === 0 && delete this.children;
        this.xmlns && Object.keys(this.xmlns).length === 0 && delete this.xmlns;
        delete this.nsName;
        delete this.prefix;
        delete this.name;
    };
    Element.prototype.startElement = function (stack, nsName, attrs, options, schemaXmlns) {
        if (!this.allowedChildren) {
            return;
        }
        var ChildClass = this.allowedChildren[utils_1.splitQName(nsName).name];
        if (ChildClass) {
            var child = new ChildClass(nsName, attrs, options, schemaXmlns);
            child.init();
            stack.push(child);
        }
        else {
            this.unexpected(nsName);
        }
    };
    Element.prototype.setText = function (text) {
        this.$text = text;
    };
    Element.prototype.endElement = function (stack, nsName) {
        if (this.nsName === nsName) {
            if (stack.length < 2) {
                return;
            }
            var parent_1 = stack[stack.length - 2];
            if (this !== stack[0]) {
                _.defaultsDeep(stack[0].xmlns, this.xmlns);
                // delete this.xmlns;
                parent_1.children.push(this);
                parent_1.addChild(this);
            }
            stack.pop();
        }
    };
    Element.prototype.addChild = function (child) {
        return;
    };
    Element.prototype.unexpected = function (name) {
        throw new Error('Found unexpected element (' + name + ') inside ' + this.nsName);
    };
    Element.prototype.description = function (definitions, xmlns) {
        return this.$name || this.name;
    };
    Element.prototype.init = function () {
    };
    Element.prototype._initializeOptions = function (options) {
        if (options) {
            this.valueKey = options.valueKey || '$value';
            this.xmlKey = options.xmlKey || '$xml';
            this.ignoredNamespaces = options.ignoredNamespaces || [];
        }
        else {
            this.valueKey = '$value';
            this.xmlKey = '$xml';
            this.ignoredNamespaces = [];
        }
    };
    return Element;
}());
exports.Element = Element;
var ElementElement = /** @class */ (function (_super) {
    __extends(ElementElement, _super);
    function ElementElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'annotation',
            'complexType',
            'simpleType',
        ]);
        _this.annotation = null;
        return _this;
    }
    ElementElement.prototype.addChild = function (child) {
        if (child instanceof AnnotationElement) {
            this.annotation = child;
            this.children.pop();
        }
    };
    ElementElement.prototype.description = function (definitions, xmlns) {
        var element = {};
        var name = this.$name;
        // Check minOccurs / maxOccurs attributes to see if this element is a list
        // These are default values for an element
        var minOccurs = 1;
        var maxOccurs = 1;
        if (this.$maxOccurs === 'unbounded') {
            maxOccurs = Infinity;
        }
        else if (Boolean(this.$maxOccurs)) {
            maxOccurs = parseInt(this.$maxOccurs, 10);
        }
        if (Boolean(this.$minOccurs)) {
            minOccurs = parseInt(this.$minOccurs, 10);
        }
        var isMany = maxOccurs > 1;
        if (isMany) {
            name += '[]';
        }
        if (xmlns && xmlns[utils_1.TNS_PREFIX]) {
            this.$targetNamespace = xmlns[utils_1.TNS_PREFIX];
        }
        var type = this.$type || this.$ref;
        if (type) {
            type = utils_1.splitQName(type);
            var typeName = type.name;
            var ns = xmlns && xmlns[type.prefix] ||
                ((definitions.xmlns[type.prefix] !== undefined || definitions.xmlns[this.targetNSAlias] !== undefined) && this.schemaXmlns[type.prefix]) ||
                definitions.xmlns[type.prefix];
            var schema = definitions.schemas[ns];
            var typeElement = schema && (this.$type ? schema.complexTypes[typeName] || schema.types[typeName] : schema.elements[typeName]);
            var typeStorage = this.$type ? definitions.descriptions.types : definitions.descriptions.elements;
            if (ns && definitions.schemas[ns]) {
                xmlns = definitions.schemas[ns].xmlns;
            }
            if (typeElement && !(typeName in Primitives)) {
                if (!(typeName in typeStorage)) {
                    var elem_1 = {};
                    typeStorage[typeName] = elem_1;
                    var description_1 = typeElement.description(definitions, xmlns);
                    if (typeof description_1 === 'string') {
                        elem_1 = description_1;
                    }
                    else {
                        Object.keys(description_1).forEach(function (key) {
                            elem_1[key] = description_1[key];
                        });
                    }
                    if (this.$ref) {
                        element = elem_1;
                    }
                    else {
                        element[name] = elem_1;
                    }
                    if (typeof elem_1 === 'object') {
                        elem_1.targetNSAlias = type.prefix;
                        elem_1.targetNamespace = ns;
                    }
                    typeStorage[typeName] = elem_1;
                }
                else {
                    if (this.$ref) {
                        element = typeStorage[typeName];
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
            var children = this.children;
            element[name] = {};
            for (var _i = 0, children_1 = children; _i < children_1.length; _i++) {
                var child = children_1[_i];
                if (child instanceof ComplexTypeElement || child instanceof SimpleTypeElement) {
                    element[name] = child.description(definitions, xmlns);
                }
            }
        }
        return element;
    };
    return ElementElement;
}(Element));
exports.ElementElement = ElementElement;
var AnyElement = /** @class */ (function (_super) {
    __extends(AnyElement, _super);
    function AnyElement() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return AnyElement;
}(Element));
exports.AnyElement = AnyElement;
var InputElement = /** @class */ (function (_super) {
    __extends(InputElement, _super);
    function InputElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'body',
            'documentation',
            'header',
            'SecuritySpecRef',
        ]);
        return _this;
    }
    InputElement.prototype.addChild = function (child) {
        if (child instanceof BodyElement) {
            this.use = child.$use;
            if (this.use === 'encoded') {
                this.encodingStyle = child.$encodingStyle;
            }
            this.children.pop();
        }
    };
    return InputElement;
}(Element));
exports.InputElement = InputElement;
var OutputElement = /** @class */ (function (_super) {
    __extends(OutputElement, _super);
    function OutputElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'body',
            'documentation',
            'header',
            'SecuritySpecRef',
        ]);
        return _this;
    }
    OutputElement.prototype.addChild = function (child) {
        if (child instanceof BodyElement) {
            this.use = child.$use;
            if (this.use === 'encoded') {
                this.encodingStyle = child.$encodingStyle;
            }
            this.children.pop();
        }
    };
    return OutputElement;
}(Element));
exports.OutputElement = OutputElement;
var SimpleTypeElement = /** @class */ (function (_super) {
    __extends(SimpleTypeElement, _super);
    function SimpleTypeElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'restriction',
        ]);
        return _this;
    }
    SimpleTypeElement.prototype.description = function (definitions) {
        for (var _i = 0, _a = this.children; _i < _a.length; _i++) {
            var child = _a[_i];
            if (child instanceof RestrictionElement) {
                return [this.$name, child.description()].filter(Boolean).join('|');
            }
        }
        return {};
    };
    return SimpleTypeElement;
}(Element));
exports.SimpleTypeElement = SimpleTypeElement;
var RestrictionElement = /** @class */ (function (_super) {
    __extends(RestrictionElement, _super);
    function RestrictionElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'all',
            'choice',
            'enumeration',
            'sequence',
        ]);
        return _this;
    }
    RestrictionElement.prototype.description = function (definitions, xmlns) {
        var children = this.children;
        var desc;
        for (var i = 0, child = void 0; child = children[i]; i++) {
            if (child instanceof SequenceElement || child instanceof ChoiceElement) {
                desc = child.description(definitions, xmlns);
                break;
            }
        }
        if (desc && this.$base) {
            var type = utils_1.splitQName(this.$base);
            var typeName = type.name;
            var ns = xmlns && xmlns[type.prefix] || definitions.xmlns[type.prefix];
            var schema_1 = definitions.schemas[ns];
            var typeElement_1 = schema_1 && (schema_1.complexTypes[typeName] || schema_1.types[typeName] || schema_1.elements[typeName]);
            desc.getBase = function () {
                return typeElement_1.description(definitions, schema_1.xmlns);
            };
            return desc;
        }
        // then simple element
        var base = this.$base ? this.$base + '|' : '';
        var restrictions = this.children.map(function (child) {
            return child.description();
        }).join(',');
        return [this.$base, restrictions].filter(Boolean).join('|');
    };
    return RestrictionElement;
}(Element));
exports.RestrictionElement = RestrictionElement;
var ExtensionElement = /** @class */ (function (_super) {
    __extends(ExtensionElement, _super);
    function ExtensionElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'all',
            'choice',
            'sequence',
        ]);
        return _this;
    }
    ExtensionElement.prototype.description = function (definitions, xmlns) {
        var desc = {};
        for (var _i = 0, _a = this.children; _i < _a.length; _i++) {
            var child = _a[_i];
            if (child instanceof SequenceElement || child instanceof ChoiceElement) {
                desc = child.description(definitions, xmlns);
            }
        }
        if (this.$base) {
            var type = utils_1.splitQName(this.$base);
            var typeName = type.name;
            var ns = xmlns && xmlns[type.prefix] || definitions.xmlns[type.prefix];
            var schema = definitions.schemas[ns];
            if (typeName in Primitives) {
                return this.$base;
            }
            else {
                var typeElement = schema && (schema.complexTypes[typeName] ||
                    schema.types[typeName] ||
                    schema.elements[typeName]);
                if (typeElement) {
                    var base = typeElement.description(definitions, schema.xmlns);
                    desc = typeof base === 'string' ? base : _.defaults(base, desc);
                }
            }
        }
        return desc;
    };
    return ExtensionElement;
}(Element));
exports.ExtensionElement = ExtensionElement;
var ChoiceElement = /** @class */ (function (_super) {
    __extends(ChoiceElement, _super);
    function ChoiceElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'any',
            'choice',
            'element',
            'sequence',
        ]);
        return _this;
    }
    ChoiceElement.prototype.description = function (definitions, xmlns) {
        var choice = {};
        for (var _i = 0, _a = this.children; _i < _a.length; _i++) {
            var child = _a[_i];
            var description = child.description(definitions, xmlns);
            for (var key in description) {
                choice[key] = description[key];
            }
        }
        return choice;
    };
    return ChoiceElement;
}(Element));
exports.ChoiceElement = ChoiceElement;
var EnumerationElement = /** @class */ (function (_super) {
    __extends(EnumerationElement, _super);
    function EnumerationElement() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    // no children
    EnumerationElement.prototype.description = function () {
        return this[this.valueKey];
    };
    return EnumerationElement;
}(Element));
exports.EnumerationElement = EnumerationElement;
var ComplexTypeElement = /** @class */ (function (_super) {
    __extends(ComplexTypeElement, _super);
    function ComplexTypeElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'all',
            'annotation',
            'choice',
            'complexContent',
            'sequence',
            'simpleContent',
        ]);
        _this.annotation = null;
        return _this;
    }
    ComplexTypeElement.prototype.addChild = function (child) {
        if (child instanceof AnnotationElement) {
            this.annotation = child;
        }
        this.children.pop();
    };
    ComplexTypeElement.prototype.description = function (definitions, xmlns) {
        var children = this.children || [];
        for (var _i = 0, children_2 = children; _i < children_2.length; _i++) {
            var child = children_2[_i];
            if (child instanceof ChoiceElement ||
                child instanceof SequenceElement ||
                child instanceof AllElement ||
                child instanceof SimpleContentElement ||
                child instanceof ComplexContentElement) {
                return child.description(definitions, xmlns);
            }
        }
        return {};
    };
    return ComplexTypeElement;
}(Element));
exports.ComplexTypeElement = ComplexTypeElement;
var ComplexContentElement = /** @class */ (function (_super) {
    __extends(ComplexContentElement, _super);
    function ComplexContentElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'extension',
        ]);
        return _this;
    }
    ComplexContentElement.prototype.description = function (definitions, xmlns) {
        for (var _i = 0, _a = this.children; _i < _a.length; _i++) {
            var child = _a[_i];
            if (child instanceof ExtensionElement) {
                return child.description(definitions, xmlns);
            }
        }
        return {};
    };
    return ComplexContentElement;
}(Element));
exports.ComplexContentElement = ComplexContentElement;
var SimpleContentElement = /** @class */ (function (_super) {
    __extends(SimpleContentElement, _super);
    function SimpleContentElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'extension',
        ]);
        return _this;
    }
    SimpleContentElement.prototype.description = function (definitions, xmlns) {
        for (var _i = 0, _a = this.children; _i < _a.length; _i++) {
            var child = _a[_i];
            if (child instanceof ExtensionElement) {
                return child.description(definitions, xmlns);
            }
        }
        return {};
    };
    return SimpleContentElement;
}(Element));
exports.SimpleContentElement = SimpleContentElement;
var SequenceElement = /** @class */ (function (_super) {
    __extends(SequenceElement, _super);
    function SequenceElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'any',
            'choice',
            'element',
            'sequence',
        ]);
        return _this;
    }
    SequenceElement.prototype.description = function (definitions, xmlns) {
        var sequence = {};
        for (var _i = 0, _a = this.children; _i < _a.length; _i++) {
            var child = _a[_i];
            if (child instanceof AnyElement) {
                continue;
            }
            var description = child.description(definitions, xmlns);
            for (var key in description) {
                sequence[key] = description[key];
            }
        }
        return sequence;
    };
    return SequenceElement;
}(Element));
exports.SequenceElement = SequenceElement;
var AllElement = /** @class */ (function (_super) {
    __extends(AllElement, _super);
    function AllElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'choice',
            'element',
        ]);
        return _this;
    }
    AllElement.prototype.description = function (definitions, xmlns) {
        var sequence = {};
        for (var _i = 0, _a = this.children; _i < _a.length; _i++) {
            var child = _a[_i];
            if (child instanceof AnyElement) {
                continue;
            }
            var description = child.description(definitions, xmlns);
            for (var key in description) {
                sequence[key] = description[key];
            }
        }
        return sequence;
    };
    return AllElement;
}(Element));
exports.AllElement = AllElement;
var MessageElement = /** @class */ (function (_super) {
    __extends(MessageElement, _super);
    function MessageElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'part',
            'documentation',
        ]);
        _this.element = null;
        _this.parts = null;
        return _this;
    }
    MessageElement.prototype.postProcess = function (definitions) {
        var part = null;
        var children = this.children || [];
        for (var _i = 0, children_3 = children; _i < children_3.length; _i++) {
            var child = children_3[_i];
            if (child.name === 'part') {
                part = child;
                break;
            }
        }
        if (!part) {
            return;
        }
        if (part.$element) {
            var lookupTypes = [];
            delete this.parts;
            var nsName = utils_1.splitQName(part.$element);
            var ns = nsName.prefix;
            var schema = definitions.schemas[definitions.xmlns[ns]];
            this.element = schema.elements[nsName.name];
            if (!this.element) {
                debug(nsName.name + ' is not present in wsdl and cannot be processed correctly.');
                return;
            }
            this.element.targetNSAlias = ns;
            this.element.targetNamespace = definitions.xmlns[ns];
            // set the optional $lookupType to be used within `client#_invoke()` when
            // calling `wsdl#objectToDocumentXML()
            this.element.$lookupType = part.$element;
            var elementChildren = this.element.children;
            // get all nested lookup types (only complex types are followed)
            if (elementChildren.length > 0) {
                for (var _a = 0, elementChildren_1 = elementChildren; _a < elementChildren_1.length; _a++) {
                    var child = elementChildren_1[_a];
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
                var schemaXmlns = definitions.schemas[this.element.targetNamespace].xmlns;
                for (var i = 0; i < lookupTypes.length; i++) {
                    lookupTypes[i] = this._createLookupTypeObject(lookupTypes[i], schemaXmlns);
                }
            }
            this.element.$lookupTypes = lookupTypes;
            if (this.element.$type) {
                var type = utils_1.splitQName(this.element.$type);
                var typeNs = schema.xmlns && schema.xmlns[type.prefix] || definitions.xmlns[type.prefix];
                if (typeNs) {
                    if (type.name in Primitives) {
                        // this.element = this.element.$type;
                    }
                    else {
                        // first check local mapping of ns alias to namespace
                        schema = definitions.schemas[typeNs];
                        var ctype = schema.complexTypes[type.name] || schema.types[type.name] || schema.elements[type.name];
                        if (ctype) {
                            this.parts = ctype.description(definitions, schema.xmlns);
                        }
                    }
                }
            }
            else {
                var method = this.element.description(definitions, schema.xmlns);
                this.parts = method[nsName.name];
            }
            this.children.splice(0, 1);
        }
        else {
            // rpc encoding
            this.parts = {};
            delete this.element;
            for (var i = 0; part = this.children[i]; i++) {
                if (part.name === 'documentation') {
                    // <wsdl:documentation can be present under <wsdl:message>
                    continue;
                }
                assert_1.ok(part.name === 'part', 'Expected part element');
                var nsName = utils_1.splitQName(part.$type);
                var ns = definitions.xmlns[nsName.prefix];
                var type = nsName.name;
                var schemaDefinition = definitions.schemas[ns];
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
    };
    MessageElement.prototype.description = function (definitions) {
        if (this.element) {
            return this.element && this.element.description(definitions);
        }
        var desc = {};
        desc[this.$name] = this.parts;
        return desc;
    };
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
    MessageElement.prototype._createLookupTypeObject = function (nsString, xmlns) {
        var splittedNSString = utils_1.splitQName(nsString);
        var nsAlias = splittedNSString.prefix;
        var splittedName = splittedNSString.name.split('#');
        var type = splittedName[0];
        var name = splittedName[1];
        return {
            $namespace: xmlns[nsAlias],
            $type: nsAlias + ':' + type,
            $name: name
        };
    };
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
    MessageElement.prototype._getNestedLookupTypeString = function (element) {
        var _this = this;
        var resolvedType = '^';
        var excluded = this.ignoredNamespaces.concat('xs'); // do not process $type values wich start with
        if (element.hasOwnProperty('$type') && typeof element.$type === 'string') {
            if (excluded.indexOf(element.$type.split(':')[0]) === -1) {
                resolvedType += ('_' + element.$type + '#' + element.$name);
            }
        }
        if (element.children.length > 0) {
            element.children.forEach(function (child) {
                var resolvedChildType = _this._getNestedLookupTypeString(child).replace(/\^_/, '');
                if (resolvedChildType && typeof resolvedChildType === 'string') {
                    resolvedType += ('_' + resolvedChildType);
                }
            });
        }
        return resolvedType;
    };
    return MessageElement;
}(Element));
exports.MessageElement = MessageElement;
var AnnotationElement = /** @class */ (function (_super) {
    __extends(AnnotationElement, _super);
    function AnnotationElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'documentation',
        ]);
        _this.documentation = null;
        return _this;
    }
    AnnotationElement.prototype.addChild = function (child) {
        if (child instanceof DocumentationElement) {
            this.documentation = child;
            this.children.pop();
        }
    };
    return AnnotationElement;
}(Element));
exports.AnnotationElement = AnnotationElement;
var DocumentationElement = /** @class */ (function (_super) {
    __extends(DocumentationElement, _super);
    function DocumentationElement() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return DocumentationElement;
}(Element));
exports.DocumentationElement = DocumentationElement;
var SchemaElement = /** @class */ (function (_super) {
    __extends(SchemaElement, _super);
    function SchemaElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'complexType',
            'element',
            'import',
            'include',
            'simpleType',
        ]);
        _this.complexTypes = {};
        _this.types = {};
        _this.elements = {};
        _this.includes = [];
        return _this;
    }
    SchemaElement.prototype.merge = function (source) {
        var _this = this;
        assert_1.ok(source instanceof SchemaElement);
        _.merge(this.complexTypes, source.complexTypes);
        _.merge(this.types, source.types);
        _.merge(this.elements, source.elements);
        _.merge(this.xmlns, source.xmlns);
        // Merge attributes from source without overwriting our's
        _.merge(this, _.pickBy(source, function (value, key) {
            return key.startsWith('$') && !_this.hasOwnProperty(key);
        }));
        return this;
    };
    SchemaElement.prototype.addChild = function (child) {
        if (child.$name in Primitives) {
            return;
        }
        if (child instanceof IncludeElement || child instanceof ImportElement) {
            var location_1 = child.$schemaLocation || child.$location;
            if (location_1) {
                this.includes.push({
                    namespace: child.$namespace || child.$targetNamespace || this.$targetNamespace,
                    location: location_1
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
    };
    return SchemaElement;
}(Element));
exports.SchemaElement = SchemaElement;
var TypesElement = /** @class */ (function (_super) {
    __extends(TypesElement, _super);
    function TypesElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'documentation',
            'schema',
        ]);
        _this.schemas = {};
        return _this;
    }
    // fix#325
    TypesElement.prototype.addChild = function (child) {
        var _a;
        assert_1.ok(child instanceof SchemaElement);
        var targetNamespace = child.$targetNamespace || ((_a = child.includes[0]) === null || _a === void 0 ? void 0 : _a.namespace);
        if (!this.schemas.hasOwnProperty(targetNamespace)) {
            this.schemas[targetNamespace] = child;
        }
        else {
            console.error('Target-Namespace "' + targetNamespace + '" already in use by another Schema!');
        }
    };
    return TypesElement;
}(Element));
exports.TypesElement = TypesElement;
var OperationElement = /** @class */ (function (_super) {
    __extends(OperationElement, _super);
    function OperationElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'documentation',
            'fault',
            'input',
            'operation',
            'output',
        ]);
        _this.documentation = null;
        _this.input = null;
        _this.output = null;
        _this.inputSoap = null;
        _this.outputSoap = null;
        _this.style = '';
        _this.soapAction = '';
        return _this;
    }
    OperationElement.prototype.addChild = function (child) {
        if (child instanceof OperationElement) {
            this.soapAction = child.$soapAction || '';
            this.style = child.$style || '';
            this.children.pop();
        }
    };
    OperationElement.prototype.postProcess = function (definitions, tag) {
        var children = this.children;
        for (var i = 0, child = void 0; child = children[i]; i++) {
            if (child.name === 'documentation') {
                this.documentation = child;
                children.splice(i--, 1);
                continue;
            }
            if (child.name !== 'input' && child.name !== 'output') {
                continue;
            }
            if (tag === 'binding') {
                this[child.name] = child;
                children.splice(i--, 1);
                continue;
            }
            var messageName = utils_1.splitQName(child.$message).name;
            var message = definitions.messages[messageName];
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
        this.deleteFixedAttrs();
    };
    OperationElement.prototype.description = function (definitions) {
        var documentation = this.documentation ? this.documentation.description() : null;
        var inputDesc = this.input ? this.input.description(definitions) : null;
        var outputDesc = this.output ? this.output.description(definitions) : null;
        return {
            documentation: documentation,
            input: inputDesc && inputDesc[Object.keys(inputDesc)[0]],
            output: outputDesc && outputDesc[Object.keys(outputDesc)[0]]
        };
    };
    return OperationElement;
}(Element));
exports.OperationElement = OperationElement;
var PortTypeElement = /** @class */ (function (_super) {
    __extends(PortTypeElement, _super);
    function PortTypeElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'documentation',
            'operation',
        ]);
        _this.documentation = null;
        _this.methods = {};
        return _this;
    }
    PortTypeElement.prototype.postProcess = function (definitions) {
        var children = this.children;
        if (typeof children === 'undefined') {
            return;
        }
        for (var i = 0, child = void 0; child = children[i]; i++) {
            if (child.name === 'documentation') {
                this.documentation = child;
                children.splice(i--, 1);
                continue;
            }
            if (child.name !== 'operation') {
                continue;
            }
            child.postProcess(definitions, 'portType');
            this.methods[child.$name] = child;
            children.splice(i--, 1);
        }
        delete this.$name;
        this.deleteFixedAttrs();
    };
    PortTypeElement.prototype.description = function (definitions) {
        var methods = {};
        for (var name_1 in this.methods) {
            var method = this.methods[name_1];
            methods[name_1] = method.description(definitions);
        }
        return methods;
    };
    return PortTypeElement;
}(Element));
exports.PortTypeElement = PortTypeElement;
var BindingElement = /** @class */ (function (_super) {
    __extends(BindingElement, _super);
    function BindingElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'binding',
            'documentation',
            'operation',
            'SecuritySpec',
        ]);
        _this.documentation = null;
        _this.transport = '';
        _this.style = '';
        _this.methods = {};
        return _this;
    }
    BindingElement.prototype.addChild = function (child) {
        if (child.name === 'binding') {
            this.transport = child.$transport;
            this.style = child.$style;
            this.children.pop();
        }
    };
    BindingElement.prototype.postProcess = function (definitions) {
        var type = utils_1.splitQName(this.$type).name;
        var portType = definitions.portTypes[type];
        var style = this.style;
        var children = this.children;
        if (portType) {
            portType.postProcess(definitions);
            this.methods = portType.methods;
            for (var i = 0, child = void 0; child = children[i]; i++) {
                if (child.name === 'documentation') {
                    this.documentation = child;
                    children.splice(i--, 1);
                    continue;
                }
                if (child.name !== 'operation') {
                    continue;
                }
                child.postProcess(definitions, 'binding');
                children.splice(i--, 1);
                child.style || (child.style = style);
                var method = this.methods[child.$name];
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
    };
    BindingElement.prototype.description = function (definitions) {
        var methods = {};
        for (var name_2 in this.methods) {
            var method = this.methods[name_2];
            methods[name_2] = method.description(definitions);
        }
        return methods;
    };
    return BindingElement;
}(Element));
exports.BindingElement = BindingElement;
var PortElement = /** @class */ (function (_super) {
    __extends(PortElement, _super);
    function PortElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'address',
            'documentation',
        ]);
        _this.documentation = null; // TODO:
        _this.location = null;
        return _this;
    }
    PortElement.prototype.addChild = function (child) {
        if (child.name === 'address' && typeof (child.$location) !== 'undefined') {
            this.location = child.$location;
        }
        if (child.name === 'documentation') {
            // console.log(document);
            this.documentation = child;
        }
    };
    return PortElement;
}(Element));
exports.PortElement = PortElement;
var ServiceElement = /** @class */ (function (_super) {
    __extends(ServiceElement, _super);
    function ServiceElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'documentation',
            'port',
        ]);
        _this.documentation = null;
        _this.ports = {};
        return _this;
    }
    ServiceElement.prototype.postProcess = function (definitions) {
        var children = this.children;
        var bindings = definitions.bindings;
        if (children && children.length > 0) {
            for (var i = 0, child = void 0; child = children[i]; i++) {
                if (child.name === 'documentation') {
                    this.documentation = child;
                    children.splice(i--, 1);
                    continue;
                }
                if (child.name !== 'port') {
                    continue;
                }
                var bindingName = utils_1.splitQName(child.$binding).name;
                var binding = bindings[bindingName];
                if (binding) {
                    binding.postProcess(definitions);
                    this.ports[child.$name] = {
                        location: child.location,
                        binding: binding
                    };
                    children.splice(i--, 1);
                }
            }
        }
        delete this.$name;
        this.deleteFixedAttrs();
    };
    ServiceElement.prototype.description = function (definitions) {
        var ports = {};
        for (var name_3 in this.ports) {
            var port = this.ports[name_3];
            ports[name_3] = port.binding.description(definitions);
        }
        return ports;
    };
    return ServiceElement;
}(Element));
exports.ServiceElement = ServiceElement;
var DefinitionsElement = /** @class */ (function (_super) {
    __extends(DefinitionsElement, _super);
    function DefinitionsElement() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.allowedChildren = buildAllowedChildren([
            'binding',
            'documentation',
            'import',
            'message',
            'portType',
            'service',
            'types',
        ]);
        _this.messages = {};
        _this.portTypes = {};
        _this.bindings = {};
        _this.services = {};
        _this.schemas = {};
        _this.descriptions = {
            types: {},
            elements: {}
        };
        return _this;
    }
    DefinitionsElement.prototype.init = function () {
        if (this.name !== 'definitions') {
            this.unexpected(this.nsName);
        }
    };
    DefinitionsElement.prototype.addChild = function (child) {
        if (child instanceof TypesElement) {
            // Merge types.schemas into definitions.schemas
            _.merge(this.schemas, child.schemas);
        }
        else if (child instanceof MessageElement) {
            this.messages[child.$name] = child;
        }
        else if (child.name === 'import') {
            var schemaElement = new SchemaElement(child.$namespace, {});
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
    };
    return DefinitionsElement;
}(Element));
exports.DefinitionsElement = DefinitionsElement;
var BodyElement = /** @class */ (function (_super) {
    __extends(BodyElement, _super);
    function BodyElement() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return BodyElement;
}(Element));
exports.BodyElement = BodyElement;
var IncludeElement = /** @class */ (function (_super) {
    __extends(IncludeElement, _super);
    function IncludeElement() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return IncludeElement;
}(Element));
exports.IncludeElement = IncludeElement;
var ImportElement = /** @class */ (function (_super) {
    __extends(ImportElement, _super);
    function ImportElement() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return ImportElement;
}(Element));
exports.ImportElement = ImportElement;
var ElementTypeMap = {
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
    "import": ImportElement,
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
    types: TypesElement
};
function buildAllowedChildren(elementList) {
    var rtn = {};
    for (var _i = 0, elementList_1 = elementList; _i < elementList_1.length; _i++) {
        var element = elementList_1[_i];
        rtn[element.replace(/^_/, '')] = ElementTypeMap[element] || Element;
    }
    return rtn;
}
//# sourceMappingURL=elements.js.map