/**
 * Certificate verification: what it accepts, what it refuses, what it leaves
 * alone.
 *
 * The fixtures are a real self-signed pair generated the way the engine's
 * `init-self-tls` generates one — same subject, same `localhost` /
 * `127.0.0.1` / `::1` SANs — so the handshake tests exercise the certificate
 * shape operators actually deploy, including the part that makes hostname
 * checking the wrong question to ask.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';

import { Engine, closeAllPools } from '../dist/index.js';
import { sendData } from '../dist/core/engine.js';
import { resolveTls } from '../dist/core/tls.js';

const FIXTURES = new URL('./fixtures/', import.meta.url);
const CERTIFICATE = new URL('cert.pem', FIXTURES).pathname;
const PRIVATE_KEY = new URL('key.pem', FIXTURES).pathname;
const OTHER_CERTIFICATE = new URL('other_cert.pem', FIXTURES).pathname;

function fingerprintOf(certificatePath) {
  const pem = fs.readFileSync(certificatePath, 'utf8');
  const body = pem
    .slice(
      pem.indexOf('-----BEGIN CERTIFICATE-----') + '-----BEGIN CERTIFICATE-----'.length,
      pem.indexOf('-----END CERTIFICATE-----'),
    )
    .replace(/\s/g, '');
  return crypto.createHash('sha256').update(Buffer.from(body, 'base64')).digest('hex');
}

/** One TLS listener answering one JSON line, the way the engine does. */
function engineLikeListener() {
  return new Promise((resolve) => {
    const server = tls.createServer(
      { cert: fs.readFileSync(CERTIFICATE), key: fs.readFileSync(PRIVATE_KEY) },
      (socket) => {
        socket.on('data', () => {
          socket.write('{"status":true,"payload":"ok","error":null}\n');
        });
        socket.on('error', () => {});
      },
    );
    server.on('tlsClientError', () => {});
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function engineFor(port, options = {}) {
  return new Engine({
    host: '127.0.0.1',
    port,
    username: 'user',
    password: 'password',
    useTls: true,
    ...options,
  });
}

// ---------------------------------------------------------------------------
// The default has to stay exactly where it was.
// ---------------------------------------------------------------------------

test('useTls on its own still means what it always meant', () => {
  // Every existing caller passes only `useTls`. Turning verification on for
  // them would break every deployment running the engine's own self-signed
  // certificate, which is every default deployment.
  const engine = engineFor(21210);

  assert.equal(engine.tls, null);
});

test('settings appear only when something was asked for', () => {
  const engine = engineFor(21210, { certificatePath: CERTIFICATE });

  assert.ok(engine.tls);
  assert.equal(engine.tls.pinned, true);
});

// ---------------------------------------------------------------------------
// Turning it on.
// ---------------------------------------------------------------------------

test('a pin implies verification', () => {
  // Nobody should have to pass two options to say one thing.
  const settings = resolveTls({ certificatePath: CERTIFICATE });

  assert.equal(settings.verification, true);
  assert.equal(settings.pinned, true);
});

test('verification without a pin defers to node', () => {
  // The proxy-with-a-real-certificate case: nothing to compare against, so the
  // ordinary rules apply — a chain to a trusted root, and a matching hostname.
  const settings = resolveTls({ certificateVerification: true });

  assert.equal(settings.pinned, false);
  assert.equal(settings.defersToNode, true);
});

test('a pin does not defer to node', () => {
  // The engine's certificate names localhost, 127.0.0.1 and ::1 only. An
  // operator pointing at a LAN address would fail hostname verification with
  // nothing actually wrong, and the comparison has already answered the
  // question that matters.
  assert.equal(resolveTls({ certificatePath: CERTIFICATE }).defersToNode, false);
});

test('a fingerprint is accepted in the shape openssl prints it', () => {
  const digest = fingerprintOf(CERTIFICATE);
  const colonSeparated = digest.match(/../g).join(':').toUpperCase();

  const settings = resolveTls({ certificateFingerprint: colonSeparated });

  assert.equal(settings.pinned, true);
  // Same certificate, whichever way it was named.
  assert.equal(settings.poolKey(), resolveTls({ certificatePath: CERTIFICATE }).poolKey());
});

test('a fingerprint that cannot be one is refused', () => {
  for (const value of ['', 'not-a-fingerprint', 'ab99cf', 'z'.repeat(64)]) {
    assert.throws(() => resolveTls({ certificateFingerprint: value }), TypeError, `accepted ${value}`);
  }
});

// ---------------------------------------------------------------------------
// Combinations that cannot mean anything.
// ---------------------------------------------------------------------------

test('a pin with verification switched off is a contradiction', () => {
  assert.throws(
    () => resolveTls({ certificateVerification: false, certificatePath: CERTIFICATE }),
    /contradicts/,
  );
});

test('verifying a plaintext connection is refused', () => {
  // Ignoring this quietly would leave someone believing a connection is checked
  // when it is not even encrypted.
  assert.throws(
    () =>
      new Engine({
        host: '127.0.0.1',
        port: 21210,
        username: 'user',
        password: 'password',
        certificatePath: CERTIFICATE,
      }),
    /requires TLS/,
  );
});

test('a fingerprint that disagrees with the file is refused', () => {
  assert.throws(
    () =>
      resolveTls({
        certificatePath: CERTIFICATE,
        certificateFingerprint: fingerprintOf(OTHER_CERTIFICATE),
      }),
    /does not match/,
  );
});

test('an unreadable certificate fails where it was configured', () => {
  assert.throws(
    () => resolveTls({ certificatePath: '/nonexistent/montycat/cert.pem' }),
    /could not read/,
  );
});

test('a file that is not a certificate is named as such', () => {
  const junk = path.join(os.tmpdir(), `montycat-not-a-cert-${process.pid}.pem`);
  fs.writeFileSync(junk, 'just some text\n');

  try {
    assert.throws(() => resolveTls({ certificatePath: junk }), /no PEM certificate/);
  } finally {
    fs.unlinkSync(junk);
  }
});

// ---------------------------------------------------------------------------
// Against a real listener.
// ---------------------------------------------------------------------------

test('the expected certificate completes a handshake', async () => {
  const { server, port } = await engineLikeListener();
  try {
    const engine = engineFor(port, { certificatePath: CERTIFICATE });
    const response = await engine.queueDepths();

    assert.equal(response.status, true);
  } finally {
    await closeAllPools();
    server.close();
  }
});

test('a different certificate is refused', async () => {
  const { server, port } = await engineLikeListener();
  try {
    const engine = engineFor(port, { certificatePath: OTHER_CERTIFICATE });
    const response = await engine.queueDepths();

    // Errors are returned rather than thrown on this client, which is what
    // every other connection failure does here too.
    assert.match(String(response), /not the expected one/);
    // The message has to name what actually arrived: a regenerated certificate
    // is the common cause, and the operator needs the new value to update the
    // pin.
    assert.match(String(response), new RegExp(fingerprintOf(CERTIFICATE)));
  } finally {
    await closeAllPools();
    server.close();
  }
});

test('a fingerprint pin reaches the same verdict as a file pin', async () => {
  const { server, port } = await engineLikeListener();
  try {
    const good = await engineFor(port, {
      certificateFingerprint: fingerprintOf(CERTIFICATE),
    }).queueDepths();
    assert.equal(good.status, true);

    const bad = await engineFor(port, {
      certificateFingerprint: fingerprintOf(OTHER_CERTIFICATE),
    }).queueDepths();
    assert.match(String(bad), /not the expected one/);
  } finally {
    await closeAllPools();
    server.close();
  }
});

test('an unverified connection still reaches a self-signed engine', async () => {
  // The default path, and the reason it is still the default.
  const { server, port } = await engineLikeListener();
  try {
    const response = await engineFor(port).queueDepths();

    assert.equal(response.status, true);
  } finally {
    await closeAllPools();
    server.close();
  }
});

test('a pin is enforced on pooled connections too', async () => {
  // Two code paths open sockets here. A pin enforced on one and forgotten on
  // the other would be worse than no pin, because it would look like it was
  // working.
  const { server, port } = await engineLikeListener();
  try {
    const engine = engineFor(port, {
      certificatePath: OTHER_CERTIFICATE,
      pool: { maxIdle: 4, idleTimeoutMs: 30000 },
    });

    const response = await engine.queueDepths();
    assert.match(String(response), /not the expected one/);
  } finally {
    await closeAllPools();
    server.close();
  }
});

test('a failed handshake settles instead of hanging forever', async () => {
  // Found against a live engine, not in a unit test. A handshake that fails
  // before `secureConnect` never reaches `finalizeConnect`, so no socket error
  // handler is attached and nothing else can settle the promise. Clearing the
  // handshake timer alone left the caller awaiting forever.
  //
  // Unreachable while `rejectUnauthorized` was hardcoded false; verifying a
  // self-signed engine reaches it on the first request.
  const { server, port } = await engineLikeListener();
  try {
    const engine = engineFor(port, { certificateVerification: true });

    const settled = await Promise.race([
      engine.queueDepths(),
      new Promise((resolve) => setTimeout(() => resolve('TIMED OUT'), 5000)),
    ]);

    assert.notEqual(settled, 'TIMED OUT', 'the request never settled');
  } finally {
    await closeAllPools();
    server.close();
  }
});

test('a failed handshake settles a subscription too', async () => {
  // The same hang, on the path that guards its resolve with `subscriptionMode`.
  // `finalizeConnect` is what hands a subscriber its `{ stop }` handle, and a
  // failed handshake never reaches it — so the subscriber waited forever.
  const { server, port } = await engineLikeListener();
  try {
    const engine = engineFor(port, { certificateVerification: true });
    const keyspace = { host: '127.0.0.1', port, useTls: true, tls: engine.tls, pool: null };

    const settled = await Promise.race([
      sendData(
        keyspace.host,
        keyspace.port,
        JSON.stringify({ subscribe: true, store: 's', keyspace: 'k' }),
        () => {},
        true,
        null,
        engine.tls,
      ),
      new Promise((resolve) => setTimeout(() => resolve('TIMED OUT'), 5000)),
    ]);

    assert.notEqual(settled, 'TIMED OUT', 'the subscription never settled');
  } finally {
    await closeAllPools();
    server.close();
  }
});

test('a wrong pin settles a subscription too', async () => {
  // A different door to the same hang, and the one the unit test above misses:
  // a pin rejection is not a handshake failure. The handshake *succeeds* —
  // verification is deliberately deferred until after it — so the rejection
  // lands in the post-handshake catch rather than on the socket's error event.
  // That catch had its own `subscriptionMode` guard. Found live.
  const { server, port } = await engineLikeListener();
  try {
    const engine = engineFor(port, { certificatePath: OTHER_CERTIFICATE });

    const settled = await Promise.race([
      sendData(
        '127.0.0.1',
        port,
        JSON.stringify({ subscribe: true, store: 's', keyspace: 'k' }),
        () => {},
        true,
        null,
        engine.tls,
      ),
      new Promise((resolve) => setTimeout(() => resolve('TIMED OUT'), 5000)),
    ]);

    assert.notEqual(settled, 'TIMED OUT', 'the subscription never settled');
    assert.match(String(settled), /not the expected one/);
  } finally {
    await closeAllPools();
    server.close();
  }
});

test('trust is part of the pool registry key', async () => {
  // A connection verified against a pinned certificate must never be handed to
  // a caller that asked for no verification.
  const { server, port } = await engineLikeListener();
  const pool = { maxIdle: 4, idleTimeoutMs: 30000 };
  try {
    const unverified = engineFor(port, { pool });
    assert.equal((await unverified.queueDepths()).status, true);

    // Same host and port, different trust. If they shared a pool, this would
    // reuse the unverified connection and quietly pass.
    const pinnedElsewhere = engineFor(port, {
      pool,
      certificatePath: OTHER_CERTIFICATE,
    });
    assert.match(String(await pinnedElsewhere.queueDepths()), /not the expected one/);
  } finally {
    await closeAllPools();
    server.close();
  }
});
