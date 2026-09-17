# Changelog

## 1.3.4 - 2026-09-10

### Added

- **Optional certificate verification.** `useTls` encrypts but does not check
  who answers — the client set `rejectUnauthorized: false` unconditionally, so
  an active attacker in the path could present its own certificate and read
  every request, credentials included. `Engine` now accepts three new options:

  - `certificatePath` — the engine's certificate, copied to the client host.
    The certificate presented must match it byte for byte.
  - `certificateFingerprint` — its SHA-256 digest, for deployments that would
    rather pass a string than ship a file. Read one with
    `openssl x509 -in server.crt -noout -fingerprint -sha256`.
  - `certificateVerification` — verify against Node's trust store with ordinary
    hostname checking, for an engine behind a proxy holding a CA-issued
    certificate.

  Either pin implies verification, so one option says one thing. Both skip
  hostname checking: the engine's self-signed certificate names only
  `localhost`, `127.0.0.1` and `::1` unless regenerated with
  `init-self-tls dns/ip`, and comparing the certificate already answers
  identity exactly. A pin is checked after the handshake rather than through
  `rejectUnauthorized`, which answers "does this chain to a trusted root" — a
  question a CA-signed impostor would pass.

  The check runs on both socket paths, the per-request one and the pooled one,
  and fails before any request byte is written. Following this client's
  convention the failure is returned as an error string rather than thrown, and
  names the fingerprint that arrived.

  `TlsSettings` and `TlsVerificationError` are exported.

- `Engine.fromUri` accepts a third argument carrying `useTls` and the
  verification options, rather than always starting in plaintext.

### Fixed

- `updateBulk` now extracts the schema from serialized schema values and sends
  it as request metadata, matching `insertBulk`. Nested `timestamps` metadata
  is preserved, keeping updated rows registered in timestamp indexes.
- Bulk update preparation no longer mutates caller-owned objects and rejects a
  batch containing multiple schema names.

- **A failed TLS handshake no longer hangs the caller forever.** The handshake
  error listener cleared its own timeout without settling the promise, and a
  handshake that fails before `secureConnect` never reaches the code that
  attaches a socket error handler — so nothing could resolve it. Latent while
  `rejectUnauthorized` was hardcoded false; verifying a self-signed engine hits
  it on the first request. Found against a live engine, not in a unit test.

  Subscriptions were affected the same way and are fixed with it. Three sites
  skipped their `resolve` in subscription mode — the handshake timeout, the
  handshake error, and the certificate check that runs after a *successful*
  handshake — while `finalizeConnect`, the only other thing that settles a
  subscription, is never reached in any of those cases. A subscriber now
  receives a `Connection error: ...` string rather than waiting forever.

  The guards that remain on `onEnd`, `onError` and `onTimeout` are correct and
  untouched: those handlers are attached only after `finalizeConnect`, by which
  point a subscription already holds its handle.

### Changed

- Connection pools are keyed by the whole TLS configuration rather than by an
  on/off flag. A connection verified against a pinned certificate is never
  handed to a caller that asked for different trust, or for none.
- `getPool` takes the resolved TLS settings as a new fourth argument. Internal
  to the package; it is not exported from `montycat`.

### Unchanged

- **`certificateVerification` defaults to off.** Existing TLS deployments keep
  working exactly as before — turning verification on by default would break
  every engine running its own self-signed certificate.


## 1.3.3 - 2026-09-02

- Added the exported `SearchMode` enum, `searchKeys`, and `searchValues`, with optional
  metadata filters. Existing `semanticSearch*` methods are deprecated
  semantic-only wrappers with unchanged signatures and behavior. Keyword and
  hybrid modes use compatibility-safe commands; current engines normalize
  hybrid RRF scores to `[0, 1]`.

### Documentation

- Clarify score semantics: hybrid RRF is bounded to `[0, 1]`, while raw BM25
  keyword scores are unbounded and should only be compared within the same
  query and search mode.

## 1.3.2 - 2026-08-15

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
