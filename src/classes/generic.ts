import { Schema } from '../core/schema.js';
import { 
    convertCustomKey, 
    convertCustomKeys, 
    convertCustomKeysValues, 
    convertToBinaryQuery, 
    runQuery, 
} from '../functions/storeGenericFunctions.js'
import { inspect } from 'util';

/**
 * GenericKV class that provides a base for key-value store operations.
 * It includes methods for inserting, updating, retrieving, and deleting keys and values.
 */
class GenericKV {
    static store: string = "";
    static command: string = "";
    static persistent: boolean = false;
    static keyspace: string;
    static username: string;
    static password: string;

    keyspace: string;
    username: string;
    password: string;

    constructor(options: { keyspace: string; username: string; password: string }) {
        this.keyspace = options.keyspace;
        this.username = options.username;
        this.password = options.password;
    }

    static [inspect.custom]() {
        return this.name;
    }

    static connectEngine(engine: any) {
        Object.assign(this, engine);
    }

    /**
     * Get value from a store
     * @param key - The key for the value to retrieve.
     * @param customKey - The custom key for the value to retrieve.
     * @param withPointers - Whether to include pointers in the retrieved value.
     * @return A promise that resolves with the retrieved value.
     */
    static async getValue({ key = "", customKey = null, withPointers = false }: { key?: string; customKey?: string | null; withPointers?: boolean } = {}): Promise<any> {
        try {
            if (customKey) key = convertCustomKey(customKey);

            if (!key) {
                throw new Error("No key provided");
            }

            this.command = "get_value";
            const query = convertToBinaryQuery(this, { key, withPointers });
            return runQuery(this, query);
        } catch (err) {
            throw err;
        }
    }

    /**
     * List all depending keys for a given key or custom key.
     * @param key - The key for which to list depending keys.
     * @param customKey - The custom key for which to list depending keys.
     * @returns A promise that resolves with the list of depending keys.
     * */
    static async listAllDependingKeys({ key = "", customKey = null }: { key?: string; customKey?: string | null } = {}): Promise<any> {
        try {
            if (customKey) key = convertCustomKey(customKey);

            if (!key) {
                throw new Error("No key provided");
            }

                this.command = "list_all_depending_keys";
            const query = convertToBinaryQuery(this, { key });
            return runQuery(this, query);
        } catch (err) {
            throw err;
        }
    }

    static async listAllSchemasInKeyspace(): Promise<any> {
        this.command = "list_all_schemas_in_keyspace";
        const query = convertToBinaryQuery(this, {});
        return runQuery(this, query);
    }

    /**
     * Deletes a key from the keyspace.
     * @param key - The key to delete.
     * @param customKey - The custom key to delete.
     * @return A promise that resolves with the result of the deletion.
     * */
    static async deleteKey({ key = "", customKey = null }: { key?: string; customKey?: string | null } = {}): Promise<any> {
        try {
            if (customKey) key = convertCustomKey(customKey);

            if (!key) {
                throw new Error("No key provided");
            }

            this.command = "delete_key";
            const query = convertToBinaryQuery(this, { key });
            return runQuery(this, query);
        } catch (err) {
            throw err;
        }
    }

    /**
     * Deletes a bulk of keys from the keyspace.
     * @param bulkKeys - An array of keys to delete.
     * @param bulkCustomKeys - An array of custom keys to delete.
     * @return A promise that resolves with the result of the deletion.
     * */
    static async deleteBulk({ bulkKeys = [], bulkCustomKeys = [] }: { bulkKeys?: string[]; bulkCustomKeys?: string[] } = {}): Promise<any> {
        try {
            if (bulkCustomKeys.length) bulkKeys = bulkKeys.concat(convertCustomKeys(bulkCustomKeys));

            if (!bulkKeys || bulkKeys.length === 0) {
                throw new Error("No keys provided");
            }

            this.command = "delete_bulk";
            const query = convertToBinaryQuery(this, { bulkKeys });
            return runQuery(this, query);
        } catch (err) {
            throw err;
        }
    }

    /**
     * Gets bulk values from the keyspace.
     * @param bulkKeys - An array of keys to retrieve.
     * @param bulkCustomKeys - An array of custom keys to retrieve.
     * @param limitOutput - An object specifying the start and stop indices for limiting output.
     * @param withPointers - Whether to include pointers in the retrieved values.
     * @returns A promise that resolves with the retrieved keys.
     */
    static async getBulk({ bulkKeys = [], bulkCustomKeys = [], limitOutput = { start: 0, stop: 0 }, withPointers = false }: { bulkKeys?: string[]; bulkCustomKeys?: string[]; limitOutput?: { start: number; stop: number }; withPointers?: boolean } = {}): Promise<any> {
        try {
            if (bulkCustomKeys.length) bulkKeys = bulkKeys.concat(convertCustomKeys(bulkCustomKeys));

            if (!bulkKeys || bulkKeys.length === 0) {
                throw new Error("No keys provided");
            }

            this.command = "get_bulk";
            const query = convertToBinaryQuery(this, { bulkKeys, limitOutput, withPointers });
            return runQuery(this, query);
        } catch (err) {
            throw err;
        }
    }

    /**
     * Updates a bulk of keys and values in the keyspace.
     * @param bulkKeysValues - An object where keys are the keys to update and values are the new values.
     * @param bulkCustomKeysValues - An object where custom keys are the keys to update and values are the new values.
     * @return A promise that resolves with the result of the update.
     */
    static async updateBulk({ bulkKeysValues = {}, bulkCustomKeysValues = {} }: { bulkKeysValues?: { [key: string]: any }; bulkCustomKeysValues?: { [key: string]: any } } = {}): Promise<any> {
        try {
            if (Object.keys(bulkCustomKeysValues).length) {
                bulkKeysValues = { ...bulkKeysValues, ...convertCustomKeysValues(bulkCustomKeysValues) };
            }

            if (Object.keys(bulkKeysValues).length === 0) {
                throw new Error("No keys provided");
            }

            this.command = "update_bulk";
            const query = convertToBinaryQuery(this, { bulkKeysValues });
            return runQuery(this, query);
        } catch (err) {
            throw err;
        }
    }

    /**
     * Looks up keys based on search criteria.
     * @param searchCriteria - An object containing the search criteria.
     * @param limitOutput - An object specifying the start and stop indices for limiting output.
     * @param schema - The schema to use for the lookup.
     * @returns A promise that resolves with the result of the lookup.
     */
    static async lookupKeysWhere({ searchCriteria = {}, limitOutput = { start: 0, stop: 0 }, schema = null }: { searchCriteria?: { [key: string]: any }; limitOutput?: { start: number; stop: number }; schema?: any } = {}): Promise<any> {
        try {
            this.command = "lookup_keys";
            const query = convertToBinaryQuery(this, { searchCriteria, limitOutput, schema });
            return runQuery(this, query);
        } catch (err) {
            throw err;
        }
    }

    /**
     * Looks up values based on search criteria.
     * @param searchCriteria - An object containing the search criteria.
     * @param limitOutput - An object specifying the start and stop indices for limiting output.
     * @param withPointers - Whether to include pointers in the retrieved values.
     * @param schema - The schema to use for the lookup.
     * @return A promise that resolves with the result of the lookup.
     */
    static async lookupValuesWhere({ searchCriteria = {}, limitOutput = { start: 0, stop: 0 }, withPointers = false, schema = null }: { searchCriteria?: { [key: string]: any }; limitOutput?: { start: number; stop: number }; withPointers?: boolean; schema?: any } = {}): Promise<any> {
        try {
            this.command = "lookup_values";
            const query = convertToBinaryQuery(this, { searchCriteria, limitOutput, withPointers, schema });
            return runQuery(this, query);
        } catch (err) {
            throw err;
        }
    }

    /**
     * Gets the length of the keyspace.
     * @returns A promise that resolves with the length of the keyspace.
     */
    static async getLen(): Promise<any> {
        this.command = "get_len";
        const query = convertToBinaryQuery(this, {});
        return runQuery(this, query);
    }

    /**
     * Removes the keyspace from the store.
     * @returns A promise that resolves with the result of the keyspace removal.
     * */
    static async removeKeyspace(): Promise<any> {
        const query = {
            raw: ["remove-keyspace", "store", this.store, "keyspace", this.keyspace],
            credentials: [this.username, this.password],
        };
        return await runQuery(this, JSON.stringify(query));
    }

    // how to make it available for TS only ?
    /**
     * Enforces a schema on the store.
     * @param schema - The schema to enforce. Should be an instance of the Schema class.
     * @throws TypeError if the schema is not an instance of Schema.
     * @returns A promise that resolves with the result of the schema enforcement.
     */
    static async enforceSchema(schema: any): Promise<any> {

        function parseType(fieldType: any): string {
            switch (fieldType) {
                case "String": return "String";
                case "Number": return "Number";
                case "Boolean": return "Boolean";
                case "Array": return "Array";
                case "Object": return "Object";
                case "Pointer": return "Pointer";
                case "Timestamp": return "Timestamp";
                default: throw new TypeError(`Unsupported field type: ${fieldType}`);
            }
        }

        let schemaTypes: Record<string, string> = {};

        if (!schema.metadata) {
            throw new TypeError("Schema must have metadata");
        }

        for (const [field, fieldType] of Object.entries(schema.metadata)) {
            schemaTypes[field] = parseType(fieldType);
        }

        const query = {
            raw: ["enforce-schema", "store", this.store, "keyspace", this.keyspace, "persistent", this.persistent ? "y" : "n", "schema_name", schema.name, "schema_content", `${JSON.stringify(schemaTypes)}`],
            credentials: [this.username, this.password],
        };

        return await runQuery(this, JSON.stringify(query));
    }

    /**
     * Removes an enforced schema from the store.
     * @param schema - The name of the schema to remove.
     * @returns A promise that resolves with the result of the schema removal.
     */
    static async removeEnforcedSchema(schema: any): Promise<any> {
        
        if (!schema) {
            throw new TypeError("Schema must be provided");
        }

        const query = {
            raw: ["remove-enforced-schema", "store", this.store, "keyspace", this.keyspace, "persistent", this.persistent ? "y" : "n", "schema_name", schema.name],
            credentials: [this.username, this.password],
        };

        return await runQuery(this, JSON.stringify(query));
    }

    /**
     * Shows the properties of the store.
     * @returns The current instance of GenericKV.
     */
    showStoreProperties(): this {
        return this;
    }
}

export default GenericKV;