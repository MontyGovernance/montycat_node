import { runQuery, convertToBinaryQuery, convertCustomKey } from '../functions/storeGenericFunctions.js';
import GenericKV from '../classes/generic.js';

/**
 * Persistent class that extends GenericKV for persistent keyspace operations.
 * It provides methods for inserting, updating, and retrieving data in a persistent store.
 */
class Persistent extends GenericKV {
    static persistent: boolean = true;
    static distributed: boolean = false;

    keyspace: string;

    constructor(options: { keyspace: string; username: string; password: string;[key: string]: any }) {
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
     * Inserts a custom key into the persistent store.
     * @param customKey - The custom key to insert.
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
     * Inserts multiple key-value pairs into the persistent store in bulk.
     * @param bulk - An array of key-value pairs to insert.
     * @return A promise that resolves with the result of the bulk insertion.
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
     * Retrieves keys from the persistent store based on provided options.
     * @param limitOutput - An object specifying the start and stop limits for output.
     * @param latestVolume - A boolean indicating whether to retrieve keys from the latest volume.
     * @param volumes - An array of volume names to retrieve keys from.
     * @returns A promise that resolves with the retrieved keys.
     */
    static async getKeys({ limitOutput = { start: 0, stop: 0 }, latestVolume = false, volumes = [] }: { limitOutput?: { start: number; stop: number }; latestVolume?: boolean; volumes?: string[] } = {}): Promise<any> {

        if ((!volumes || volumes.length === 0) && !latestVolume && (!limitOutput || (limitOutput.start === 0 && limitOutput.stop === 0))) {
            throw new Error("Please provide volumes/latest volume or limit.");
        }

        this.command = "get_keys";
        const query = convertToBinaryQuery(this, { limitOutput, latestVolume, volumes });
        return runQuery(this, query);
    }

    /**
     * Updates the cache and compression settings for the persistent store.
     * @param options - Optional cache (number) and compression (boolean) settings.
     * @return A promise that resolves with the result of the update.
     */
    static async updateCacheAndCompression({ cache, compression }: { cache?: number; compression?: boolean } = {}): Promise<any> {

        if (!this.persistent) {
            throw new Error("Cache and compression settings can only be updated for persistent keyspaces.");
        }

        const cacheValue = cache !== undefined ? cache.toString() : "0";
        const compressionValue = compression === true ? "y" : "n";

        const query = {
            raw: [
                "update-cache-compression",
                "store", this.store,
                "keyspace", this.keyspace,
                "cache", cacheValue,
                "compression", compressionValue
            ],
            credentials: [this.username, this.password],
        };
        return await runQuery(this, JSON.stringify(query));
    }

    /**
     * Creates a keyspace in the persistent store.
     * @param options - Optional cache (number) and compression (boolean) settings.
     * @return A promise that resolves with the result of the keyspace creation.
     */
    static async createKeyspace({ cache, compression }: { cache?: number; compression?: boolean } = {}): Promise<any> {

        const cacheValue = cache !== undefined ? cache.toString() : "0";
        const compressionValue = compression === true ? "y" : "n";

        const query = {
            raw: [
                "create-keyspace",
                "store", this.store,
                "keyspace", this.keyspace,
                "persistent", this.persistent ? "y" : "n",
                "distributed", this.distributed ? "y" : "n",
                "cache", cacheValue,
                "compression", compressionValue
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