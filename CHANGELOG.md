# Changelog

## 1.2.2 - 2026-07-31

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

## 1.2.1 - 2026-07-29

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

## 1.2.0 - 2026-07-28

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
