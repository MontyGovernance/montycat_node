/**
 * Connection pooling behaviour.
 *
 * Covers the required matrix in
 * `montycat_semantic/CLIENT_CONNECTION_POOLING_CONTRACT.md` §9. Stub servers
 * throughout; no live engine required.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';

import { Engine, closeAllPools } from '../dist/index.js';

const OK = '{"status":true,"payload":null,"error":null}\n';

/** A newline-framed stub that serves many requests per connection. */
function stubServer({ responder, closeAfter } = {}) {
  const state = { accepts: 0, port: 0 };
  const server = net.createServer((socket) => {
    const index = state.accepts++;
    let served = 0;
    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      let nl;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        buffer = buffer.slice(nl + 1);
        const body = responder ? responder(index, served) : OK;
        served++;
        if (body === null) {
          socket.destroy(); // die without responding
          return;
        }
        socket.write(body);
        if (closeAfter && served >= closeAfter(index)) {
          socket.end();
          return;
        }
      }
    });
    socket.on('error', () => {});
  });

  return {
    state,
    listen: () =>
      new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
          state.port = server.address().port;
          resolve();
        });
      }),
    close: () =>
      new Promise((resolve) => {
        // Destroy live sockets first: a pooled connection stays open by design,
        // so waiting on `close` alone would hang the test, not the client.
        closeAllPools();
        server.close(() => resolve());
        setTimeout(resolve, 200).unref?.();
      }),
  };
}

const engineFor = (port, pool) =>
  new Engine({
    host: '127.0.0.1',
    port,
    username: 'owner',
    password: 'secret',
    store: 'orders',
    pool,
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('pooling is off by default and opens a connection per request', async () => {
  const stub = stubServer();
  await stub.listen();
  try {
    const engine = engineFor(stub.state.port);
    for (let i = 0; i < 5; i++) await engine.listOwners();
    assert.equal(stub.state.accepts, 5, 'unpooled engine must not reuse connections');
  } finally {
    await stub.close();
  }
});

test('sequential requests reuse one pooled connection', async () => {
  const stub = stubServer();
  await stub.listen();
  try {
    const engine = engineFor(stub.state.port, {});
    for (let i = 0; i < 10; i++) await engine.listOwners();
    assert.equal(stub.state.accepts, 1, '10 requests should share one connection');
  } finally {
    await stub.close();
  }
});

test('every keyspace pointing at one server shares a pool', async () => {
  // The registry is keyed by (host, port, useTls), so two engines against the
  // same target reuse each other's connections.
  const stub = stubServer();
  await stub.listen();
  try {
    const a = engineFor(stub.state.port, {});
    const b = engineFor(stub.state.port, {});
    await a.listOwners();
    await b.listOwners();
    assert.equal(stub.state.accepts, 1, 'the second engine opened its own connection');
  } finally {
    await stub.close();
  }
});

test('idle connections never exceed maxIdle', async () => {
  const stub = stubServer();
  await stub.listen();
  try {
    const engine = engineFor(stub.state.port, { maxIdle: 2 });
    // Concurrency forces several live connections; only maxIdle may be kept.
    await Promise.all(Array.from({ length: 8 }, () => engine.listOwners()));
    // Nothing observable exceeds the bound: a further burst must not grow it.
    await Promise.all(Array.from({ length: 8 }, () => engine.listOwners()));
    assert.ok(stub.state.accepts >= 2, 'expected concurrency to open several connections');
  } finally {
    await stub.close();
  }
});

test('connections older than the idle timeout are discarded', async () => {
  const stub = stubServer();
  await stub.listen();
  try {
    const engine = engineFor(stub.state.port, { idleTimeoutMs: 50 });
    await engine.listOwners();
    assert.equal(stub.state.accepts, 1);
    await sleep(120);
    await engine.listOwners();
    assert.equal(stub.state.accepts, 2, 'an expired connection was reused');
  } finally {
    await stub.close();
  }
});

test('a server-closed idle connection is replaced without replaying the request', async () => {
  // The stale-socket case. The mechanism is not a failing write — writing to a
  // peer-closed socket normally succeeds. Node surfaces the close as an `end`
  // event, so the connection is known dead before it is handed out again.
  const stub = stubServer({ closeAfter: (i) => (i === 0 ? 1 : Infinity) });
  await stub.listen();
  try {
    const engine = engineFor(stub.state.port, {});
    const first = await engine.listOwners();
    assert.equal(first.status, true);

    await sleep(80); // let the close land

    const second = await engine.listOwners();
    assert.equal(second.status, true, `stale connection not replaced cleanly: ${JSON.stringify(second)}`);
    assert.equal(stub.state.accepts, 2, 'expected exactly one fresh connection');
  } finally {
    await stub.close();
  }
});

test('a read failure is returned and never retried', async () => {
  // The rule whose violation duplicates user data: the engine may have applied
  // the write already and only the response was lost.
  const stub = stubServer({ responder: () => null });
  await stub.listen();
  try {
    const engine = engineFor(stub.state.port, {});
    const result = await engine.listOwners();
    assert.equal(stub.state.accepts, 1, 'a read-phase failure was retried — §4 forbids it');
    assert.equal(typeof result, 'string', 'EOF before a response must not look like success');
  } finally {
    await stub.close();
  }
});

test('no bytes leak between two requests on one pooled connection', async () => {
  const stub = stubServer({
    responder: (_i, served) => `{"status":true,"payload":"response-${served}"}\n`,
  });
  await stub.listen();
  try {
    const engine = engineFor(stub.state.port, {});
    const first = await engine.listOwners();
    const second = await engine.listOwners();
    assert.equal(stub.state.accepts, 1, 'the requests did not share a connection');
    assert.equal(first.payload, 'response-0');
    assert.equal(second.payload, 'response-1');
  } finally {
    await stub.close();
  }
});

test('two frames arriving in one write do not merge, and desync the connection out of the pool', async () => {
  // A reader that stops when its buffer merely contains a newline would swallow
  // frame two into frame one — on a pooled connection that is the next caller's
  // response. The first response must be exactly the first frame.
  //
  // The leftover frame is then *not* served to the next caller. In a strict
  // request/response protocol the client has not sent request N+1 yet, so bytes
  // sitting in the buffer mean the stream desynchronised. `isHealthy` rejects
  // such a connection and a fresh one is opened, rather than handing a caller a
  // response to a request it never made.
  const stub = stubServer({
    responder: (_i, served) =>
      served === 0
        ? '{"status":true,"payload":"first"}\n{"status":true,"payload":"second"}\n'
        : '{"status":true,"payload":"third"}\n',
  });
  await stub.listen();
  try {
    const engine = engineFor(stub.state.port, {});
    const first = await engine.listOwners();
    assert.equal(first.payload, 'first', 'the following frame leaked into this response');

    const second = await engine.listOwners();
    assert.equal(
      stub.state.accepts,
      2,
      'a desynchronised connection was returned to the pool and reused',
    );
    assert.equal(second.payload, 'first', 'expected a clean exchange on the fresh connection');
  } finally {
    await stub.close();
  }
});

test('a heavily fragmented large response is reassembled', async () => {
  const filler = 'x'.repeat(17 * 1024 * 1024);
  const stub = stubServer({ responder: () => `{"status":true,"payload":"${filler}"}\n` });
  await stub.listen();
  try {
    for (const [mode, pool] of [['direct', undefined], ['pooled', {}]]) {
      const engine = engineFor(stub.state.port, pool);
      const result = await engine.listOwners();
      assert.equal(
        result.payload.length,
        filler.length,
        `${mode} large response was truncated`,
      );
    }
  } finally {
    await stub.close();
  }
});

test('closeAllPools drains idle connections', async () => {
  const stub = stubServer();
  await stub.listen();
  try {
    const engine = engineFor(stub.state.port, {});
    await engine.listOwners();
    closeAllPools();
    // A fresh pool means the next request must reconnect.
    await engine.listOwners();
    assert.equal(stub.state.accepts, 2, 'closeAllPools left a connection in use');
  } finally {
    await stub.close();
  }
});
