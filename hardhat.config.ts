import dotenv from "dotenv";
import type { HardhatUserConfig } from "hardhat/config";

dotenv.config({ path: "./backend/.env" });

const SEPOLIA_RPC = process.env.SEPOLIA_RPC || "https://rpc.sepolia.org";
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";

const config: HardhatUserConfig = {
    solidity: "0.8.20",
    networks: {
        sepolia: {
            type: "http",
            url: SEPOLIA_RPC,
            accounts: DEPLOYER_KEY ? [DEPLOYER_KEY] : [],
        },
    },
    paths: {
        sources: "./contracts",
        artifacts: "./artifacts",
    },
};

export default config;
