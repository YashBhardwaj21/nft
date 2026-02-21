import { ethers } from 'ethers';

/**
 * Creates a dynamic, highly-available provider using multiple fallback JSON-RPC endpoints.
 * This ensures smooth UX even if a specific RPC (like Alchemy or Infura) goes down or has an invalid key.
 */
export function getDynamicProvider(): ethers.Provider {
    const rawUrls = [
        process.env.RPC_URL,
        process.env.SEPOLIA_RPC,
        process.env.TESTNET_RPC_URL,
        // We removed the generic public nodes because they sporadically glitch and return Mainnet (1) 
        // to `eth_chainId` polling, which causes ethers v6 FallbackProvider to panic and violently crash.
    ];

    // Filter out undefined, empty, and duplicates
    const uniqueUrls = [...new Set(rawUrls.filter(url => Boolean(url) && url!.trim() !== ''))] as string[];

    const providers = uniqueUrls.map((url, index) => {
        // Assign higher weights/priority to user-provided environment configs
        // Priority 1 is highest priority. Ethers sends requests to Priority 1 first.
        const priority = index < 3 ? 1 : 2;

        if (url.startsWith('ws')) {
            return { provider: new ethers.WebSocketProvider(url), priority, weight: 1 };
        }

        // Sepolia Testnet ID is 11155111.
        const staticNetwork = ethers.Network.from(11155111);

        const provider = new ethers.JsonRpcProvider(url, staticNetwork, { staticNetwork: true });

        return {
            provider: provider,
            priority,
            weight: 1
        };
    });

    if (providers.length === 1) {
        return providers[0].provider;
    }

    // Ethers v6 FallbackProvider defaults to requiring a quorum (consensus) across multiple RPCs.
    // If one RPC is slightly out of sync or rejects the eth_getLogs block range, the entire call crashes.
    // Setting `quorum: 1` ensures that as long as ANY single priority sub-provider succeeds, the call returns.
    return new ethers.FallbackProvider(providers, 1);
}
