import { readContract } from "@wagmi/core";
import { config } from "../config/wagmi";

import NFTContractData from '@shared/DAOMarketplaceNFT.json';
const NFT_ABI = NFTContractData.abi;

export async function verifyOwnership(contractAddress: `0x${string}`, tokenId: bigint, user: `0x${string}`) {
    const owner = await readContract(config as any, {
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
