const TARGET_CHAIN_HEX = import.meta.env.VITE_SUPPORTED_CHAIN_HEX;
const TARGET_CHAIN_ID = Number(import.meta.env.VITE_SUPPORTED_CHAIN_ID);

export async function ensureCorrectNetwork() {
    if (!window.ethereum) {
        throw new Error("No Ethereum wallet found. Please install MetaMask or a compatible wallet.");
    }

    const chainId = await window.ethereum.request({ method: "eth_chainId" });

    if (chainId !== TARGET_CHAIN_HEX) {
        try {
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: TARGET_CHAIN_HEX }],
            });
        } catch (switchError: any) {
            // This error code indicates that the chain has not been added to MetaMask.
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [
                            {
                                chainId: TARGET_CHAIN_HEX,
                                chainName: import.meta.env.VITE_NETWORK_NAME || 'Hardhat Local',
                                rpcUrls: [import.meta.env.VITE_SEPOLIA_RPC_URL || 'http://127.0.0.1:8545'],
                                nativeCurrency: {
                                    name: "ETH",
                                    symbol: "ETH",
                                    decimals: 18
                                }
                            },
                        ],
                    });
                } catch (addError) {
                    throw new Error("Failed to add the network to your wallet.");
                }
            } else {
                throw switchError;
            }
        }
    }
}

export { TARGET_CHAIN_ID };
