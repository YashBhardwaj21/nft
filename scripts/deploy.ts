import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

    const NFT = await ethers.getContractFactory("DAOMarketplaceNFT");
    const nft = await NFT.deploy();
    await nft.waitForDeployment();

    const address = await nft.getAddress();
    console.log("✅ DAOMarketplaceNFT deployed to:", address);

    // Append to backend .env
    const envPath = path.join(__dirname, "..", "backend", ".env");
    const envContent = fs.readFileSync(envPath, "utf8");

    if (envContent.includes("CONTRACT_ADDRESS=")) {
        // Replace existing
        const updated = envContent.replace(
            /CONTRACT_ADDRESS=.*/,
            `CONTRACT_ADDRESS=${address}`
        );
        fs.writeFileSync(envPath, updated);
    } else {
        // Append
        fs.appendFileSync(envPath, `\n# NFT Contract (Sepolia)\nCONTRACT_ADDRESS=${address}\n`);
    }

    console.log("📝 CONTRACT_ADDRESS written to backend/.env");

    // Also save ABI for frontend/backend use
    const artifact = await ethers.getContractFactory("DAOMarketplaceNFT");
    const abi = artifact.interface.formatJson();
    const abiDir = path.join(__dirname, "..", "shared");
    if (!fs.existsSync(abiDir)) fs.mkdirSync(abiDir, { recursive: true });
    fs.writeFileSync(
        path.join(abiDir, "DAOMarketplaceNFT.json"),
        JSON.stringify({ address, abi: JSON.parse(abi) }, null, 2)
    );
    console.log("📝 ABI saved to shared/DAOMarketplaceNFT.json");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
