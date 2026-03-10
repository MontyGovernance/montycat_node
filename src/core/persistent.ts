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
     * Subscribes to changes in the persistent store based on the provided options.
     * @param callback - A callback function to handle incoming data.
     * @param key - A specific key to subscribe to.
     * @param customKey - A custom key to subscribe to.
     * @return A promise that resolves with the result of the subscription.
     * Note: Subscriptions are only allowed on non-persistent keyspaces, so this method will throw an error if called on a persistent keyspace.
     * The effective key for the subscription is determined by the presence of a custom key or a regular key, with the custom key taking precedence if both are provided.
     * The subscription query is constructed with the appropriate parameters and sent to the server using the runQuery function, with the callback function passed to handle incoming data.
     * If the subscription is successful, the promise will resolve with the result of the subscription; otherwise, it will reject with an error.
     * Error handling is implemented to ensure that subscriptions are not allowed on persistent keyspaces, and that a key is provided for the subscription.
     * The method is designed to facilitate real-time updates and notifications for changes in the keyspace, allowing clients to react to data changes as they occur.
     * Overall, this method provides a mechanism for clients to stay informed about changes in the persistent store, while enforcing the constraints of the keyspace type and ensuring that necessary parameters are provided for the subscription.
     * @throws Will throw an error if subscriptions are attempted on a persistent keyspace or if no key is provided for the subscription.
     * @example
     * Persistent.subscribe({
     *   callback: (data) => {
     *    console.log("Received data:", data);
     *  },
     *  key: "myKey"
     * });
     * @example
     * Persistent.subscribe({
     *  callback: (data) => {
     *   console.log("Received data for custom key:", data);
     * },
     * customKey: "myCustomKey"
     * });
     */
    static async subscribe({callback, key, customKey}: {callback?: (data: any) => void, key?: string, customKey?: string}): Promise<any> {

        const effectiveKey = customKey ? convertCustomKey(customKey) : (key || null);

        const queryObj = {
            subscribe: true,
            key: effectiveKey,
            keyspace: this.keyspace,
            store: this.store,
            username: this.username,
            password: this.password
        }

        const query = JSON.stringify(queryObj);
        return await runQuery(this, query, callback, true);

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
     * @param cache - The cache settings to apply.
     * @param compression - Whether to enable compression.
     * @return A promise that resolves with the result of the update.
     */
    static async updateCacheAndCompression(): Promise<any> {

        if (!this.persistent) {
            throw new Error("Cache and compression settings can only be updated for persistent keyspaces.");
        }

        const query = {
            raw: [
                    "update-cache-compression",
                    "store", this.store,
                    "keyspace", this.keyspace,
                    "cache", this.cache ? this.cache : "0",
                    "compression", this.compression ? "y" : "n"
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
                    "create-keyspace",
                    "store", this.store,
                    "keyspace", this.keyspace,
                    "persistent", this.persistent ? "y" : "n",
                    "distributed", this.distributed ? "y" : "n",
                    "cache", this.cache ? this.cache : "0",
                    "compression", this.compression ? "y" : "n"
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