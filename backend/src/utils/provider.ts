import { ethers } from 'ethers';
import { isNonEmptyString, assertValidRpcUrl } from './typeguards.js';

/**
 * Creates a read-only provider for the configured chain.
 *
 * ARCHITECTURE NOTE: This provider is INTENTIONALLY read-only.
 * The backend is a blockchain observer — it reads events and state.
 * It NEVER signs transactions or holds a private key.
 * All write operations (mint, list, rent, cancel) are signed by the USER'S wallet via MetaMask/WalletConnect.
 *
 * Chain ID is driven by CHAIN_ID env var so this works for any EVM network.
 */
export function getDynamicProvider(): ethers.Provider {
    // Read chain ID from env — defaults to Sepolia (11155111) for safety
    const chainId = parseInt(process.env.CHAIN_ID || '11155111', 10);
    const staticNetwork = ethers.Network.from(chainId);

    // Priority list of RPC URLs to try (first valid one wins)
    const rawUrls = [
        process.env.SEPOLIA_RPC,
        process.env.RPC_URL,
        process.env.TESTNET_RPC_URL,
        process.env.SEPOLIA_RPC_FALLBACK,
        process.env.PUBLIC_RPC,
    ];

    const uniqueUrls = [...new Set(rawUrls.filter(isNonEmptyString))];

    if (uniqueUrls.length === 0) {
        throw new Error('No RPC URL configured. Set SEPOLIA_RPC or RPC_URL in .env');
    }

    // Use the FIRST valid RPC URL
    for (const url of uniqueUrls) {
        try {
            const validatedUrl = assertValidRpcUrl(url);

            if (validatedUrl.startsWith('ws://') || validatedUrl.startsWith('wss://')) {
                console.log(`🔗 Using WebSocket RPC: ${validatedUrl.substring(0, 50)}...`);
                return new ethers.WebSocketProvider(validatedUrl);
            }

            // staticNetwork prevents eth_chainId polling, which can return wrong chain
            // on some free-tier RPCs that serve multiple networks.
            // batchMaxCount: 1 disables batch requests for compatibility with free-tier RPCs.
            const provider = new ethers.JsonRpcProvider(validatedUrl, staticNetwork, {
                staticNetwork: true,
                batchMaxCount: 1,
            });
            console.log(`🔗 Using RPC: ${validatedUrl.substring(0, 60)}...`);
            return provider;
        } catch (err: any) {
            console.warn(`⚠️  Skipping invalid RPC URL "${url}": ${err.message}`);
        }
    }

    throw new Error('No valid RPC URLs could be initialized. Check your .env configuration.');
}
