import { runQuery, convertToBinaryQuery, convertCustomKey } from '../functions/storeGenericFunctions.js';
import GenericKV from '../classes/generic.js';

/**
 * Persistent class that extends GenericKV for persistent keyspace operations.
 * It provides methods for inserting, updating, and retrieving data in a persistent store.
 */
class Persistent extends GenericKV {
    static persistent: boolean = true;
    static distributed: boolean = false;
    static cache: number | null = null;
    static compression: boolean = false;

    keyspace: string;

    constructor(options: { keyspace: string; username: string; password: string; [key: string]: any }) {
        super(options);
        this.keyspace = options.keyspace;
    }

    /**
     * Inserts a value into the persistent store.
     * @param value - The value to insert.
     * @return A promise that resolves with the result of the insertion.
     */
    static async insertValue({ value = {} }: { value?: any } = {}): Promise<any> {
        this.command = "insert_value";
        const query = convertToBinaryQuery(this, { value });
        return runQuery(this, query);
    }

    /**
     * Inserts a key-value pair into the persistent store.
     * @param key - The key for the value.
     * @param value - The value to insert.
     * @return A promise that resolves with the result of the insertion.
     */
    static async insertCustomKey({ customKey }: { customKey: string }): Promise<any> {
        if (!customKey) {
            throw new Error("No key provided");
        }
        this.command = "insert_custom_key";
        const query = convertToBinaryQuery(this, { key: convertCustomKey(customKey) });
        return runQuery(this, query);
    }

    /**
     * Inserts a custom key-value pair into the persistent store.
     * @param customKey - The custom key for the value.
     * @param value - The value to insert.
     * @return A promise that resolves with the result of the insertion.
     */
    static async insertCustomKeyValue({ customKey, value = {} }: { customKey: string; value?: any }): Promise<any> {
        if (!customKey) {
            throw new Error("No key provided");
        }
        this.command = "insert_custom_key_value";
        const query = convertToBinaryQuery(this, { key: convertCustomKey(customKey), value });
        return runQuery(this, query);
    }

    /**
     * Updates a value in the persistent store.
     * @param key - The key for the value to update.
     * @param customKey - The custom key for the value to update.
     * @param value - The new value to set.
     * @return A promise that resolves with the result of the update.
     */
    static async updateValue({ key = "", customKey = null, value = {} }: { key?: string; customKey?: string | null; value?: any } = {}): Promise<any> {

        const effectiveKey = customKey ? convertCustomKey(customKey) : key;
        if (!effectiveKey) {
            throw new Error("No key provided");
        }

        this.command = "update_value";
        const query = convertToBinaryQuery(this, { key: effectiveKey, value });
        return runQuery(this, query);
    }

    /**
     * Retrieves a value from the persistent store.
     * @param key - The key for the value to retrieve.
     * @param customKey - The custom key for the value to retrieve.
     * @return A promise that resolves with the retrieved value.
     */
    static async insertBulk({ bulk = [] }: { bulk?: any[] } = {}): Promise<any> {
        if (!bulk || bulk.length === 0) {
            throw new Error("No values provided");
        }
        this.command = "insert_bulk";
        const query = convertToBinaryQuery(this, { bulkValues: bulk });
        return runQuery(this, query);
    }

    /**
     * Retrieves a value from the persistent store.
     * @param key - The key for the value to retrieve.
     * @param customKey - The custom key for the value to retrieve.
     * @return A promise that resolves with the retrieved value.
     */
    static async getKeys({ limitOutput = { start: 0, stop: 0 } }: { limitOutput?: { start: number; stop: number } } = {}): Promise<any> {
        this.command = "get_keys";
        const query = convertToBinaryQuery(this, { limitOutput });
        return runQuery(this, query);
    }

    /**
     * Updates the cache and compression settings for the persistent store.
     * @param cache - The cache settings to apply.
     * @param compression - Whether to enable compression.
     * @return A promise that resolves with the result of the update.
     */
    static async updateCacheAndCompression(): Promise<any> {
        const query = {
            raw: [
                "update-cache-compression", "store", this.store, "keyspace", this.keyspace, "persistent", "y",
                "cache", this.cache ? this.cache : null, "compression", this.compression ? "y" : "n"
            ],
            credentials: [this.username, this.password],
        };
        return await runQuery(this, JSON.stringify(query));
    }

    /**
     * Creates a keyspace in the persistent store.
     * @return A promise that resolves with the result of the keyspace creation.
     */
    static async createKeyspace(): Promise<any> {
        const query = {
            raw: [
                "create-keyspace", "store", this.store, "keyspace", this.keyspace, "persistent", this.persistent ? "y" : "n",
                "cache", this.cache ? this.cache : null, "compression", this.compression ? "y" : "n"
            ],
            credentials: [this.username, this.password],
        };
        return await runQuery(this, JSON.stringify(query));
    }

};

/**
 * PersistentDistributed class that extends Persistent for distributed persistent keyspace operations.
 * It provides methods for distributed operations in a persistent store.
 */
class PersistentDistributed extends Persistent {
    static distributed: boolean = true;
};

export { Persistent, PersistentDistributed };