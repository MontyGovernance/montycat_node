import { Field } from '../core/schema.js';
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
    static distributed: boolean = false;
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
    static async getValue({ key = "", customKey = null, withPointers = false, keyIncluded = false, pointersMetadata = false }: { key?: string; customKey?: string | null; withPointers?: boolean; keyIncluded?: boolean; pointersMetadata?: boolean } = {}): Promise<any> {

        if (pointersMetadata && withPointers) {
            throw new Error("You select both pointers value and pointers metadata. Choose one");
        }

        try {
            if (customKey) key = convertCustomKey(customKey);

            if (!key) {
                throw new Error("No key provided");
            }

            this.command = "get_value";
            const query = convertToBinaryQuery(this, { key, withPointers, keyIncluded, pointersMetadata });
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
     * @param keyIncluded - Whether to include the keys in the retrieved values.
     * @param pointersMetadata - Whether to include metadata for the pointers in the retrieved values.
     * @param volumes - An array of volumes to retrieve values from.
     * @param latestVolume - Whether to retrieve values from the latest volume only.
     * @returns A promise that resolves with the retrieved keys.
     */
    static async getBulk({ bulkKeys = [], bulkCustomKeys = [], limitOutput = { start: 0, stop: 0 }, withPointers = false, keyIncluded = false, pointersMetadata = false, volumes = [], latestVolume = false }: { bulkKeys?: string[]; bulkCustomKeys?: string[]; limitOutput?: { start: number; stop: number }; withPointers?: boolean; keyIncluded?: boolean; pointersMetadata?: boolean; volumes?: string[]; latestVolume?: boolean } = {}): Promise<any> {

        if (pointersMetadata && withPointers) {
            throw new Error("You select both pointers value and pointers metadata. Choose one");
        }

        try {
            if (bulkCustomKeys.length) bulkKeys = bulkKeys.concat(convertCustomKeys(bulkCustomKeys));

            const selectedOptions = [
                bulkKeys.length > 0,
                volumes.length > 0,
                latestVolume
            ].filter(Boolean).length;

            if (selectedOptions !== 1) {
                throw new Error("Multiple conflicting options provided. Please provide exactly one of the following: keys, volumes, or latest volume.");
            }

            this.command = "get_bulk";
            const query = convertToBinaryQuery(this, { bulkKeys, limitOutput, withPointers, keyIncluded, pointersMetadata, volumes, latestVolume });
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
     * @param keyIncluded - Whether to include the keys in the retrieved values.
     * @param pointersMetadata - Whether to include metadata for the pointers in the retrieved values.
     * @return A promise that resolves with the result of the lookup.
     */
    static async lookupValuesWhere({ searchCriteria = {}, limitOutput = { start: 0, stop: 0 }, withPointers = false, schema = null, keyIncluded = false, pointersMetadata = false }: { searchCriteria?: { [key: string]: any }; limitOutput?: { start: number; stop: number }; withPointers?: boolean; schema?: any; keyIncluded?: boolean; pointersMetadata?: boolean } = {}): Promise<any> {


        if (pointersMetadata && withPointers) {
            throw new Error("You select both pointers value and pointers metadata. Choose one");
        }

        try {
            this.command = "lookup_values";
            const query = convertToBinaryQuery(this, { searchCriteria, limitOutput, withPointers, schema, keyIncluded, pointersMetadata });
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
            raw: [
                    "remove-keyspace",
                    "store", this.store,
                    "keyspace", this.keyspace,
                    "persistent", this.persistent ? "y" : "n",
                ],
            credentials: [this.username, this.password],
        };
        return await runQuery(this, JSON.stringify(query));
    }

    /**
     * Enforces a schema on the store.
     * @param schema - The schema to enforce. Should be an instance of the Schema class.
     * @throws TypeError if the schema is not an instance of Schema.
     * @returns A promise that resolves with the result of the schema enforcement.
     */
    static async enforceSchema(schema: any): Promise<any> {

        function parseType(fieldType: Field): [string, boolean] {

            switch (fieldType.getType()) {
                case "String": return ["String", fieldType.getNullable()];
                case "Number": return ["Number", fieldType.getNullable()];
                case "Boolean": return ["Boolean", fieldType.getNullable()];
                case "Array": return ["Array", fieldType.getNullable()];
                case "Object": return ["Object", fieldType.getNullable()];
                case "Pointer": return ["Pointer", fieldType.getNullable()];
                case "Timestamp": return ["Timestamp", fieldType.getNullable()];
                default: throw new TypeError(`Unsupported field type: ${fieldType.getType()}`);
            }
        }

        let schemaTypes: Record<string, [string, boolean]> = {};

        if (!schema.metadata) {
            throw new TypeError("Schema must have metadata");
        }

        for (const [field, fieldType] of Object.entries(schema.metadata as Record<string, Field>)) {
            schemaTypes[field] = parseType(fieldType);
        }

        const query = {
            raw: [
                    "enforce-schema",
                    "store", this.store,
                    "keyspace", this.keyspace,
                    "persistent", this.persistent ? "y" : "n",
                    "schema_name", schema.name,
                    "schema_content", `${JSON.stringify(schemaTypes)}`
                ],
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
            raw: [
                    "remove-enforced-schema",
                    "store", this.store,
                    "keyspace", this.keyspace,
                    "persistent", this.persistent ? "y" : "n",
                    "schema_name", schema.name
                ],
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