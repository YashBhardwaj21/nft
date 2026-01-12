import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';

const router = Router();

/**
 * @route   GET /api/users/:id/stats
 * @desc    Get user statistics
 * @access  Public
 */
router.get('/:id/stats', userController.getUserStats);

/**
 * @route   GET /api/users/:id/owned
 * @desc    Get user's owned NFTs
 * @access  Public
 */
router.get('/:id/owned', userController.getOwnedNFTs);

/**
 * @route   GET /api/users/:id/rented
 * @desc    Get user's rented NFTs
 * @access  Public
 */
router.get('/:id/rented', userController.getRentedNFTs);

/**
 * @route   GET /api/users/:id/listings
 * @desc    Get user's active listings
 * @access  Public
 */
router.get('/:id/listings', userController.getUserListings);

/**
 * @route   GET /api/users/:id/profile
 * @desc    Get user profile
 * @access  Public
 */
router.get('/:id/profile', userController.getUserProfile);

/**
 * @route   PUT /api/users/:id/profile
 * @desc    Update user profile
 * @access  Public (will be protected later)
 */
router.put('/:id/profile', userController.updateUserProfile);

export default router;
