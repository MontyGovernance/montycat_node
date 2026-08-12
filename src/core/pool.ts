/**
 * Connection pooling for request/response traffic.
 *
 * Implements the client half of
 * `montycat_semantic/CLIENT_CONNECTION_POOLING_CONTRACT.md`. The rules that
 * shape this module:
 *
 * - **§3** — pooling by `(host, port, tls)` is safe: credentials travel in every
 *   request payload and the engine re-authenticates per request, so a pooled
 *   connection carries no identity and may serve different users.
 * - **§4** — never replay a request after a read failure; the engine may have
 *   applied it already. Stale connections are caught before use, not by waiting
 *   for a write to fail.
 * - **§5** — subscriptions are never pooled.
 * - **§6** — pooling is opt-in and bounded; an idle pooled connection still
 *   holds a server permit.
 * - **§7** — the leftover bytes after a frame stay *with the connection*, and
 *   only newly-arrived bytes are scanned for the delimiter.
 *
 * The pool lives in a module-level registry rather than on the `Engine`, because
 * `connectEngine` is `Object.assign(this, engine)` — it copies properties onto
 * the keyspace class and keeps no reference to the engine itself.
 *
 * Unlike the Rust and Python clients, no explicit health poll is needed here:
 * a Node socket reports the peer hanging up through `end`/`close`/`error`, so
 * liveness is tracked as a flag and costs nothing.
 */

import net from 'net';
import tls from 'tls';

const NEWLINE = 0x0a;

/**
 * Incrementally split newline-delimited byte frames in O(total bytes).
 *
 * Incoming chunks are retained as slices and joined once per completed frame;
 * growing responses are never recopied on every socket event.
 */
export class FrameAccumulator {
  private parts: Buffer[] = [];
  private length = 0;

  push(chunk: Buffer): Buffer[] {
    const frames: Buffer[] = [];
    let start = 0;

    while (start < chunk.length) {
      const newline = chunk.indexOf(NEWLINE, start);
      if (newline === -1) {
        const tail = chunk.subarray(start);
        this.parts.push(tail);
        this.length += tail.length;
        break;
      }

      const tail = chunk.subarray(start, newline);
      const frameLength = this.length + tail.length;
      if (this.parts.length === 0) {
        frames.push(tail);
      } else {
        if (tail.length > 0) this.parts.push(tail);
        frames.push(Buffer.concat(this.parts, frameLength));
      }
      this.parts = [];
      this.length = 0;
      start = newline + 1;
    }

    return frames;
  }

  hasBufferedData(): boolean {
    return this.length > 0;
  }

  finish(): Buffer {
    const result = this.parts.length === 0
      ? Buffer.alloc(0)
      : Buffer.concat(this.parts, this.length);
    this.parts = [];
    this.length = 0;
    return result;
  }
}

/** How many idle connections to keep, and how long to keep them. */
export interface PoolConfig {
  /** Maximum idle connections retained per target. Never unbounded. Default 8. */
  maxIdle?: number;
  /**
   * Discard an idle connection older than this, in milliseconds. Default 30000.
   *
   * Keep it shorter than any server or firewall idle reaper so the client drops
   * a connection before the peer does.
   */
  idleTimeoutMs?: number;
}

interface ResolvedPoolConfig {
  maxIdle: number;
  idleTimeoutMs: number;
}

function resolveConfig(config: PoolConfig): ResolvedPoolConfig {
  const maxIdle = config.maxIdle ?? 8;
  const idleTimeoutMs = config.idleTimeoutMs ?? 30_000;
  if (maxIdle < 1) throw new Error('maxIdle must be at least 1');
  if (idleTimeoutMs <= 0) throw new Error('idleTimeoutMs must be positive');
  return { maxIdle, idleTimeoutMs };
}

/** Which half of an exchange failed. Only a write failure is safe to replay. */
export class WriteFailed extends Error {}
export class ReadFailed extends Error {}

/**
 * One socket plus the framing state that must travel with it.
 *
 * The leftover buffer lives here rather than in a per-request closure: a
 * response's trailing bytes belong to the *next* response, and discarding them
 * when the call returns would corrupt it (contract §7).
 */
export class PooledConnection {
  private frames = new FrameAccumulator();
  private unexpectedFrame = false;
  private pending: {
    resolve: (line: string) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  } | null = null;
  private dead = false;

  constructor(private socket: net.Socket | tls.TLSSocket) {
    socket.on('data', (chunk: Buffer) => this.onData(chunk));
    socket.on('end', () => this.die(new ReadFailed('connection closed by peer')));
    socket.on('close', () => this.die(new ReadFailed('connection closed')));
    socket.on('error', (err: Error) => this.die(new ReadFailed(err.message)));
  }

  private die(err: Error): void {
    this.dead = true;
    const pending = this.pending;
    this.pending = null;
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
  }

  private onData(chunk: Buffer): void {
    for (const frame of this.frames.push(chunk)) {
      const pending = this.pending;
      if (pending) {
        this.pending = null;
        clearTimeout(pending.timer);
        pending.resolve(frame.toString());
      } else {
        // A strict request/response connection must not receive another frame
        // before another request. Keep it out of the pool if it does.
        this.unexpectedFrame = true;
      }
    }
  }

  /**
   * Send one request and resolve with the raw text of exactly one response frame.
   *
   * Parsing is the caller's job, which keeps this module transport-only and
   * avoids an import cycle with the engine.
   */
  request(message: string, timeoutMs: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (this.dead || this.socket.destroyed) {
        reject(new WriteFailed('connection is closed'));
        return;
      }
      if (this.pending) {
        // A pooled connection is handed out exclusively; two concurrent requests
        // on one socket would deliver a response to the wrong caller.
        reject(new Error('connection already has a request in flight'));
        return;
      }

      const timer = setTimeout(() => {
        this.pending = null;
        this.dead = true;
        this.socket.destroy();
        reject(new ReadFailed('Operation timed out'));
      }, timeoutMs);

      this.pending = { resolve, reject, timer };

      try {
        this.socket.write(message + '\n', (err) => {
          if (!err) return;
          // Surfaced before any response, so nothing was processed by the
          // engine — safe to replay on a fresh connection (contract §4).
          if (this.pending) {
            clearTimeout(this.pending.timer);
            this.pending = null;
          }
          this.dead = true;
          reject(new WriteFailed(err.message));
        });
      } catch (err) {
        clearTimeout(timer);
        this.pending = null;
        this.dead = true;
        reject(new WriteFailed(String(err)));
      }
    });
  }

  /**
   * Is this connection usable for a fresh exchange?
   *
   * Checked before use rather than relying on the write failing: writing to a
   * peer-closed socket normally succeeds, and the request would then read EOF —
   * indistinguishable from "the engine applied the write and the response was
   * lost", which contract §4 forbids retrying.
   */
  isHealthy(): boolean {
    if (this.dead || this.socket.destroyed || !this.socket.writable) return false;
    // Leftover bytes mean a previous response was never fully consumed, which
    // would desynchronise the next caller's read.
    if (this.unexpectedFrame || this.frames.hasBufferedData()) return false;
    return this.pending === null;
  }

  destroy(): void {
    this.dead = true;
    try {
      this.socket.destroy();
    } catch {
      /* already gone */
    }
  }
}

/** A bounded set of idle connections for one `(host, port, useTls)` target. */
export class ConnectionPool {
  private idle: { conn: PooledConnection; idleSince: number }[] = [];
  private config: ResolvedPoolConfig;

  constructor(config: PoolConfig) {
    this.config = resolveConfig(config);
  }

  /** Idle connections currently held. Test and diagnostic use. */
  idleLen(): number {
    return this.idle.length;
  }

  /** Take a healthy idle connection, discarding any that aged out or died. */
  checkout(): PooledConnection | null {
    while (this.idle.length > 0) {
      const entry = this.idle.pop()!;
      const agedOut = Date.now() - entry.idleSince >= this.config.idleTimeoutMs;
      if (agedOut || !entry.conn.isHealthy()) {
        entry.conn.destroy();
        continue;
      }
      return entry.conn;
    }
    return null;
  }

  /**
   * Return a healthy connection. Callers must never return one that errored,
   * timed out, or carried a subscription.
   */
  checkin(conn: PooledConnection): void {
    if (!conn.isHealthy()) {
      conn.destroy();
      return;
    }
    if (this.idle.length >= this.config.maxIdle) {
      conn.destroy();
      return;
    }
    this.idle.push({ conn, idleSince: Date.now() });
  }

  /** Drain and destroy every idle connection. */
  close(): void {
    const entries = this.idle;
    this.idle = [];
    for (const entry of entries) entry.conn.destroy();
  }
}

// One pool per target. `useTls` is part of the key: a plaintext and a TLS
// connection to the same address are not interchangeable.
const POOLS = new Map<string, ConnectionPool>();

const keyOf = (host: string, port: number, useTls: boolean) => `${host}:${port}:${useTls}`;

/**
 * The pool for this target, creating it on first use.
 *
 * Returns `null` when no config is supplied, which is how pooling stays
 * opt-in: the caller then connects per request exactly as before.
 */
export function getPool(
  host: string,
  port: number,
  useTls: boolean,
  config: PoolConfig | undefined | null,
): ConnectionPool | null {
  if (!config) return null;
  const key = keyOf(host, port, useTls);
  let pool = POOLS.get(key);
  if (!pool) {
    pool = new ConnectionPool(config);
    POOLS.set(key, pool);
  }
  return pool;
}

/** Drain every pool. Call before process exit, and between test cases. */
export function closeAllPools(): void {
  for (const pool of POOLS.values()) pool.close();
  POOLS.clear();
}
