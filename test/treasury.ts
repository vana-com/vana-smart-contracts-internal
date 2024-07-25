import chai, { should } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers, upgrades } from "hardhat";
import { DAT, TreasuryImplementation } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { parseEther } from "../utils/helpers";

chai.use(chaiAsPromised);
should();

describe("Treasury", () => {
  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;

  let treasury: TreasuryImplementation;

  const deploy = async () => {
    [deployer, owner, user1, user2, user3] = await ethers.getSigners();

    const treasuryDeploy = await upgrades.deployProxy(
      await ethers.getContractFactory("TreasuryImplementation"),
      [owner.address],
      {
        kind: "uups",
      },
    );

    treasury = await ethers.getContractAt(
      "TreasuryImplementation",
      treasuryDeploy.target,
    );
  };

  describe("Setup", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should have correct params after deploy", async function () {
      (await treasury.owner()).should.eq(owner);
      (await treasury.version()).should.eq(1);
    });

    it("Should transferOwnership in 2 steps", async function () {
      await treasury
        .connect(owner)
        .transferOwnership(user2.address)
        .should.emit(treasury, "OwnershipTransferStarted")
        .withArgs(owner, user2);
      (await treasury.owner()).should.eq(owner);

      await treasury
        .connect(owner)
        .transferOwnership(user3.address)
        .should.emit(treasury, "OwnershipTransferStarted")
        .withArgs(owner, user3);
      (await treasury.owner()).should.eq(owner);

      await treasury
        .connect(user3)
        .acceptOwnership()
        .should.emit(treasury, "OwnershipTransferred");

      (await treasury.owner()).should.eq(user3);
    });

    it("Should reject transferOwnership when non-owner", async function () {
      await treasury
        .connect(user1)
        .transferOwnership(user2)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("Should reject acceptOwnership when non-newOwner", async function () {
      await treasury
        .connect(owner)
        .transferOwnership(user2.address)
        .should.emit(treasury, "OwnershipTransferStarted")
        .withArgs(owner, user2);
      (await treasury.owner()).should.eq(owner);

      await treasury
        .connect(user3)
        .acceptOwnership()
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user3.address}")`,
        );
    });

    it("Should upgradeTo when owner", async function () {
      await upgrades.upgradeProxy(
        treasury,
        await ethers.getContractFactory("TreasuryImplementationV2Mock", owner),
      );

      const newRoot = await ethers.getContractAt(
        "TreasuryImplementationV2Mock",
        treasury,
      );
      (await newRoot.owner()).should.eq(owner);
      (await newRoot.version()).should.eq(2);

      (await newRoot.test()).should.eq("test");
    });

    it("Should upgradeTo when owner and emit event", async function () {
      const newRootImplementation = await ethers.deployContract(
        "TreasuryImplementationV2Mock",
      );

      await treasury
        .connect(owner)
        .upgradeToAndCall(newRootImplementation, "0x")
        .should.emit(treasury, "Upgraded")
        .withArgs(newRootImplementation);

      const newRoot = await ethers.getContractAt(
        "TreasuryImplementationV2Mock",
        treasury,
      );

      (await newRoot.owner()).should.eq(owner);
      (await newRoot.version()).should.eq(2);

      (await newRoot.test()).should.eq("test");
    });

    it("Should reject upgradeTo when storage layout is incompatible", async function () {
      await upgrades
        .upgradeProxy(
          treasury,
          await ethers.getContractFactory(
            "TreasuryImplementationV3Mock",
            owner,
          ),
        )
        .should.be.rejectedWith("New storage layout is incompatible");
    });

    it("Should reject upgradeTo when non owner", async function () {
      const newRootImplementation = await ethers.deployContract(
        "TreasuryImplementationV2Mock",
      );

      await treasury
        .connect(user1)
        .upgradeToAndCall(newRootImplementation, "0x")
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });
  });

  describe("Receive", () => {
    before(async function () {});

    beforeEach(async () => {
      await deploy();
    });

    it("should receive VANA", async function () {
      const receiveAmount = parseEther(40);

      //transfer VANA to treasury
      await owner.sendTransaction({
        to: treasury,
        value: receiveAmount,
      });

      (await ethers.provider.getBalance(treasury)).should.eq(receiveAmount);
    });
  });

  describe("Withdraw", () => {
    let dat: DAT;

    let treasuryInitialDatBalance = parseEther(1000);
    let user1InitialDatBalance = parseEther(100);

    let treasuryInitialBalance = parseEther(100);

    before(async function () {});

    beforeEach(async () => {
      await deploy();

      dat = await ethers.deployContract("DAT", [
        "Test Data Autonomy Token",
        "TDAT",
        owner.address,
      ]);

      await dat.connect(owner).mint(treasury, treasuryInitialDatBalance);
      await dat.connect(owner).mint(user1, user1InitialDatBalance);

      //transfer VANA to treasury
      await owner.sendTransaction({
        to: treasury,
        value: treasuryInitialBalance,
      });
    });

    it("should withdraw token when owner", async function () {
      const withdrawAmount = parseEther(40);

      await treasury
        .connect(owner)
        .withdraw(dat, user1, withdrawAmount)
        .should.emit(dat, "Transfer")
        .withArgs(treasury, user1, withdrawAmount);

      (await dat.balanceOf(treasury)).should.eq(
        treasuryInitialDatBalance - withdrawAmount,
      );
      (await dat.balanceOf(user1)).should.eq(
        user1InitialDatBalance + withdrawAmount,
      );
    });

    it("should not withdraw token when non owner", async function () {
      await treasury
        .connect(user1)
        .withdraw(dat, user1, treasuryInitialDatBalance)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("should withdraw VANA when owner", async function () {
      let user1InitialBalance = await ethers.provider.getBalance(user1.address);

      const withdrawAmount = parseEther(40);

      await treasury
        .connect(owner)
        .withdraw(ethers.ZeroAddress, user1, withdrawAmount).should.be
        .fulfilled;

      (await ethers.provider.getBalance(treasury)).should.eq(
        treasuryInitialBalance - withdrawAmount,
      );
      (await ethers.provider.getBalance(user1)).should.eq(
        user1InitialBalance + withdrawAmount,
      );
    });

    it("should not withdraw VANA when non owner", async function () {
      await treasury
        .connect(user1)
        .withdraw(ethers.ZeroAddress, user1, parseEther(100))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });
  });
});
