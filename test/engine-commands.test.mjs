import assert from 'node:assert/strict';
import net from 'node:net';
import test from 'node:test';

import {
  Engine,
  PolicyCapability,
  PolicyFormat,
  PolicyKeyspaceType,
  SemanticModel,
  ValidPermissions,
} from '../dist/core/engine.js';

async function withCapture(run) {
  const commands = [];
  const server = net.createServer((socket) => {
    socket.once('data', (data) => {
      commands.push(JSON.parse(data.toString().trim()));
      socket.end('{"status":true}\n');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const engine = new Engine({
      host: '127.0.0.1',
      port,
      username: 'owner',
      password: 'secret',
      store: 'orders',
    });
    await run(engine);
    return commands;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('parses valid URIs and rejects malformed URIs', () => {
  const engine = Engine.fromUri('montycat://alice:secret@db.example:12777/orders');
  assert.ok(engine);
  assert.ok(Engine.fromUri('montycat://alice:secret@db.example:12777'));

  for (const uri of [
    'https://alice:secret@db.example:12777',
    'montycat://db.example:12777',
    'montycat://alice:secret@db.example:not-a-port',
  ]) {
    assert.throws(() => Engine.fromUri(uri));
  }
});

test('builds store, owner, access, and semantic commands', async () => {
  const commands = await withCapture(async (engine) => {
    await engine.createStore();
    await engine.removeStore();
    await engine.createOwner({ owner: 'alice', password: 'pw' });
    await engine.removeOwner({ owner: 'alice' });
    await engine.listOwners();
    await engine.grantTo({
      owner: 'alice',
      permission: ValidPermissions.READ,
      keyspaces: ['events', { keyspace: 'users' }],
    });
    await engine.revokeFrom({
      owner: 'alice',
      permission: ValidPermissions.WRITE,
      keyspaces: 'events',
    });
    await engine.enableSemanticSearch({
      model: SemanticModel.BGE_SMALL,
      field: 'body',
      store: 'catalog',
      keyspace: 'products',
    });
    await engine.disableSemanticSearch({
      dropVectors: true,
      store: 'catalog',
      keyspace: 'products',
    });
    await engine.getSemanticStatus({ store: 'catalog', keyspace: 'products' });
    await engine.reembedSemanticSearch({
      model: SemanticModel.BGE_BASE,
      field: 'description',
      store: 'catalog',
      keyspace: 'products',
    });
  });

  assert.deepEqual(commands.map(({ raw }) => raw), [
    ['create-store', 'store', 'orders'],
    ['remove-store', 'store', 'orders'],
    ['create-owner', 'username', 'alice', 'password', 'pw'],
    ['remove-owner', 'username', 'alice'],
    ['list-owners'],
    ['grant-to', 'owner', 'alice', 'permission', 'read', 'store', 'orders', 'keyspaces', 'events', 'users'],
    ['revoke-from', 'owner', 'alice', 'permission', 'write', 'store', 'orders', 'keyspaces', 'events'],
    ['enable-semantic-search', 'model', 'bge-small', 'field', 'body', 'store', 'catalog', 'keyspace', 'products'],
    ['disable-semantic-search', 'drop-vectors', 'store', 'catalog', 'keyspace', 'products'],
    ['get-semantic-status', 'store', 'catalog', 'keyspace', 'products'],
    ['reembed-semantic-search', 'model', 'bge-base', 'field', 'description', 'store', 'catalog', 'keyspace', 'products'],
  ]);
  assert.deepEqual(commands[0].credentials, ['owner', 'secret']);

  const engine = new Engine();
  await assert.rejects(
    engine.enableSemanticSearch({ keyspace: 'products' }),
    /store is required/,
  );
  await assert.rejects(
    engine.disableSemanticSearch({ keyspace: 'products' }),
    /store is required/,
  );
  await assert.rejects(
    engine.getSemanticStatus({ keyspace: 'products' }),
    /store is required/,
  );
  await assert.rejects(
    engine.grantTo({ owner: 'alice', permission: 'admin' }),
    /Invalid permission/,
  );
});

test('builds governance read, mutation, and manifest commands', async () => {
  const commands = await withCapture(async (engine) => {
    await engine.policyView({ owner: 'alice', store: 'catalog' });
    await engine.policyHistory({ owner: 'alice', store: 'catalog', keyspace: 'products' });
    await engine.policyExplain({
      capability: PolicyCapability.MANAGE_SEMANTIC,
      store: 'catalog',
      owner: 'alice',
      keyspace: 'products',
      keyspaceType: PolicyKeyspaceType.PERSISTENT,
      model: SemanticModel.BGE_SMALL,
    });
    const options = {
      owner: 'alice',
      capability: PolicyCapability.PROVISION_KEYSPACE,
      store: 'catalog',
      keyspace: 'ignored-for-provision',
      types: [PolicyKeyspaceType.PERSISTENT],
      models: [SemanticModel.BGE_SMALL],
    };
    await engine.policyGrant(options);
    await engine.policyRevoke(options);
    await engine.policyDeny(options);
    await engine.policyRemoveDenial(options);
    await engine.policyPreviewGrant(options);
    await engine.policyPreviewRevoke(options);
    await engine.policyValidate('rules: []', PolicyFormat.YAML);
    await engine.policyPlan('rules: []', PolicyFormat.YAML);
    await engine.policyApply('rules: []', PolicyFormat.YAML);
    await engine.policyExport(PolicyFormat.YML);
  });

  assert.deepEqual(commands[0].raw, ['policy-view', 'owner', 'alice', 'store', 'catalog']);
  assert.deepEqual(commands[1].raw, [
    'policy-history', 'owner', 'alice', 'store', 'catalog', 'keyspace', 'products',
  ]);
  assert.deepEqual(commands[2].raw, [
    'policy-explain', 'capability', 'manage-semantic', 'store', 'catalog',
    'owner', 'alice', 'keyspace', 'products', 'type', 'persistent',
    'model', 'bge-small',
  ]);
  const mutationOperations = [
    'policy-grant',
    'policy-revoke',
    'policy-deny',
    'policy-remove-denial',
    'policy-preview-grant',
    'policy-preview-revoke',
  ];
  for (const [index, operation] of mutationOperations.entries()) {
    assert.deepEqual(commands[index + 3].raw, [
      operation, 'owner', 'alice', 'capability', 'provision-keyspace',
      'store', 'catalog', 'types', 'persistent', 'models', 'bge-small',
    ]);
  }
  assert.deepEqual(commands.slice(9).map(({ raw }) => raw), [
    ['policy-validate', 'format', 'yaml', 'document', 'rules: []'],
    ['policy-plan', 'format', 'yaml', 'document', 'rules: []'],
    ['policy-apply', 'format', 'yaml', 'document', 'rules: []'],
    ['policy-export', 'format', 'yml'],
  ]);
});

test('builds operator commands', async () => {
  const commands = await withCapture(async (engine) => {
    await engine.getStructureAvailable();
    await engine.enableWaitForIndex();
    await engine.disableWaitForIndex();
    await engine.enableReports();
    await engine.disableReports();
    await engine.allowSubscriptions();
    await engine.restrictSubscriptions();
    await engine.queueDepths();
    await engine.setSnapshotRate(5);
    await engine.setExpirationCheckRate(10);
  });
  assert.deepEqual(commands.map(({ raw }) => raw), [
    ['get-structure-available', 'store', 'orders'],
    ['enable-wait-for-index'],
    ['disable-wait-for-index'],
    ['enable-reports'],
    ['disable-reports'],
    ['allow-subscriptions'],
    ['restrict-subscriptions'],
    ['queue-depths'],
    ['snapshot-rate', '5'],
    ['expiration-check', '10'],
  ]);
});
