/**
 * ECDSA Signature Verification — Ethereum Compatible
 * ===================================================
 *
 * Implements public key recovery from Ethereum signatures (EIP-191).
 * Replaces ethers.verifyMessage() with first-principles math.
 *
 * ETHEREUM SIGNATURE FORMAT:
 *   65 bytes = r(32) + s(32) + v(1)
 *   v = 27 or 28 (sometimes 0 or 1)
 *
 * RECOVERY ALGORITHM:
 *   1. Parse & validate signature bytes
 *   2. Hash message with Ethereum prefix ("\x19Ethereum Signed Message:\n" + byteLen + msg)
 *   3. Recover public key: Q = r⁻¹(s·R − z·G)
 *   4. Derive address: last 20 bytes of keccak256(Q.x || Q.y)
 *
 * SECURITY CHECKS:
 *   - Strict 65-byte signature length
 *   - Range checks: 0 < r < n, 0 < s < n
 *   - Low-s enforcement (EIP-2): s ≤ n/2
 *   - v must be exactly 27/28 or 0/1
 *   - Recovered point must be on curve
 *   - sqrtMod verified (rejects non-QR values)
 */

import { keccak256Buffer } from './keccak256.js';
import {
    CURVE, G, POINT_AT_INFINITY,
    type Point,
    mod, modInverse, sqrtMod,
    pointAdd, scalarMultiply,
    isOnCurve, isPointAtInfinity,
} from './secp256k1.js';

// Half of curve order — used for low-s check
const HALF_N = CURVE.n >> 1n;

// ============================================================================
// SIGNATURE PARSING
// ============================================================================

/**
 * Parse and validate a raw 65-byte Ethereum signature.
 *
 * @returns { r, s, v } where v is normalized to 0 or 1
 * @throws on any malformed input
 */
function parseSignature(signature: string | Buffer): { r: bigint; s: bigint; v: number } {
    const sig = Buffer.isBuffer(signature)
        ? signature
        : Buffer.from(signature.replace(/^0x/, ''), 'hex');

    // STRICT: exactly 65 bytes
    if (sig.length !== 65) {
        throw new Error(`Invalid signature: expected 65 bytes, got ${sig.length}`);
    }

    const r = BigInt('0x' + sig.subarray(0, 32).toString('hex'));
    const s = BigInt('0x' + sig.subarray(32, 64).toString('hex'));
    let v = sig[64];

    // Range checks: 0 < r < n, 0 < s < n
    if (r <= 0n || r >= CURVE.n) throw new Error('Invalid signature: r out of range');
    if (s <= 0n || s >= CURVE.n) throw new Error('Invalid signature: s out of range');

    // Low-s enforcement (EIP-2) — reject malleable signatures
    if (s > HALF_N) {
        throw new Error('Invalid signature: s > n/2 (malleability)');
    }

    // Normalize v: 27/28 → 0/1
    if (v >= 27) v -= 27;
    if (v !== 0 && v !== 1) {
        throw new Error(`Invalid signature: v must be 0/1 or 27/28, got ${sig[64]}`);
    }

    return { r, s, v };
}

// ============================================================================
// PUBLIC KEY RECOVERY
// ============================================================================

/**
 * Recover the public key from an ECDSA signature.
 *
 * Given message hash z and signature (r, s, v):
 *   1. Compute R point from r and recovery bit v
 *   2. Q = r⁻¹ · (s·R − z·G)
 *
 * @param msgHash - 32-byte Keccak-256 hash of the prefixed message
 * @param r - Signature r component
 * @param s - Signature s component
 * @param v - Recovery ID (0 or 1)
 * @returns Recovered public key point
 */
function recoverPublicKey(msgHash: Buffer, r: bigint, s: bigint, v: number): Point {
    // x-coordinate of R (for v >= 2, x = r + n, but extremely rare for secp256k1)
    const x = v >= 2 ? r + CURVE.n : r;

    if (x >= CURVE.p) {
        throw new Error('Invalid recovery: x >= p');
    }

    // Compute y² = x³ + 7 (mod p)
    const ySquared = mod(x * x * x + CURVE.b, CURVE.p);

    // Compute y = sqrt(y²) mod p — throws if not a quadratic residue
    let y = sqrtMod(ySquared);

    // Choose correct y parity based on v
    // v=0 → even y, v=1 → odd y
    if ((y & 1n) !== BigInt(v & 1)) {
        y = CURVE.p - y;
    }

    const R: Point = { x, y };

    // Verify R is on the curve
    if (!isOnCurve(R)) {
        throw new Error('Recovered R is not on curve');
    }

    // Convert message hash to bigint
    const z = BigInt('0x' + msgHash.toString('hex'));

    // Q = r⁻¹ · (s·R − z·G)
    const rInv = modInverse(r, CURVE.n);
    const sR = scalarMultiply(s, R);
    const zG = scalarMultiply(z, G);

    // s·R − z·G  =  s·R + (−z·G)
    const negZG: Point = { x: zG.x, y: mod(CURVE.p - zG.y, CURVE.p) };
    const diff = pointAdd(sR, negZG);

    const pubKey = scalarMultiply(rInv, diff);

    if (isPointAtInfinity(pubKey)) {
        throw new Error('Recovered public key is point at infinity');
    }

    if (!isOnCurve(pubKey)) {
        throw new Error('Recovered public key is not on curve');
    }

    return pubKey;
}

// ============================================================================
// ADDRESS DERIVATION
// ============================================================================

/**
 * Derive Ethereum address from a public key.
 *
 * Steps:
 *   1. Serialize as uncompressed (64 bytes: x || y, WITHOUT 0x04 prefix)
 *   2. Hash with Keccak-256
 *   3. Take last 20 bytes
 *   4. Prefix with "0x", lowercase
 */
export function publicKeyToAddress(pubKey: Point): string {
    const xHex = pubKey.x.toString(16).padStart(64, '0');
    const yHex = pubKey.y.toString(16).padStart(64, '0');
    const pubBytes = Buffer.from(xHex + yHex, 'hex');

    const hash = keccak256Buffer(pubBytes);
    return '0x' + hash.subarray(hash.length - 20).toString('hex').toLowerCase();
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Recover the signer's Ethereum address from a message and signature.
 *
 * This is the equivalent of ethers.verifyMessage() returning the address.
 *
 * The message is hashed with the standard Ethereum prefix:
 *   keccak256("\x19Ethereum Signed Message:\n" + byteLength + message)
 *
 * @param message - Original message string (what the user saw in MetaMask)
 * @param signature - 65-byte hex signature (0x-prefixed or raw)
 * @returns Lowercase Ethereum address of the signer
 * @throws on invalid signature, malleability, or unrecoverable key
 */
export function recoverAddress(message: string, signature: string | Buffer): string {
    // 1. Parse & validate signature
    const { r, s, v } = parseSignature(signature);

    // 2. Hash message with Ethereum prefix using BYTE LENGTH (not string length)
    //    This matches what wallets (MetaMask, WalletConnect) sign.
    const msgBytes = Buffer.from(message, 'utf8');
    const prefix = `\x19Ethereum Signed Message:\n${msgBytes.length}`;
    const prefixed = Buffer.concat([Buffer.from(prefix, 'utf8'), msgBytes]);
    const msgHash = keccak256Buffer(prefixed);

    // 3. Recover public key
    const pubKey = recoverPublicKey(msgHash, r, s, v);

    // 4. Derive address
    return publicKeyToAddress(pubKey);
}

/**
 * Verify that a signature was produced by a specific address.
 *
 * @param message - Original message
 * @param signature - 65-byte hex signature
 * @param expectedAddress - Expected signer address
 * @returns true if recovered address matches expected
 */
export function verifySignature(
    message: string,
    signature: string | Buffer,
    expectedAddress: string,
): boolean {
    try {
        const recovered = recoverAddress(message, signature);
        return recovered.toLowerCase() === expectedAddress.toLowerCase();
    } catch {
        return false;
    }
}
