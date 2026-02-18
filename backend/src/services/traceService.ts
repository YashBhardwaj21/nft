import { ethers } from 'ethers';
import { keccak256 } from '../crypto/keccak256.js';
import { recoverAddress, publicKeyToAddress } from '../crypto/ecdsa.js';

const SEPOLIA_RPC = process.env.SEPOLIA_RPC || "https://rpc.sepolia.org";

export class TraceService {
    private provider: ethers.JsonRpcProvider;

    constructor() {
        this.provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    }

    /**
     * Trace the cryptographic steps to verify a transaction sender.
     * 1. Fetch Tx
     * 2. Reconstruct RLP-encoded signing serialization
     * 3. Hash (Keccak-256)
     * 4. Recover Public Key from (r, s, v)
     * 5. Derive Address from Public Key
     */
    public async traceTransaction(txHash: string) {
        // 1. Fetch Transaction
        const tx = await this.provider.getTransaction(txHash);
        if (!tx) throw new Error("Transaction not found");

        // 2. Reconstruct Signing Hash (using ethers to handle RLP complexity)
        // ethers v6 Transaction object has .unsignedHash (v5 had .msgHash?)
        // Actually, let's use ethers to get the signature components and the hash.

        // In ethers v6, `tx.unsignedHash` is not directly public on the Response object.
        // We might need to reconstruct it. 
        // However, `Transaction.from(tx).unsignedHash` works.

        const txObj = ethers.Transaction.from(tx);
        const unsignedHash = txObj.unsignedHash; // The hash that was signed

        const { r, s, v } = tx.signature;

        // 3. Manual Verification Steps (Educational)

        // Step A: Keccak-256 of the RLP-encoded transaction (simulated)
        // We accept the hash from ethers because RLP implementation is out of scope for "custom crypto demo" 
        // unless we want to import an RLP library. The user said "Libraries for RLP... ok".

        // Step B: Recover Address (Custom Crypto)
        // Note: `v` in Ethereum tx is adjusted (27/28 or EIP-155 vector). 
        // Our custom `recoverAddress` expects standard 0/1 recovery id? 
        // Or full signature?
        // Our `recoverAddress` takes (msgHash, signature). 
        // Signature needs to be 65 bytes (r + s + v).

        // Adjust v for recovery
        let recoveryId = v;
        if (recoveryId >= 27) recoveryId -= 27;
        // EIP-155: v = chainId * 2 + 35 + recoveryId. 
        // ethers handles this normalized v usually. 

        // Construct 65-byte signature for our custom functions
        const rBytes = Buffer.from(r.slice(2), 'hex');
        const sBytes = Buffer.from(s.slice(2), 'hex');
        const vByte = Buffer.from([recoveryId]);

        // Our `recoverAddress` typically takes a hex string signature.
        // r (32) + s (32) + v (1)
        const customSignature = '0x' + rBytes.toString('hex') + sBytes.toString('hex') + vByte.toString('hex');

        const customRecovered = recoverAddress(unsignedHash, customSignature);

        return {
            step1_fetch: {
                txHash: tx.hash,
                from: tx.from,
                to: tx.to,
                value: tx.value.toString(),
                nonce: tx.nonce,
            },
            step2_hashing: {
                description: "RLP-encoded transaction data hashed with Keccak-256",
                signingHash: unsignedHash,
                note: "This hash is what the private key signed."
            },
            step3_signature: {
                r: r,
                s: s,
                v: v,
                recoveryId: recoveryId,
                combined65Byte: customSignature
            },
            step4_recovery: {
                description: "Recover public key Q = (s^-1)(zG - rR)",
                recoveredAddress: customRecovered,
                match: customRecovered.toLowerCase() === tx.from.toLowerCase()
            }
        };
    }
}

export const traceService = new TraceService();
