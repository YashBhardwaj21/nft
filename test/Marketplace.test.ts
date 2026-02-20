
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("DAOMarketplace", function () {
    async function deployFixture() {
        const [owner, renter, otherAccount] = await ethers.getSigners();

        const NFT = await ethers.getContractFactory("DAOMarketplaceNFT");
        const nft = await NFT.deploy();

        const Market = await ethers.getContractFactory("DAOMarketplaceMarket");
        const market = await Market.deploy(owner.address); // Treasury is owner for test

        return { nft, market, owner, renter, otherAccount };
    }

    describe("Deployment", function () {
        it("Should deploy successfully", async function () {
            const { nft, market } = await loadFixture(deployFixture);
            expect(await nft.getAddress()).to.be.properAddress;
            expect(await market.getAddress()).to.be.properAddress;
        });
    });

    describe("Minting", function () {
        it("Should mint an NFT", async function () {
            const { nft, owner } = await loadFixture(deployFixture);
            await nft.mint(owner.address, "ipfs://test");
            expect(await nft.ownerOf(1)).to.equal(owner.address);
        });
    });

    describe("Rentals (ERC-4907)", function () {
        it("Should allow owner to set user manually", async function () {
            const { nft, owner, renter } = await loadFixture(deployFixture);
            await nft.mint(owner.address, "ipfs://test");

            const expires = Math.floor(Date.now() / 1000) + 3600; // 1 hour
            await nft.setUser(1, renter.address, expires);

            expect(await nft.userOf(1)).to.equal(renter.address);
            expect(await nft.userExpires(1)).to.equal(expires);
        });

        it("Should expire user automatically", async function () {
            const { nft, owner, renter } = await loadFixture(deployFixture);
            await nft.mint(owner.address, "ipfs://test");

            const expires = Math.floor(Date.now() / 1000) + 3600;
            await nft.setUser(1, renter.address, expires);

            // Simulate time passing (requires correct network helpers or just check logic)
            // Since we can't easily warp time in this simple test without helpers, 
            // we check the view function logic:
            // userOf checks block.timestamp. 
            // We can use network.provider.send("evm_increaseTime", [3601])

            await ethers.provider.send("evm_increaseTime", [3601]);
            await ethers.provider.send("evm_mine", []);

            expect(await nft.userOf(1)).to.equal(ethers.ZeroAddress);
        });
    });

    describe("Marketplace Integration", function () {
        it("Should list and rent an NFT", async function () {
            const { nft, market, owner, renter } = await loadFixture(deployFixture);
            await nft.mint(owner.address, "ipfs://test");

            // Approve marketplace
            await nft.setApprovalForAll(await market.getAddress(), true);

            // List
            const pricePerDay = ethers.parseEther("0.1");
            await market.listNFT(await nft.getAddress(), 1, pricePerDay, 1, 30);

            // Rent
            const days = 5;
            const cost = pricePerDay * BigInt(days);

            await market.connect(renter).rent(1, days, { value: cost });

            // Check renter is user
            expect(await nft.userOf(1)).to.equal(renter.address);

            // Check owner received funds (minus fee) - approximate
            // ...
        });
    });
});
