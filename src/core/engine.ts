import net from 'net';
import JSONbigBase from 'json-bigint';
import GenericKV from '../classes/generic.js';
import tls from "tls";
import { ConnectionPool, PoolConfig, PooledConnection, WriteFailed, closeAllPools, getPool } from './pool.js';

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
  /**
   * Enables connection pooling for request/response traffic. Absent (the
   * default) opens a connection per request, exactly as before.
   *
   * Pools live in a module-level registry keyed by `(host, port, useTls)`, so
   * every keyspace class pointing at one server shares a single pool.
   * Subscriptions are never pooled. Call `closeAllPools()` before exit.
   */
  pool?: PoolConfig | null;
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

/** Capabilities that can be granted through data-mesh governance policies. */
enum PolicyCapability {
  PROVISION_KEYSPACE = 'provision-keyspace',
  REMOVE_KEYSPACE = 'remove-keyspace',
  MANAGE_SNAPSHOTS = 'manage-snapshots',
  MANAGE_SEMANTIC = 'manage-semantic',
  MANAGE_SCHEMA = 'manage-schema',
  MANAGE_ACCESS = 'manage-access',
}

/** Keyspace storage types addressable by governance policies. */
enum PolicyKeyspaceType {
  IN_MEMORY = 'inmemory',
  PERSISTENT = 'persistent',
  DISTRIBUTED = 'distributed',
}

/** Compiled embedding models supported by Montycat semantic search. */
enum SemanticModel {
  MINI_LM = 'minilm',
  BGE_SMALL = 'bge-small',
  BGE_BASE = 'bge-base',
  E5_SMALL = 'e5-small',
}

/** Serialization formats accepted by policy manifest commands. */
enum PolicyFormat {
  JSON = 'json',
  YAML = 'yaml',
  YML = 'yml',
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
  /** Pooling config, or null/undefined for connect-per-request. */
  public pool: PoolConfig | null | undefined;

  constructor({ host = null, port = null, username = null, password = null, store = null, useTls = false, pool = null }: EngineConfig = {}) {
    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;
    this.store = store;
    this.useTls = useTls;
    this.pool = pool;
  }

  /**
   * Creates an Engine instance from a URI string in the format:
   * montycat://username:password@host:port/[store]
   * @param {string} uri - The URI string to parse.
   * @returns {Engine} An instance of the Engine class configured with the parsed values.
   */
  static fromUri(uri: string, pool: PoolConfig | null = null): Engine {
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
      pool,
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
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls, this.pool);
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
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls, this.pool);
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
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls, this.pool);
  }

  async removeOwner({ owner }: { owner: string }): Promise<unknown> {
    const rawQuery: RawQuery = {
      raw: ['remove-owner', 'username', owner],
      credentials: [this.username!, this.password!],
    };
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls, this.pool);
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
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls, this.pool);
  }

  /**
   * Grants a permission to an owner for specified keyspaces.
   * @param {string} owner - The username of the owner to grant permission to.
   * @param {ValidPermissions} permission - The permission to grant (read, write, all).
   * @param {string | GenericKV[] | string[] | { keyspace: string }} [keyspaces] - The keyspaces to grant permission for.
   * @returns {Promise<unknown>} A promise that resolves with the result of the grant operation.
   */
  async grantTo({ owner, permission, keyspaces }: {owner: string, permission: ValidPermissions, keyspaces?: string | GenericKV[] | string[] | { keyspace: string }}): Promise<unknown> {
    const normalizedPermission = String(permission).trim().toLowerCase();
    const validPermissions = Object.values(ValidPermissions);
    if (!validPermissions.includes(normalizedPermission as ValidPermissions)) {
      throw new Error(`Invalid permission: ${permission}. Valid permissions are: ${validPermissions}`);
    }

    const query: RawQuery = {
      raw: ['grant-to', 'owner', owner, 'permission', normalizedPermission, 'store', this.store!],
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

    return sendData(this.host!, this.port!, JSONbig.stringify(query), undefined, this.useTls, this.pool);
  }

  /**
   * Revokes a permission from an owner for specified keyspaces.
   * @param {string} owner - The username of the owner to revoke permission from.
   * @param {ValidPermissions} permission - The permission to revoke (read, write, all).
   * @param {string | GenericKV[] | string[] | { keyspace: string }} [keyspaces] - The keyspaces to revoke permission for.
   * @returns {Promise<unknown>} A promise that resolves with the result of the revoke operation.
   */
  async revokeFrom({ owner, permission, keyspaces }: { owner: string; permission: ValidPermissions; keyspaces?: string | string[] | GenericKV[] | { keyspace: string } }): Promise<unknown> {
    const normalizedPermission = String(permission).trim().toLowerCase();
    const validPermissions = Object.values(ValidPermissions);

    if (!validPermissions.includes(normalizedPermission as ValidPermissions)) {
      throw new Error(`Invalid permission: ${permission}. Valid permissions are: ${validPermissions}`);
    }

    const query: RawQuery = {
      raw: ['revoke-from', 'owner', owner, 'permission', normalizedPermission, 'store', this.store!],
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

    return sendData(this.host!, this.port!, JSONbig.stringify(query), undefined, this.useTls, this.pool);
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
   *
   * An already-enrolled keyspace is not modified. Use
   * `reembedSemanticSearch` to change its model or field.
   */
  async enableSemanticSearch({ model, field, store, keyspace }: { model?: SemanticModel; field?: string; store?: string; keyspace?: string } = {}): Promise<unknown> {
    if (keyspace && !store) throw new Error('A store is required when keyspace is specified');
    const rawQuery: RawQuery = {
      raw: ['enable-semantic-search'],
      credentials: [this.username!, this.password!],
    };
    if (model) rawQuery.raw.push('model', model);
    if (field) rawQuery.raw.push('field', field);
    if (store) rawQuery.raw.push('store', store);
    if (keyspace) rawQuery.raw.push('keyspace', keyspace);

    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls, this.pool);
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
   *                                                when `store` is set. Use
   *                                                `reembedSemanticSearch` for
   *                                                model replacement.
   * @param {string} [options.store] - Restrict the disable to this store only.
   * @returns {Promise<unknown>} The server's response confirming the disable.
   */
  async disableSemanticSearch({ dropVectors = false, store, keyspace }: { dropVectors?: boolean; store?: string; keyspace?: string } = {}): Promise<unknown> {
    if (keyspace && !store) throw new Error('A store is required when keyspace is specified');
    const rawQuery: RawQuery = {
      raw: ['disable-semantic-search'],
      credentials: [this.username!, this.password!],
    };
    if (dropVectors) rawQuery.raw.push('drop-vectors');
    if (store) rawQuery.raw.push('store', store);
    if (keyspace) rawQuery.raw.push('keyspace', keyspace);

    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls, this.pool);
  }

  /** Read the actual global and per-keyspace semantic configuration. */
  async getSemanticStatus({ store, keyspace }: { store?: string; keyspace?: string } = {}): Promise<unknown> {
    if (keyspace && !store) throw new Error('A store is required when keyspace is specified');
    const raw = ['get-semantic-status'];
    if (store) raw.push('store', store);
    if (keyspace) raw.push('keyspace', keyspace);
    return this.executeRaw(raw);
  }

  /** Enroll a keyspace for vectors generated by an external embedding model. */
  async enablePrecomputedVectorSearch({
    store, keyspace, dimensions, embeddingSpace,
  }: {
    store: string; keyspace: string; dimensions: number; embeddingSpace: string;
  }): Promise<unknown> {
    if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 4096) {
      throw new Error('dimensions must be an integer between 1 and 4096');
    }
    if (!embeddingSpace || embeddingSpace.length > 128) {
      throw new Error('embeddingSpace must contain 1 to 128 characters');
    }
    return this.executeRaw([
      'enable-semantic-search', 'source', 'external',
      'dimensions', String(dimensions), 'embedding-space', embeddingSpace,
      'store', store, 'keyspace', keyspace,
    ]);
  }

  /**
   * Atomically drop one keyspace's old vectors, replace its semantic
   * configuration, and start a complete backfill.
   */
  async reembedSemanticSearch({
    model,
    field,
    store,
    keyspace,
  }: {
    model: SemanticModel;
    field?: string;
    store: string;
    keyspace: string;
  }): Promise<unknown> {
    const raw = ['reembed-semantic-search', 'model', model];
    if (field) raw.push('field', field);
    raw.push('store', store, 'keyspace', keyspace);
    return this.executeRaw(raw);
  }

  private executeRaw(raw: string[]): Promise<unknown> {
    const query: RawQuery = { raw, credentials: [this.username!, this.password!] };
    return sendData(this.host!, this.port!, JSONbig.stringify(query), undefined, this.useTls, this.pool);
  }

  async policyView({ owner, store }: { owner?: string; store?: string } = {}): Promise<unknown> {
    const raw = ['policy-view'];
    if (owner) raw.push('owner', owner);
    if (store) raw.push('store', store);
    return this.executeRaw(raw);
  }

  async policyHistory({ owner, store, keyspace }: { owner?: string; store?: string; keyspace?: string } = {}): Promise<unknown> {
    const raw = ['policy-history'];
    if (owner) raw.push('owner', owner);
    if (store) raw.push('store', store);
    if (keyspace) raw.push('keyspace', keyspace);
    return this.executeRaw(raw);
  }

  async policyExplain({ capability, store, owner, keyspace, keyspaceType, model }: { capability: PolicyCapability; store: string; owner?: string; keyspace?: string; keyspaceType?: PolicyKeyspaceType; model?: SemanticModel }): Promise<unknown> {
    if (keyspaceType && capability === PolicyCapability.MANAGE_SNAPSHOTS) {
      throw new TypeError('keyspaceType is not valid for manage-snapshots policies; snapshots are always in-memory');
    }
    if (model && capability !== PolicyCapability.PROVISION_KEYSPACE && capability !== PolicyCapability.MANAGE_SEMANTIC) {
      throw new TypeError('model is only valid for provision-keyspace or manage-semantic policies');
    }
    const raw = ['policy-explain', 'capability', capability, 'store', store];
    if (owner) raw.push('owner', owner);
    if (keyspace && capability !== PolicyCapability.PROVISION_KEYSPACE) raw.push('keyspace', keyspace);
    if (keyspaceType) raw.push('type', keyspaceType);
    if (model) raw.push('model', model);
    return this.executeRaw(raw);
  }

  private policyMutation(operation: string, { owner, capability, store, keyspace, types = [], models = [] }: { owner: string; capability: PolicyCapability; store: string; keyspace?: string; types?: PolicyKeyspaceType[]; models?: SemanticModel[] }): Promise<unknown> {
    if (types.length && capability === PolicyCapability.MANAGE_SNAPSHOTS) {
      throw new TypeError('types is not valid for manage-snapshots policies; snapshots are always in-memory');
    }
    if (models.length && capability !== PolicyCapability.PROVISION_KEYSPACE && capability !== PolicyCapability.MANAGE_SEMANTIC) {
      throw new TypeError('models is only valid for provision-keyspace or manage-semantic policies');
    }
    const raw = [operation, 'owner', owner, 'capability', capability, 'store', store];
    if (keyspace && capability !== PolicyCapability.PROVISION_KEYSPACE) raw.push('keyspace', keyspace);
    if (types.length) raw.push('types', ...types);
    if (models.length) raw.push('models', ...models);
    return this.executeRaw(raw);
  }

  policyGrant(options: { owner: string; capability: PolicyCapability; store: string; keyspace?: string; types?: PolicyKeyspaceType[]; models?: SemanticModel[] }): Promise<unknown> { return this.policyMutation('policy-grant', options); }
  policyRevoke(options: { owner: string; capability: PolicyCapability; store: string; keyspace?: string; types?: PolicyKeyspaceType[]; models?: SemanticModel[] }): Promise<unknown> { return this.policyMutation('policy-revoke', options); }
  policyDeny(options: { owner: string; capability: PolicyCapability; store: string; keyspace?: string; types?: PolicyKeyspaceType[]; models?: SemanticModel[] }): Promise<unknown> { return this.policyMutation('policy-deny', options); }
  policyRemoveDenial(options: { owner: string; capability: PolicyCapability; store: string; keyspace?: string; types?: PolicyKeyspaceType[]; models?: SemanticModel[] }): Promise<unknown> { return this.policyMutation('policy-remove-denial', options); }
  policyPreviewGrant(options: { owner: string; capability: PolicyCapability; store: string; keyspace?: string; types?: PolicyKeyspaceType[]; models?: SemanticModel[] }): Promise<unknown> { return this.policyMutation('policy-preview-grant', options); }
  policyPreviewRevoke(options: { owner: string; capability: PolicyCapability; store: string; keyspace?: string; types?: PolicyKeyspaceType[]; models?: SemanticModel[] }): Promise<unknown> { return this.policyMutation('policy-preview-revoke', options); }

  private policyManifest(operation: string, document: string, format: PolicyFormat = PolicyFormat.JSON): Promise<unknown> {
    return this.executeRaw([operation, 'format', format, 'document', document]);
  }

  policyValidate(document: string, format: PolicyFormat = PolicyFormat.JSON): Promise<unknown> { return this.policyManifest('policy-validate', document, format); }
  policyPlan(document: string, format: PolicyFormat = PolicyFormat.JSON): Promise<unknown> { return this.policyManifest('policy-plan', document, format); }
  policyApply(document: string, format: PolicyFormat = PolicyFormat.JSON): Promise<unknown> { return this.policyManifest('policy-apply', document, format); }
  policyExport(format: PolicyFormat = PolicyFormat.JSON): Promise<unknown> { return this.executeRaw(['policy-export', 'format', format]); }

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
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls, this.pool);
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
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls, this.pool);
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
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls, this.pool);
  }

  /** Internal helper for no-argument superowner raw commands. */
  private async _adminCommand(command: string): Promise<unknown> {
    const rawQuery: RawQuery = {
      raw: [command],
      credentials: [this.username!, this.password!],
    };
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls, this.pool);
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
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls, this.pool);
  }

  /**
   * Set how often the server scans for expired keys. Requires superowner credentials.
   * @param {number} rate - The check period in whole seconds (e.g. rate=10 → a scan
   *   every 10 seconds). Stored as-is, like the snapshot rate. Defaults to 1 second.
   * @returns {Promise<unknown>} The server's response confirming the change.
   */
  async setExpirationCheckRate(rate: number): Promise<unknown> {
    const rawQuery: RawQuery = {
      raw: ['expiration-check', String(rate)],
      credentials: [this.username!, this.password!],
    };
    return sendData(this.host!, this.port!, JSONbig.stringify(rawQuery), undefined, this.useTls, this.pool);
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
  poolConfig?: PoolConfig | null,
): Promise<unknown | SubscriptionHandle> {
  // Subscriptions are never pooled (contract §5): they are long-lived, stream
  // many responses to one request, and live on the `port + 1` subscription port.
  if (!isSubscriptionMessage(message)) {
    const pooled = await pooledRequest(host, port, message, useTls, poolConfig);
    if (pooled !== NOT_POOLED) return pooled;
  }

  return new Promise((resolve, _reject) => {
    let client: net.Socket | tls.TLSSocket;
    let response = "";
    const subscriptionMode = isSubscriptionMessage(message);
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

/** Sentinel meaning "pooling is off — fall through to the per-request path". */
const NOT_POOLED = Symbol('not-pooled');

const REQUEST_TIMEOUT_MS = 120000;

/** Open one connection and wrap it for pooling. */
function openPooled(
  host: string,
  port: number,
  useTls: boolean,
): Promise<PooledConnection> {
  return new Promise((resolve, reject) => {
    if (useTls) {
      const socket = tls.connect({ host, port, rejectUnauthorized: false }, () => {
        clearTimeout(handshake);
        resolve(new PooledConnection(socket));
      });
      const handshake = setTimeout(() => {
        socket.destroy();
        reject(new Error('TLS handshake timeout'));
      }, 10000);
      socket.once('error', (err) => {
        clearTimeout(handshake);
        reject(err);
      });
    } else {
      const socket = new net.Socket();
      socket.once('error', reject);
      socket.connect(port, host, () => {
        socket.removeListener('error', reject);
        resolve(new PooledConnection(socket));
      });
    }
  });
}

/**
 * Request/response over a pooled connection.
 *
 * Returns `NOT_POOLED` when pooling is disabled, so the caller falls through to
 * the original per-request implementation and behaviour is unchanged by default.
 *
 * Errors resolve as strings, matching what this client has always returned,
 * rather than rejecting — changing that would break every existing caller.
 */
async function pooledRequest(
  host: string,
  port: number,
  message: string,
  useTls: boolean,
  poolConfig: PoolConfig | undefined | null,
): Promise<unknown | typeof NOT_POOLED> {
  const pool = getPool(host, port, useTls, poolConfig);
  if (!pool) return NOT_POOLED;

  const leased = pool.checkout();
  if (leased) {
    try {
      const line = await leased.request(message, REQUEST_TIMEOUT_MS);
      pool.checkin(leased);
      return recursiveParseJSON(line);
    } catch (err) {
      leased.destroy();
      if (!(err instanceof WriteFailed)) {
        // Never retry a read failure: the engine may have applied the write and
        // only the response was lost. These commands are not idempotent and the
        // wire has no request IDs, so replaying would duplicate data (§4).
        return `Connection error: ${(err as Error).message}`;
      }
      // A write failure transmitted nothing, so replaying below is safe.
    }
  }

  let conn: PooledConnection;
  try {
    conn = await openPooled(host, port, useTls);
  } catch (err) {
    return `Connection error: ${(err as Error).message}`;
  }

  try {
    const line = await conn.request(message, REQUEST_TIMEOUT_MS);
    pool.checkin(conn);
    return recursiveParseJSON(line);
  } catch (err) {
    conn.destroy();
    return `Connection error: ${(err as Error).message}`;
  }
}

export function isSubscriptionMessage(message: string): boolean {
  try {
    const parsed = JSON.parse(message) as { subscribe?: unknown };
    return parsed?.subscribe === true;
  } catch {
    return false;
  }
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

export { Engine, EngineConfig, sendData, ValidPermissions, PolicyCapability, PolicyKeyspaceType, SemanticModel, PolicyFormat };
