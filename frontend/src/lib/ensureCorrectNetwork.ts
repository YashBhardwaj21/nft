const TARGET_CHAIN_HEX = import.meta.env.VITE_SUPPORTED_CHAIN_HEX;
const TARGET_CHAIN_ID = Number(import.meta.env.VITE_SUPPORTED_CHAIN_ID);

export async function ensureCorrectNetwork() {
    if (!window.ethereum) {
        throw new Error("No Ethereum wallet found. Please install MetaMask or a compatible wallet.");
    }

    const chainId = await window.ethereum.request({ method: "eth_chainId" });

    if (chainId !== TARGET_CHAIN_HEX) {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: TARGET_CHAIN_HEX }],
        });
    }
}

export { TARGET_CHAIN_ID };
