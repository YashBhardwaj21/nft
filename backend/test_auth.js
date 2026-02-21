import { ethers } from 'ethers';
import { CryptoService } from './src/security/cryptoService.js';
import { config } from 'dotenv';
config(); // load .env

async function run() {
    try {
        const wallet = new ethers.Wallet("0x1111111111111111111111111111111111111111111111111111111111111111");
        const address = wallet.address.toLowerCase();

        // 1. Get Nonce
        const nonce = CryptoService.generateNonce();
        const nonceHash = CryptoService.getNonceHash(address, nonce);

        // 2. Mock Frontend create message (matching AuthContext)
        const domain = 'localhost:5173';
        const uri = 'http://localhost:5173';
        const issuedAt = new Date().toISOString();
        const message = [
            `${domain} wants you to sign in with your Ethereum account:`,
            address,
            '',
            'Sign in to DAO Marketplace',
            '',
            `URI: ${uri}`,
            'Version: 1',
            `Chain ID: 11155111`,
            `Nonce: ${nonce}`,
            `Issued At: ${issuedAt}`,
        ].join('\n');

        // 3. Sign it
        const signature = await wallet.signMessage(message);

        // 4. Verify
        const result = CryptoService.authenticateSIWE(message, signature, address, nonceHash);

        console.log("TEST RESULT:", JSON.stringify(result, null, 2));

    } catch (e) {
        console.error("TEST FAILED:", e);
    }
}
run();
