import { Router } from 'express';
import * as rentalController from '../controllers/rental.controller.js';

const router = Router();

/**
 * @route   GET /api/rentals
 * @desc    Get all rentals
 * @access  Public
 */
router.get('/', rentalController.getAllRentals);

/**
 * @route   GET /api/rentals/:id
 * @desc    Get rental by ID
 * @access  Public
 */
router.get('/:id', rentalController.getRentalById);

/**
 * @route   POST /api/rentals
 * @desc    Create a new rental
 * @access  Public (will be protected later)
 */
router.post('/', rentalController.createRental);

/**
 * @route   POST /api/rentals/:id/rent
 * @desc    Rent an NFT
 * @access  Public (will be protected later)
 */
router.post('/:id/rent', rentalController.rentNFT);

/**
 * @route   PUT /api/rentals/:id/return
 * @desc    Return a rented NFT
 * @access  Public (will be protected later)
 */
router.put('/:id/return', rentalController.returnNFT);

/**
 * @route   GET /api/rentals/active
 * @desc    Get active rentals
 * @access  Public
 */
router.get('/active/list', rentalController.getActiveRentals);

/**
 * @route   GET /api/rentals/history
 * @desc    Get rental history
 * @access  Public
 */
router.get('/history/list', rentalController.getRentalHistory);

export default router;
