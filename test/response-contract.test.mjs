import assert from 'node:assert/strict';
import net from 'node:net';
import test from 'node:test';

import {
  Engine,
  PolicyCapability,
  PolicyKeyspaceType,
  SemanticModel,
  isSubscriptionMessage,
  sendData,
} from '../dist/core/engine.js';

async function responseFromServer(response) {
  const server = net.createServer((socket) => {
    socket.once('data', () => socket.end(`${JSON.stringify(response)}\n`));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    return await sendData('127.0.0.1', address.port, '{}');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('preserves governance denial details from the server', async () => {
  const error = "Governance permission denied: capability 'manage-schema' on store 'orders', keyspace 'events'";
  assert.deepEqual(await responseFromServer({ status: false, payload: null, error }), {
    status: false,
    payload: null,
    error,
  });
});

test('preserves creator revocations in policy views', async () => {
  const response = await responseFromServer({
    status: true,
    payload: { owned_keyspaces: [{ revoked_creator_capabilities: ['manage-schema'] }] },
    error: null,
  });
  assert.deepEqual(response.payload.owned_keyspaces[0].revoked_creator_capabilities, ['manage-schema']);
});

test('only the explicit subscribe field enables subscription mode', () => {
  assert.equal(isSubscriptionMessage(JSON.stringify({ subscribe: true })), true);
  assert.equal(isSubscriptionMessage(JSON.stringify({ value: { subscribed: true } })), false);
  assert.equal(isSubscriptionMessage(JSON.stringify({ note: 'subscribe later' })), false);
});

test('policy qualifiers are restricted to their matching capabilities', async () => {
  const engine = new Engine();

  assert.throws(
    () => engine.policyGrant({
      owner: 'alice',
      capability: PolicyCapability.MANAGE_SCHEMA,
      store: 'catalog',
      models: [SemanticModel.BGE_SMALL],
    }),
    /models.*manage-semantic/,
  );
  assert.throws(
    () => engine.policyGrant({
      owner: 'alice',
      capability: PolicyCapability.MANAGE_SNAPSHOTS,
      store: 'catalog',
      types: [PolicyKeyspaceType.PERSISTENT],
    }),
    /types.*manage-snapshots/,
  );
  await assert.rejects(
    engine.policyExplain({
      capability: PolicyCapability.MANAGE_SCHEMA,
      store: 'catalog',
      model: SemanticModel.BGE_SMALL,
    }),
    /model.*manage-semantic/,
  );
});
