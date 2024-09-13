import chai, { should } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "hardhat";
import { parseEther } from "ethers";
import { DAT } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

chai.use(chaiAsPromised);
should();

describe("ERC20", () => {
  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;
  let user4: HardhatEthersSigner;

  let dat: DAT;

  const deploy = async () => {
    [deployer, owner, admin, user1, user2, user3, user4] =
      await ethers.getSigners();

    dat = await ethers.deployContract("DAT", [
      "Test Data Autonomy Token",
      "TDAT",
      owner.address,
    ]);

    await dat.connect(owner).changeAdmin(admin);
  };

  describe("DLPT - basic", () => {
    before(async function () {});

    beforeEach(async () => {
      await deploy();
    });

    it("should have correct params after deploy", async function () {
      (await dat.owner()).should.eq(owner);
      (await dat.admin()).should.eq(admin);
      (await dat.name()).should.eq("Test Data Autonomy Token");
      (await dat.symbol()).should.eq("TDAT");
      (await dat.mintBlocked()).should.eq(false);
    });

    it("Should transferOwnership in 2 steps", async function () {
      await dat
        .connect(owner)
        .transferOwnership(user2.address)
        .should.emit(dat, "OwnershipTransferStarted")
        .withArgs(owner, user2);
      (await dat.owner()).should.eq(owner);

      await dat
        .connect(owner)
        .transferOwnership(user3.address)
        .should.emit(dat, "OwnershipTransferStarted")
        .withArgs(owner, user3);
      (await dat.owner()).should.eq(owner);

      await dat.connect(user3).acceptOwnership().should.fulfilled;
      (await dat.owner()).should.eq(user3);
    });

    it("Should reject transferOwnership when non-owner", async function () {
      await dat
        .connect(admin)
        .transferOwnership(user2)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${admin.address}")`,
        );
    });

    it("Should changeAdmin when owner", async function () {
      await dat
        .connect(owner)
        .changeAdmin(user2.address)
        .should.emit(dat, "AdminChanged")
        .withArgs(admin, user2);
      (await dat.admin()).should.eq(user2);
    });

    it("Should reject changeAdmin when non-owner", async function () {
      await dat
        .connect(admin)
        .changeAdmin(user2)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${admin.address}")`,
        );
    });

    it("Should blockMint when owner", async function () {
      await dat.connect(owner).blockMint().should.emit(dat, "MintBlocked");

      (await dat.mintBlocked()).should.eq(true);
    });

    it("Should reject blockMint when non-owner", async function () {
      await dat
        .connect(admin)
        .blockMint()
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${admin.address}")`,
        );
    });

    it("Should mint when owner", async function () {
      const mintAmount = parseEther("100");

      (await dat.balanceOf(user2)).should.eq(0);

      await dat.connect(owner).mint(user2, mintAmount).should.be.fulfilled;

      (await dat.balanceOf(user2)).should.eq(mintAmount);
    });

    it("Should reject mint when non-owner", async function () {
      await dat
        .connect(admin)
        .mint(user1, parseEther("10"))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${admin.address}")`,
        );
    });

    it("Should reject mint when minting is blocked", async function () {
      await dat.connect(owner).blockMint().should.emit(dat, "MintBlocked");

      await dat
        .connect(owner)
        .mint(user1, parseEther("10"))
        .should.be.rejectedWith(`EnforceMintBlocked()`);
    });

    it("Should blockAddress when admin", async function () {
      (await dat.blockListLength()).should.eq(0);

      await dat
        .connect(admin)
        .blockAddress(user2)
        .should.emit(dat, "AddressBlocked")
        .withArgs(user2);

      (await dat.blockListLength()).should.eq(1);
      (await dat.blockListAt(0)).should.eq(user2);
    });

    it("Should reject blockAddress when non-admin", async function () {
      await dat
        .connect(user3)
        .blockAddress(user2)
        .should.be.rejectedWith(`UnauthorizedAdminAction("${user3.address}")`);
    });

    it("Should unblockAddress when admin #1", async function () {
      (await dat.blockListLength()).should.eq(0);

      await dat
        .connect(admin)
        .blockAddress(user2)
        .should.emit(dat, "AddressBlocked")
        .withArgs(user2);

      (await dat.blockListLength()).should.eq(1);
      (await dat.blockListAt(0)).should.eq(user2);

      await dat
        .connect(admin)
        .unblockAddress(user2)
        .should.emit(dat, "AddressUnblocked")
        .withArgs(user2);

      (await dat.blockListLength()).should.eq(0);
    });

    it("Should reject unblockAddress when non-admin", async function () {
      await dat
        .connect(user3)
        .unblockAddress(user2)
        .should.be.rejectedWith(`UnauthorizedAdminAction("${user3.address}")`);
    });

    it("Should unblockAddress when admin #2", async function () {
      (await dat.blockListLength()).should.eq(0);

      await dat
        .connect(admin)
        .blockAddress(user2)
        .should.emit(dat, "AddressBlocked")
        .withArgs(user2);

      await dat
        .connect(admin)
        .blockAddress(user3)
        .should.emit(dat, "AddressBlocked")
        .withArgs(user3);

      (await dat.blockListLength()).should.eq(2);
      (await dat.blockListAt(0)).should.eq(user2);
      (await dat.blockListAt(1)).should.eq(user3);

      await dat
        .connect(admin)
        .unblockAddress(user2)
        .should.emit(dat, "AddressUnblocked")
        .withArgs(user2);

      (await dat.blockListLength()).should.eq(1);
      (await dat.blockListAt(0)).should.eq(user3);
    });

    it("Should transfer", async function () {
      const mintAmount = parseEther("100");
      const transferAmount = parseEther("20");

      await dat.connect(owner).mint(user1, mintAmount).should.be.fulfilled;

      (await dat.balanceOf(user1)).should.eq(mintAmount);
      (await dat.balanceOf(user2)).should.eq(0);
      (await dat.totalSupply()).should.eq(mintAmount);

      await dat
        .connect(user1)
        .transfer(user2, parseEther("20"))
        .should.emit(dat, "Transfer")
        .withArgs(user1, user2, parseEther("20"));

      (await dat.balanceOf(user1)).should.eq(mintAmount - transferAmount);
      (await dat.balanceOf(user2)).should.eq(transferAmount);
      (await dat.totalSupply()).should.eq(mintAmount);
    });

    it("Should reject transfer when blocked", async function () {
      const mintAmount = parseEther("100");
      const transferAmount = parseEther("20");

      await dat
        .connect(admin)
        .blockAddress(user2)
        .should.emit(dat, "AddressBlocked")
        .withArgs(user2);

      await dat.connect(owner).mint(user2, mintAmount).should.be.fulfilled;

      (await dat.balanceOf(user2)).should.eq(mintAmount);
      (await dat.balanceOf(user3)).should.eq(0);
      (await dat.totalSupply()).should.eq(mintAmount);

      await dat
        .connect(user2)
        .transfer(user2, parseEther("20"))
        .should.rejectedWith(`UnauthorizedUserAction("${user2.address}")`);

      (await dat.balanceOf(user2)).should.eq(mintAmount);
      (await dat.balanceOf(user3)).should.eq(0);
      (await dat.totalSupply()).should.eq(mintAmount);
    });

    it("Should transfer when unblocked", async function () {
      const mintAmount = parseEther("100");
      const transferAmount = parseEther("20");

      await dat
        .connect(admin)
        .blockAddress(user2)
        .should.emit(dat, "AddressBlocked")
        .withArgs(user2);

      await dat.connect(owner).mint(user2, mintAmount).should.be.fulfilled;

      (await dat.balanceOf(user2)).should.eq(mintAmount);
      (await dat.balanceOf(user3)).should.eq(0);
      (await dat.totalSupply()).should.eq(mintAmount);

      await dat
        .connect(user2)
        .transfer(user2, parseEther("20"))
        .should.rejectedWith(`UnauthorizedUserAction("${user2.address}")`);

      (await dat.balanceOf(user2)).should.eq(mintAmount);
      (await dat.balanceOf(user3)).should.eq(0);
      (await dat.totalSupply()).should.eq(mintAmount);

      await dat
        .connect(admin)
        .unblockAddress(user2)
        .should.emit(dat, "AddressUnblocked")
        .withArgs(user2);

      await dat
        .connect(user2)
        .transfer(user3, parseEther("20"))
        .should.emit(dat, "Transfer")
        .withArgs(user2, user3, parseEther("20"));

      (await dat.balanceOf(user2)).should.eq(mintAmount - transferAmount);
      (await dat.balanceOf(user3)).should.eq(transferAmount);
      (await dat.totalSupply()).should.eq(mintAmount);
    });
  });
});
