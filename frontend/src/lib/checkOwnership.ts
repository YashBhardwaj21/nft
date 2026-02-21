import { readContract } from "@wagmi/core";
import { config } from "../config/wagmi";

const NFT_ABI = [
    {
        "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
        "name": "ownerOf",
        "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
        "stateMutability": "view",
        "type": "function"
    }
];

export async function verifyOwnership(contractAddress: `0x${string}`, tokenId: bigint, user: `0x${string}`) {
    const owner = await readContract(config, {
        address: contractAddress as `0x${string}`,
        abi: NFT_ABI,
        functionName: "ownerOf",
        args: [tokenId],
    });

    const ownerAddress = (owner as string).toLowerCase();
    const userAddress = user.toLowerCase();

    console.log(`[PREFLIGHT] verifyOwnership check:
    => Contract: ${contractAddress}
    => Token ID: ${tokenId.toString()}
    => On-Chain Owner: ${ownerAddress}
    => Connected User: ${userAddress}`);

    if (ownerAddress !== userAddress) {
        throw new Error(`You are not the NFT owner. On-chain owner is ${ownerAddress.slice(0, 6)}... Connected: ${userAddress.slice(0, 6)}...`);
    }
}
