/**
 * KECCAK-256 HASH FUNCTION
 * ========================
 * 
 * Production implementation of Keccak-256, the hash function used by Ethereum.
 * 
 * IMPORTANT DISTINCTION:
 * ---------------------
 * - Keccak-256: Original Keccak algorithm (used by Ethereum)
 * - SHA-3-256: NIST standardized version (slightly different)
 * 
 * Ethereum uses the original Keccak-256, NOT SHA-3-256!
 * 
 * WHAT IS KECCAK?
 * --------------
 * Keccak is a cryptographic hash function designed by Guido Bertoni, Joan Daemen,
 * Michaël Peeters, and Gilles Van Assche. It won the SHA-3 competition in 2012.
 * 
 * ETHEREUM USES:
 * -------------
 * - Hashing messages for ECDSA signing
 * - Computing Ethereum addresses from public keys
 * - Merkle tree construction
 * - Storage key derivation
 * 
 * ALGORITHM OVERVIEW:
 * ------------------
 * 1. Pad the input message
 * 2. Absorb input into state (sponge construction)
 * 3. Apply Keccak-f[1600] permutation
 * 4. Squeeze out 256 bits of output
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Keccak-256 produces 256-bit (32-byte) output
 */
const OUTPUT_LENGTH = 32;

/**
 * Keccak-256 rate: 1088 bits = 136 bytes
 * This is how many bytes we process at a time
 */
const RATE = 136;

/**
 * Number of rounds in Keccak-f[1600]
 */
const ROUNDS = 24;

/**
 * Round constants for iota step
 * These are derived from a linear feedback shift register
 */
const ROUND_CONSTANTS = [
    0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an,
    0x8000000080008000n, 0x000000000000808bn, 0x0000000080000001n,
    0x8000000080008081n, 0x8000000000008009n, 0x000000000000008an,
    0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
    0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n,
    0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n,
    0x000000000000800an, 0x800000008000000an, 0x8000000080008081n,
    0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n
];

/**
 * Rotation offsets for rho step
 * These define how much to rotate each lane
 */
const ROTATION_OFFSETS = [
    0, 1, 62, 28, 27,
    36, 44, 6, 55, 20,
    3, 10, 43, 25, 39,
    41, 45, 15, 21, 8,
    18, 2, 61, 56, 14
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Left rotate a 64-bit BigInt
 * 
 * @param value - Value to rotate
 * @param shift - Number of positions to rotate
 * @returns Rotated value
 */
function rotateLeft(value: bigint, shift: number): bigint {
    const shifted = (value << BigInt(shift)) | (value >> BigInt(64 - shift));
    return shifted & 0xFFFFFFFFFFFFFFFFn;  // Keep only 64 bits
}

/**
 * Convert bytes to 64-bit little-endian BigInt
 * 
 * @param bytes - Array of 8 bytes
 * @param offset - Starting position in array
 * @returns 64-bit BigInt
 */
function bytesToLane(bytes: Uint8Array, offset: number): bigint {
    let result = 0n;
    for (let i = 0; i < 8; i++) {
        result |= BigInt(bytes[offset + i]) << BigInt(i * 8);
    }
    return result;
}

/**
 * Convert 64-bit BigInt to 8 bytes (little-endian)
 * 
 * @param lane - 64-bit BigInt
 * @param bytes - Output array
 * @param offset - Starting position in output
 */
function laneToBytes(lane: bigint, bytes: Uint8Array, offset: number): void {
    for (let i = 0; i < 8; i++) {
        bytes[offset + i] = Number((lane >> BigInt(i * 8)) & 0xFFn);
    }
}

// ============================================================================
// KECCAK-F[1600] PERMUTATION
// ============================================================================

/**
 * Theta step: Add column parity
 * 
 * Theta provides diffusion - it ensures that changing one bit
 * affects many other bits in the state.
 * 
 * @param state - 5x5 array of 64-bit lanes
 */
function theta(state: bigint[]): void {
    const C = new Array(5);
    const D = new Array(5);

    // Compute column parity
    for (let x = 0; x < 5; x++) {
        C[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
    }

    // XOR back into state
    for (let x = 0; x < 5; x++) {
        D[x] = C[(x + 4) % 5] ^ rotateLeft(C[(x + 1) % 5], 1);
        for (let y = 0; y < 5; y++) {
            state[x + y * 5] ^= D[x];
        }
    }
}

/**
 * Rho step: Rotate lanes by varying amounts
 * 
 * Different lanes are rotated by different amounts to provide
 * more diffusion across the state.
 * 
 * @param state - 5x5 array of 64-bit lanes
 */
function rho(state: bigint[]): void {
    for (let i = 0; i < 25; i++) {
        state[i] = rotateLeft(state[i], ROTATION_OFFSETS[i]);
    }
}

/**
 * Pi step: Permute lanes
 * 
 * This rearranges the position of lanes in the state array.
 * 
 * @param state - 5x5 array of 64-bit lanes
 */
function pi(state: bigint[]): void {
    const temp = new Array(25);
    for (let i = 0; i < 25; i++) {
        temp[i] = state[i];
    }

    for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
            state[y + ((2 * x + 3 * y) % 5) * 5] = temp[x + y * 5];
        }
    }
}

/**
 * Chi step: Non-linear mixing
 * 
 * This is the only non-linear step and provides confusion
 * (makes relationship between input and output complex).
 * 
 * @param state - 5x5 array of 64-bit lanes
 */
function chi(state: bigint[]): void {
    for (let y = 0; y < 5; y++) {
        const temp: bigint[] = new Array(5);
        for (let x = 0; x < 5; x++) {
            temp[x] = state[x + y * 5];
        }
        for (let x = 0; x < 5; x++) {
            state[x + y * 5] = state[x + y * 5] ^ (~temp[(x + 1) % 5] & temp[(x + 2) % 5]);
            state[x + y * 5] &= 0xFFFFFFFFFFFFFFFFn;
        }
    }
}

/**
 * Iota step: Add round constant
 * 
 * Different constant added each round to break symmetry.
 * 
 * @param state - 5x5 array of 64-bit lanes
 * @param round - Current round number (0-23)
 */
function iota(state: bigint[], round: number): void {
    state[0] ^= ROUND_CONSTANTS[round];
    state[0] &= 0xFFFFFFFFFFFFFFFFn;
}

/**
 * Keccak-f[1600] permutation (24 rounds)
 * 
 * This is the core of Keccak. Each round applies five steps:
 * theta, rho, pi, chi, iota
 * 
 * @param state - State array to permute
 */
function keccakF(state: bigint[]): void {
    for (let round = 0; round < ROUNDS; round++) {
        theta(state);
        rho(state);
        pi(state);
        chi(state);
        iota(state, round);
    }
}

// ============================================================================
// KECCAK-256 MAIN FUNCTION
// ============================================================================

/**
 * Calculate Keccak-256 hash
 * 
 * SPONGE CONSTRUCTION:
 * 1. Initialize state to all zeros
 * 2. ABSORB PHASE: XOR input blocks into state, permute
 * 3. SQUEEZE PHASE: Extract output from state
 * 
 * @param input - Data to hash (string or Buffer)
 * @returns 32-byte hash as hexadecimal string
 * 
 * @example
 * keccak256('hello') // Returns hex string
 */
export function keccak256(input: string | Buffer): string {
    // Convert input to Uint8Array
    let inputBytes: Uint8Array;
    if (typeof input === 'string') {
        inputBytes = new TextEncoder().encode(input);
    } else {
        inputBytes = new Uint8Array(input);
    }

    // Add padding: input || 0x01 || 0x00...00 || 0x80
    // The padding ensures last block is complete
    const paddingLength = RATE - (inputBytes.length % RATE);
    const paddedLength = inputBytes.length + paddingLength;
    const padded = new Uint8Array(paddedLength);
    padded.set(inputBytes);
    padded[inputBytes.length] = 0x01;  // Keccak padding starts with 0x01
    padded[paddedLength - 1] |= 0x80;   // Last byte has 0x80

    // Initialize state: 25 lanes of 64 bits each (1600 bits total)
    const state = new Array(25).fill(0n);

    // ABSORB PHASE: Process each block
    for (let offset = 0; offset < paddedLength; offset += RATE) {
        // XOR block into state
        for (let i = 0; i < RATE / 8; i++) {
            state[i] ^= bytesToLane(padded, offset + i * 8);
        }

        // Apply permutation
        keccakF(state);
    }

    // SQUEEZE PHASE: Extract output
    const output = new Uint8Array(OUTPUT_LENGTH);
    for (let i = 0; i < OUTPUT_LENGTH / 8; i++) {
        laneToBytes(state[i], output, i * 8);
    }

    // Convert to hex string
    return Array.from(output)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Calculate Keccak-256 and return as Buffer
 * 
 * @param input - Data to hash
 * @returns 32-byte Buffer
 */
export function keccak256Buffer(input: string | Buffer): Buffer {
    const hex = keccak256(input);
    return Buffer.from(hex, 'hex');
}

/**
 * Hash message for Ethereum signing
 * 
 * Ethereum prepends "\x19Ethereum Signed Message:\n" + length before hashing.
 * This prevents signed messages from being valid Ethereum transactions.
 * 
 * @param message - Message to hash
 * @returns Keccak-256 hash ready for signing
 */
export function hashEthereumMessage(message: string): string {
    const messageBuffer = Buffer.from(message, 'utf8');
    const prefix = `\x19Ethereum Signed Message:\n${messageBuffer.length}`;
    const prefixBuffer = Buffer.from(prefix, 'utf8');
    const prefixedMessage = Buffer.concat([prefixBuffer, messageBuffer]);
    return keccak256(prefixedMessage);
}
