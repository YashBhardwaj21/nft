/**
 * CUSTOM CRYPTOGRAPHY MODULE
 * ===========================
 *
 * Exports all custom cryptographic implementations:
 * - SHA-256: Cryptographic hash function
 * - Keccak-256: Ethereum's hash function
 * - secp256k1: Elliptic curve math
 * - ECDSA: Ethereum signature verification
 * - Secure Random: Cryptographically secure random generation
 *
 * PRODUCTION USE:
 * - bcryptjs: password hashing (kept as-is)
 * - jsonwebtoken: JWT operations (kept as-is)
 * - Custom ECDSA: replaces ethers.verifyMessage
 * - Custom Random: replaces Math.random for nonce generation
 */

// SHA-256 hashing
export { sha256, sha256Buffer } from './sha256.js';

// Keccak-256 hashing (Ethereum)
export { keccak256, keccak256Buffer, hashEthereumMessage } from './keccak256.js';

// secp256k1 curve math
export {
    CURVE, G, POINT_AT_INFINITY,
    mod, modInverse, modPow, sqrtMod,
    pointAdd, pointDouble, scalarMultiply,
    isOnCurve, isPointAtInfinity,
} from './secp256k1.js';
export type { Point } from './secp256k1.js';

// ECDSA signature verification (Ethereum)
export { verifySignature, recoverAddress, publicKeyToAddress } from './ecdsa.js';

// Secure random generation
export {
    generateRandomBytes,
    generateRandomHex,
    generateRandomInt,
    generateNonce,
    generateRandomBase64
} from './random.js';
