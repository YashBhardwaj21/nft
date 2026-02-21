export async function ensureSepolia() {
    if (!window.ethereum) {
        throw new Error("No Ethereum wallet found. Please install MetaMask or a compatible wallet.");
    }
    const chainId = await window.ethereum.request({ method: "eth_chainId" });

    // 0xaa36a7 is 11155111 (Sepolia) in hex
    if (chainId !== "0xaa36a7") {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xaa36a7" }],
        });
    }
}
