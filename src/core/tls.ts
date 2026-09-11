/**
 * Client-side TLS trust: what this client requires of the engine that answers.
 *
 * The CLI that ships with the engine can pin the engine's certificate exactly,
 * because it reads the very file the listener loaded — same package, same host.
 * A client library has no such luxury. It runs somewhere else entirely, and the
 * only trust material it has is whatever the operator copied over.
 *
 * So verification is opt-in, and accepts whichever form of that material the
 * operator actually has:
 *
 * - `certificatePath` — the engine's certificate, copied to the client host.
 * - `certificateFingerprint` — its SHA-256 digest, which travels in an
 *   environment variable and needs no file. Read one with:
 *
 *   ```sh
 *   openssl x509 -in server.crt -noout -fingerprint -sha256
 *   ```
 *
 * - neither, with `certificateVerification: true` — Node's trust store with
 *   ordinary hostname checking, for an engine behind a proxy holding a
 *   certificate from a real CA.
 *
 * Both pinning forms compare the certificate the engine presents against the
 * one expected, byte for byte, and skip hostname checking: the engine's
 * self-signed certificate carries only `localhost`, `127.0.0.1` and `::1` as
 * subject alternative names unless it was regenerated with
 * `init-self-tls dns/ip`, so requiring a hostname match would reject a
 * perfectly good certificate for the wrong reason. Identity is already answered
 * exactly by the comparison.
 */

import crypto from 'crypto';
import fs from 'fs';
import type tls from 'tls';

const BEGIN_CERTIFICATE = '-----BEGIN CERTIFICATE-----';
const END_CERTIFICATE = '-----END CERTIFICATE-----';

/**
 * The engine presented a certificate other than the expected one.
 *
 * Raised during connection setup, so it surfaces the way any other connection
 * failure does on this client — `sendData` returns it as an error string rather
 * than throwing it on to the caller.
 */
export class TlsVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TlsVerificationError';
  }
}

/** What to require of the engine's certificate. */
export interface TlsOptions {
  /**
   * Verify the certificate at all. Omitted means "whatever the other options
   * imply": on when a pin is given, off otherwise — which keeps existing TLS
   * callers working unchanged. Passing `false` alongside a pin is a
   * contradiction and throws.
   */
  certificateVerification?: boolean;
  /** Path to the engine's certificate in PEM form. */
  certificatePath?: string;
  /** Its SHA-256 digest, as an alternative to the file. */
  certificateFingerprint?: string;
}

/**
 * Accepts a SHA-256 fingerprint in any of the shapes tools print it in.
 *
 * `openssl` emits colon-separated uppercase, some dashboards emit bare
 * lowercase, and a value pasted from either should work without the operator
 * having to reformat it.
 */
export function normalizeFingerprint(value: string, source = 'certificateFingerprint'): string {
  const cleaned = value.trim().replace(/[:\s-]/g, '').toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(cleaned)) {
    throw new TypeError(
      `${source} must be a SHA-256 fingerprint (64 hex characters, optionally ` +
        `colon-separated); got ${JSON.stringify(value)}`,
    );
  }

  return cleaned;
}

/**
 * The first certificate in a PEM file.
 *
 * A file may hold a chain. The engine presents its leaf first, so the leaf is
 * what a pin compares against.
 */
function firstCertificateDer(pem: string, source: string): Buffer {
  const start = pem.indexOf(BEGIN_CERTIFICATE);
  const end = start === -1 ? -1 : pem.indexOf(END_CERTIFICATE, start + BEGIN_CERTIFICATE.length);

  if (start === -1 || end === -1) {
    throw new TypeError(`no PEM certificate found in ${source}`);
  }

  const body = pem.slice(start + BEGIN_CERTIFICATE.length, end).replace(/\s/g, '');
  const der = Buffer.from(body, 'base64');

  if (der.length === 0) {
    throw new TypeError(`could not parse the certificate at ${source}`);
  }

  return der;
}

/**
 * Resolved trust requirements.
 *
 * Reading and parsing happen in {@link resolveTls}, not at first request, so a
 * misconfiguration fails where it was written.
 */
export class TlsSettings {
  /** Whether the engine's certificate is checked at all. */
  readonly verification: boolean;

  private readonly expectedDer: Buffer | null;
  private readonly expectedFingerprint: string | null;

  constructor(verification: boolean, expectedDer: Buffer | null, expectedFingerprint: string | null) {
    this.verification = verification;
    this.expectedDer = expectedDer;
    this.expectedFingerprint = expectedFingerprint;
  }

  /** Is identity decided by comparison rather than by a trust store? */
  get pinned(): boolean {
    return this.expectedFingerprint !== null;
  }

  /**
   * Should the handshake itself decide, rather than this class?
   *
   * True only for the trust-store path, where Node's own chain and hostname
   * checks are exactly what is wanted.
   */
  get defersToNode(): boolean {
    return this.verification && !this.pinned;
  }

  /**
   * Rejects requirements that cannot be met on a plaintext connection.
   *
   * Ignoring this quietly would leave someone believing a connection is checked
   * when it is not even encrypted.
   */
  assertUsableWith(useTls: boolean): void {
    if (!useTls && this.verification) {
      throw new TypeError(
        'certificate verification requires TLS; pass useTls: true as well ' +
          '(there is nothing to verify on a plaintext connection)',
      );
    }
  }

  /**
   * The part of a pool's identity that trust decides.
   *
   * Connections with different trust requirements are not interchangeable, so
   * two engines pointing at one address with different pins must not share
   * pooled connections.
   */
  poolKey(): string {
    return `${this.verification}:${this.expectedFingerprint ?? ''}`;
  }

  /**
   * Checks the certificate the engine presented against the pin.
   *
   * A no-op unless pinning: the other modes were already decided during the
   * handshake.
   */
  verifyPeer(socket: tls.TLSSocket): void {
    if (!this.pinned) return;

    const presented = socket.getPeerCertificate();
    const der = presented?.raw;

    if (!der || der.length === 0) {
      throw new TlsVerificationError(
        'the engine presented no certificate to compare against the pin',
      );
    }

    if (this.expectedDer) {
      if (der.equals(this.expectedDer)) return;
    } else if (crypto.createHash('sha256').update(der).digest('hex') === this.expectedFingerprint) {
      return;
    }

    // Naming what actually arrived is what makes this fixable: the usual cause
    // is a regenerated certificate, not an attack, and the operator needs the
    // new value in order to update the pin.
    const arrived = crypto.createHash('sha256').update(der).digest('hex');
    throw new TlsVerificationError(
      `the engine presented a certificate that is not the expected one ` +
        `(expected ${this.expectedFingerprint}, got ${arrived}). Update the pin ` +
        `if the engine's certificate was regenerated, or check what is ` +
        `listening on this port.`,
    );
  }
}

/**
 * Turns the constructor's three options into settings, or `null` when none were
 * given — which is the default, and means encryption without checking who
 * answers.
 *
 * @throws {TypeError} If the combination cannot mean anything coherent, or if
 * the certificate file cannot be read or parsed.
 */
export function resolveTls(options: TlsOptions | null | undefined): TlsSettings | null {
  if (!options) return null;

  const { certificateVerification, certificatePath, certificateFingerprint } = options;

  if (
    certificateVerification === undefined &&
    certificatePath === undefined &&
    certificateFingerprint === undefined
  ) {
    return null;
  }

  const pinned = certificatePath !== undefined || certificateFingerprint !== undefined;

  if (certificateVerification === false && pinned) {
    throw new TypeError(
      'certificateVerification: false contradicts certificatePath / ' +
        'certificateFingerprint. Drop the pin to connect without verification, ' +
        'or drop the option to verify against the pin.',
    );
  }

  let expectedFingerprint: string | null = null;
  if (certificateFingerprint !== undefined) {
    expectedFingerprint = normalizeFingerprint(certificateFingerprint);
  }

  let expectedDer: Buffer | null = null;
  if (certificatePath !== undefined) {
    let pem: string;
    try {
      pem = fs.readFileSync(certificatePath, 'utf8');
    } catch (err) {
      throw new TypeError(
        `could not read certificatePath ${certificatePath}: ${(err as Error).message}`,
      );
    }

    expectedDer = firstCertificateDer(pem, certificatePath);
    const loaded = crypto.createHash('sha256').update(expectedDer).digest('hex');

    // Both forms given: they must agree, or the operator believes something
    // about this connection that is not true.
    if (expectedFingerprint !== null && expectedFingerprint !== loaded) {
      throw new TypeError(
        `certificateFingerprint does not match the certificate at ` +
          `${certificatePath} (that file is ${loaded})`,
      );
    }

    expectedFingerprint = loaded;
  }

  return new TlsSettings(certificateVerification ?? pinned, expectedDer, expectedFingerprint);
}
