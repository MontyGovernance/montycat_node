import net from 'net';
import JSONbigBase from 'json-bigint';
import GenericKV from '../classes/generic.js';

const JSONbig = JSONbigBase({ storeAsString: true });

/** * Interface for engine configuration options.
 * @interface
 * */
interface EngineConfig {
  host?: string | null;
  port?: number | null;
  username?: string | null;
  password?: string | null;
  store?: string | null;
}

/** * Interface for raw query structure.
 * @interface
 * */
interface RawQuery {
  raw: (string | boolean)[];
  credentials: string[];
}

/** * Enum for valid permissions.
 * @enum
 * */
enum ValidPermissions {
    READ = 'read',
    WRITE = 'write',
    ALL = 'all',
}

/**
 * Represents the configuration and connection details for a communication engine.
 * This class allows you to connect to a MontyCat server and perform operations such as creating stores, managing owners, and granting/revoking permissions.
 * @class
 * @param {EngineConfig} config - The configuration for the engine, including host, port, username, password, and store.
 * @example
 * 
 *  const engine = new Engine({
 *    host: 'localhost',
 *    port: 3000,
 *    username: 'admin',
 *    password: 'admin',
 *    store: 'test_store',
 *  });
 * 
 */
class Engine {
  private host: string | null;
  private port: number | null;
  private username: string | null;
  private password: string | null;
  private store: string | null;

  constructor({ host = null, port = null, username = null, password = null, store = null }: EngineConfig = {}) {
    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;
    this.store = store;
  }

  /**
   * Creates an Engine instance from a URI string in the format:
   * montycat://host/port/username/password[/store]
   */
  static fromUri(uri: string): Engine {
    if (!uri.startsWith('montycat://')) {
      throw new Error("URI must use 'montycat://' protocol");
    }

    const parts = uri.slice('montycat://'.length).split('/');

    if (parts.length !== 4 && parts.length !== 5) {
      throw new Error('Missing or extra parts in URI');
    }

    const [host, portStr, username, password, store = null] = parts;

    if (!host || !portStr || !username || !password) {
      throw new Error('Host, port, username, and password must be non-empty');
    }

    const port = parseInt(portStr, 10);
    if (isNaN(port)) {
      throw new Error('Port must be an integer');
    }

    return new Engine({ host, port, username, password, store });
  }

  /**
   * Creates a store with the specified persistence option.
   * @param {Object} options - Options for creating the store.
   * @param {boolean} [options.persistent=false] - Whether to create a persistent store.
   * @returns {Promise<unknown>} A promise that resolves with the result of the store creation.
   */
  async createStore({ persistent = false }: { persistent?: boolean } = {}): Promise<unknown> {
    const rawQuery: RawQuery = {
      raw: ['create-store', 'store', this.store!, 'persistent', persistent ? 'y' : 'n'],
      credentials: [this.username!, this.password!],
    };
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery));
  }

  /**
   * Removes a store with the specified persistence option.
   * @param {Object} options - Options for removing the store.
   * @param {boolean} [options.persistent=false] - Whether to remove a persistent store.
   * @returns {Promise<unknown>} A promise that resolves with the result of the store removal.
   */
  async removeStore({ persistent = false }: { persistent?: boolean } = {}): Promise<unknown> {
    const rawQuery: RawQuery = {
      raw: ['remove-store', 'store', this.store!, 'persistent', persistent ? 'y' : 'n'],
      credentials: [this.username!, this.password!],
    };
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery));
  }

  /**
   * Creates an owner with the specified username and password.
   * @param {string} owner - The username of the owner to create.
   * @param {string} password - The password for the owner.
   * @returns {Promise<unknown>} A promise that resolves with the result of the owner creation.
   */
  async createOwner(owner: string, password: string): Promise<unknown> {
    const rawQuery: RawQuery = {
      raw: ['create-owner', 'username', owner, 'password', password],
      credentials: [this.username!, this.password!],
    };
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery));
  }

  async removeOwner(owner: string): Promise<unknown> {
    const rawQuery: RawQuery = {
      raw: ['remove-owner', 'username', owner],
      credentials: [this.username!, this.password!],
    };
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery));
  }

  /**
   * Lists all owners in the store.
   * @returns {Promise<unknown>} A promise that resolves with the list of owners.
   */
  async listOwners(): Promise<unknown> {
    const rawQuery: RawQuery = {
      raw: ['list-owners'],
      credentials: [this.username!, this.password!],
    };
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery));
  }

  /**
   * Grants a permission to an owner for specified keyspaces.
   * @param {string} owner - The username of the owner to grant permission to.
   * @param {ValidPermissions} permission - The permission to grant (read, write, all).
   * @param {string | GenericKV[] | string[] | { keyspace: string }} [keyspaces] - The keyspaces to grant permission for.
   * @returns {Promise<unknown>} A promise that resolves with the result of the grant operation.
   */
  async grantTo(owner: string, permission: ValidPermissions, keyspaces?: string | GenericKV[] | string[] | { keyspace: string }): Promise<unknown> {

    const query: RawQuery = {
      raw: ['grant-to', 'owner', owner, 'permission', permission, 'store', this.store!],
      credentials: [this.username!, this.password!],
    };

    if (keyspaces) {
      query.raw.push('keyspaces');

      if (typeof keyspaces === 'string') {
        query.raw.push(keyspaces);
      } else if (Array.isArray(keyspaces)) {

        keyspaces.forEach(each => {
          if (typeof each === 'object' && each.hasOwnProperty('keyspace')) {
            query.raw.push(each.keyspace);
          } else if (typeof each === 'string') {
            query.raw.push(each);
          }
        });

      } else if (typeof keyspaces === 'object' && keyspaces.hasOwnProperty('keyspace')) {
        query.raw.push(keyspaces.keyspace);
      }
    }

    return sendData(this.host!, this.port!, JSONbig.stringify(query));
  }

  /**
   * Revokes a permission from an owner for specified keyspaces.
   * @param {string} owner - The username of the owner to revoke permission from.
   * @param {ValidPermissions} permission - The permission to revoke (read, write, all).
   * @param {string | GenericKV[] | string[] | { keyspace: string }} [keyspaces] - The keyspaces to revoke permission for.
   * @returns {Promise<unknown>} A promise that resolves with the result of the revoke operation.
   */
  async revokeFrom(owner: string, permission: ValidPermissions, keyspaces?: string | string[] | GenericKV[] | { keyspace: string }): Promise<unknown> {
    const validPermissions = ['read', 'write', 'all'];

    if (!validPermissions.includes(permission)) {
      throw new Error(`Invalid permission: ${permission}. Valid permissions are: ${validPermissions}`);
    }

    const query: RawQuery = {
      raw: ['revoke-from', 'owner', owner, 'permission', permission, 'store', this.store!],
      credentials: [this.username!, this.password!],
    };

    if (keyspaces) {
      query.raw.push('keyspaces');

      if (typeof keyspaces === 'string') {
        query.raw.push(keyspaces);
      } else if (Array.isArray(keyspaces)) {
        keyspaces.forEach(each => {
          if (typeof each === 'object' && each.hasOwnProperty('keyspace')) {
            query.raw.push(each.keyspace);
          } else if (typeof each === 'string') {
            query.raw.push(each);
          }
        });
      } else if (typeof keyspaces === 'object' && keyspaces.hasOwnProperty('keyspace')) {
        query.raw.push(keyspaces.keyspace);
      }
    }

    return sendData(this.host!, this.port!, JSONbig.stringify(query));
  }

  /**
   * Retrieves the structure of the store.
   * @returns {Promise<unknown>} A promise that resolves with the structure of the store
   * */
  async getStructureAvailable(): Promise<unknown> {
    const rawQuery: RawQuery = {
      raw: ['get-structure-available'],
      credentials: [this.username!, this.password!],
    };
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery));
  }
}

/**
 * Sends a string to the specified host and port, and returns the parsed response.
 * @param {string} host - The host to connect to.
 * @param {number} port - The port to connect to.
 * @param {string} string - The string to send.
 * @returns {Promise<unknown>} A promise that resolves with the parsed response.
 */
async function sendData(host: string, port: number, string: string): Promise<unknown> {
  return new Promise((resolve) => {
    const client = new net.Socket({
      readable: true,
      writable: true,
    });
    let response = '';

    client.connect(port, host, () => {
      client.write(string + '\n');
    });

    client.on('data', (data: Buffer) => {
      response += data.toString();
      if (response.includes('\n')) {
        try {
          const parsedResponse = recursiveParseJSON(response);
          client.destroy();
          resolve(parsedResponse);
        } catch (err) {
          // Ignore parsing errors for now; handled in 'end' event
        }
      }
    });

    client.on('end', () => {
      try {
        const parsedResponse = recursiveParseJSON(response);
        resolve(parsedResponse);
      } catch (err) {
        resolve('Incomplete or invalid response');
      }
    });

    client.on('timeout', () => {
      resolve('Operation timed out');
      client.destroy();
    });

    client.on('error', (err: Error) => {
      resolve(`Connection error: ${err.message}`);
      client.destroy();
    });

    client.setTimeout(120000);
  });
}

/**
 * Recursively parses JSON data, handling BigInt and other types.
 * @param {unknown} data - The data to parse.
 * @returns {unknown} The parsed data.
 */
function recursiveParseJSON(data: unknown): unknown {
  if (typeof data === 'string') {
    if (/^\d+$/.test(data) && BigInt(data) <= 18446744073709551615n) {
      return data;
    }
    try {
      const parsedData = JSONbig.parse(data);
      return recursiveParseJSON(parsedData);
    } catch {
      return data;
    }
  } else if (Array.isArray(data)) {
    return data.map((item) => recursiveParseJSON(item));
  } else if (typeof data === 'object' && data !== null) {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => {
        const parsedKey = isNaN(parseInt(key, 10)) ? key : parseInt(key, 10);
        return [parsedKey, recursiveParseJSON(value)];
      })
    );
  } else {
    return data;
  }
}

export { Engine, EngineConfig, sendData, ValidPermissions };