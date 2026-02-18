/**
 * SECURE RANDOM NUMBER GENERATION
 * ================================
 * 
 * Cryptographically secure random number generation using Node.js crypto module.
 * This replaces Math.random() which is NOT cryptographically secure.
 * 
 * WHY NOT Math.random()?
 * ---------------------
 * - Math.random() uses a predictable pseudorandom algorithm
 * - Attackers can predict future values if they observe enough outputs
 * - NEVER use Math.random() for security (passwords, tokens, nonces, keys)
 * 
 * CRYPTOGRAPHICALLY SECURE RNG:
 * ----------------------------
 * - Uses OS-level entropy sources (hardware noise, system events, etc.)
 * - Unpredictable even if you know previous outputs
 * - Safe for security-critical applications
 */

import { randomBytes, randomInt } from 'crypto';

/**
 * Generate cryptographically secure random bytes
 * 
 * @param length - Number of bytes to generate
 * @returns Buffer containing random bytes
 * 
 * @example
 * const randomData = generateRandomBytes(32); // 32 random bytes
 */
export function generateRandomBytes(length: number): Buffer {
    return randomBytes(length);
}

/**
 * Generate cryptographically secure random hex string
 * 
 * Commonly used for:
 * - Session tokens
 * - CSRF tokens
 * - Nonces for authentication
 * - API keys
 * 
 * @param byteLength - Number of random bytes (output will be 2x this in hex)
 * @returns Hexadecimal string
 * 
 * @example
 * const nonce = generateRandomHex(32); // 64-character hex string
 */
export function generateRandomHex(byteLength: number): string {
    return randomBytes(byteLength).toString('hex');
}

/**
 * Generate random integer in a range
 * 
 * Uses crypto.randomInt which is cryptographically secure
 * 
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (exclusive)
 * @returns Random integer in [min, max)
 * 
 * @example
 * const dice = generateRandomInt(1, 7); // 1-6
 */
export function generateRandomInt(min: number, max: number): number {
    return randomInt(min, max);
}

/**
 * Generate secure nonce for SIWE (Sign-In with Ethereum)
 * 
 * Replaces: Math.floor(Math.random() * 1000000).toString()
 * 
 * @param byteLength - Number of random bytes (default: 32 for 256-bit security)
 * @returns Hexadecimal nonce string
 * 
 * @example
 * const nonce = generateNonce(); 
 * // Returns something like: "a3f4b2...c9d8e1" (64 hex characters)
 */
export function generateNonce(byteLength: number = 32): string {
    return generateRandomHex(byteLength);
}

/**
 * Generate Base64 random string
 * 
 * Useful for tokens that need to be URL-safe
 * 
 * @param byteLength - Number of random bytes
 * @returns Base64 encoded string
 * 
 * @example
 * const token = generateRandomBase64(32);
 */
export function generateRandomBase64(byteLength: number): string {
    return randomBytes(byteLength).toString('base64');
}
