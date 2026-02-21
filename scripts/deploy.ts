import { ethers, artifacts } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

    // 1. Deploy NFT Contract
    console.log("Deploying DAOMarketplaceNFT...");
    const NFT = await ethers.getContractFactory("DAOMarketplaceNFT");
    const nft = await NFT.deploy();
    await nft.waitForDeployment();
    const nftAddress = await nft.getAddress();
    console.log("✅ DAOMarketplaceNFT deployed to:", nftAddress);

    // 2. Deploy Marketplace Contract
    console.log("Deploying DAOMarketplaceMarket...");
    const Market = await ethers.getContractFactory("DAOMarketplaceMarket");
    // Mock treasury as deployer for now
    const market = await Market.deploy(deployer.address);
    await market.waitForDeployment();
    const marketAddress = await market.getAddress();
    console.log("✅ DAOMarketplaceMarket deployed to:", marketAddress);

    // 3. Update backend .env
    const envPath = path.join(__dirname, "..", "backend", ".env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, "utf8");
    }

    // Helper to update or append env var
    const updateEnv = (key: string, value: string) => {
        const regex = new RegExp(`^${key}=.*`, "m");
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
            envContent += `\n${key}=${value}`;
        }
    };

    updateEnv("CONTRACT_ADDRESS", nftAddress);
    updateEnv("MARKETPLACE_ADDRESS", marketAddress);

    fs.writeFileSync(envPath, envContent);
    console.log("📝 Addresses written to backend/.env");

    // 3.5 Update frontend .env
    const frontendEnvPath = path.join(__dirname, "..", "frontend", ".env");
    if (fs.existsSync(frontendEnvPath)) {
        let frontendEnvContent = fs.readFileSync(frontendEnvPath, "utf8");
        const updateFrontendEnv = (key: string, value: string) => {
            const regex = new RegExp(`^${key}=.*`, "m");
            if (regex.test(frontendEnvContent)) {
                frontendEnvContent = frontendEnvContent.replace(regex, `${key}=${value}`);
            } else {
                frontendEnvContent += `\n${key}=${value}`;
            }
        };
        updateFrontendEnv("VITE_CONTRACT_ADDRESS", nftAddress);
        updateFrontendEnv("VITE_MARKETPLACE_ADDRESS", marketAddress);
        fs.writeFileSync(frontendEnvPath, frontendEnvContent);
        console.log("📝 Addresses written to frontend/.env");
    }

    // 4. Save ABIs to shared/
    const sharedDir = path.join(__dirname, "..", "shared");
    if (!fs.existsSync(sharedDir)) fs.mkdirSync(sharedDir, { recursive: true });

    const saveABI = async (name: string, address: string) => {
        // Use artifacts.readArtifact to ensure we get the full correct artifact
        const artifact = await artifacts.readArtifact(name);

        fs.writeFileSync(
            path.join(sharedDir, `${name}.json`),
            JSON.stringify({ address, abi: artifact.abi }, null, 2)
        );
        console.log(`📝 ABI saved to shared/${name}.json`);
    };

    await saveABI("DAOMarketplaceNFT", nftAddress);
    await saveABI("DAOMarketplaceMarket", marketAddress);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
