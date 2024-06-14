import chai, { should } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "hardhat";
import { parseEther } from "ethers";
import { DLPT } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

chai.use(chaiAsPromised);
should();

describe("ERC20Swapper", () => {
  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;
  let user4: HardhatEthersSigner;

  let dlpt: DLPT;

  const deploy = async () => {
    [deployer, owner, admin, user1, user2, user3, user4] = await ethers.getSigners();

    dlpt = await ethers.deployContract("DLPT", [owner.address]);
    await dlpt.waitForDeployment();

    await dlpt.connect(owner).changeAdmin(admin);
  }

  describe("DLPT - basic", () => {
    before(async function () {
    });

    beforeEach(async () => {
      await deploy();
    });

    it("should have correct params after deploy", async function () {
      (await dlpt.owner()).should.eq(owner);
      (await dlpt.admin()).should.eq(admin);
      (await dlpt.name()).should.eq("DLP Token");
      (await dlpt.symbol()).should.eq("DLPT");
      (await dlpt.mintBlocked()).should.eq(false);
    });

    it("Should transferOwnership in 2 steps", async function () {
      await dlpt.connect(owner).transferOwnership(user2.address)
        .should.emit(dlpt, "OwnershipTransferStarted")
        .withArgs(owner, user2);
      (await dlpt.owner()).should.eq(owner);

      await dlpt.connect(owner).transferOwnership(user3.address)
        .should.emit(dlpt, "OwnershipTransferStarted")
        .withArgs(owner, user3);
      (await dlpt.owner()).should.eq(owner);

      await dlpt.connect(user3).acceptOwnership()
        .should.fulfilled;
      (await dlpt.owner()).should.eq(user3);
    });

    it("Should reject transferOwnership when non-owner", async function () {
      await dlpt.connect(admin)
        .transferOwnership(user2)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${admin.address}")`
        );
    });

    it("Should changeAdmin when owner", async function () {
      await dlpt.connect(owner).changeAdmin(user2.address)
        .should.emit(dlpt, "AdminChanged")
        .withArgs(admin, user2);
      (await dlpt.admin()).should.eq(user2);
    });

    it("Should reject changeAdmin when non-owner", async function () {
      await dlpt.connect(admin)
        .changeAdmin(user2)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${admin.address}")`
        );
    });

    it("Should blockMint when owner", async function () {
      await dlpt.connect(owner).blockMint()
        .should.emit(dlpt, "MintBlocked");

      (await dlpt.mintBlocked()).should.eq(true);
    });

    it("Should reject blockMint when non-owner", async function () {
      await dlpt.connect(admin)
        .blockMint()
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${admin.address}")`
        );
    });

    it("Should mint when owner", async function () {
      const mintAmount = parseEther("100");

      (await dlpt.balanceOf(user2)).should.eq(0);

      await dlpt.connect(owner)
        .mint(user2, mintAmount)
        .should.be.fulfilled;

      (await dlpt.balanceOf(user2)).should.eq(mintAmount);
    });

    it("Should reject mint when non-owner", async function () {
      await dlpt.connect(admin)
        .mint(user1, parseEther("10"))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${admin.address}")`
        );
    });

    it("Should reject mint when minting is blocked", async function () {
      await dlpt.connect(owner).blockMint()
        .should.emit(dlpt, "MintBlocked");

      await dlpt.connect(owner)
        .mint(user1, parseEther("10"))
        .should.be.rejectedWith(`EnforceMintBlocked()`);
    });

    it("Should blockAddress when admin", async function () {
      (await dlpt.blockListLength()).should.eq(0);

      await dlpt.connect(admin)
        .blockAddress(user2)
        .should.emit(dlpt, "AddressBlocked")
        .withArgs(user2);

      (await dlpt.blockListLength()).should.eq(1);
      (await dlpt.blockListAt(0)).should.eq(user2);
    });

    it("Should reject blockAddress when non-admin", async function () {
      await dlpt.connect(user3)
        .blockAddress(user2)
        .should.be.rejectedWith(`UnauthorizedAdminAction("${user3.address}")`)
    });

    it("Should unblockAddress when admin #1", async function () {
      (await dlpt.blockListLength()).should.eq(0);

      await dlpt.connect(admin)
        .blockAddress(user2)
        .should.emit(dlpt, "AddressBlocked")
        .withArgs(user2);

      (await dlpt.blockListLength()).should.eq(1);
      (await dlpt.blockListAt(0)).should.eq(user2);

      await dlpt.connect(admin)
        .unblockAddress(user2)
        .should.emit(dlpt, "AddressUnblocked")
        .withArgs(user2);

      (await dlpt.blockListLength()).should.eq(0);
    });

    it("Should reject unblockAddress when non-admin", async function () {
      await dlpt.connect(user3)
        .unblockAddress(user2)
        .should.be.rejectedWith(`UnauthorizedAdminAction("${user3.address}")`)
    });

    it("Should unblockAddress when admin #2", async function () {
      (await dlpt.blockListLength()).should.eq(0);

      await dlpt.connect(admin)
        .blockAddress(user2)
        .should.emit(dlpt, "AddressBlocked")
        .withArgs(user2);

      await dlpt.connect(admin)
        .blockAddress(user3)
        .should.emit(dlpt, "AddressBlocked")
        .withArgs(user3);

      (await dlpt.blockListLength()).should.eq(2);
      (await dlpt.blockListAt(0)).should.eq(user2);
      (await dlpt.blockListAt(1)).should.eq(user3);

      await dlpt.connect(admin)
        .unblockAddress(user2)
        .should.emit(dlpt, "AddressUnblocked")
        .withArgs(user2);

      (await dlpt.blockListLength()).should.eq(1);
      (await dlpt.blockListAt(0)).should.eq(user3);
    });

    it("Should transfer", async function () {
      const mintAmount = parseEther("100");
      const transferAmount = parseEther("20");

      await dlpt.connect(owner).mint(user1, mintAmount).should.be.fulfilled;

      (await dlpt.balanceOf(user1)).should.eq(mintAmount);
      (await dlpt.balanceOf(user2)).should.eq(0);
      (await dlpt.totalSupply()).should.eq(mintAmount);

      await dlpt.connect(user1)
        .transfer(user2, parseEther("20"))
        .should.emit(dlpt, "Transfer")
        .withArgs(user1, user2, parseEther("20"));

      (await dlpt.balanceOf(user1)).should.eq(mintAmount - transferAmount);
      (await dlpt.balanceOf(user2)).should.eq(transferAmount);
      (await dlpt.totalSupply()).should.eq(mintAmount);
    });

    it("Should reject transfer when blocked", async function () {
      const mintAmount = parseEther("100");
      const transferAmount = parseEther("20");

      await dlpt.connect(admin)
        .blockAddress(user2)
        .should.emit(dlpt, "AddressBlocked")
        .withArgs(user2);

      await dlpt.connect(owner).mint(user2, mintAmount).should.be.fulfilled;

      (await dlpt.balanceOf(user2)).should.eq(mintAmount);
      (await dlpt.balanceOf(user3)).should.eq(0);
      (await dlpt.totalSupply()).should.eq(mintAmount);

      await dlpt.connect(user2)
        .transfer(user2, parseEther("20"))
        .should.rejectedWith(`UnauthorizedUserAction("${user2.address}")`);

      (await dlpt.balanceOf(user2)).should.eq(mintAmount);
      (await dlpt.balanceOf(user3)).should.eq(0);
      (await dlpt.totalSupply()).should.eq(mintAmount);
    });

    it("Should transfer when unblocked", async function () {
      const mintAmount = parseEther("100");
      const transferAmount = parseEther("20");

      await dlpt.connect(admin)
        .blockAddress(user2)
        .should.emit(dlpt, "AddressBlocked")
        .withArgs(user2);

      await dlpt.connect(owner).mint(user2, mintAmount).should.be.fulfilled;

      (await dlpt.balanceOf(user2)).should.eq(mintAmount);
      (await dlpt.balanceOf(user3)).should.eq(0);
      (await dlpt.totalSupply()).should.eq(mintAmount);

      await dlpt.connect(user2)
        .transfer(user2, parseEther("20"))
        .should.rejectedWith(`UnauthorizedUserAction("${user2.address}")`);

      (await dlpt.balanceOf(user2)).should.eq(mintAmount);
      (await dlpt.balanceOf(user3)).should.eq(0);
      (await dlpt.totalSupply()).should.eq(mintAmount);

      await dlpt.connect(admin)
        .unblockAddress(user2)
        .should.emit(dlpt, "AddressUnblocked")
        .withArgs(user2);

      await dlpt.connect(user2)
        .transfer(user3, parseEther("20"))
        .should.emit(dlpt, "Transfer")
        .withArgs(user2, user3, parseEther("20"));

      (await dlpt.balanceOf(user2)).should.eq(mintAmount - transferAmount);
      (await dlpt.balanceOf(user3)).should.eq(transferAmount);
      (await dlpt.totalSupply()).should.eq(mintAmount);
    });

  });
});