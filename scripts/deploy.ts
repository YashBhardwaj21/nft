import { ethers, artifacts } from "hardhat";
import fs from "fs";
import path from "path";

// ─── Phase 5.1: Unified upsertEnv helper ─────────────────────────────────────
// Safely writes or updates a single key=value line in any .env file.
// Creates the file if it does not exist. Never corrupts keys with inline comments.
function upsertEnv(filePath: string, key: string, value: string): void {
    const abs = path.resolve(filePath);
    let content = fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
    const regex = new RegExp(`^${key}=.*`, "m");
    content = regex.test(content)
        ? content.replace(regex, `${key}=${value}`)
        : content.trim() + `\n${key}=${value}`;
    fs.writeFileSync(abs, content.trim() + "\n");
    console.log(`  ✓ ${key} written to ${filePath}`);
}
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

    // 1. Deploy NFT Contract
    console.log("\nDeploying DAOMarketplaceNFT...");
    const NFT = await ethers.getContractFactory("DAOMarketplaceNFT");
    const nft = await NFT.deploy();
    await nft.waitForDeployment();
    const nftAddress = await nft.getAddress();
    console.log("✅ DAOMarketplaceNFT deployed to:", nftAddress);

    // 2. Deploy Marketplace Contract
    console.log("\nDeploying DAOMarketplaceMarket...");
    const Market = await ethers.getContractFactory("DAOMarketplaceMarket");
    // Mock treasury as deployer for now
    const market = await Market.deploy(deployer.address);
    await market.waitForDeployment();
    const marketAddress = await market.getAddress();
    console.log("✅ DAOMarketplaceMarket deployed to:", marketAddress);

    // 3. Write contract addresses to both .env files
    console.log("\n📝 Writing addresses to .env files...");
    upsertEnv("backend/.env", "CONTRACT_ADDRESS", nftAddress);
    upsertEnv("backend/.env", "MARKETPLACE_ADDRESS", marketAddress);
    upsertEnv("frontend/.env", "VITE_CONTRACT_ADDRESS", nftAddress);
    upsertEnv("frontend/.env", "VITE_MARKETPLACE_ADDRESS", marketAddress);

    // 4. Save ABIs to shared/
    console.log("\n📝 Saving ABIs to shared/...");
    const sharedDir = path.resolve("shared");
    if (!fs.existsSync(sharedDir)) fs.mkdirSync(sharedDir, { recursive: true });

    const saveABI = async (name: string, address: string) => {
        const artifact = await artifacts.readArtifact(name);
        fs.writeFileSync(
            path.join(sharedDir, `${name}.json`),
            JSON.stringify({ address, abi: artifact.abi }, null, 2)
        );
        console.log(`  ✓ ABI saved to shared/${name}.json`);
    };

    await saveABI("DAOMarketplaceNFT", nftAddress);
    await saveABI("DAOMarketplaceMarket", marketAddress);

    console.log("\n✅ Deployment complete!");
    console.log(`   NFT:         ${nftAddress}`);
    console.log(`   Marketplace: ${marketAddress}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

