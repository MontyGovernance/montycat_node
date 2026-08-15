import assert from 'node:assert/strict';
import test from 'node:test';

import GenericKV from '../dist/classes/generic.js';
import { Field, Pointer, Schema, Timestamp } from '../dist/core/schema.js';
import {
  convertCustomKey,
  convertCustomKeys,
  convertCustomKeysValues,
  convertToBinaryQuery,
  processBulkKeysValues,
} from '../dist/functions/storeGenericFunctions.js';

const keyspace = { keyspace: 'events' };

test('serializes schemas, pointers, timestamps, and fields', () => {
  class Event extends Schema {}
  const event = new Event({
    name: 'launch',
    parent: new Pointer({ keyspace, key: 7 }),
    createdAt: new Timestamp({ timestamp: '2026-01-01T00:00:00Z' }),
  });
  assert.deepEqual(event.serialize(), {
    name: 'launch',
    pointers: { parent: ['events', '7'] },
    timestamps: { createdAt: '2026-01-01T00:00:00Z' },
    schema: 'Event',
  });

  assert.equal(new Timestamp.after(10).after_timestamp, 10);
  assert.equal(new Timestamp.before(20).before_timestamp, 20);
  assert.deepEqual(
    new Timestamp.range({ startTimestamp: 'a', endTimestamp: 'b' }).range_timestamp,
    ['a', 'b'],
  );
  assert.equal(new Field('String', true).getType(), 'String');
  assert.equal(new Field('String', true).getNullable(), true);
  assert.throws(
    () => new Pointer({ keyspace }).setupPointer(),
    /Pointer is not valid/,
  );
});

test('hashes custom keys consistently', () => {
  assert.deepEqual(
    convertCustomKeys(['alpha', 'beta']),
    [convertCustomKey('alpha'), convertCustomKey('beta')],
  );
  assert.deepEqual(convertCustomKeysValues({ alpha: 1 }), {
    [convertCustomKey('alpha')]: 1,
  });
});

test('serializes store queries and optional semantic fields', () => {
  const queryClass = {
    username: 'owner',
    password: 'secret',
    namespace: 'default',
    store: 'orders',
    keyspace: 'events',
    persistent: true,
    distributed: false,
    command: 'semantic_search',
  };
  const query = JSON.parse(convertToBinaryQuery(queryClass, {
    key: '7',
    value: {
      schema: 'Event',
      parent: new Pointer({ keyspace, customKey: 'root' }),
      createdAt: new Timestamp({ timestamp: 'now' }),
    },
    bulkKeys: ['1', '2'],
    semanticQuery: 'launch',
    minScore: 0.7,
    semanticFilter: {
      parent: new Pointer({ keyspace, key: 'root' }),
      active: true,
    },
    semanticVector: [0.1, 0.2],
    semanticVectors: { 7: [0.3, 0.4] },
    semanticVectorList: [[0.5, 0.6]],
    waitForIndex: true,
    order: 'ascending',
  }));

  assert.equal(query.schema, 'Event');
  assert.equal(query.search_criteria, 'launch');
  assert.equal(query.min_score, 0.7);
  assert.equal(query.wait_for_index, true);
  assert.equal(query.order, 'ascending');
  assert.deepEqual(query.semantic_vector, [0.1, 0.2]);
  assert.deepEqual(query.semantic_vectors, { 7: [0.3, 0.4] });
  assert.deepEqual(query.semantic_vector_list, [[0.5, 0.6]]);
  assert.deepEqual(JSON.parse(query.value), {
    parent: ['events', convertCustomKey('root')],
    createdAt: 'now',
  });
  assert.deepEqual(JSON.parse(query.semantic_filter), {
    pointers: { parent: ['events', 'root'] },
    active: true,
  });
});

test('processes bulk key values and rejects mixed bulk schemas', () => {
  assert.deepEqual(
    processBulkKeysValues({
      alpha: { updatedAt: new Timestamp({ timestamp: 'now' }) },
      7: new Pointer({ keyspace, key: 'root' }),
    }),
    {
      [convertCustomKey('alpha')]: '{"updatedAt":"now"}',
      7: '["events","root"]',
    },
  );

  assert.throws(
    () => convertToBinaryQuery({}, {
      bulkValues: [
        { schema: 'One', value: 1 },
        { schema: 'Two', value: 2 },
        { schema: 'Three', value: 3 },
      ],
    }),
    /same schema/,
  );
});

test('GenericKV rejects ambiguous and incomplete requests before networking', async () => {
  await assert.rejects(
    GenericKV.getValue({ key: '1', customKey: 'one' }),
    /either 'key' or 'customKey', not both/,
  );
  await assert.rejects(GenericKV.getValue(), /Provide either/);
  await assert.rejects(GenericKV.deleteKey(), /No key provided/);
  await assert.rejects(GenericKV.deleteBulk(), /No keys provided/);
  await assert.rejects(GenericKV.updateBulk(), /No keys provided/);
  await assert.rejects(GenericKV.getBulk(), /provide keys or volumes/);
  await assert.rejects(
    GenericKV.semanticSearchGetKeys({ query: '   ' }),
    /No query text/,
  );
  await assert.rejects(
    GenericKV.semanticSearchGetKeys({ query: '', vector: [] }),
    /finite numbers/,
  );
  await assert.rejects(
    GenericKV.semanticSearchGetKeys({ query: '', vector: [Number.NaN] }),
    /finite numbers/,
  );
  await assert.rejects(
    GenericKV.semanticSearchGetKeysWhere({ query: 'launch', filters: {} }),
    /No filters provided/,
  );
  await assert.rejects(
    GenericKV.semanticSearchGetValuesWhere({ query: 'launch', filters: {} }),
    /No filters provided/,
  );
  await assert.rejects(
    GenericKV.subscribe({ key: '1', customKey: 'one' }),
    /either 'key' or 'customKey', not both/,
  );
  await assert.rejects(GenericKV.enforceSchema({}), /metadata/);
  await assert.rejects(GenericKV.removeEnforcedSchema(null), /must be provided/);
});
