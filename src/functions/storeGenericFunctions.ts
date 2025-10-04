import xxhash from 'xxhashjs';
import { sendData } from '../core/engine.js';
import { Timestamp, Pointer } from '../core/schema.js';

/**
 * Utility functions for handling custom keys and values in a generic store.
 * These functions include converting custom keys, processing bulk keys and values,
 * and converting values to a binary query format.
 */
function convertCustomKey(key: string): string {
    return xxhash.h32().update(key.toString()).digest().toNumber().toString();
}

/** * Converts an array of custom keys to their hashed string representations.
 * @param keys - An array of keys, which can be strings or numbers.
 * @returns An array of hashed string representations of the keys.
 * */
function convertCustomKeys(keys: string[]): string[] {
    return keys.map(convertCustomKey);
}

/**
 * Converts an object of custom keys and values to their hashed string representations.
 * @param keysValues - An object where keys can be strings or numbers, and values can be any type.
 * @returns An object with hashed string keys and original values.
 */
function convertCustomKeysValues(keysValues: { [key: string]: any }): { [key: string]: any } {
    return Object.fromEntries(
        Object.entries(keysValues).map(([key, value]) => [convertCustomKey(key), value])
    );
}

/**
 * Processes bulk keys and values, converting any Timestamp or Pointer instances
 * to their appropriate string representations and hashing the keys.
 * @param bulkKeysValues - An object containing bulk keys and values.
 * @returns An object with processed keys and values.
 */
function processBulkKeysValues(bulkKeysValues: { [key: string]: any }): { [key: string]: any } {
    const bulkKeysValuesProcessed: { [key: string]: any } = {};

    Object.keys(bulkKeysValues).forEach((key) => {
        const entry = bulkKeysValues[key];

        if (entry instanceof Object) {
            const inner = entry as { [key: string]: any };

            Object.keys(inner).forEach((prop) => {
                const value = inner[prop];
                if (value instanceof Timestamp) {
                    inner[prop] = value.timestamp;
                }
            });

            if (entry instanceof Pointer) {
                bulkKeysValues[key] = entry.setupPointer();
            }

            const processedKey = !isNaN(Number(key)) ? key : convertCustomKey(key);
            bulkKeysValuesProcessed[processedKey] = JSON.stringify(bulkKeysValues[key]);
        }
    });

    return bulkKeysValuesProcessed;
}

/**
 * Converts a class instance to a binary query string.
 * @param cls - The class instance containing store properties.
 * @param options - An object containing various options for the query.
 * @returns A JSON string representing the binary query.
 * */
function convertToBinaryQuery(cls:  any, options: { [key: string]: any } = {}) : string {
    const {
        key = null,
        value = {},
        expireSec = 0,
        bulkValues = [],
        bulkKeys = [],
        bulkKeysValues = {},
        searchCriteria = {},
        limitOutput = { start: 0, stop: 0 },
        withPointers = false,
        schema = null,
        keyIncluded = false,
        pointersMetadata = false,
        volumes = [],
        latestVolume = false,
    } = options;

    const { processedValue, foundSchema } = processValue(value);
    const { processedBulkValues, uniqueSchema } = processBulkValues(bulkValues);

    const bulkKeysValuesProcessed = processBulkKeysValues(bulkKeysValues);
    const processedSearchCriteria = processSearchCriteria(searchCriteria);

    return JSON.stringify({
        username: cls.username,
        password: cls.password,
        namespace: cls.namespace,
        store: cls.store,
        keyspace: cls.keyspace,
        persistent: cls.persistent,
        distributed: cls.distributed,
        limit_output: limitOutput,
        key,
        value: JSON.stringify(processedValue),
        command: cls.command,
        expire: expireSec,
        bulk_values:  processedBulkValues.map(v => JSON.stringify(v)),
        bulk_keys: bulkKeys,
        bulk_keys_values: bulkKeysValuesProcessed,
        search_criteria: JSON.stringify(processedSearchCriteria),
        with_pointers: withPointers,
        schema: foundSchema ? foundSchema: uniqueSchema ? uniqueSchema : schema,
        key_included: keyIncluded,
        pointers_metadata: pointersMetadata,
        volumes,
        latest_volume: latestVolume,
    });
}

function processSearchCriteria(searchCriteria: object[]): object {
    const processedCriteria: { [key: string]: any } = {};
    for (const key in searchCriteria) {
        if (searchCriteria[key] instanceof Pointer) {

            if (processedCriteria['pointers'] === undefined) {
                processedCriteria['pointers'] = { [key]: searchCriteria[key].setupPointer() };
            } else {
                processedCriteria['pointers'][key] = searchCriteria[key].setupPointer();
            }

        } else {
            processedCriteria[key] = searchCriteria[key];
        }
    }
    return processedCriteria;
}

/**
 * Processes a single value, converting any Timestamp or Pointer instances
 * to their appropriate string representations.
 * @param value - The value to process, which can be any type.
 * @returns An object containing the processed value and the found schema, if any.
 */
function processValue(value: any): { processedValue: any, foundSchema: string | null } {

    let foundSchema = null;

    if (value) {
        if (value instanceof Object) {
            if (value.hasOwnProperty('schema')) {
                foundSchema = value['schema'];
                delete value['schema'];
            }

            for (const prop in value) {
                if (value[prop] instanceof Timestamp) {
                    value[prop] = value[prop].timestamp; // Convert Timestamp to ISO string
                }
                if (value[prop] instanceof Pointer) {
                    value[prop] = value[prop].setupPointer(); // Serialize Pointer
                }
            }

        }
        return { processedValue: value, foundSchema };
    }
    return { processedValue: value, foundSchema };
}

/** * Processes an array of bulk values, converting any Timestamp or Pointer instances
 * to their appropriate string representations and ensuring all values have the same schema.
 * @param bulkValues - An array of values to process.
 * @returns An object containing the processed bulk values and the unique schema, if any.
 */
function processBulkValues(bulkValues: any[]) {
    let arrayWithValues: any[] = [];
    let uniqueSchemas: Set<string> = new Set();

    if (bulkValues.length > 0) {
        bulkValues.forEach((val, i) => {
            const { processedValue, foundSchema } = processValue(val);
            if (foundSchema) {
                if (uniqueSchemas.size > 1) {
                    throw new Error("Bulk values must have the same schema");
                } else {

                    uniqueSchemas.add(foundSchema);
                }
            }
            arrayWithValues.push(processedValue);
        });
    }

    return { processedBulkValues: arrayWithValues, uniqueSchema: uniqueSchemas.size > 0 ? uniqueSchemas.values().next().value: null };
}

/**
 * Runs a query against the store using the provided class instance.
 * @param cls - The class instance containing store properties.
 * @param query - The query string to execute.
 * @returns A promise that resolves with the result of the query.
 */
async function runQuery(cls: any, query: string, callback?: (data: any) => void, subscribe=false): Promise<unknown> {

    subscribe && (cls.port = cls.port + 1);

    return sendData(cls.host, cls.port, query, callback);
}

/**
 * Displays the properties of a store class instance.
 * @param cls - The class instance containing store properties.
 */
function showStoreProperties(cls: any): void {
    console.log(
        `Store Name: ${cls.store}\n` +
        `Store Namespace: ${cls.namespace}\n` +
        `Persistent: ${cls.persistent}\n` +
        `Distributed: ${cls.distributed}\n` +
        `Host: ${cls.host}\n` +
        `Port: ${cls.port}\n` +
        `Username: ${cls.username}\n` +
        `Password: ${cls.password}\n`
    );
}

export { convertCustomKey, convertCustomKeys, convertCustomKeysValues, convertToBinaryQuery, runQuery, showStoreProperties, processBulkKeysValues };
