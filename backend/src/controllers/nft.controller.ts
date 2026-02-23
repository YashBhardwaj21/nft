import { Request, Response } from 'express';
import { ApiResponse } from '../types/index.js';
import { NFTModel } from '../models/NFT.js';
import { ListingModel } from '../models/Listing.js';
import { DraftModel } from '../models/Draft.js';
import { uploadFileBuffer } from '../services/ipfs.service.js';
import { sha256 } from '../crypto/sha256.js';
import { hashMetadata } from '../utils/canonicalMetadata.js';

/**
 * Get all NFTs
 */
export const getAllNFTs = async (req: Request, res: Response) => {
    try {
        const { collection } = req.query;
        const filter: any = {};
        if (collection) filter.collectionName = { $regex: collection, $options: 'i' };

        const nfts = await NFTModel.find(filter).lean();

        const now = new Date();
        const enrichedNFTs = await Promise.all(nfts.map(async (nft) => {
            const isListed = await ListingModel.exists({
                tokenAddress: nft.tokenAddress?.toLowerCase(),
                tokenId: nft.tokenId?.toString(),
                status: 'ACTIVE'
            });
            const isRented = nft.expiresAt && nft.expiresAt > now;
            return { ...nft, isListed: !!isListed, isRented: !!isRented };
        }));

        res.status(200).json({ status: 'success', data: enrichedNFTs });
    } catch (error: any) {
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Get NFT by ID (supports compound 'tokenAddress-tokenId' or legacy id)
 */
export const getNFTById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        let query: any = { id };

        // Handle compound ID: tokenAddress-tokenId
        if (id.includes('-')) {
            const [tokenAddress, tokenId] = id.split('-');
            query = { tokenAddress: tokenAddress.toLowerCase(), tokenId };
        }

        const nft: any = await NFTModel.findOne(query).lean();
        if (!nft) return res.status(404).json({ status: 'error', error: 'NFT not found' });

        const isListed = await ListingModel.exists({
            tokenAddress: nft.tokenAddress?.toLowerCase(),
            tokenId: nft.tokenId?.toString(),
            status: 'ACTIVE'
        });
        const isRented = nft.expiresAt && nft.expiresAt > new Date();

        res.status(200).json({ status: 'success', data: { ...nft, isListed: !!isListed, isRented: !!isRented } });
    } catch (error: any) {
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Prepare NFT for minting (Draft Phase)
 */
export const prepareMint = async (req: Request, res: Response) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Image file is required' });

        const { name, description, attributes } = req.body;
        const walletAddress = (req as any).user.id; // From JWT

        const fileHash = sha256(req.file.buffer);
        const imageUrl = await uploadFileBuffer(req.file.buffer, req.file.originalname, req.file.mimetype);

        const metadataObj = {
            name,
            description: description || '',
            image: imageUrl,
            attributes: attributes ? JSON.parse(attributes) : [],
            external_url: "https://daomarketplace.demo",
            file_hash: fileHash,
            creator: walletAddress
        };

        const metadataHash = hashMetadata(metadataObj);
        const { canonicalizeMetadata } = await import('../utils/canonicalMetadata.js');
        const metadataString = JSON.stringify(canonicalizeMetadata(metadataObj));

        const metadataUrl = await uploadFileBuffer(
            Buffer.from(metadataString, 'utf-8'),
            `${name.replace(/\s+/g, '-')}-metadata.json`,
            'application/json'
        );

        // ALWAYS write to DraftModel, not NFTModel
        const draft = await DraftModel.create({
            metadataHash,
            creator: walletAddress,
            name,
            description,
            image: imageUrl,
            attributes: metadataObj.attributes,
            fileHash,
            tokenURI: metadataUrl,
            status: 'PREPARED',
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) // 48h
        });

        res.status(201).json({
            status: 'success',
            data: {
                draftId: draft._id,
                tokenURI: metadataUrl,
                contractAddress: process.env.CONTRACT_ADDRESS,
                metadataHash
            }
        });
    } catch (error: any) {
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Confirm Mint (Proactive Update)
 * Creates the NFT record in NFTModel from the draft data + on-chain info.
 */
export const confirmMint = async (req: Request, res: Response) => {
    try {
        const { draftId, txHash, tokenId, blockNumber, metadataHash } = req.body;
        const walletAddress = (req as any).user.id;

        const draft = await DraftModel.findById(draftId);
        if (!draft) return res.status(404).json({ error: 'Draft not found' });
        if (draft.creator !== walletAddress) return res.status(403).json({ error: 'Not authorized' });
        if (draft.status === 'MINTED') {
            return res.status(200).json({ status: 'success', message: 'Already confirmed' });
        }

        const contractAddress = (process.env.CONTRACT_ADDRESS || '').toLowerCase();
        if (!contractAddress) {
            return res.status(503).json({ error: 'CONTRACT_ADDRESS not configured' });
        }

        // Create the NFT fact record — this is what getOwnedNFTs queries
        const nft = await NFTModel.findOneAndUpdate(
            { tokenAddress: contractAddress, tokenId: String(tokenId) },
            {
                $setOnInsert: {
                    tokenAddress: contractAddress,
                    tokenId: String(tokenId),
                    name: draft.name,
                    description: draft.description || '',
                    image: draft.image,
                    collectionName: 'DAO Collection',
                    creator: walletAddress,
                    owner: walletAddress,
                    tokenURI: draft.tokenURI,
                    metadataHash: metadataHash || draft.metadataHash,
                    mintTxHash: txHash,
                    blockNumber: blockNumber || 0,
                    id: `${contractAddress}-${tokenId}`,
                }
            },
            { upsert: true, new: true }
        );

        // Mark draft as completed
        draft.status = 'MINTED';
        await draft.save();

        res.status(200).json({ status: 'success', message: 'Mint confirmed', data: nft });
    } catch (error: any) {
        res.status(500).json({ status: 'error', error: error.message });
    }
};

export const createNFT = prepareMint;

/**
 * Get NFTs by user
 */
export const getNFTsByUser = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const nfts = await NFTModel.find({ owner: userId.toLowerCase() }).lean();

        const enrichedNFTs = await Promise.all(nfts.map(async (nft) => {
            const isListed = await ListingModel.exists({
                tokenAddress: nft.tokenAddress?.toLowerCase(),
                tokenId: nft.tokenId?.toString(),
                status: 'ACTIVE'
            });
            const isRented = nft.expiresAt && nft.expiresAt > new Date();
            return { ...nft, isListed: !!isListed, isRented: !!isRented };
        }));

        res.status(200).json({ status: 'success', data: enrichedNFTs });
    } catch (error: any) {
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Update NFT
 */
export const updateNFT = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        let query: any = { id };
        if (id.includes('-')) {
            const [tokenAddress, tokenId] = id.split('-');
            query = { tokenAddress: tokenAddress.toLowerCase(), tokenId };
        }

        const nft = await NFTModel.findOneAndUpdate(query, { $set: updates }, { new: true });
        if (!nft) return res.status(404).json({ error: 'NFT not found' });
        res.status(200).json({ status: 'success', data: nft });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Delete NFT
 */
export const deleteNFT = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        let query: any = { id };
        if (id.includes('-')) {
            const [tokenAddress, tokenId] = id.split('-');
            query = { tokenAddress: tokenAddress.toLowerCase(), tokenId };
        }

        const result = await NFTModel.deleteOne(query);
        if (result.deletedCount === 0) return res.status(404).json({ error: 'NFT not found' });
        res.status(200).json({ status: 'success', message: 'NFT deleted' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
