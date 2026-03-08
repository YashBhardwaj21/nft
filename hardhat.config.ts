import dotenv from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@typechain/hardhat";

// Load deployment secrets from .env (root), or fallback to backend/.env
import { existsSync } from "fs";
if (existsSync(".env.hardhat")) {
    dotenv.config({ path: ".env.hardhat" });
} else if (existsSync(".env")) {
    dotenv.config({ path: ".env" });
} else {
    dotenv.config({ path: "./backend/.env" });
}

const SEPOLIA_RPC = process.env.SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com";
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";

if (!DEPLOYER_KEY) {
    console.warn("[hardhat.config] ⚠️ DEPLOYER_PRIVATE_KEY not set. Deployment will not work. Set it in .env.");
}

const config: HardhatUserConfig = {
    solidity: "0.8.20",
    networks: {
        localhost: {
            url: 'http://127.0.0.1:8545',
            chainId: 31337,
        },
        sepolia: {
            url: SEPOLIA_RPC,
            accounts: DEPLOYER_KEY ? [DEPLOYER_KEY] : [],
            chainId: 11155111,
        },
    },
    paths: {
        sources: "./contracts",
        artifacts: "./artifacts",
    },
    typechain: {
        outDir: 'typechain-types',
        target: 'ethers-v6',
    },
};

export default config;
