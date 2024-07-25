import chai, { should } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers, upgrades } from "hardhat";
import { FileRegistryImplementation } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

chai.use(chaiAsPromised);
should();

describe("FileRegistry", () => {
  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;

  let fileRegistry: FileRegistryImplementation;

  const deploy = async () => {
    [deployer, owner, user1, user2, user3] = await ethers.getSigners();

    const fileRegistryDeploy = await upgrades.deployProxy(
      await ethers.getContractFactory("FileRegistryImplementation"),
      [owner.address],
      {
        kind: "uups",
      },
    );

    fileRegistry = await ethers.getContractAt(
      "FileRegistryImplementation",
      fileRegistryDeploy.target,
    );
  };

  describe("Setup", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should have correct params after deploy", async function () {
      (await fileRegistry.owner()).should.eq(owner);
      (await fileRegistry.version()).should.eq(1);
    });

    it("Should transferOwnership in 2 steps", async function () {
      await fileRegistry
        .connect(owner)
        .transferOwnership(user2.address)
        .should.emit(fileRegistry, "OwnershipTransferStarted")
        .withArgs(owner, user2);
      (await fileRegistry.owner()).should.eq(owner);

      await fileRegistry
        .connect(owner)
        .transferOwnership(user3.address)
        .should.emit(fileRegistry, "OwnershipTransferStarted")
        .withArgs(owner, user3);
      (await fileRegistry.owner()).should.eq(owner);

      await fileRegistry
        .connect(user3)
        .acceptOwnership()
        .should.emit(fileRegistry, "OwnershipTransferred");

      (await fileRegistry.owner()).should.eq(user3);
    });

    it("Should reject transferOwnership when non-owner", async function () {
      await fileRegistry
        .connect(user1)
        .transferOwnership(user2)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("Should reject acceptOwnership when non-newOwner", async function () {
      await fileRegistry
        .connect(owner)
        .transferOwnership(user2.address)
        .should.emit(fileRegistry, "OwnershipTransferStarted")
        .withArgs(owner, user2);
      (await fileRegistry.owner()).should.eq(owner);

      await fileRegistry
        .connect(user3)
        .acceptOwnership()
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user3.address}")`,
        );
    });

    it("Should upgradeTo when owner", async function () {
      await upgrades.upgradeProxy(
        fileRegistry,
        await ethers.getContractFactory(
          "FileRegistryImplementationV2Mock",
          owner,
        ),
      );

      const newRoot = await ethers.getContractAt(
        "FileRegistryImplementationV2Mock",
        fileRegistry,
      );
      (await newRoot.owner()).should.eq(owner);
      (await newRoot.version()).should.eq(2);

      (await newRoot.test()).should.eq("test");
    });

    it("Should upgradeTo when owner and emit event", async function () {
      const newRootImplementation = await ethers.deployContract(
        "FileRegistryImplementationV2Mock",
      );

      await fileRegistry
        .connect(owner)
        .upgradeToAndCall(newRootImplementation, "0x")
        .should.emit(fileRegistry, "Upgraded")
        .withArgs(newRootImplementation);

      const newRoot = await ethers.getContractAt(
        "FileRegistryImplementationV2Mock",
        fileRegistry,
      );

      (await newRoot.owner()).should.eq(owner);
      (await newRoot.version()).should.eq(2);

      (await newRoot.test()).should.eq("test");
    });

    it("Should reject upgradeTo when storage layout is incompatible", async function () {
      await upgrades
        .upgradeProxy(
          fileRegistry,
          await ethers.getContractFactory(
            "FileRegistryImplementationV3Mock",
            owner,
          ),
        )
        .should.be.rejectedWith("New storage layout is incompatible");
    });

    it("Should reject upgradeTo when non owner", async function () {
      const newRootImplementation = await ethers.deployContract(
        "FileRegistryImplementationV2Mock",
      );

      await fileRegistry
        .connect(user1)
        .upgradeToAndCall(newRootImplementation, "0x")
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });
  });
});
