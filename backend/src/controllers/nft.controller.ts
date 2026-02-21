import { Request, Response } from 'express';
import { ApiResponse } from '../types/index.js';
// import { NFTModel } from '../models/NFT.js'; // Removed duplicate

/**
 * Get all NFTs
 */
export const getAllNFTs = async (req: Request, res: Response) => {
    try {
        const { status, collection, minPrice, maxPrice } = req.query;

        const filter: any = {};

        // Filter by status
        if (status) {
            filter.status = status;
        }

        // Filter by collection
        if (collection) {
            filter.collectionName = { $regex: collection, $options: 'i' };
        }

        // Filter by price range
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = minPrice; // Note: Stored as string, comparison might be tricky without casting.Ideally store as number.
            if (maxPrice) filter.price.$lte = maxPrice;
        }

        const filteredNFTs = await NFTModel.find(filter);

        const response: ApiResponse<any[]> = {
            status: 'success',
            data: filteredNFTs,
            message: `Found ${filteredNFTs.length} NFTs`
        };

        res.status(200).json(response);
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Get NFT by ID
 */
export const getNFTById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const nft = await NFTModel.findOne({ id: id });

        if (!nft) {
            return res.status(404).json({
                status: 'error',
                error: 'NFT not found'
            });
        }

        // Increment views
        nft.views = (nft.views || 0) + 1;
        await nft.save();

        const response: ApiResponse<any> = {
            status: 'success',
            data: nft
        };

        res.status(200).json(response);
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Create new NFT
 */
import { uploadFileBuffer, uploadJSON } from '../services/ipfs.service.js';
import { sha256 } from '../crypto/sha256.js';
import { NFTModel } from '../models/NFT.js';
import { ListingModel } from '../models/Listing.js';

/**
 * Prepare NFT for minting
 * 1. Calculate SHA-256 of raw image (for authenticity)
 * 2. Upload image to IPFS
 * 3. Create & upload metadata to IPFS
 * 4. Create Draft NFT record
 * 5. Return tokenURI + draftId for frontend to mint
 */
export const prepareMint = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Image file is required' });
        }

        const { name, description, attributes } = req.body;
        const walletAddress = (req as any).user.id; // JWT payload has 'id', which is wallet address for SIWE

        // 1. Calculate Authenticity Hash (SHA-256 of raw bytes)
        const fileHash = sha256(req.file.buffer);

        // 2. Upload Image to IPFS
        const imageUrl = await uploadFileBuffer(req.file.buffer, req.file.originalname, req.file.mimetype);

        // Extract CID from URL (simple split for demo)
        // https://gateway.pinata.cloud/ipfs/Qm...
        const imageCID = imageUrl.split('/').pop() || '';

        // 3. Create Metadata String
        const metadata = {
            name,
            description,
            image: imageUrl,
            attributes: attributes ? JSON.parse(attributes) : [],
            external_url: "https://daomarketplace.demo",
            file_hash: fileHash, // On-chain proof of matching file
            creator: walletAddress
        };
        const metadataString = JSON.stringify(metadata);

        // 3.1 Calculate Metadata Hash exactly as it will be stored and retrieved
        const metadataHash = '0x' + sha256(metadataString);

        // 3.2 Upload Metadata String as a Buffer to Pinata so it bypasses their JSON formatting
        const metadataUrl = await uploadFileBuffer(
            Buffer.from(metadataString, 'utf-8'),
            `${name.replace(/\s+/g, '-')}-metadata.json`,
            'application/json'
        );
        const metadataCID = metadataUrl.split('/').pop() || '';

        // 4. Create Draft Record
        const draftNFT = await NFTModel.create({
            id: Date.now().toString(), // Temporary ID until minted
            name,
            description,
            image: imageUrl,
            owner: (req as any).user.id, // User ID
            creator: walletAddress,
            collectionName: 'DAO Collection',
            price: 0, // Not listed yet
            status: 'available',

            // Chain Data
            fileHash,
            imageCID,
            metadataCID,
            metadataHash, // Update the DB field
            tokenURI: metadataUrl,
            mintStatus: 'draft'
        });

        // 5. Return Prep Data
        res.status(201).json({
            status: 'success',
            data: {
                draftId: draftNFT.id,
                tokenURI: metadataUrl,
                contractAddress: process.env.CONTRACT_ADDRESS,
                fileHash
            }
        });

    } catch (error: any) {
        console.error("Prepare Mint Error:", error);
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Confirm Mint
 * Frontend calls this after wallet successfully submits transaction
 */
export const confirmMint = async (req: Request, res: Response) => {
    try {
        const idempotencyKey = req.headers['idempotency-key'];
        if (!idempotencyKey) {
            return res.status(400).json({ status: 'error', error: 'Idempotency-Key header is required' });
        }

        const { draftId, txHash } = req.body;

        if (!draftId || !txHash) {
            return res.status(400).json({ error: 'Missing draftId or txHash' });
        }

        const nft = await NFTModel.findOne({ id: draftId });
        if (!nft) {
            const existingNFTByTx = await NFTModel.findOne({ mintTxHash: txHash });
            if (existingNFTByTx) {
                return res.status(200).json({ status: 'success', message: 'Mint already marked as pending' });
            }
            return res.status(404).json({ error: 'Draft NFT not found' });
        }

        nft.mintTxHash = txHash;
        nft.mintStatus = 'pending';
        await nft.save();

        res.status(200).json({ status: 'success', message: 'Mint marked as pending' });

    } catch (error: any) {
        console.error("Confirm Mint Error:", error);
        res.status(500).json({ status: 'error', error: error.message });
    }
};

// Legacy createNFT wrapper if needed, or just remove
export const createNFT = prepareMint;

/**
 * Update NFT
 */
export const updateNFT = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const nft = await NFTModel.findOneAndUpdate(
            { id: id },
            { ...req.body, updatedAt: new Date() },
            { new: true }
        );

        if (!nft) {
            return res.status(404).json({
                status: 'error',
                error: 'NFT not found'
            });
        }

        const response: ApiResponse<any> = {
            status: 'success',
            data: nft,
            message: 'NFT updated successfully'
        };

        res.status(200).json(response);
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Delete NFT from collection
 * - Verifies caller is the owner
 * - Blocks deletion if NFT is currently rented / in escrow
 * - Cancels any active listings first
 */
export const deleteNFT = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.id;

        const nft = await NFTModel.findOne({ id });
        if (!nft) {
            return res.status(404).json({ status: 'error', error: 'NFT not found' });
        }

        // Ownership check
        if (nft.owner !== userId) {
            return res.status(403).json({ status: 'error', error: 'Not authorised. You do not own this NFT.' });
        }

        // Block deletion while actively rented / in escrow
        if (nft.status === 'rented' || nft.isEscrowed) {
            return res.status(400).json({ status: 'error', error: 'Cannot delete an NFT that is currently rented or in escrow.' });
        }

        // Cancel any active listings for this NFT
        await ListingModel.updateMany(
            { nftId: id, status: 'active' },
            { status: 'cancelled' }
        );

        // Hard-delete the NFT document
        await NFTModel.findOneAndDelete({ id });

        const response: ApiResponse<any> = {
            status: 'success',
            data: null,
            message: 'NFT deleted from collection'
        };

        res.status(200).json(response);
    } catch (error: any) {
        console.error('Delete NFT error:', error);
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Get NFTs by user
 */
export const getNFTsByUser = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const userNFTs = await NFTModel.find({ owner: userId });

        const response: ApiResponse<any[]> = {
            status: 'success',
            data: userNFTs,
            message: `Found ${userNFTs.length} NFTs for user ${userId}`
        };

        res.status(200).json(response);
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};
