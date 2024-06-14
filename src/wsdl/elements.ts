
import { ok as assert } from 'assert';
import * as debugBuilder from 'debug';
import * as _ from 'lodash';
import { IWsdlBaseOptions } from '../types';
import { splitQName, TNS_PREFIX } from '../utils';

const debug = debugBuilder('node-soap');

const Primitives: {
  [type: string]: number;
} = {
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

export class Element {
  public readonly allowedChildren?: { [k: string]: typeof Element } = {};
  public $name?: string;
  public $targetNamespace?;
  public children: Element[] = [];
  public ignoredNamespaces;
  public name?: string;
  public nsName?;
  public prefix?: string;
  public schemaXmlns?;
  public valueKey: string;
  public xmlKey;
  public xmlns?: IXmlNs;

  constructor(nsName: string, attrs, options?: IWsdlBaseOptions, schemaAttrs?) {
    const parts = splitQName(nsName);

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
        this.xmlns[match[1] ? match[1] : TNS_PREFIX] = attrs[key];
      } else {
        if (key === 'value') {
          this[this.valueKey] = attrs[key];
        } else {
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
      this.xmlns[TNS_PREFIX] = this.$targetNamespace;
    }

    this.init();
  }

  public deleteFixedAttrs() {
    this.children && this.children.length === 0 && delete this.children;
    this.xmlns && Object.keys(this.xmlns).length === 0 && delete this.xmlns;
    delete this.nsName;
    delete this.prefix;
    delete this.name;
  }

  public startElement(stack: Element[], nsName: string, attrs, options: IWsdlBaseOptions, schemaXmlns) {
    if (!this.allowedChildren) {
      return;
    }

    const ChildClass = this.allowedChildren[splitQName(nsName).name];
    if (ChildClass) {
      const child = new ChildClass(nsName, attrs, options, schemaXmlns);
      child.init();
      stack.push(child);
    } else {
      this.unexpected(nsName);
    }

  }

  public endElement(stack: Element[], nsName: string) {
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

  public addChild(child: Element) {
    return;
  }

  public unexpected(name: string) {
    throw new Error('Found unexpected element (' + name + ') inside ' + this.nsName);
  }

  public description(definitions?: DefinitionsElement, xmlns?: IXmlNs): any {
    return this.$name || this.name;
  }

  public init(): void {
  }

  private _initializeOptions(options: IWsdlBaseOptions) {
    if (options) {
      this.valueKey = options.valueKey || '$value';
      this.xmlKey = options.xmlKey || '$xml';
      this.ignoredNamespaces = options.ignoredNamespaces || [];
    } else {
      this.valueKey = '$value';
      this.xmlKey = '$xml';
      this.ignoredNamespaces = [];
    }
  }
}

export class ElementElement extends Element {
  public readonly allowedChildren = buildAllowedChildren([
    'annotation',
    'complexType',
    'simpleType',
  ]);
  public $minOccurs?: string;
  public $maxOccurs?: string;
  public $type?: string;
  public $ref?: string;
  public targetNSAlias?: string;
  public targetNamespace?: string;
  public $lookupType?: string;
  public $lookupTypes?: any[];

  public description(definitions: DefinitionsElement, xmlns?: IXmlNs) {
    let element = {};
    let name = this.$name;

    // Check minOccurs / maxOccurs attributes to see if this element is a list
    // These are default values for an element
    let minOccurs = 1;
    let maxOccurs = 1;

    if (this.$maxOccurs === 'unbounded') {
      maxOccurs = Infinity;
    } else if (Boolean(this.$maxOccurs)) {
      maxOccurs = parseInt(this.$maxOccurs, 10);
    }

    if (Boolean(this.$minOccurs)) {
      minOccurs = parseInt(this.$minOccurs, 10);
    }

    const isMany = maxOccurs > 1;

    if (isMany) {
      name += '[]';
    }

    if (xmlns && xmlns[TNS_PREFIX]) {
      this.$targetNamespace = xmlns[TNS_PREFIX];
    }
    let type: any = this.$type || this.$ref;
    if (type) {
      type = splitQName(type);
      const typeName: string = type.name;
      const ns: string = xmlns && xmlns[type.prefix] ||
        ((definitions.xmlns[type.prefix] !== undefined || definitions.xmlns[this.targetNSAlias] !== undefined) && this.schemaXmlns[type.prefix]) ||
        definitions.xmlns[type.prefix];
      const schema = definitions.schemas[ns];
      const typeElement = schema && (this.$type ? schema.complexTypes[typeName] || schema.types[typeName] : schema.elements[typeName]);
      const typeStorage = this.$type ? definitions.descriptions.types : definitions.descriptions.elements;

      if (ns && definitions.schemas[ns]) {
        xmlns = definitions.schemas[ns].xmlns;
      }

      if (typeElement && !(typeName in Primitives)) {

        if (!(typeName in typeStorage)) {

          let elem: any = {};
          typeStorage[typeName] = elem;

          const description = typeElement.description(definitions, xmlns);
          if (typeof description === 'string') {
            elem = description;
          } else {
            Object.keys(description).forEach((key) => {
              elem[key] = description[key];
            });
          }

          if (this.$ref) {
            element = elem;
          } else {
            element[name] = elem;
          }

          if (typeof elem === 'object') {
            elem.targetNSAlias = type.prefix;
            elem.targetNamespace = ns;
          }

          typeStorage[typeName] = elem;
        } else {
          if (this.$ref) {
            element = typeStorage[typeName];
          } else {
            element[name] = typeStorage[typeName];
          }
        }

      } else {
        element[name] = this.$type;
      }
    } else {
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

export class AnyElement extends Element {
}

export class InputElement extends Element {
  public readonly allowedChildren = buildAllowedChildren([
    'body',
    'documentation',
    'header',
    'SecuritySpecRef',
  ]);
  public use: string;
  public encodingStyle: string;
  public $type: string;
  public $lookupType: string;
  public targetNSAlias?: string;
  public targetNamespace?: string;
  public parts?;

  public addChild(child: Element) {
    if (child instanceof BodyElement) {
      this.use = child.$use;
      if (this.use === 'encoded') {
        this.encodingStyle = child.$encodingStyle;
      }
      this.children.pop();
    }
  }
}

export class OutputElement extends Element {
  public readonly allowedChildren = buildAllowedChildren([
    'body',
    'documentation',
    'header',
    'SecuritySpecRef',
  ]);
  public targetNSAlias?: string;
  public targetNamespace?: string;
  public use?: string;
  public encodingStyle?: string;
  public $lookupTypes;

  public addChild(child: Element) {
    if (child instanceof BodyElement) {
      this.use = child.$use;
      if (this.use === 'encoded') {
        this.encodingStyle = child.$encodingStyle;
      }
      this.children.pop();
    }
  }
}

export class SimpleTypeElement extends Element {
  public readonly allowedChildren = buildAllowedChildren([
    'restriction',
  ]);

  public description(definitions: DefinitionsElement) {
    for (const child of this.children) {
      if (child instanceof RestrictionElement) {
        return [this.$name, child.description()].filter(Boolean).join('|');
      }
    }
    return {};
  }
}

export class RestrictionElement extends Element {
  public readonly allowedChildren = buildAllowedChildren([
    'all',
    'choice',
    'enumeration',
    'sequence',
  ]);
  public $base: string;

  public description(definitions?: DefinitionsElement, xmlns?: IXmlNs) {
    const children = this.children;
    let desc;
    for (let i = 0, child; child = children[i]; i++) {
      if (child instanceof SequenceElement || child instanceof ChoiceElement) {
        desc = child.description(definitions, xmlns);
        break;
      }
    }
    if (desc && this.$base) {
      const type = splitQName(this.$base);
      const typeName = type.name;
      const ns = xmlns && xmlns[type.prefix] || definitions.xmlns[type.prefix];
      const schema = definitions.schemas[ns];
      const typeElement = schema && (schema.complexTypes[typeName] || schema.types[typeName] || schema.elements[typeName]);

      desc.getBase = () => {
        return typeElement.description(definitions, schema.xmlns);
      };
      return desc;
    }

    // then simple element
    const base = this.$base ? this.$base + '|' : '';
    const restrictions = this.children.map((child) => {
      return child.description();
    }).join(',');

    return [this.$base, restrictions].filter(Boolean).join('|');
  }
}

export class ExtensionElement extends Element {
  public readonly allowedChildren = buildAllowedChildren([
    'all',
    'choice',
    'sequence',
  ]);
  public $base: string;

  public description(definitions: DefinitionsElement, xmlns?: IXmlNs) {
    let desc = {};
    for (const child of this.children) {
      if (child instanceof SequenceElement || child instanceof ChoiceElement) {
        desc = child.description(definitions, xmlns);
      }
    }
    if (this.$base) {
      const type = splitQName(this.$base);
      const typeName = type.name;
      const ns = xmlns && xmlns[type.prefix] || definitions.xmlns[type.prefix];
      const schema = definitions.schemas[ns];

      if (typeName in Primitives) {
        return this.$base;
      } else {
        const typeElement = schema && (
          schema.complexTypes[typeName] ||
          schema.types[typeName] ||
          schema.elements[typeName]
        );
        if (typeElement) {
          const base = typeElement.description(definitions, schema.xmlns);
          desc = typeof base === 'string' ? base : _.defaults(base, desc);
        }
      }
    }
    return desc;
  }
}

export class ChoiceElement extends Element {
  public readonly allowedChildren = buildAllowedChildren([
    'any',
    'choice',
    'element',
    'sequence',
  ]);
  public description(definitions: DefinitionsElement, xmlns: IXmlNs) {
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

export class EnumerationElement extends Element {
  // no children
  public description(): string {
    return this[this.valueKey];
  }
}

export class ComplexTypeElement extends Element {
  public readonly allowedChildren = buildAllowedChildren([
    'all',
    'annotation',
    'choice',
    'complexContent',
    'sequence',
    'simpleContent',
  ]);
  public description(definitions: DefinitionsElement, xmlns: IXmlNs) {
    const children = this.children || [];
    for (const child of children) {
      if (child instanceof ChoiceElement ||
        child instanceof SequenceElement ||
        child instanceof AllElement ||
        child instanceof SimpleContentElement ||
        child instanceof ComplexContentElement) {

        return child.description(definitions, xmlns);
      }
    }
    return {};
  }
}

export class ComplexContentElement extends Element {
  public readonly allowedChildren = buildAllowedChildren([
    'extension',
  ]);
  public description(definitions: DefinitionsElement, xmlns: IXmlNs) {
    for (const child of this.children) {
      if (child instanceof ExtensionElement) {
        return child.description(definitions, xmlns);
      }
    }
    return {};
  }
}

export class SimpleContentElement extends Element {
  public readonly allowedChildren = buildAllowedChildren([
    'extension',
  ]);
  public description(definitions: DefinitionsElement, xmlns: IXmlNs) {
    for (const child of this.children) {
      if (child instanceof ExtensionElement) {
        return child.description(definitions, xmlns);
      }
    }
    return {};
  }
}

export class SequenceElement extends Element {
  public readonly allowedChildren = buildAllowedChildren([
    'any',
    'choice',
    'element',
    'sequence',
  ]);
  public description(definitions: DefinitionsElement, xmlns: IXmlNs) {
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

export class AllElement extends Element {
  public readonly allowedChildren = buildAllowedChildren([
    'choice',
    'element',
  ]);
  public description(definitions: DefinitionsElement, xmlns: IXmlNs) {
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

export class MessageElement extends Element {
  public readonly allowedChildren = buildAllowedChildren([
    'part',
    'documentation',
  ]);
  public element: ElementElement = null;
  public parts = null;

  public postProcess(definitions: DefinitionsElement) {
    let part: any = null;
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
      let lookupTypes: any[] = [];

      delete this.parts;

      const nsName = splitQName(part.$element);
      const ns = nsName.prefix;
      let schema = definitions.schemas[definitions.xmlns[ns]];
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
        const type = splitQName(this.element.$type);
        const typeNs = schema.xmlns && schema.xmlns[type.prefix] || definitions.xmlns[type.prefix];

        if (typeNs) {
          if (type.name in Primitives) {
            // this.element = this.element.$type;
          } else {
            // first check local mapping of ns alias to namespace
            schema = definitions.schemas[typeNs];
            const ctype = schema.complexTypes[type.name] || schema.types[type.name] || schema.elements[type.name];

            if (ctype) {
              this.parts = ctype.description(definitions, schema.xmlns);
            }
          }
        }
      } else {
        const method = this.element.description(definitions, schema.xmlns);
        this.parts = method[nsName.name];
      }

      this.children.splice(0, 1);
    } else {
      // rpc encoding
      this.parts = {};
      delete this.element;
      for (let i = 0; part = this.children[i]; i++) {
        if (part.name === 'documentation') {
          // <wsdl:documentation can be present under <wsdl:message>
          continue;
        }
        assert(part.name === 'part', 'Expected part element');
        const nsName = splitQName(part.$type);
        const ns = definitions.xmlns[nsName.prefix];
        const type = nsName.name;
        const schemaDefinition = definitions.schemas[ns];
        if (typeof schemaDefinition !== 'undefined') {
          this.parts[part.$name] = definitions.schemas[ns].types[type] || definitions.schemas[ns].complexTypes[type];
        } else {
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

  public description(definitions: DefinitionsElement) {
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
  private _createLookupTypeObject(nsString: string, xmlns: IXmlNs) {
    const splittedNSString = splitQName(nsString);
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
  private _getNestedLookupTypeString(element): string {
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

export class DocumentationElement extends Element {
  // no children
}

export interface IInclude {
  namespace: string;
  location: string;
}

export class SchemaElement extends Element {
  public readonly allowedChildren = buildAllowedChildren([
    'complexType',
    'element',
    'import',
    'include',
    'simpleType',
  ]);
  public complexTypes: { [name: string]: ComplexTypeElement } = {};
  public types: { [name: string]: SimpleTypeElement } = {};
  public elements: { [name: string]: ElementElement } = {};
  public includes: IInclude[] = [];
  public $elementFormDefault;

  public merge(source: SchemaElement) {
    assert(source instanceof SchemaElement);

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

  public addChild(child: Element) {
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
    } else if (child instanceof ComplexTypeElement) {
      this.complexTypes[child.$name] = child;
    } else if (child instanceof ElementElement) {
      this.elements[child.$name] = child;
    } else if (child instanceof SimpleTypeElement) {
      this.types[child.$name] = child;
    }
    this.children.pop();
    // child.deleteFixedAttrs();
  }
}

export class TypesElement extends Element {
  public readonly allowedChildren = buildAllowedChildren([
    'documentation',
    'schema',
  ]);
  public schemas: { [name: string]: SchemaElement } = {};

  // fix#325
  public addChild(child) {
    assert(child instanceof SchemaElement);

    const targetNamespace = child.$targetNamespace || child.includes[0]?.namespace;

    if (!this.schemas.hasOwnProperty(targetNamespace)) {
      this.schemas[targetNamespace] = child;
    } else {
      console.error('Target-Namespace "' + targetNamespace + '" already in use by another Schema!');
    }
  }
}

export class OperationElement extends Element {
  public readonly allowedChildren = buildAllowedChildren([
    'documentation',
    'fault',
    'input',
    'operation',
    'output',
  ]);
  public input: InputElement = null;
  public output: OutputElement = null;
  public inputSoap = null;
  public outputSoap = null;
  public style = '';
  public soapAction = '';
  public $soapAction?: string;
  public $style?: string;

  public addChild(child) {
    if (child instanceof OperationElement) {
      this.soapAction = child.$soapAction || '';
      this.style = child.$style || '';
      this.children.pop();
    }
  }

  public postProcess(definitions: DefinitionsElement, tag: string) {
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
      const messageName = splitQName(child.$message).name;
      const message = definitions.messages[messageName];
      if (message) {
        message.postProcess(definitions);
        if (message.element) {
          definitions.messages[message.element.$name] = message;
          this[child.name] = message.element;
        } else {
          this[child.name] = message;
        }
        children.splice(i--, 1);
      }
    }
    this.deleteFixedAttrs();
  }

  public description(definitions: DefinitionsElement) {
    const inputDesc = this.input ? this.input.description(definitions) : null;
    const outputDesc = this.output ? this.output.description(definitions) : null;
    return {
      input: inputDesc && inputDesc[Object.keys(inputDesc)[0]],
      output: outputDesc && outputDesc[Object.keys(outputDesc)[0]],
    };
  }
}

export class PortTypeElement extends Element {
  public readonly allowedChildren = buildAllowedChildren([
    'documentation',
    'operation',
  ]);
  public methods: {
    [name: string]: OperationElement;
  } = {};

  public postProcess(definitions: DefinitionsElement) {
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

  public description(definitions: DefinitionsElement) {
    const methods = {};
    for (const name in this.methods) {
      const method = this.methods[name];
      methods[name] = method.description(definitions);
    }
    return methods;
  }
}

export interface ITopElement {
  methodName: string;
  outputName: string;
}

export interface ITopElements {
  [name: string]: ITopElement;
}

export class BindingElement extends Element {
  public readonly allowedChildren = buildAllowedChildren([
    'binding',
    'documentation',
    'operation',
    'SecuritySpec',
  ]);
  public topElements?: ITopElements;
  public transport = '';
  public style = '';
  public methods: { [name: string]: OperationElement } = {};
  public $type?: string;

  public addChild(child) {
    if (child.name === 'binding') {
      this.transport = child.$transport;
      this.style = child.$style;
      this.children.pop();
    }
  }

  public postProcess(definitions: DefinitionsElement) {
    const type = splitQName(this.$type).name;
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

  public description(definitions: DefinitionsElement) {
    const methods = {};
    for (const name in this.methods) {
      const method = this.methods[name];
      methods[name] = method.description(definitions);
    }
    return methods;
  }
}

export class PortElement extends Element {
  public readonly allowedChildren = buildAllowedChildren([
    'address',
    'documentation',
  ]);
  public location = null;

  public addChild(child) {
    if (child.name === 'address' && typeof (child.$location) !== 'undefined') {
      this.location = child.$location;
    }
  }
}

export interface IPort {
  location: string;
  binding: BindingElement;
}

export class ServiceElement extends Element {
  public readonly allowedChildren = buildAllowedChildren([
    'documentation',
    'port',
  ]);
  public ports: { [name: string]: IPort } = {};

  public postProcess(definitions: DefinitionsElement) {
    const children = this.children;
    const bindings = definitions.bindings;
    if (children && children.length > 0) {
      for (let i = 0, child; child = children[i]; i++) {
        if (child.name !== 'port') {
          continue;
        }
        const bindingName = splitQName(child.$binding).name;
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

  public description(definitions: DefinitionsElement) {
    const ports = {};
    for (const name in this.ports) {
      const port = this.ports[name];
      ports[name] = port.binding.description(definitions);
    }
    return ports;
  }
}

export class DefinitionsElement extends Element {
  public readonly allowedChildren = buildAllowedChildren([
    'binding',
    'documentation',
    'import',
    'message',
    'portType',
    'service',
    'types',
  ]);
  public complexTypes;
  public messages: { [name: string]: MessageElement } = {};
  public portTypes: { [name: string]: PortTypeElement } = {};
  public bindings: { [name: string]: BindingElement } = {};
  public services: { [name: string]: ServiceElement } = {};
  public schemas: { [name: string]: SchemaElement } = {};
  public descriptions: {
    types: {
      [key: string]: Element;
    },
    elements: {
      [key: string]: Element;
    },
  } = {
      types: {},
      elements: {},
    };

  public init() {
    if (this.name !== 'definitions') { this.unexpected(this.nsName); }
  }

  public addChild(child) {
    if (child instanceof TypesElement) {
      // Merge types.schemas into definitions.schemas
      _.merge(this.schemas, child.schemas);
    } else if (child instanceof MessageElement) {
      this.messages[child.$name] = child;
    } else if (child.name === 'import') {
      const schemaElement = new SchemaElement(child.$namespace, {});
      schemaElement.init();
      this.schemas[child.$namespace] = schemaElement;
      this.schemas[child.$namespace].addChild(child);
    } else if (child instanceof PortTypeElement) {
      this.portTypes[child.$name] = child;
    } else if (child instanceof BindingElement) {
      if (child.transport === 'http://schemas.xmlsoap.org/soap/http' ||
        child.transport === 'http://www.w3.org/2003/05/soap/bindings/HTTP/') {
        this.bindings[child.$name] = child;
      }
    } else if (child instanceof ServiceElement) {
      this.services[child.$name] = child;
    } else if (child instanceof DocumentationElement) {
    }
    this.children.pop();
  }
}

export class BodyElement extends Element {
  public $use?: string;
  public $encodingStyle?: string;
}

export class IncludeElement extends Element {
  public $schemaLocation?;
  public $location?;
  public $namespace?;
}

export class ImportElement extends Element {
  public $schemaLocation?;
  public $location?;
  public $namespace?;
}

const ElementTypeMap: {
  [k: string]: typeof Element;
} = {
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
};

function buildAllowedChildren(elementList: string[]): { [k: string]: typeof Element } {
  const rtn = {};
  for (const element of elementList) {
    rtn[element.replace(/^_/, '')] = ElementTypeMap[element] || Element;
  }
  return rtn;
}
