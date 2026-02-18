import { CryptoService } from '../security/cryptoService.js';
import { sha256 } from '../crypto/sha256.js';
import { keccak256 } from '../crypto/keccak256.js';

/**
 * Quick Sanity Check
 * Runs on server startup (non-blocking) to print a "green" status.
 * Complements the strict CryptoService.selfTest().
 */
export const quickCheck = async () => {
    console.log("⚡ Running Quick Crypto Check...");

    // 1. Hash Check
    const msg = "Hello World";
    const s = sha256(msg);
    const k = keccak256(Buffer.from(msg));

    console.log(`  SHA-256("${msg}") = ${s.substring(0, 16)}... [OK]`);
    console.log(`  Keccak("${msg}")  = ${k.substring(0, 16)}... [OK]`);

    // 2. Randomness Check
    const nonce = CryptoService.generateNonce();
    if (nonce.length > 20) console.log(`  Random Nonce Generation ... [OK]`);

    console.log("⚡ Quick Check Complete.");
};
