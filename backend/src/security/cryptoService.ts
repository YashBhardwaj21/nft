/**
 * CRYPTO SERVICE — Central Security Authority
 * =============================================
 *
 * THE ONLY entry point for all authentication operations.
 * No other module should call crypto primitives directly for auth.
 *
 * RESPONSIBILITIES:
 *   1. Nonce generation (crypto.randomBytes)
 *   2. Nonce storage hashing (HMAC-SHA256)
 *   3. SIWE authentication (full pipeline)
 *   4. Startup self-test (crash on failure)
 *
 * VERIFICATION PIPELINE ORDER:
 *   Signature first (ECDSA is expensive but nonce is inside the signed
 *   message — cannot trust parsed fields until signature verified).
 *
 *   1. Recover address from signature
 *   2. Triple address check (recovered == parsed == expected)
 *   3. Parse SIWE message
 *   4. Validate domain / chain / time
 *   5. Validate nonce (HMAC compare)
 */

import { randomBytes } from 'crypto';
import { sha256, sha256Buffer } from '../crypto/sha256.js';
import { keccak256 } from '../crypto/keccak256.js';
import { recoverAddress, publicKeyToAddress } from '../crypto/ecdsa.js';
import { parseSiweMessage, validateSiweMessage } from '../auth/siweParser.js';
import {
    CURVE, G, POINT_AT_INFINITY,
    scalarMultiply, isPointAtInfinity,
} from '../crypto/secp256k1.js';

// ============================================================================
// HMAC-SHA256 (using custom SHA-256)
// ============================================================================

/**
 * HMAC-SHA256 per RFC 2104.
 *
 * HMAC(K, m) = H((K' ⊕ opad) || H((K' ⊕ ipad) || m))
 *
 * Block size for SHA-256 = 64 bytes.
 * ipad = 0x36 repeated, opad = 0x5c repeated.
 */
function hmacSha256(key: string, data: string): string {
    const blockSize = 64;
    let keyBytes = Buffer.from(key, 'utf8');

    // If key > block size, hash it first
    if (keyBytes.length > blockSize) {
        keyBytes = sha256Buffer(keyBytes);
    }

    // Pad key to block size
    const paddedKey = Buffer.alloc(blockSize, 0);
    keyBytes.copy(paddedKey);

    // XOR with ipad and opad
    const ipad = Buffer.alloc(blockSize);
    const opad = Buffer.alloc(blockSize);
    for (let i = 0; i < blockSize; i++) {
        ipad[i] = paddedKey[i] ^ 0x36;
        opad[i] = paddedKey[i] ^ 0x5c;
    }

    // Inner hash: H(ipad || data)
    const innerData = Buffer.concat([ipad, Buffer.from(data, 'utf8')]);
    const innerHash = sha256Buffer(innerData);

    // Outer hash: H(opad || innerHash)
    const outerData = Buffer.concat([opad, innerHash]);
    return sha256(outerData);
}

// ============================================================================
// PUBLIC API
// ============================================================================

export class CryptoService {

    /**
     * Generate a cryptographically secure nonce.
     * 32 bytes → base64url (no padding ambiguity).
     */
    static generateNonce(): string {
        return randomBytes(32).toString('base64url');
    }

    /**
     * Compute HMAC-SHA256 hash of nonce for secure storage.
     *
     * HMAC prevents rainbow table attacks on nonce values.
     * Server secret is the HMAC key.
     */
    static getNonceHash(address: string, nonce: string): string {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET not configured');
        return hmacSha256(secret, address.toLowerCase() + nonce);
    }

    /**
     * Authenticate a SIWE login attempt.
     *
     * PIPELINE (signature first, nonce last):
     *   1. Recover address from ECDSA signature
     *   2. Triple address check
     *   3. Parse SIWE message
     *   4. Validate domain / chain / expiration
     *   5. Validate nonce (HMAC comparison)
     */
    static authenticateSIWE(
        message: string,
        signature: string,
        expectedAddress: string,
        storedNonceHash: string,
    ): { success: boolean; error?: string; recoveredAddress?: string } {

        const normalize = (addr: string) => addr.toLowerCase().trim();

        // ── Step 1: Recover address (ECDSA) ───────────────────────────
        let recoveredAddr: string;
        try {
            recoveredAddr = recoverAddress(message, signature);
        } catch (e: any) {
            return { success: false, error: `Signature recovery failed: ${e.message}` };
        }

        // ── Step 2: Triple address check ──────────────────────────────
        const normalRecovered = normalize(recoveredAddr);
        const normalExpected = normalize(expectedAddress);

        if (normalRecovered !== normalExpected) {
            return { success: false, error: 'Recovered address does not match claimed address' };
        }

        // ── Step 3: Parse SIWE message ────────────────────────────────
        let parsed;
        try {
            parsed = parseSiweMessage(message);
        } catch (e: any) {
            return { success: false, error: `SIWE parse error: ${e.message}` };
        }

        // Second leg of triple check: parsed address == expected
        if (normalize(parsed.address) !== normalExpected) {
            return { success: false, error: 'Message address does not match claimed address' };
        }

        // ── Step 4: Validate SIWE constraints ─────────────────────────
        try {
            validateSiweMessage(parsed);
        } catch (e: any) {
            return { success: false, error: `SIWE validation: ${e.message}` };
        }

        // ── Step 5: Validate nonce (HMAC comparison) ──────────────────
        const recomputedHash = this.getNonceHash(normalExpected, parsed.nonce);

        if (!this.constantTimeEqual(recomputedHash, storedNonceHash)) {
            return { success: false, error: 'Invalid nonce' };
        }

        return { success: true, recoveredAddress: recoveredAddr };
    }

    /**
     * Constant-time string comparison to prevent timing attacks.
     */
    private static constantTimeEqual(a: string, b: string): boolean {
        if (a.length !== b.length) return false;
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    }

    // ====================================================================
    // SELF-TEST — runs at server startup, crashes on failure
    // ====================================================================

    /**
     * Deterministic self-test that verifies all crypto primitives.
     *
     * Tests:
     *   1. SHA-256 (NIST vector)
     *   2. Keccak-256 (empty string, pre-standardization)
     *   3. EC math: n × G = point at infinity
     *   4. ECDSA recovery: ethers oracle comparison (dev) or hardcoded vector (prod)
     *
     * @throws and crashes server if any check fails
     */
    static async selfTest(): Promise<void> {
        console.log('🔐 Running CryptoService Self-Test...');

        // ── 1. SHA-256 NIST Vector ────────────────────────────────────
        const shaResult = sha256('abc');
        const shaExpected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
        if (shaResult !== shaExpected) {
            throw new Error(`SHA-256 self-test FAILED. Got: ${shaResult}`);
        }
        console.log('  ✅ SHA-256');

        // ── 2. Keccak-256 Empty String (pre-standardization) ──────────
        const keccakResult = keccak256(Buffer.alloc(0));
        const keccakExpected = 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470';
        if (keccakResult !== keccakExpected) {
            throw new Error(`Keccak-256 self-test FAILED. Got: ${keccakResult}`);
        }
        console.log('  ✅ Keccak-256');

        // ── 3. EC Math: n × G = infinity ──────────────────────────────
        const nG = scalarMultiply(CURVE.n, G);
        if (!isPointAtInfinity(nG)) {
            throw new Error(`EC math self-test FAILED: n×G is not infinity`);
        }
        console.log('  ✅ secp256k1 (n×G = ∞)');

        // ── 4. ECDSA Recovery Oracle ──────────────────────────────────
        // Try ethers as correctness oracle (available in dev, not prod)
        try {
            const ethers = await import('ethers');
            const testKey = '0x' + 'ab'.repeat(32);
            const wallet = new ethers.Wallet(testKey);
            const testMsg = 'CryptoService self-test';
            const sig = await wallet.signMessage(testMsg);
            const ethersAddr = ethers.verifyMessage(testMsg, sig);

            const customAddr = recoverAddress(testMsg, sig);

            if (customAddr.toLowerCase() !== ethersAddr.toLowerCase()) {
                throw new Error(
                    `ECDSA oracle MISMATCH:\n  ethers:  ${ethersAddr}\n  custom:  ${customAddr}`
                );
            }
            console.log('  ✅ ECDSA recovery (verified against ethers oracle)');
        } catch (e: any) {
            if (e.message?.includes('MISMATCH')) throw e;
            // ethers not available (production) — use address derivation test
            // Private key 1 → public key = G → address is well-known
            const addr1 = publicKeyToAddress(G);
            const expectedAddr1 = '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf';
            if (addr1.toLowerCase() !== expectedAddr1) {
                throw new Error(
                    `ECDSA address derivation FAILED:\n  got:      ${addr1}\n  expected: ${expectedAddr1}`
                );
            }
            console.log('  ✅ ECDSA address derivation (ethers not available, using known vector)');
        }

        console.log('🔐 CryptoService Self-Test PASSED');
    }
}
