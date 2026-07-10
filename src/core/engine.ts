import net from 'net';
import JSONbigBase from 'json-bigint';
import GenericKV from '../classes/generic.js';
import tls from "tls";

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
  useTls?: boolean;
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
  public useTls: boolean | undefined;

  constructor({ host = null, port = null, username = null, password = null, store = null, useTls = false }: EngineConfig = {}) {
    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;
    this.store = store;
    this.useTls = useTls;
  }

  /**
   * Creates an Engine instance from a URI string in the format:
   * montycat://username:password@host:port/[store]
   * @param {string} uri - The URI string to parse.
   * @returns {Engine} An instance of the Engine class configured with the parsed values.
   */
  static fromUri(uri: string): Engine {
    if (!uri.startsWith("montycat://")) {
      throw new Error("URI must use 'montycat://' protocol");
    }

    const uriWithoutScheme = uri.slice("montycat://".length);

    const [mainPart, store] = uriWithoutScheme.split("/").length > 1
      ? [uriWithoutScheme.split("/")[0], uriWithoutScheme.split("/").slice(1).join("/")]
      : [uriWithoutScheme, null];

    const atIndex = mainPart.indexOf("@");
    if (atIndex === -1) {
      throw new Error("Missing '@' in URI (username:password@host:port required)");
    }

    const [userPass, hostPort] = [mainPart.slice(0, atIndex), mainPart.slice(atIndex + 1)];
    const [username, password] = userPass.split(":");
    const [host, portStr] = hostPort.split(":");

    if (!username || !password || !host || !portStr) {
      throw new Error("Username, password, host, and port must be non-empty");
    }

    const port = parseInt(portStr, 10);
    if (isNaN(port)) {
      throw new Error("Port must be an integer");
    }

    return new Engine({
      host,
      port,
      username,
      password,
      store: store || null,
      useTls: false,
    });
  }

  /**
   * Creates a store with the specified persistence option.
   * @param {Object} options - Options for creating the store.
   * @param {boolean} [options.persistent=false] - Whether to create a persistent store.
   * @returns {Promise<unknown>} A promise that resolves with the result of the store creation.
   */
  async createStore(): Promise<unknown> {
    const rawQuery: RawQuery = {
      raw: ['create-store', 'store', this.store!],
      credentials: [this.username!, this.password!],
    };
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls);
  }

  /**
   * Removes a store with the specified persistence option.
   * @param {Object} options - Options for removing the store.
   * @param {boolean} [options.persistent=false] - Whether to remove a persistent store.
   * @returns {Promise<unknown>} A promise that resolves with the result of the store removal.
   */
  async removeStore(): Promise<unknown> {
    const rawQuery: RawQuery = {
      raw: ['remove-store', 'store', this.store!],
      credentials: [this.username!, this.password!],
    };
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls);
  }

  /**
   * Creates an owner with the specified username and password.
   * @param {string} owner - The username of the owner to create.
   * @param {string} password - The password for the owner.
   * @returns {Promise<unknown>} A promise that resolves with the result of the owner creation.
   */
  async createOwner({ owner, password }: { owner: string; password: string }): Promise<unknown> {
    const rawQuery: RawQuery = {
      raw: ['create-owner', 'username', owner, 'password', password],
      credentials: [this.username!, this.password!],
    };
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls);
  }

  async removeOwner({ owner }: { owner: string }): Promise<unknown> {
    const rawQuery: RawQuery = {
      raw: ['remove-owner', 'username', owner],
      credentials: [this.username!, this.password!],
    };
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls);
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
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls);
  }

  /**
   * Grants a permission to an owner for specified keyspaces.
   * @param {string} owner - The username of the owner to grant permission to.
   * @param {ValidPermissions} permission - The permission to grant (read, write, all).
   * @param {string | GenericKV[] | string[] | { keyspace: string }} [keyspaces] - The keyspaces to grant permission for.
   * @returns {Promise<unknown>} A promise that resolves with the result of the grant operation.
   */
  async grantTo({ owner, permission, keyspaces }: {owner: string, permission: ValidPermissions, keyspaces?: string | GenericKV[] | string[] | { keyspace: string }}): Promise<unknown> {

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

    return sendData(this.host!, this.port!, JSONbig.stringify(query), undefined, this.useTls);
  }

  /**
   * Revokes a permission from an owner for specified keyspaces.
   * @param {string} owner - The username of the owner to revoke permission from.
   * @param {ValidPermissions} permission - The permission to revoke (read, write, all).
   * @param {string | GenericKV[] | string[] | { keyspace: string }} [keyspaces] - The keyspaces to revoke permission for.
   * @returns {Promise<unknown>} A promise that resolves with the result of the revoke operation.
   */
  async revokeFrom({ owner, permission, keyspaces }: { owner: string; permission: ValidPermissions; keyspaces?: string | string[] | GenericKV[] | { keyspace: string } }): Promise<unknown> {
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

    return sendData(this.host!, this.port!, JSONbig.stringify(query), undefined, this.useTls);
  }

  /**
   * Enable semantic (vector similarity) search.
   *
   * Without `store`, this is DB-wide: it flips the whole database on, sets the
   * default embedding model and field, and enrolls every existing keyspace that
   * has no semantic config yet (each gets a background backfill so its existing
   * items become searchable). The chosen model is downloaded on demand on first
   * enable, so this call may take a while the first time.
   *
   * With `store`, it is scoped: only that store's un-enrolled keyspaces are
   * enrolled and backfilled; the DB-wide switch and default model/field are left
   * untouched. Use this to (re-)enable one store without re-embedding the entire
   * database.
   *
   * @param {Object} options - Options for enabling semantic search.
   * @param {string} [options.model] - The embedding model key to use by default.
   *                                   One of 'minilm', 'bge-small', 'bge-base',
   *                                   'e5-small'. Defaults to the server default
   *                                   ('bge-small').
   * @param {string} [options.field] - The JSON field of each value to embed.
   *                                   Defaults to embedding the whole value.
   * @param {string} [options.store] - Restrict enrollment/backfill to this store
   *                                   only. If the DB-wide switch is off, a scoped
   *                                   enable enrolls but nothing embeds until a
   *                                   DB-wide enable.
   * @returns {Promise<unknown>} The server's response describing the enabled
   *                             model and enrolled keyspaces.
   */
  async enableSemanticSearch({ model, field, store }: { model?: string; field?: string; store?: string } = {}): Promise<unknown> {
    const rawQuery: RawQuery = {
      raw: ['enable-semantic-search'],
      credentials: [this.username!, this.password!],
    };
    if (model) rawQuery.raw.push('model', model);
    if (field) rawQuery.raw.push('field', field);
    if (store) rawQuery.raw.push('store', store);

    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls);
  }

  /**
   * Disable semantic search.
   *
   * Without `store`, this is DB-wide: embedding and semantic queries stop across
   * the whole database; stored vectors are kept by default so re-enabling
   * resumes without a full re-embed.
   *
   * With `store`, it is scoped: only that store's keyspaces are unenrolled
   * (their configs and resident graphs dropped); the DB-wide switch and all
   * other stores are left untouched. This is the surgical way to reset one
   * store's semantic state instead of nuking and re-backfilling the whole
   * database.
   *
   * @param {Object} options - Options for disabling semantic search.
   * @param {boolean} [options.dropVectors=false] - If true, also clear stored
   *                                                vectors — every keyspace's
   *                                                DB-wide, or the scoped store's
   *                                                when `store` is set. Required
   *                                                before switching to a different
   *                                                embedding model.
   * @param {string} [options.store] - Restrict the disable to this store only.
   * @returns {Promise<unknown>} The server's response confirming the disable.
   */
  async disableSemanticSearch({ dropVectors = false, store }: { dropVectors?: boolean; store?: string } = {}): Promise<unknown> {
    const rawQuery: RawQuery = {
      raw: ['disable-semantic-search'],
      credentials: [this.username!, this.password!],
    };
    if (dropVectors) rawQuery.raw.push('drop-vectors');
    if (store) rawQuery.raw.push('store', store);

    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls);
  }

  /**
   * Retrieves the structure of the store.
   * @returns {Promise<unknown>} A promise that resolves with the structure of the store
   * */
  async getStructureAvailable(): Promise<unknown> {

    const storePart = this.store ? ['store', this.store] : [];

    const rawQuery: RawQuery = {
      raw: ['get-structure-available', ...storePart],
      credentials: [this.username!, this.password!],
    };
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls);
  }

  /**
   * Enable the DB-wide "wait for index" default: writes block until their
   * secondary indexes are updated before returning, so a write is immediately
   * visible to index-backed reads (e.g. lookupValuesWhere) at the cost of
   * higher write latency. Requires superowner credentials.
   * @returns {Promise<unknown>} The server's response confirming the change.
   */
  async enableWaitForIndex(): Promise<unknown> {
    const rawQuery: RawQuery = {
      raw: ['enable-wait-for-index'],
      credentials: [this.username!, this.password!],
    };
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls);
  }

  /**
   * Disable the DB-wide "wait for index" default: writes return as soon as the
   * data is committed and indexing happens asynchronously in the background
   * (lower write latency; index-backed reads may briefly lag). This is the
   * default behavior. Requires superowner credentials.
   * @returns {Promise<unknown>} The server's response confirming the change.
   */
  async disableWaitForIndex(): Promise<unknown> {
    const rawQuery: RawQuery = {
      raw: ['disable-wait-for-index'],
      credentials: [this.username!, this.password!],
    };
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls);
  }

  /** Internal helper for no-argument superowner raw commands. */
  private async _adminCommand(command: string): Promise<unknown> {
    const rawQuery: RawQuery = {
      raw: [command],
      credentials: [this.username!, this.password!],
    };
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls);
  }

  /**
   * Enable server-side operation reporting (logging). Requires superowner credentials.
   * @returns {Promise<unknown>} The server's response confirming the change.
   */
  async enableReports(): Promise<unknown> {
    return this._adminCommand('enable-reports');
  }

  /**
   * Disable server-side operation reporting (logging). Requires superowner credentials.
   * @returns {Promise<unknown>} The server's response confirming the change.
   */
  async disableReports(): Promise<unknown> {
    return this._adminCommand('disable-reports');
  }

  /**
   * Allow clients to open keyspace subscriptions DB-wide. Requires superowner credentials.
   * @returns {Promise<unknown>} The server's response confirming the change.
   */
  async allowSubscriptions(): Promise<unknown> {
    return this._adminCommand('allow-subscriptions');
  }

  /**
   * Restrict (disallow) keyspace subscriptions DB-wide. Requires superowner credentials.
   * @returns {Promise<unknown>} The server's response confirming the change.
   */
  async restrictSubscriptions(): Promise<unknown> {
    return this._adminCommand('restrict-subscriptions');
  }

  /**
   * Sample the current depth of every background task queue (index, timer,
   * counting) — an observability probe for whether the background runners are
   * keeping up with the write rate. Requires superowner credentials.
   * @returns {Promise<unknown>} The server's response whose payload maps
   *   "index" | "timer" | "counting" to per-queue depth maps.
   */
  async queueDepths(): Promise<unknown> {
    return this._adminCommand('queue-depths');
  }

  /**
   * Set the server-wide snapshot rate. Requires superowner credentials.
   * @param {number} rate - The snapshot rate value (server-defined units).
   * @returns {Promise<unknown>} The server's response confirming the change.
   */
  async setSnapshotRate(rate: number): Promise<unknown> {
    const rawQuery: RawQuery = {
      raw: ['snapshot-rate', String(rate)],
      credentials: [this.username!, this.password!],
    };
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls);
  }

  /**
   * Set how often the server scans for expired keys. Requires superowner credentials.
   * @param {number} rate - Number of 15-minute intervals between expiration scans;
   *   multiplied by 900 seconds server-side (e.g. rate=4 → a scan every 60 minutes).
   * @returns {Promise<unknown>} The server's response confirming the change.
   */
  async setExpirationCheckRate(rate: number): Promise<unknown> {
    const rawQuery: RawQuery = {
      raw: ['expiration-check', String(rate)],
      credentials: [this.username!, this.password!],
    };
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls);
  }
}

/**
 * Sends a string to the specified host and port, and returns the parsed response.
 * @param {string} host - The host to connect to.
 * @param {number} port - The port to connect to.
 * @param {string} string - The string to send.
 * @returns {Promise<unknown>} A promise that resolves with the parsed response.
 */
type SubscriptionHandle = {
  stop: () => void;
};

/**
 * Sends data to a server. Supports one-time request/response or subscription.
 * @param host - The server host.
 * @param port - The server port.
 * @param message - The string message to send.
 * @param callback - Optional callback for subscription responses.
 * @returns Promise resolving with parsed response or SubscriptionHandle.
 */
async function sendData(
  host: string,
  port: number,
  message: string,
  callback?: (data: unknown) => void,
  useTls: boolean = false,
): Promise<unknown | SubscriptionHandle> {

  return new Promise((resolve, _reject) => {
    let client: net.Socket | tls.TLSSocket;
    let response = "";
    const subscriptionMode = message.includes("subscribe");
    let stopped = false;

    const onData = (data: Buffer) => {
      response += data.toString();
      const parts = response.split("\n");
      response = parts.pop() || "";

      for (const part of parts) {
        if (!part.trim()) continue;
        try {
          const parsed = recursiveParseJSON(part);
          if (subscriptionMode) {
            if (!stopped && callback) callback(parsed);
          } else {
            client.destroy();
            resolve(parsed);
          }
        } catch (err) {
          resolve(`Failed to parse response: ${err}`);
        }
      }
    };

    const onEnd = () => {
      if (!subscriptionMode) {
        try {
          const parsed = recursiveParseJSON(response);
          resolve(parsed);
        } catch {
          resolve("Incomplete or invalid response");
        }
      }
    };

    const onError = (err: Error) => {
      if (!subscriptionMode) resolve(`Connection error: ${err.message}`);
      client.destroy();
    };

    const onTimeout = () => {
      if (!subscriptionMode) resolve("Operation timed out");
      client.destroy();
    };

    // Function to finalize connection setup
    const finalizeConnect = (sock: net.Socket | tls.TLSSocket) => {
      client = sock;
      client.on("data", onData);
      client.on("end", onEnd);
      client.on("error", onError);
      client.on("timeout", onTimeout);
      client.setTimeout(120000);

      client.write(message + "\n");

      if (subscriptionMode) {
        resolve({
          stop: () => {
            stopped = true;
            client.destroy();
          },
        });
      }
    };

    if (useTls) {
      const tlsSocket = tls.connect(
        {
          host,
          port,
          rejectUnauthorized: false, // for self-signed certs, enable true in prod
        },
        () => finalizeConnect(tlsSocket)
      );

      // Handshake timeout
      const handshakeTimer = setTimeout(() => {
        tlsSocket.destroy();
        if (!subscriptionMode) resolve("TLS handshake timeout");
      }, 10000);

      tlsSocket.once("secureConnect", () => clearTimeout(handshakeTimer));
      tlsSocket.once("error", () => clearTimeout(handshakeTimer));
    } else {
      const tcpSocket = new net.Socket();
      tcpSocket.connect(port, host, () => finalizeConnect(tcpSocket));
    }
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