# Changelog

## Unreleased

- Add the exported `ResultOrder` type and optional ordering to key-range, bulk, and lookup reads.

## 1.3.1

Large-response performance fix. Upgrading requires no code changes.

### Fixed

- Large newline-framed responses now retain socket chunks and join them only
  once per completed frame. This avoids repeatedly copying the entire response
  as it grows in direct, pooled, and subscription modes.

## 1.3.0

Opt-in connection pooling. Additive — upgrading needs no code changes, and
behavior is unchanged until you enable it.

### Added

- **Opt-in connection pooling.** Every request previously opened a TCP
  connection, sent one request, read one response, and closed. Reuse removes the
  handshake from every call after the first:

  ```typescript
  import { Engine, closeAllPools } from 'montycat';

  const engine = new Engine({
    host: '127.0.0.1', port: 21210, username: 'user', password: 'password',
    store: 'Company',
    pool: {},                   // the only new field; omit for today's behavior
  });

  Sales.connectEngine(engine);
  await Sales.insertValue({ value: newSale });   // unchanged

  closeAllPools();              // before exit
  ```

  Pools live in a module-level registry keyed by `(host, port, useTls)`, so every
  keyspace class pointing at one server shares a single pool. `connectEngine` is
  `Object.assign`, which would have propagated a pool reference by accident; the
  config is now copied explicitly instead, and `connectEngine`'s parameter is no
  longer typed `any`. `useTls` is part of the key because a plaintext and a TLS
  connection to one address are not interchangeable.

  Disabled by default: an idle pooled connection still holds one of the engine's
  connection permits, so the bound is conservative (`maxIdle: 8`,
  `idleTimeoutMs: 30000`). Subscriptions are never pooled. A connection is held
  exclusively for one request/response, so concurrent calls each get their own
  rather than interleaving writes on one socket.

  Exported `closeAllPools` and the `PoolConfig` type from the package root.

- **Precomputed vectors.** Vectors produced elsewhere — another model, a batch
  pipeline, an existing embedding store — can now be supplied directly, and the
  server skips embedding entirely. Requires a Montycat Semantic server 1.3.0 or
  newer.

  Writes take an optional `vector`, applied after the write succeeds:

  ```ts
  await Docs.insertValue({
    value: { text: 'a document' },
    vector: myEmbedding,          // number[], omit for server-side embedding
  });
  ```

  Available on `insertValue`, `insertCustomKeyValue`, and `updateValue` for both
  in-memory and persistent keyspaces. `insertBulk` takes `vectors: number[][]`,
  paired with `bulk` **by position**; `updateBulk` takes `vectors` for numeric
  keys and `customVectors` for custom keys.

  Search takes an optional query `vector`, which bypasses text embedding. The
  query string may be empty when one is supplied:

  ```ts
  await Docs.semanticSearchGetValues({ query: '', vector: myQueryEmbedding });
  ```

  Available on `semanticSearchGetKeys`, `semanticSearchGetKeysWhere`,
  `semanticSearchGetValues`, and `semanticSearchGetValuesWhere`.

  Dimensions must match the keyspace's enrolled model; the server validates
  before anything reaches the index. A supplied vector is not overwritten by
  background embedding — a later ordinary write to the same item clears that
  protection and re-embeds from text.

### Changed

- **The response reader no longer re-splits an accumulating string.** It
  previously did `response += data.toString()` followed by `response.split("\n")`
  on every `data` event, which is O(n²) on a large response. Pooled connections
  use a `Buffer` accumulator that scans only newly-arrived bytes for the
  delimiter.

  The retained-remainder behaviour that made the old reader pooling-safe is
  preserved, and now lives *with the connection* rather than in a per-request
  closure — a response's trailing bytes belong to the next response, and
  discarding them when the call returned would have corrupted it.

- The per-request 120s timeout no longer rides on `socket.setTimeout`, so it
  cannot fire against a pooled socket sitting idle between requests.

## 1.2.2

Adds a way to read the server's real semantic configuration, and a safe way to
change an enrolled keyspace's embedding model. Additive — upgrading from 1.2.1
requires no code changes.

### Added

- `Engine.getSemanticStatus({ store, keyspace })` returns the server's actual
  semantic settings rather than what the caller assumed: the DB-wide switch and
  default model, plus each enrolled keyspace's model, dimensions, field,
  storage type, and whether a backfill is still pending.
- `Engine.reembedSemanticSearch({ model, field, store, keyspace })` atomically
  drops one keyspace's vectors, records the new configuration, and starts a
  complete backfill. It reports the previous model alongside the new one, so a
  caller can confirm what it replaced.

### Changed

- Documented that `enableSemanticSearch` leaves an already-enrolled keyspace
  alone. It was never a way to switch models; `reembedSemanticSearch` is.
  Behavior is unchanged — only the documentation was misleading.
- Corrected the `disableSemanticSearch` docs: `dropVectors` is not "required
  before switching to a different embedding model". Use
  `reembedSemanticSearch`, which does not leave the keyspace unsearchable in
  between.

## 1.2.1

Documentation and CI only — no library code changed, so upgrading from 1.2.0 is
optional.

### Added

- README sections for behavior that was previously undocumented: response shape
  (`{status, payload, error}` and u128 keys arriving as strings), real-time
  subscriptions with the `stop()` handle and the `port + 1` subscription port,
  TLS via `useTls`, and owner/access management with `createOwner`, `grantTo`,
  `revokeFrom`, and `ValidPermissions`.
- `ci.yml` workflow building and running the test suite on Linux and macOS
  against Node 18, 20, 22, and 24.
- Changelog link in the README.

### Changed

- The publish workflow now runs `npm test` before publishing to npm.

## 1.2.0

### Added

- Data-mesh governance policy APIs on `Engine`:
  - inspection: `policyView`, `policyHistory`, `policyExplain`, `policyExport`
  - mutation: `policyGrant`, `policyRevoke`, `policyDeny`, `policyRemoveDenial`
  - dry runs: `policyPreviewGrant`, `policyPreviewRevoke`
  - manifests: `policyValidate`, `policyPlan`, `policyApply`
- `PolicyCapability`, `PolicyKeyspaceType`, `SemanticModel`, and `PolicyFormat`,
  exported from the package root.
- Keyspace-scoped semantic enrollment and removal through `keyspace` on
  `enableSemanticSearch` and `disableSemanticSearch`.

### Changed

- Governance qualifiers are validated client-side before sending a command:
  - semantic models apply to `PROVISION_KEYSPACE` and `MANAGE_SEMANTIC`
  - storage types apply to `PROVISION_KEYSPACE`, `REMOVE_KEYSPACE`, `MANAGE_SCHEMA`,
    `MANAGE_ACCESS`, and `MANAGE_SEMANTIC`; `MANAGE_SNAPSHOTS` is always in-memory
- `PROVISION_KEYSPACE` is treated as a store-level capability, so its policy commands
  omit `keyspace`.
