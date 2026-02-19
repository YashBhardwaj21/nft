# Decentralized NFT Rental Platform

A comprehensive full-stack NFT marketplace implementing **ERC-4907 (Rentable NFT Standard)**. Users can mint, list, rent, and trade NFTs with full ownership verification and secure authentication via **Sign-In with Ethereum (SIWE)**.

Built with **React**, **Node.js**, **Express**, **MongoDB**, **Hardhat**, **Wagmi**, and **RainbowKit**.

![License](https://img.shields.io/badge/license-Apache_2.0-blue.svg) ![Solidity](https://img.shields.io/badge/solidity-^0.8.20-363636.svg) ![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?logo=typescript&logoColor=white)

---

## Features

- **Secure Authentication**: SIWE (Sign-In with Ethereum) ensures users prove ownership of their wallet securely using JWT sessions.
- **NFT Minting**: Mint your own NFTs with metadata stored on IPFS (Pinata).
- **Marketplace**: List NFTs for sale or rent. Browse trending and recent assets.
- **Rental System**: Rent NFTs for a specific duration using the ERC-4907 standard. The renter gets usage rights without ownership transfer.
- **User Dashboard**: Track your owned assets, active rentals, listings, and earning history.
- **Clean UI/UX**: Responsive, modern interface built with TailwindCSS and Lucide icons.

---

## Tech Stack

**Frontend**
- **React + Vite** (Fast build tool)
- **TypeScript** (Type safety)
- **Wagmi + Viem** (Ethereum hooks and interactions)
- **RainbowKit** (Wallet connection UI)
- **TailwindCSS** (Styling)

**Backend**
- **Node.js + Express** (API Server)
- **MongoDB** (Database for caching metadata/listings)
- **Mongoose** (ODM)
- **Ethers.js v6** (Blockchain interaction)
- **Pinata SDK** (IPFS Storage)

**Smart Contract**
- **Solidity 0.8.20**
- **Hardhat** (Development environment)
- **ERC-721 + ERC-4907** (NFT Standards)
- **Sepolia Testnet** (Deployment network)

---

## Getting Started

Follow these steps to set up the project locally.

### Prerequisites
- Node.js (v18+)
- MongoDB (Running locally or Atlas cluster)
- MetaMask Wallet (with Sepolia ETH)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/nft-rental-platform.git
cd nft-rental-platform
```

### 2. Install Dependencies
Run this in the root directory to install packages for both frontend and backend:
```bash
npm install
cd frontend && npm install
cd ../backend && npm install
```

### 3. Environment Setup

#### Backend (`backend/.env`)
Create a `.env` file in the `backend/` directory (copy from `.env.example`):
```env
PORT=5000
MONGODB_URI=mongodb+srv://...                   # Your MongoDB Connection String
JWT_SECRET=super_secret_key                     # Random string for JWT
PINATA_JWT=...                                  # IPFS Pinata JWT Token
SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/...  # Alchemy/Infura RPC URL
DEPLOYER_PRIVATE_KEY=...                        # Wallet Private Key (for contract interactions)
CONTRACT_ADDRESS=0xa13e8FDd1FdB64FcA74fC6ef99cF04f09919Bab7  # Deployed Contract
```

#### Frontend (`frontend/.env`)
Create a `.env` file in the `frontend/` directory:
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_WALLET_CONNECT_PROJECT_ID=...              # Get from cloud.walletconnect.com
VITE_CONTRACT_ADDRESS=0xa13e8FDd1FdB64FcA74fC6ef99cF04f09919Bab7
```

### 4. Smart Contract (Optional)
If you want to deploy your own contract:
1. Configure `hardhat.config.ts`.
2. Run deployment script:
   ```bash
   npx hardhat run scripts/deploy.ts --network sepolia
   ```
3. Update `CONTRACT_ADDRESS` in both `.env` files with the new address.

---

## Running the App

### Start Backend
```bash
cd backend
npm run dev
```
Server runs on `http://localhost:5000`.

### Start Frontend
In a new terminal:
```bash
cd frontend
npm run dev
```
App runs on `http://localhost:5173`.

---

## Architecture Overview

**Smart Contract (`DAOMarketplaceNFT.sol`)**
- `mint(address to, string tokenURI)`: Mints a new NFT.
- `setUser(uint256 tokenId, address user, uint64 expires)`: Sets the "renter" of the NFT (ERC-4907 standard).
- `userOf(uint256 tokenId)`: Returns the current renter.

**Backend Services**
- **Auth Service**: Handles SIWE login. Verifies signature -> Issues JWT.
- **Chain Listener**: Listens for `NFTMinted` events on-chain to verify image hashes and index new NFTs automatically.
- **Marketplace Controller**: Manages off-chain listing data (prices, rental duration).

**Authentication Flow**
1. User connects wallet (RainbowKit).
2. Frontend requests a nonce from Backend.
3. User signs the message ("Sign in to NFT Platform...").
4. Backend verifies signature using `ethers.verifyMessage`.
5. Backend issues a secure HTTP-only cookie/JWT.

---

## Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

Distributed under the Apache License, Version 2.0. See `LICENSE` for more information.
