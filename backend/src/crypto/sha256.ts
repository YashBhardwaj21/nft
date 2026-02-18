/**
 * SHA-256 CRYPTOGRAPHIC HASH FUNCTION
 * ====================================
 * 
 * Production-grade implementation of SHA-256 (Secure Hash Algorithm 256-bit).
 * This implementation is used in production for JWT signing and other cryptographic operations.
 * 
 * SHA-256 PROPERTIES:
 * ------------------
 * - Produces a 256-bit (32-byte) hash from any input
 * - One-way function: cannot reverse hash to get original input
 * - Deterministic: same input always produces same hash
 * - Avalanche effect: tiny input change completely changes output
 * - Collision resistant: computationally infeasible to find two inputs with same hash
 * 
 * ALGORITHM STEPS:
 * ---------------
 * 1. Convert message to binary and add padding
 * 2. Split padded message into 512-bit blocks
 * 3. Process each block through 64 rounds of mixing
 * 4. Return final 256-bit hash value
 * 
 * SECURITY NOTES:
 * --------------
 * - SHA-256 is part of the SHA-2 family, designed by NSA
 * - It's the most widely used cryptographic hash function
 * - Used in Bitcoin, TLS/SSL, and many other security protocols
 * - No known practical attacks as of 2024
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Initial hash values (H0 through H7)
 * 
 * These are the first 32 bits of the fractional parts of square roots
 * of the first 8 prime numbers (2, 3, 5, 7, 11, 13, 17, 19).
 * 
 * Example: sqrt(2) = 1.414213562373095...
 *          Fractional part: 0.414213562373095...
 *          First 32 bits in hex: 0x6a09e667
 */
const INITIAL_HASH_VALUES: number[] = [
    0x6a09e667,  // H0: sqrt(2)
    0xbb67ae85,  // H1: sqrt(3)
    0x3c6ef372,  // H2: sqrt(5)
    0xa54ff53a,  // H3: sqrt(7)
    0x510e527f,  // H4: sqrt(11)
    0x9b05688c,  // H5: sqrt(13)
    0x1f83d9ab,  // H6: sqrt(17)
    0x5be0cd19   // H7: sqrt(19)
];

/**
 * Round constants (K0 through K63)
 * 
 * First 32 bits of fractional parts of cube roots of first 64 primes.
 * These constants ensure no backdoors exist in the algorithm.
 */
const ROUND_CONSTANTS: number[] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

// ============================================================================
// BITWISE OPERATIONS
// ============================================================================

/**
 * Right rotate (circular shift) a 32-bit number
 * 
 * Unlike right shift (>>), rotation wraps bits from right to left.
 * Example: ROTR(3, 0b11010000) = 0b00011010
 */
function rightRotate(value: number, shiftAmount: number): number {
    return (value >>> shiftAmount) | (value << (32 - shiftAmount));
}

/**
 * Right shift a 32-bit number (fills with zeros on left)
 */
function rightShift(value: number, shiftAmount: number): number {
    return value >>> shiftAmount;
}

/**
 * Ensure number stays within 32-bit unsigned integer bounds
 */
function toUint32(value: number): number {
    return value >>> 0;
}

// ============================================================================
// SHA-256 LOGICAL FUNCTIONS
// ============================================================================

/**
 * CH (Choose) function
 * 
 * For each bit: if x is 1, choose bit from y; if x is 0, choose bit from z
 * Formula: (x AND y) XOR (NOT x AND z)
 */
function chooseFunction(x: number, y: number, z: number): number {
    return (x & y) ^ (~x & z);
}

/**
 * MAJ (Majority) function
 * 
 * For each bit: return 1 if at least 2 of x, y, z are 1
 * Formula: (x AND y) XOR (x AND z) XOR (y AND z)
 */
function majorityFunction(x: number, y: number, z: number): number {
    return (x & y) ^ (x & z) ^ (y & z);
}

/**
 * Σ0 (Capital Sigma 0) - Used in compression function
 * Formula: ROTR(2,x) XOR ROTR(13,x) XOR ROTR(22,x)
 */
function capitalSigma0(x: number): number {
    return rightRotate(x, 2) ^ rightRotate(x, 13) ^ rightRotate(x, 22);
}

/**
 * Σ1 (Capital Sigma 1) - Used in compression function
 * Formula: ROTR(6,x) XOR ROTR(11,x) XOR ROTR(25,x)
 */
function capitalSigma1(x: number): number {
    return rightRotate(x, 6) ^ rightRotate(x, 11) ^ rightRotate(x, 25);
}

/**
 * σ0 (Lowercase Sigma 0) - Used in message schedule
 * Formula: ROTR(7,x) XOR ROTR(18,x) XOR SHR(3,x)
 */
function lowercaseSigma0(x: number): number {
    return rightRotate(x, 7) ^ rightRotate(x, 18) ^ rightShift(x, 3);
}

/**
 * σ1 (Lowercase Sigma 1) - Used in message schedule
 * Formula: ROTR(17,x) XOR ROTR(19,x) XOR SHR(10,x)
 */
function lowercaseSigma1(x: number): number {
    return rightRotate(x, 17) ^ rightRotate(x, 19) ^ rightShift(x, 10);
}

// ============================================================================
// MESSAGE PREPROCESSING
// ============================================================================

/**
 * Convert string or Buffer to byte array
 */
function convertToBytes(input: string | Buffer): number[] {
    if (Buffer.isBuffer(input)) {
        return Array.from(input);
    }

    // Use TextEncoder for proper UTF-8 encoding
    const encoder = new TextEncoder();
    const encoded = encoder.encode(input);
    return Array.from(encoded);
}

/**
 * Add SHA-256 padding to message
 * 
 * PADDING ALGORITHM:
 * 1. Append bit '1' (byte 0x80)
 * 2. Append '0' bits until length ≡ 448 (mod 512)
 * 3. Append original length as 64-bit big-endian integer
 * Result: Message length is multiple of 512 bits
 */
function addPadding(messageBytes: number[]): number[] {
    const paddedMessage = [...messageBytes];
    const originalBitLength = messageBytes.length * 8;

    // Append the '1' bit (0x80 = 10000000 binary)
    paddedMessage.push(0x80);

    // Calculate zero padding needed
    const currentLength = paddedMessage.length;
    const targetLength = Math.ceil((currentLength + 8) / 64) * 64;
    const zeroPadding = targetLength - currentLength - 8;

    // Add zero bytes
    for (let i = 0; i < zeroPadding; i++) {
        paddedMessage.push(0x00);
    }

    // Append original message length as 64-bit big-endian
    const highBits = Math.floor(originalBitLength / 0x100000000);
    const lowBits = originalBitLength >>> 0;

    // High 32 bits (big-endian)
    paddedMessage.push((highBits >>> 24) & 0xff);
    paddedMessage.push((highBits >>> 16) & 0xff);
    paddedMessage.push((highBits >>> 8) & 0xff);
    paddedMessage.push(highBits & 0xff);

    // Low 32 bits (big-endian)
    paddedMessage.push((lowBits >>> 24) & 0xff);
    paddedMessage.push((lowBits >>> 16) & 0xff);
    paddedMessage.push((lowBits >>> 8) & 0xff);
    paddedMessage.push(lowBits & 0xff);

    return paddedMessage;
}

/**
 * Split padded message into 512-bit (64-byte) blocks
 */
function splitIntoBlocks(paddedMessage: number[]): number[][] {
    const blocks: number[][] = [];
    const blockSize = 64;

    for (let i = 0; i < paddedMessage.length; i += blockSize) {
        blocks.push(paddedMessage.slice(i, i + blockSize));
    }

    return blocks;
}

// ============================================================================
// MESSAGE SCHEDULE
// ============================================================================

/**
 * Create 64-word message schedule from 512-bit block
 * 
 * EXPANSION ALGORITHM:
 * - W[0..15]: Directly from block (16 words)
 * - W[16..63]: Computed using mixing formula
 * 
 * Formula for W[i] where i >= 16:
 * W[i] = σ1(W[i-2]) + W[i-7] + σ0(W[i-15]) + W[i-16]
 */
function createMessageSchedule(block: number[]): number[] {
    const schedule: number[] = new Array(64);

    // First 16 words from block (big-endian conversion)
    for (let i = 0; i < 16; i++) {
        const offset = i * 4;
        schedule[i] =
            (block[offset] << 24) |
            (block[offset + 1] << 16) |
            (block[offset + 2] << 8) |
            block[offset + 3];
    }

    // Generate remaining 48 words
    for (let i = 16; i < 64; i++) {
        const s0 = lowercaseSigma0(schedule[i - 15]);
        const s1 = lowercaseSigma1(schedule[i - 2]);
        schedule[i] = toUint32(
            schedule[i - 16] + s0 + schedule[i - 7] + s1
        );
    }

    return schedule;
}

// ============================================================================
// COMPRESSION FUNCTION
// ============================================================================

/**
 * Process one 512-bit block through SHA-256 compression
 * 
 * COMPRESSION ALGORITHM:
 * 1. Create message schedule (64 words)
 * 2. Initialize working variables with current hash
 * 3. Run 64 rounds of mixing
 * 4. Add result to current hash
 */
function compressBlock(block: number[], hashState: number[]): number[] {
    const schedule = createMessageSchedule(block);

    // Initialize working variables
    let a = hashState[0];
    let b = hashState[1];
    let c = hashState[2];
    let d = hashState[3];
    let e = hashState[4];
    let f = hashState[5];
    let g = hashState[6];
    let h = hashState[7];

    // 64 rounds of compression
    for (let round = 0; round < 64; round++) {
        const temp1 = toUint32(
            h + capitalSigma1(e) + chooseFunction(e, f, g) +
            ROUND_CONSTANTS[round] + schedule[round]
        );
        const temp2 = toUint32(capitalSigma0(a) + majorityFunction(a, b, c));

        // Rotate working variables
        h = g;
        g = f;
        f = e;
        e = toUint32(d + temp1);
        d = c;
        c = b;
        b = a;
        a = toUint32(temp1 + temp2);
    }

    // Add compressed block to current hash
    return [
        toUint32(hashState[0] + a),
        toUint32(hashState[1] + b),
        toUint32(hashState[2] + c),
        toUint32(hashState[3] + d),
        toUint32(hashState[4] + e),
        toUint32(hashState[5] + f),
        toUint32(hashState[6] + g),
        toUint32(hashState[7] + h)
    ];
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Calculate SHA-256 hash of input
 * 
 * @param input - Message to hash (string or Buffer)
 * @returns 256-bit hash as hexadecimal string (64 characters)
 * 
 * @example
 * sha256('hello') // Returns: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
 */
export function sha256(input: string | Buffer): string {
    // Step 1: Convert to bytes
    const messageBytes = convertToBytes(input);

    // Step 2: Add padding
    const paddedMessage = addPadding(messageBytes);

    // Step 3: Split into blocks
    const blocks = splitIntoBlocks(paddedMessage);

    // Step 4: Initialize hash with SHA-256 initial values
    let hashState = [...INITIAL_HASH_VALUES];

    // Step 5: Process each block
    for (const block of blocks) {
        hashState = compressBlock(block, hashState);
    }

    // Step 6: Convert to hex string
    return hashState
        .map(word => word.toString(16).padStart(8, '0'))
        .join('');
}

/**
 * Calculate SHA-256 hash and return as Buffer
 * 
 * @param input - Message to hash
 * @returns 32-byte Buffer containing hash
 */
export function sha256Buffer(input: string | Buffer): Buffer {
    const hexHash = sha256(input);
    return Buffer.from(hexHash, 'hex');
}
