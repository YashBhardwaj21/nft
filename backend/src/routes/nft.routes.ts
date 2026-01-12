import { Router } from 'express';
import * as nftController from '../controllers/nft.controller.js';

const router = Router();

/**
 * @route   GET /api/nfts
 * @desc    Get all NFTs
 * @access  Public
 */
router.get('/', nftController.getAllNFTs);

/**
 * @route   GET /api/nfts/:id
 * @desc    Get NFT by ID
 * @access  Public
 */
router.get('/:id', nftController.getNFTById);

/**
 * @route   POST /api/nfts
 * @desc    Create a new NFT
 * @access  Public (will be protected later)
 */
router.post('/', nftController.createNFT);

/**
 * @route   PUT /api/nfts/:id
 * @desc    Update NFT
 * @access  Public (will be protected later)
 */
router.put('/:id', nftController.updateNFT);

/**
 * @route   DELETE /api/nfts/:id
 * @desc    Delete NFT
 * @access  Public (will be protected later)
 */
router.delete('/:id', nftController.deleteNFT);

/**
 * @route   GET /api/nfts/user/:userId
 * @desc    Get NFTs by user ID
 * @access  Public
 */
router.get('/user/:userId', nftController.getNFTsByUser);

export default router;
