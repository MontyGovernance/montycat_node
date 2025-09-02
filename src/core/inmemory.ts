
import { runQuery, convertToBinaryQuery, convertCustomKey } from '../functions/storeGenericFunctions.js';
import GenericKV from '../classes/generic.js';

/**
 * InMemory class that extends GenericKV for in-memory keyspace operations.
 * It provides methods for inserting, updating, and retrieving data in an in-memory store.
 */
class InMemory extends GenericKV {

    static persistent: boolean = false;
    static distributed: boolean = false;

    /**
     * Creates a keyspace in the in-memory store.
     * @returns A promise that resolves with the result of the keyspace creation.
     */
    static async createKeyspace(): Promise<any> {
        const query = {
            raw: [
                    "create-keyspace",
                    "store", this.store,
                    "keyspace", this.keyspace,
                    "persistent", this.persistent ? "y" : "n",
                    "distributed", this.distributed ? "y" : "n"
                ],
            credentials: [this.username, this.password],
        };
        return await runQuery(this, JSON.stringify(query));
    }

    /**
     * Snapshots the current state of the in-memory keyspace.
     * @returns A promise that resolves with the result of the snapshot operation.
     */
    static async doSnapshotsForKeyspace(): Promise<any> {

        if (this.persistent) {
            throw new Error("Snapshots are not allowed on persistent keyspaces");
        }

        const query = {
            raw: [
                    "do-snapshots-for-keyspace",
                    "store", this.store,
                    "keyspace", this.keyspace,
                ],
            credentials: [this.username, this.password],
        };
        return runQuery(this, JSON.stringify(query));
    }

    /**
     * Cleans up snapshots for the in-memory keyspace.
     * @returns A promise that resolves with the result of the cleanup operation.
     */
    static async cleanSnapshotsForKeyspace(): Promise<any> {

        if (this.persistent) {
            throw new Error("Snapshots are not allowed on persistent keyspaces");
        }

        const query = {
            raw: [
                    "clean-snapshots-for-keyspace",
                    "store", this.store,
                    "keyspace", this.keyspace,
                ],
            credentials: [this.username, this.password],
        };
        return runQuery(this, JSON.stringify(query));
    }

    /**
     * Stops snapshots for the in-memory keyspace.
     * @returns A promise that resolves with the result of stopping snapshots.
     */
    static async stopSnapshotsForKeyspace(): Promise<any> {

        if (this.persistent) {
            throw new Error("Snapshots are not allowed on persistent keyspaces");
        }

        const query = {
            raw: [
                    "stop-snapshots-for-keyspace",
                    "store", this.store,
                    "keyspace", this.keyspace,
                ],
            credentials: [this.username, this.password],
        };
        return runQuery(this, JSON.stringify(query));
    }

    /**
     * Inserts a value into the in-memory store.
     * @param value - The value to insert.
     * @param expireSec - The expiration time in seconds for the value.
     * @return A promise that resolves with the result of the insertion.
     * */
    static async insertValue({ value = {}, expireSec = 0 }: { value?: any; expireSec?: number } = {}): Promise<any> {
        this.command = "insert_value";
        const query = convertToBinaryQuery(this, { value, expireSec });
        return runQuery(this, query);
    }

    /**
     * Inserts a custom key into the in-memory store.
     * @param customKey - The custom key for the value.
     * @param expireSec - The expiration time in seconds for the value.
     * @return A promise that resolves with the result of the insertion.
     */
    static async insertCustomKey({ customKey, expireSec = 0 }: { customKey: string; expireSec?: number }): Promise<any> {
        if (!customKey) {
            throw new Error("No key provided");
        }
        this.command = "insert_custom_key";
        const query = convertToBinaryQuery(this, { key: convertCustomKey(customKey), expireSec });
        return runQuery(this, query);
    }

    /**
     * Inserts a custom key-value pair into the in-memory store.
     * @param customKey - The custom key for the value.
     * @param value - The value to insert.
     * @param expireSec - The expiration time in seconds for the value.
     * @return A promise that resolves with the result of the insertion.
     */
    static async insertCustomKeyValue({ customKey, value = {}, expireSec = 0 }: { customKey: string; value?: any; expireSec?: number }): Promise<any> {
        this.command = "insert_custom_key_value";
        const query = convertToBinaryQuery(this, { key: convertCustomKey(customKey), value, expireSec });
        return runQuery(this, query);
    }

    /**
     * Updates a value in the in-memory store.
     * @param key - The key for the value to update.
     * @param customKey - The custom key for the value to update.
     * @param value - The new value to set.
     * @param expireSec - The expiration time in seconds for the value.
     * @return A promise that resolves with the result of the update.
     */
    static async updateValue({ key = "", customKey = null, value = {}, expireSec = 0 }: { key?: string; customKey?: string | null; value?: any; expireSec?: number } = {}): Promise<any> {

        const effectiveKey = customKey ? convertCustomKey(customKey) : key;
        if (!effectiveKey) {
            throw new Error("No key provided");
        }

        this.command = "update_value";
        const query = convertToBinaryQuery(this, { key: effectiveKey, value, expireSec });
        return runQuery(this, query);
    }

    /**
        * Inserts a bulk of values into the in-memory store.
        * @param bulk - An array of values to insert.
        * @param expireSec - The expiration time in seconds for the values.
        * @return A promise that resolves with the result of the insertion.
     */
    static async insertBulk({ bulk = [], expireSec = 0 }: { bulk?: any[]; expireSec?: number } = {}): Promise<any> {
        if (!bulk || bulk.length === 0) {
            throw new Error("No values provided");
        }
        this.command = "insert_bulk";
        const query = convertToBinaryQuery(this, { bulkValues: bulk, expireSec });
        return runQuery(this, query);
    }


    /**
     * Gets keys from the in-memory store.
     * @returns A promise that resolves with the retrieved keys.
     */
    static async getKeys(): Promise<any> {
        this.command = "get_keys";
        const query = convertToBinaryQuery(this);
        return runQuery(this, query);
    }
};

/**
 * InMemoryDistributed class that extends InMemory for distributed in-memory keyspace operations.
 * It provides methods for distributed operations in an in-memory store.
 */
class InMemoryDistributed extends InMemory {
    static distributed: boolean = true;
};

export { InMemory, InMemoryDistributed };
