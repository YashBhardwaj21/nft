import { Request, Response } from 'express';
import { Rental, ApiResponse } from '../types/index.js';

// Mock data storage
let rentals: Rental[] = [
    {
        id: '1',
        nftId: '2',
        renterId: 'user3',
        ownerId: 'user2',
        rentalPrice: '0.08',
        currency: 'ETH',
        startDate: new Date('2026-01-10'),
        endDate: new Date('2026-01-17'),
        status: 'active',
        transactionHash: '0x123abc...',
        createdAt: new Date('2026-01-10')
    },
    {
        id: '2',
        nftId: '1',
        renterId: 'user4',
        ownerId: 'user1',
        rentalPrice: '0.1',
        currency: 'ETH',
        startDate: new Date('2026-01-05'),
        endDate: new Date('2026-01-12'),
        status: 'completed',
        transactionHash: '0x456def...',
        createdAt: new Date('2026-01-05')
    }
];

/**
 * Get all rentals
 */
export const getAllRentals = (req: Request, res: Response) => {
    try {
        const { status, userId } = req.query;

        let filteredRentals = [...rentals];

        // Filter by status
        if (status) {
            filteredRentals = filteredRentals.filter(r => r.status === status);
        }

        // Filter by user (renter or owner)
        if (userId) {
            filteredRentals = filteredRentals.filter(
                r => r.renterId === userId || r.ownerId === userId
            );
        }

        res.status(200).json({
            status: 'success',
            data: filteredRentals,
            message: `Found ${filteredRentals.length} rentals`
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
export const getRentalById = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const rental = rentals.find(r => r.id === id);

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
export const createRental = (req: Request, res: Response) => {
    try {
        const { nftId, ownerId, rentalPrice, duration } = req.body;

        // Validate required fields
        if (!nftId || !ownerId || !rentalPrice || !duration) {
            return res.status(400).json({
                status: 'error',
                error: 'Missing required fields: nftId, ownerId, rentalPrice, duration'
            });
        }

        const newRental: Rental = {
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
        };

        rentals.push(newRental);

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
export const rentNFT = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { renterId, duration } = req.body;

        const rental = rentals.find(r => r.id === id);

        if (!rental) {
            return res.status(404).json({
                status: 'error',
                error: 'Rental not found'
            });
        }

        if (rental.status !== 'active' || rental.renterId) {
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
export const returnNFT = (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const rental = rentals.find(r => r.id === id);

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
export const getActiveRentals = (req: Request, res: Response) => {
    try {
        const { userId } = req.query;

        let activeRentals = rentals.filter(r => r.status === 'active');

        // Filter by user if provided
        if (userId) {
            activeRentals = activeRentals.filter(
                r => r.renterId === userId || r.ownerId === userId
            );
        }

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
export const getRentalHistory = (req: Request, res: Response) => {
    try {
        const { userId } = req.query;

        let history = rentals.filter(r => r.status === 'completed' || r.status === 'cancelled');

        // Filter by user if provided
        if (userId) {
            history = history.filter(
                r => r.renterId === userId || r.ownerId === userId
            );
        }

        // Sort by most recent first
        history.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
        });

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
