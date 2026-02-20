import { ethers } from 'ethers';
import { NFTModel } from '../models/NFT.js';
import { ListingModel } from '../models/Listing.js';
import axios from 'axios';
import { sha256 } from '../crypto/sha256.js';
import fs from 'fs';
import path from 'path';

// __dirname is available in CommonJS

export class ChainListener {
    private provider: ethers.JsonRpcProvider | null = null;
    private contract: ethers.Contract | null = null;
    private marketContract: ethers.Contract | null = null;
    private isListening = false;
    private contractAddress: string = '';
    private marketAddress: string = '';

    constructor() {
        // Initialization moved to start() to allow dotenv to load first
    }

    public start() {
        if (this.isListening) return;

        // Load Env Vars (now available)
        const SEPOLIA_RPC = process.env.SEPOLIA_RPC || "https://rpc.sepolia.org";
        this.contractAddress = process.env.CONTRACT_ADDRESS || '';
        this.marketAddress = process.env.MARKETPLACE_ADDRESS || '';

        // Load NFT ABI
        const ABI_PATH = path.join(__dirname, '../../../shared/DAOMarketplaceNFT.json');
        let CONTRACT_ABI: any[] = [];
        if (fs.existsSync(ABI_PATH)) {
            const data = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8'));
            CONTRACT_ABI = data.abi;
            if (!this.contractAddress) this.contractAddress = data.address;
        }

        // Load Market ABI
        const MARKET_ABI_PATH = path.join(__dirname, '../../../shared/DAOMarketplaceMarket.json');
        let MARKET_ABI: any[] = [];
        if (fs.existsSync(MARKET_ABI_PATH)) {
            const data = JSON.parse(fs.readFileSync(MARKET_ABI_PATH, 'utf8'));
            MARKET_ABI = data.abi;
            if (!this.marketAddress) this.marketAddress = data.address;
        }

        this.provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
        this.provider.on("error", (e: any) => {
            // Suppress the console spam caused by Alchemy dropping idle polling filters
            if (e && e.error && e.error.message === "filter not found") {
                return;
            }
            console.error("Provider Error:", e);
        });

        if (this.contractAddress && CONTRACT_ABI.length > 0) {
            this.contract = new ethers.Contract(this.contractAddress, CONTRACT_ABI, this.provider);
        } else {
            console.warn('ChainListener: NFT Contract address or ABI missing.');
        }

        if (this.marketAddress && MARKET_ABI.length > 0) {
            this.marketContract = new ethers.Contract(this.marketAddress, MARKET_ABI, this.provider);
        } else {
            console.warn('ChainListener: Market Contract address or ABI missing.');
        }

        if (!this.contract && !this.marketContract) {
            console.warn('ChainListener: Both contracts missing. Listener disabled.');
            return;
        }

        this.isListening = true;

        // Listen for NFTMinted events
        this.contract?.on("NFTMinted", async (tokenId, creator, tokenURI, event) => {
            console.log(`🔔 NFTMinted Event Detected: TokenID=${tokenId}, Creator=${creator}`);
            // ... (existing logic)
        });

        // Listen for ListingCreated events
        this.marketContract?.on("ListingCreated", async (listingId, owner, tokenAddress, tokenId, pricePerDay, event) => {
            console.log(`🔔 ListingCreated Event Detected: ListingId=${listingId}, TokenID=${tokenId}`);
            try {
                const tokenIdStr = tokenId.toString();
                const listingIdNum = Number(listingId);

                // Find NFT by token ID (note: DB uses `id` for our internal tracking and `tokenId` for chain)
                const nft = await NFTModel.findOne({ tokenId: tokenIdStr });
                if (!nft) {
                    console.warn(`⚠️ Cannot reconcile ListingCreated. NFT with TokenID ${tokenIdStr} not found in DB.`);
                    return;
                }

                // Check if we already have this listing (from frontend fast-path)
                const existingListing = await ListingModel.findOne({ nftId: nft.id, status: 'active', type: 'rent' });
                if (existingListing) {
                    if (existingListing.onChainListingId === listingIdNum) {
                        console.log(`✅ Listing ${listingIdNum} exists and is synced.`);
                    } else {
                        // Correct desync
                        console.log(`🔄 Updating Listing ${existingListing.id} with onChainListingId ${listingIdNum}`);
                        existingListing.onChainListingId = listingIdNum;
                        await existingListing.save();
                    }
                } else {
                    // Create it! Frontend missed it (tab closed)
                    console.log(`🔧 Reconciling missing listing for NFT ${nft.id} from Chain Event`);

                    // Fetch full listing details from contract (we need min/max duration)
                    const listingData = await this.contract!.listings(listingId);

                    await ListingModel.create({
                        id: Date.now().toString(),
                        nftId: nft.id,
                        onChainListingId: listingIdNum,
                        sellerId: nft.owner, // assuming they are still the owner
                        price: ethers.formatEther(pricePerDay),
                        rentalPrice: ethers.formatEther(pricePerDay),
                        currency: 'ETH',
                        duration: Number(listingData.maxDuration), // fallback
                        minDuration: Number(listingData.minDuration),
                        maxDuration: Number(listingData.maxDuration),
                        type: 'rent',
                        status: 'active',
                        createdAt: new Date()
                    });

                    nft.status = 'listing';
                    nft.rentalPrice = Number(ethers.formatEther(pricePerDay));
                    nft.maxDuration = Number(listingData.maxDuration);
                    if (!nft.collectionName) nft.collectionName = 'DAO Collection';
                    await nft.save();
                }

            } catch (error) {
                console.error(`❌ Error processing ListingCreated event:`, error);
            }
        });

        // Listen for Rented events
        this.marketContract?.on("Rented", async (listingId, renter, tokenId, expires, totalPrice, event) => {
            console.log(`🔔 Rented Event Detected: ListingId=${listingId}, Renter=${renter}, Expires=${expires}`);
            try {
                const expiresNum = Number(expires);
                const listingIdNum = Number(listingId);

                // Find the listing
                const listing = await ListingModel.findOne({ onChainListingId: listingIdNum });
                if (!listing) {
                    console.warn(`⚠️ Cannot reconcile Rented. Listing with OnChainId ${listingIdNum} not found in DB.`);
                    return;
                }

                const nft = await NFTModel.findOne({ id: listing.nftId });
                if (!nft) {
                    console.warn(`⚠️ Cannot reconcile Rented. NFT with internal ID ${listing.nftId} not found.`);
                    return;
                }

                // Update NFT
                if (nft.status !== 'rented') {
                    nft.status = 'rented';
                    nft.isEscrowed = true;
                    nft.renterWallet = renter;
                    nft.expiresAt = new Date(expiresNum * 1000);
                    nft.rentalEndDate = new Date(expiresNum * 1000);
                    await nft.save();
                    console.log(`✅ Reconciled NFT ${nft.id} to rented state via Chain Event.`);
                }

                // Mark listing as rented
                if (listing.status === 'active') {
                    listing.status = 'rented';
                    await listing.save();
                }

                // Creating renting history (Controller creates rentals on demand usually, but we should record it)
                // We'll skip creating a full RentalModel directly here to avoid duplication if frontend did it,
                // or we could enforce creating the Rental record here always.

            } catch (error) {
                console.error(`❌ Error processing Rented event:`, error);
            }
        });

        // Listen for UpdateUser events (ERC-4907)
        this.contract?.on("UpdateUser", async (tokenId, user, expires, event) => {
            console.log(`🔔 UpdateUser Event Detected: TokenID=${tokenId}, User=${user}, Expires=${expires}`);
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
