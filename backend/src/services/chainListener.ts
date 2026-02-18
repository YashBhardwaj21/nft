import { ethers } from 'ethers';
import { NFTModel } from '../models/NFT.js';
import axios from 'axios';
import { sha256Buffer } from '../crypto/sha256.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load ABI
const ABI_PATH = path.join(__dirname, '../../../shared/DAOMarketplaceNFT.json');
let CONTRACT_ABI: any[] = [];
let CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

if (fs.existsSync(ABI_PATH)) {
    const data = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8'));
    CONTRACT_ABI = data.abi;
    if (!CONTRACT_ADDRESS) CONTRACT_ADDRESS = data.address;
}

const SEPOLIA_RPC = process.env.SEPOLIA_RPC || "https://rpc.sepolia.org";

export class ChainListener {
    private provider: ethers.JsonRpcProvider;
    private contract: ethers.Contract | null = null;
    private isListening = false;

    constructor() {
        this.provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
        if (CONTRACT_ADDRESS && CONTRACT_ABI.length > 0) {
            this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.provider);
        } else {
            console.warn("ChainListener: Contract address or ABI missing. Listener disabled.");
        }
    }

    public start() {
        if (!this.contract || this.isListening) return;

        console.log(`🎧 Starting Chain Listener for ${CONTRACT_ADDRESS}...`);
        this.isListening = true;

        // Listen for NFTMinted events
        // event NFTMinted(uint256 indexed tokenId, address indexed creator, string tokenURI);
        this.contract.on("NFTMinted", async (tokenId, creator, tokenURI, event) => {
            console.log(`🔔 NFTMinted Event Detected: TokenID=${tokenId}, Creator=${creator}`);

            try {
                // 1. Wait for Confirmations (Prevent reorgs)
                console.log(`⏳ Waiting for 2 confirmations...`);
                const tx = await event.getTransaction();
                await tx.wait(2);
                console.log(`✅ Transaction confirmed: ${tx.hash}`);

                // 2. Find Pending/Draft NFT in DB
                // Matching by mintTxHash is best, or we search by tokenURI if txHash missing
                let nft = await NFTModel.findOne({ mintTxHash: tx.hash });

                if (!nft) {
                    console.log(`⚠️ NFT not found by txHash, trying legacy/URI match...`);
                    // Fallback: match by tokenURI (less safe but distinct enough for demo)
                    // Or match by creator + recent draft
                    nft = await NFTModel.findOne({
                        tokenURI: tokenURI,
                        // creator: creator // DB creator might be case-insensitive, be careful
                        mintStatus: { $in: ['draft', 'pending'] }
                    });
                }

                if (!nft) {
                    console.error(`❌ DB Record not found for TokenID ${tokenId}`);
                    return;
                }

                // 3. Verify Metadata & Image Integrity (The "Oracle" Step)
                await this.verifyNFT(nft, tokenId.toString(), tokenURI, creator);

            } catch (error) {
                console.error(`❌ Error processing Mint event:`, error);
            }
        });
    }

    private async verifyNFT(nft: any, tokenId: string, onChainURI: string, onChainCreator: string) {
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
            // 1. Fetch Metadata
            console.log(`⬇️ Fetching metadata from ${onChainURI}...`);
            const metaRes = await axios.get(convertIpfsUrl(onChainURI));
            const metadata = metaRes.data;

            // 2. Fetch Image
            console.log(`⬇️ Fetching image from ${metadata.image}...`);
            const imageRes = await axios.get(convertIpfsUrl(metadata.image), { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageRes.data);

            // 3. Compute SHA-256
            const computedHash = sha256Buffer(imageBuffer);
            console.log(`🧮 Computed Hash: ${computedHash}`);
            console.log(`💾 Stored Hash:   ${nft.fileHash}`);

            if (computedHash === nft.fileHash) {
                console.log(`✅ VERIFIED: Image content is authentic.`);
                nft.mintStatus = 'confirmed';
                nft.tokenId = tokenId;
                nft.blockNumber = await this.provider.getBlockNumber();
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
