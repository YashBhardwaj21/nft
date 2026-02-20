import { ethers } from 'ethers';
import { NFTModel } from '../models/NFT.js';
import axios from 'axios';
import { sha256 } from '../crypto/sha256.js';
import fs from 'fs';
import path from 'path';

// __dirname is available in CommonJS

export class ChainListener {
    private provider: ethers.JsonRpcProvider | null = null;
    private contract: ethers.Contract | null = null;
    private isListening = false;
    private contractAddress: string = '';

    constructor() {
        // Initialization moved to start() to allow dotenv to load first
    }

    public start() {
        if (this.isListening) return;

        // Load Env Vars (now available)
        const SEPOLIA_RPC = process.env.SEPOLIA_RPC || "https://rpc.sepolia.org";
        this.contractAddress = process.env.CONTRACT_ADDRESS || '';

        // Load ABI
        const ABI_PATH = path.join(__dirname, '../../../shared/DAOMarketplaceNFT.json');
        let CONTRACT_ABI: any[] = [];

        if (fs.existsSync(ABI_PATH)) {
            const data = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8'));
            CONTRACT_ABI = data.abi;
            if (!this.contractAddress) this.contractAddress = data.address;
        }

        this.provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);

        if (this.contractAddress && CONTRACT_ABI.length > 0) {
            this.contract = new ethers.Contract(this.contractAddress, CONTRACT_ABI, this.provider);
        } else {
            console.warn('ChainListener: Contract address or ABI missing. Listener disabled.');
            return;
        }

        this.isListening = true;

        // Listen for NFTMinted events
        this.contract.on("NFTMinted", async (tokenId, creator, tokenURI, event) => {
            console.log(`🔔 NFTMinted Event Detected: TokenID=${tokenId}, Creator=${creator}`);
            // ... (existing logic)
        });

        // Listen for UpdateUser events (ERC-4907)
        this.contract.on("UpdateUser", async (tokenId, user, expires, event) => {
            console.log(`🔔 UpdateUser Event Detected: TokenID=${tokenId}, User=${user}, Expires=${expires}`);

            try {
                const tokenIdStr = tokenId.toString();
                const expiresNum = Number(expires);
                const userAddress = user;

                // Update NFT status in DB
                // Find NFT
                const nft = await NFTModel.findOne({ tokenId: tokenIdStr }); // Assuming tokenId is stored as string in DB for this field
                // Note: The NFT model has 'id' (our internal ID) and 'tokenId' (chain ID). 
                // We need to match by tokenId if possible, or we need to ensure we stored tokenId correctly on mint.
                // If tokenId matches, update:

                if (nft) {
                    if (userAddress === ethers.ZeroAddress || expiresNum < Date.now() / 1000) {
                        // Expired or cleared
                        nft.status = 'available';
                        nft.isEscrowed = false;
                        nft.renterWallet = undefined;
                        nft.expiresAt = undefined;
                        nft.rentalEndDate = undefined;
                        console.log(`✅ NFT ${nft.id} returned/expired.`);
                    } else {
                        // Rented
                        nft.status = 'rented';
                        nft.isEscrowed = true;
                        nft.renterWallet = userAddress;
                        nft.expiresAt = new Date(expiresNum * 1000);
                        nft.rentalEndDate = new Date(expiresNum * 1000);
                        console.log(`✅ NFT ${nft.id} marked as rented by ${userAddress}.`);
                    }
                    await nft.save();
                } else {
                    console.log(`⚠️ NFT with TokenID ${tokenIdStr} not found in DB.`);
                    // Try finding by internal ID if tokenId was not set yet (unlikely for rented/minted items)
                }

                // Also update Rental records if we can match them?
                // Ideally we created a 'pending' rental in the controller.
                // We can find the pending rental for this NFT and activate it.
                // However, the event doesn't give us the rental ID.
                // We can assume the latest pending rental for this NFT is the ONE.

            } catch (error) {
                console.error(`❌ Error processing UpdateUser event:`, error);
            }
        });
    }

    private async verifyNFT(nft: any, tokenId: string, onChainURI: string, onChainCreator: string) {
        // ... (existing logic)
        try {
            console.log(`🔍 Verifying NFT ${nft.id}...`);

            // A. Verify Creator Attribution
            if (nft.creator.toLowerCase() !== onChainCreator.toLowerCase()) {
                console.error(`🚨 FRAUD DETECTED: Creator mismatch! DB=${nft.creator}, Chain=${onChainCreator}`);
                nft.mintStatus = 'failed';
                await nft.save();
                return;
            }

            // B. Verify TokenURI consistency
            if (nft.tokenURI !== onChainURI) {
                console.error(`🚨 DATA TAMPERING: URI mismatch! DB=${nft.tokenURI}, Chain=${onChainURI}`);
                nft.mintStatus = 'failed';
                await nft.save();
                return;
            }

            // C. Cryptographic Image Verification
            console.log(`⬇️ Fetching metadata from ${onChainURI}...`);
            const metaRes = await axios.get(convertIpfsUrl(onChainURI));
            const metadata = metaRes.data;

            console.log(`⬇️ Fetching image from ${metadata.image}...`);
            const imageRes = await axios.get(convertIpfsUrl(metadata.image), { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageRes.data);

            const computedHash = sha256(imageBuffer);
            console.log(`🧮 Computed Hash: ${computedHash}`);
            console.log(`💾 Stored Hash:   ${nft.fileHash}`);

            if (computedHash === nft.fileHash) {
                console.log(`✅ VERIFIED: Image content is authentic.`);
                nft.mintStatus = 'confirmed';
                if (this.provider) {
                    nft.blockNumber = await this.provider.getBlockNumber();
                }
                nft.tokenId = tokenId;
                await nft.save();
            } else {
                console.error(`🚨 INTEGRITY FAIL: Hash mismatch!`);
                nft.mintStatus = 'failed';
                await nft.save();
            }

        } catch (error) {
            console.error(`❌ Verification failed:`, error);
        }
    }
}

function convertIpfsUrl(url: string): string {
    if (url.startsWith('ipfs://')) {
        return url.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
    }
    return url;
}

export const chainListener = new ChainListener();
