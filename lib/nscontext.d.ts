interface INamespace {
    declared: boolean;
    prefix: string;
    uri: string;
}
/**
 * Scope for XML namespaces
 * @param {NamespaceScope} [parent] Parent scope
 * @returns {NamespaceScope}
 * @constructor
 */
declare class NamespaceScope {
    parent: NamespaceScope;
    namespaces: {
        [key: string]: INamespace;
    };
    constructor(parent: NamespaceScope);
    /**
     * Look up the namespace URI by prefix
     * @param {String} prefix Namespace prefix
     * @param {Boolean} [localOnly] Search current scope only
     * @returns {String} Namespace URI
     */
    getNamespaceURI(prefix: string, localOnly?: boolean): string;
    getNamespaceMapping(prefix: string): INamespace;
    /**
     * Look up the namespace prefix by URI
     * @param {String} nsUri Namespace URI
     * @param {Boolean} [localOnly] Search current scope only
     * @returns {String} Namespace prefix
     */
    getPrefix(nsUri: string, localOnly?: boolean): string;
}
/**
 * Namespace context that manages hierarchical scopes
 * @returns {NamespaceContext}
 * @constructor
 */
export declare class NamespaceContext {
    scopes: NamespaceScope[];
    prefixCount: number;
    currentScope?: NamespaceScope;
    constructor();
    /**
     * Add a prefix/URI namespace mapping
     * @param {String} prefix Namespace prefix
     * @param {String} nsUri Namespace URI
     * @param {Boolean} [localOnly] Search current scope only
     * @returns {boolean} true if the mapping is added or false if the mapping
     * already exists
     */
    addNamespace(prefix: string, nsUri: string, localOnly?: boolean): boolean;
    /**
     * Push a scope into the context
     * @returns {NamespaceScope} The current scope
     */
    pushContext(): NamespaceScope;
    /**
     * Pop a scope out of the context
     * @returns {NamespaceScope} The removed scope
     */
    popContext(): NamespaceScope;
    /**
     * Look up the namespace URI by prefix
     * @param {String} prefix Namespace prefix
     * @param {Boolean} [localOnly] Search current scope only
     * @returns {String} Namespace URI
     */
    getNamespaceURI(prefix: string, localOnly?: boolean): string;
    /**
     * Look up the namespace prefix by URI
     * @param {String} nsURI Namespace URI
     * @param {Boolean} [localOnly] Search current scope only
     * @returns {String} Namespace prefix
     */
    getPrefix(nsUri: string, localOnly?: boolean): string;
    /**
     * Register a namespace
     * @param {String} nsUri Namespace URI
     * @returns {String} The matching or generated namespace prefix
     */
    registerNamespace(nsUri: string): string;
    /**
     * Declare a namespace prefix/uri mapping
     * @param {String} prefix Namespace prefix
     * @param {String} nsUri Namespace URI
     * @returns {Boolean} true if the declaration is created
     */
    declareNamespace(prefix: string, nsUri: string): boolean;
}
export {};
