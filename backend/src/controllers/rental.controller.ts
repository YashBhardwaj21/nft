import { Request, Response } from 'express';
import { RentalModel } from '../models/Rental.js';
import { NFTModel } from '../models/NFT.js';
import { ListingModel } from '../models/Listing.js';

/**
 * Return a rented NFT by NFT ID
 */
export const returnNFTByNFTId = async (req: Request, res: Response) => {
    try {
        const { nftId } = req.params; // from /return/:nftId
        const userId = (req as any).user.id;

        // 1. Find NFT
        const nft = await NFTModel.findOne({ id: nftId });
        if (!nft) {
            return res.status(404).json({ status: 'error', error: 'NFT not found' });
        }

        // 2. Validate Return Eligibility
        if (nft.status !== 'rented' && !nft.isEscrowed) {
            return res.status(400).json({ status: 'error', error: 'NFT is not currently rented.' });
        }

        // Check if caller is renter OR if rental has expired (allowing owner to reclaim)
        const isRenter = nft.renterWallet === userId;
        const isOwner = nft.owner === userId;
        const isExpired = nft.expiresAt && new Date() > new Date(nft.expiresAt);

        if (!isRenter && !(isOwner && isExpired)) {
            return res.status(403).json({
                status: 'error',
                error: 'Not authorized. Only the renter can return, or owner if expired.'
            });
        }

        // 3. Find and Close Rental Record
        const rental = await RentalModel.findOne({ nftId: nftId, status: 'active' });
        if (rental) {
            rental.status = 'completed';
            rental.endDate = new Date();
            await rental.save();
        }

        // 4. Update NFT
        nft.status = 'available'; // Released back to owner
        nft.isEscrowed = false;
        nft.renterWallet = undefined;
        nft.expiresAt = undefined;
        nft.rentalEndDate = undefined;
        await nft.save();

        res.status(200).json({
            status: 'success',
            message: 'NFT returned successfully'
        });

    } catch (error: any) {
        console.error("Return Error:", error);
        res.status(500).json({ status: 'error', error: error.message });
    }
};

// ... existing functions ...

/**
 * Rent an NFT from a Listing (Model A)
 */
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

// Load ABI
const ABI_PATH = path.join(__dirname, '../../../shared/DAOMarketplaceMarket.json');
let MARKETPLACE_ABI: any[] = [];
let MARKETPLACE_ADDRESS = process.env.MARKETPLACE_ADDRESS || '';

if (fs.existsSync(ABI_PATH)) {
    const data = JSON.parse(fs.readFileSync(ABI_PATH, 'utf8'));
    MARKETPLACE_ABI = data.abi;
    if (!MARKETPLACE_ADDRESS) MARKETPLACE_ADDRESS = data.address;
}

/**
 * Rent an NFT from a Listing (returns transaction payload)
 */
export const rentFromListing = async (req: Request, res: Response) => {
    try {
        const { listingId, nftId, days } = req.body;
        const renterId = (req as any).user.id;

        if ((!listingId && !nftId) || !days) {
            return res.status(400).json({ status: 'error', error: 'Missing listingId (or nftId) or days' });
        }

        // 1. Find Listing
        let targetListingId = listingId;

        // If listingId is not provided, try to find active rental listing for this NFT
        if (!targetListingId && nftId) {
            const activeListing = await ListingModel.findOne({ nftId: nftId, status: 'active', type: 'rent' });
            if (!activeListing) {
                return res.status(404).json({ status: 'error', error: 'No active rental listing found for this NFT.' });
            }
            targetListingId = activeListing.id;
        }

        // 2. Fetch Listing from DB to get price (or trust frontend?)
        const listing = await ListingModel.findOne({ id: targetListingId });
        if (!listing) {
            return res.status(404).json({ status: 'error', error: 'Listing not found' });
        }

        if (listing.onChainListingId === undefined || listing.onChainListingId === null) {
            return res.status(400).json({ status: 'error', error: 'This listing is missing an on-chain Listing ID. It may be corrupt or legacy.' });
        }

        // 3. Generate Transaction Data
        if (!MARKETPLACE_ADDRESS || MARKETPLACE_ABI.length === 0) {
            return res.status(503).json({ status: 'error', error: 'Marketplace contract not configured' });
        }

        const pricePerDay = BigInt(listing.price); // Assuming price is stored in wei as string
        const totalPrice = pricePerDay * BigInt(days);

        const iface = new ethers.Interface(MARKETPLACE_ABI);
        const data = iface.encodeFunctionData("rent", [listing.onChainListingId, days]);

        res.status(200).json({
            status: 'success',
            data: {
                to: MARKETPLACE_ADDRESS,
                data: data,
                value: totalPrice.toString(),
                chainId: 11155111 // Sepolia, or make dynamic
            },
            message: 'Transaction generated'
        });

    } catch (error: any) {
        console.error("Rent Error:", error);
        res.status(500).json({ status: 'error', error: error.message });
    }
};

/**
 * Get all rentals
 */
export const getAllRentals = async (req: Request, res: Response) => {
    try {
        const { status, userId } = req.query;

        const filter: any = {};

        // Filter by status
        if (status) {
            filter.status = status;
        }

        // Filter by user (renter or owner)
        if (userId) {
            filter.$or = [
                { renterId: userId },
                { ownerId: userId }
            ];
        }

        const rentals = await RentalModel.find(filter);

        res.status(200).json({
            status: 'success',
            data: rentals,
            message: `Found ${rentals.length} rentals`
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Get rental by ID
 */
export const getRentalById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const rental = await RentalModel.findOne({ id: id });

        if (!rental) {
            return res.status(404).json({
                status: 'error',
                error: 'Rental not found'
            });
        }

        res.status(200).json({
            status: 'success',
            data: rental
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Create a new rental listing
 */
export const createRental = async (req: Request, res: Response) => {
    try {
        const { nftId, ownerId, rentalPrice, duration } = req.body;

        // Validate required fields
        if (!nftId || !ownerId || !rentalPrice || !duration) {
            return res.status(400).json({
                status: 'error',
                error: 'Missing required fields: nftId, ownerId, rentalPrice, duration'
            });
        }

        // Verify NFT exists and is owned by ownerId
        const nft = await NFTModel.findOne({ id: nftId });
        if (!nft) {
            return res.status(404).json({ status: 'error', error: 'NFT not found' });
        }
        if (nft.owner !== ownerId) {
            return res.status(403).json({ status: 'error', error: 'You do not own this NFT' });
        }

        const newRental = await RentalModel.create({
            id: Date.now().toString(),
            nftId,
            renterId: '', // Will be set when someone rents it
            ownerId,
            rentalPrice,
            currency: 'ETH',
            startDate: new Date(),
            endDate: new Date(Date.now() + duration * 24 * 60 * 60 * 1000), // duration in days
            status: 'active',
            createdAt: new Date()
        });

        // Update NFT status? Or keep it 'available' until actually rented?
        // Assuming creating a "Rental Listing" implies it's available for rent.
        // If we want to prevent it from being sold while listed for rent, we should change status.
        // For now, let's leave NFT status as is or 'listing' (if we had that enum).
        // Since enum is 'available', 'rented', 'listing' (sale).
        // Let's assume it stays 'available' effectively, or maybe add 'renting_listed'.
        // Sticking to minimal changes for now.

        res.status(201).json({
            status: 'success',
            data: newRental,
            message: 'Rental listing created successfully'
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Rent an NFT
 */
export const rentNFT = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { renterId, duration } = req.body;

        const rental = await RentalModel.findOne({ id: id });

        if (!rental) {
            return res.status(404).json({
                status: 'error',
                error: 'Rental not found'
            });
        }

        if (rental.status !== 'active' || (rental.renterId && rental.renterId !== '')) {
            return res.status(400).json({
                status: 'error',
                error: 'NFT is not available for rent'
            });
        }

        // Update rental with renter info
        rental.renterId = renterId;
        rental.startDate = new Date();
        rental.endDate = new Date(Date.now() + (duration || 7) * 24 * 60 * 60 * 1000);
        rental.transactionHash = `0x${Math.random().toString(16).substr(2, 40)}`;
        // rental.status remains 'active' until completed? Or 'rented'? 
        // Types say 'active' | 'completed' | 'cancelled'. So 'active' matches.

        await rental.save();

        // Update NFT status to 'rented'
        await NFTModel.findOneAndUpdate({ id: rental.nftId }, { status: 'rented' });

        res.status(200).json({
            status: 'success',
            data: rental,
            message: 'NFT rented successfully'
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Return a rented NFT
 */
export const returnNFT = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const rental = await RentalModel.findOne({ id: id });

        if (!rental) {
            return res.status(404).json({
                status: 'error',
                error: 'Rental not found'
            });
        }

        if (rental.status !== 'active') {
            return res.status(400).json({
                status: 'error',
                error: 'Rental is not active'
            });
        }

        // Update rental status
        rental.status = 'completed';
        rental.endDate = new Date();
        await rental.save();

        // Update NFT status back to 'available'
        await NFTModel.findOneAndUpdate({ id: rental.nftId }, { status: 'available' });

        res.status(200).json({
            status: 'success',
            data: rental,
            message: 'NFT returned successfully'
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Get active rentals
 */
export const getActiveRentals = async (req: Request, res: Response) => {
    try {
        const { userId } = req.query;

        const filter: any = { status: 'active' };

        // Filter by user if provided
        if (userId) {
            filter.$or = [
                { renterId: userId },
                { ownerId: userId }
            ];
        }

        const activeRentals = await RentalModel.find(filter);

        res.status(200).json({
            status: 'success',
            data: activeRentals,
            message: `Found ${activeRentals.length} active rentals`
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};

/**
 * Get rental history
 */
export const getRentalHistory = async (req: Request, res: Response) => {
    try {
        const { userId } = req.query;

        const filter: any = {
            status: { $in: ['completed', 'cancelled'] }
        };

        // Filter by user if provided
        if (userId) {
            filter.$or = [
                { renterId: userId },
                { ownerId: userId }
            ];
        }

        const history = await RentalModel.find(filter).sort({ createdAt: -1 });

        res.status(200).json({
            status: 'success',
            data: history,
            message: `Found ${history.length} rental records`
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
};
