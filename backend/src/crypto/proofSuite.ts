import { sha256 } from './sha256.js';
import { keccak256 } from './keccak256.js';
import { recoverAddress, publicKeyToAddress } from './ecdsa.js';
import { G, scalarMultiply } from './secp256k1.js';
import { CryptoService } from '../security/cryptoService.js';

/**
 * Proof of Correctness Suite
 * Run via: npm run crypto:prove
 */
async function runProofSuite() {
    console.log("🛡️  STARTING CRYPTOGRAPHIC PROOF SUITE 🛡️");
    console.log("=========================================");

    // 1. SHA-256 NIST Vector
    console.log("\n[1] SHA-256 Correctness (NIST Vectors)");
    const vector1 = "abc";
    const expected1 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    const result1 = sha256(vector1);
    console.log(`Input: "${vector1}"`);
    console.log(`Expected: ${expected1}`);
    console.log(`Actual:   ${result1}`);
    console.log(result1 === expected1 ? "✅ PASS" : "❌ FAIL");

    // 2. Keccak-256 (Ethereum)
    console.log("\n[2] Keccak-256 Correctness");
    const vector2 = "";
    const expected2 = "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470";
    const result2 = keccak256(Buffer.from(vector2));
    console.log(`Input: "" (empty string)`);
    console.log(`Expected: ${expected2}`);
    console.log(`Actual:   ${result2}`);
    console.log(result2 === expected2 ? "✅ PASS" : "❌ FAIL");

    // 3. Elliptic Curve Math
    console.log("\n[3] secp256k1 Curve Math");
    const privKey = 1n; // Private key = 1
    const pubKeyPoint = scalarMultiply(privKey, G); // Should be G itself
    console.log(`PrivKey: 1`);
    console.log(`PubKey (x,y) should match G:`);
    console.log(`  Gx: ${G.x.toString(16)}`);
    console.log(`  Gy: ${G.y.toString(16)}`);
    console.log(`  Px: ${pubKeyPoint.x.toString(16)}`);
    console.log(`  Py: ${pubKeyPoint.y.toString(16)}`);
    console.log(pubKeyPoint.x === G.x && pubKeyPoint.y === G.y ? "✅ PASS" : "❌ FAIL");

    // 4. SIWE Logic
    console.log("\n[4] SIWE Authentication Logic");
    const mockAddr = "0x1234567890123456789012345678901234567890";
    const nonce = CryptoService.generateNonce();
    const hash = CryptoService.getNonceHash(mockAddr, nonce);
    // Verify hash consistency
    const hash2 = CryptoService.getNonceHash(mockAddr, nonce);
    console.log(`Nonce: ${nonce}`);
    console.log(`Hash1: ${hash}`);
    console.log(`Hash2: ${hash2}`);
    console.log(hash === hash2 ? "✅ PASS (Deterministic)" : "❌ FAIL");

    console.log("\n=========================================");
    console.log("🛡️  SUITE COMPLETE 🛡️");
}

runProofSuite().catch(console.error);
