import chai, { should } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers, upgrades } from "hardhat";
import { FileRegistryImplementation } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { getCurrentBlockNumber } from "../utils/timeAndBlockManipulation";

chai.use(chaiAsPromised);
should();

export async function deployFileRegistry(
  owner: HardhatEthersSigner,
): Promise<FileRegistryImplementation> {
  const fileRegistryDeploy = await upgrades.deployProxy(
    await ethers.getContractFactory("FileRegistryImplementation"),
    [owner.address],
    {
      kind: "uups",
    },
  );

  return await ethers.getContractAt(
    "FileRegistryImplementation",
    fileRegistryDeploy.target,
  );
}

describe("FileRegistry", () => {
  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let tee1: HardhatEthersSigner;
  let tee2: HardhatEthersSigner;
  let tee3: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;

  let fileRegistry: FileRegistryImplementation;

  const deploy = async () => {
    [deployer, owner, tee1, tee2, tee3, user1, user2, user3] =
      await ethers.getSigners();

    fileRegistry = await deployFileRegistry(owner);
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

  describe("AddFile", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should addFile", async function () {
      await fileRegistry
        .connect(user1)
        .addFile("file1")
        .should.emit(fileRegistry, "FileAdded")
        .withArgs(1, user1, "file1");

      (await fileRegistry.filesCount()).should.eq(1);

      const file1 = await fileRegistry.files(1);
      file1.id.should.eq(1);
      file1.ownerAddress.should.eq(user1.address);
      file1.addedAtBlock.should.eq(await getCurrentBlockNumber());
    });

    it("should addFile multiple times", async function () {
      const currentBlockNumber = await getCurrentBlockNumber();

      await fileRegistry
        .connect(user1)
        .addFile("file1")
        .should.emit(fileRegistry, "FileAdded")
        .withArgs(1, user1, "file1");

      await fileRegistry
        .connect(user2)
        .addFile("file2")
        .should.emit(fileRegistry, "FileAdded")
        .withArgs(2, user2, "file2");

      await fileRegistry
        .connect(user1)
        .addFile("file3")
        .should.emit(fileRegistry, "FileAdded")
        .withArgs(3, user1, "file3");

      (await fileRegistry.filesCount()).should.eq(3);

      const file1 = await fileRegistry.files(1);
      file1.id.should.eq(1);
      file1.ownerAddress.should.eq(user1);
      file1.url.should.eq("file1");
      file1.addedAtBlock.should.eq(currentBlockNumber + 1);

      const file2 = await fileRegistry.files(2);
      file2.id.should.eq(2);
      file2.ownerAddress.should.eq(user2);
      file2.url.should.eq("file2");
      file2.addedAtBlock.should.eq(currentBlockNumber + 2);

      const file3 = await fileRegistry.files(3);
      file3.id.should.eq(3);
      file3.ownerAddress.should.eq(user1);
      file3.url.should.eq("file3");
      file3.addedAtBlock.should.eq(currentBlockNumber + 3);
    });

    it("should allow duplicates", async function () {
      const currentBlockNumber = await getCurrentBlockNumber();

      await fileRegistry
        .connect(user1)
        .addFile("file1")
        .should.emit(fileRegistry, "FileAdded")
        .withArgs(1, user1, "file1");

      await fileRegistry
        .connect(user2)
        .addFile("file1")
        .should.emit(fileRegistry, "FileAdded")
        .withArgs(2, user2, "file1");

      await fileRegistry
        .connect(user1)
        .addFile("file1")
        .should.emit(fileRegistry, "FileAdded")
        .withArgs(3, user1, "file1");

      (await fileRegistry.filesCount()).should.eq(3);

      const file1 = await fileRegistry.files(1);
      file1.id.should.eq(1);
      file1.ownerAddress.should.eq(user1);
      file1.url.should.eq("file1");
      file1.addedAtBlock.should.eq(currentBlockNumber + 1);

      const file2 = await fileRegistry.files(2);
      file2.id.should.eq(2);
      file2.ownerAddress.should.eq(user2);
      file2.url.should.eq("file1");
      file2.addedAtBlock.should.eq(currentBlockNumber + 2);

      const file3 = await fileRegistry.files(3);
      file3.id.should.eq(3);
      file3.ownerAddress.should.eq(user1);
      file3.url.should.eq("file1");
      file3.addedAtBlock.should.eq(currentBlockNumber + 3);
    });

    it("should reject addFile when paused", async function () {
      await fileRegistry.connect(owner).pause();

      await fileRegistry
        .connect(user1)
        .addFile("file1")
        .should.be.rejectedWith("EnforcedPause()");
    });
  });

  describe("Request Permission", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should requestPermission, one file, one tee", async function () {
      await fileRegistry.connect(user1).addFile("file1");

      await fileRegistry
        .connect(tee1)
        .requestPermission(1)
        .should.emit(fileRegistry, "PermissionRequested")
        .withArgs(1, tee1);

      const file1 = await fileRegistry.files(1);
      file1.permissionRequestsCount.should.eq(1);

      (await fileRegistry.filePermissionRequests(1, 1)).should.eq(tee1);
    });

    it("should requestPermission, multiple files, one tee", async function () {
      await fileRegistry.connect(user1).addFile("file1");
      await fileRegistry.connect(user2).addFile("file2");
      await fileRegistry.connect(user1).addFile("file3");

      await fileRegistry
        .connect(tee1)
        .requestPermission(2)
        .should.emit(fileRegistry, "PermissionRequested")
        .withArgs(2, tee1);
      await fileRegistry
        .connect(tee1)
        .requestPermission(3)
        .should.emit(fileRegistry, "PermissionRequested")
        .withArgs(3, tee1);

      const file1 = await fileRegistry.files(1);
      file1.permissionRequestsCount.should.eq(0);

      const file2 = await fileRegistry.files(2);
      file2.permissionRequestsCount.should.eq(1);

      const file3 = await fileRegistry.files(3);
      file3.permissionRequestsCount.should.eq(1);

      (await fileRegistry.filePermissionRequests(2, 1)).should.eq(tee1);
      (await fileRegistry.filePermissionRequests(2, 1)).should.eq(tee1);
    });

    it("should requestPermission, multiple files, multiple tees", async function () {
      await fileRegistry.connect(user1).addFile("file1");
      await fileRegistry.connect(user2).addFile("file2");
      await fileRegistry.connect(user3).addFile("file3");
      await fileRegistry.connect(user1).addFile("file4");
      await fileRegistry.connect(user2).addFile("file5");
      await fileRegistry.connect(user2).addFile("file6");

      await fileRegistry
        .connect(tee1)
        .requestPermission(2)
        .should.emit(fileRegistry, "PermissionRequested")
        .withArgs(2, tee1);
      await fileRegistry
        .connect(tee1)
        .requestPermission(3)
        .should.emit(fileRegistry, "PermissionRequested")
        .withArgs(3, tee1);
      await fileRegistry
        .connect(tee2)
        .requestPermission(3)
        .should.emit(fileRegistry, "PermissionRequested")
        .withArgs(3, tee2);
      await fileRegistry
        .connect(tee3)
        .requestPermission(3)
        .should.emit(fileRegistry, "PermissionRequested")
        .withArgs(3, tee3);
      await fileRegistry
        .connect(tee2)
        .requestPermission(6)
        .should.emit(fileRegistry, "PermissionRequested")
        .withArgs(6, tee2);

      const file1 = await fileRegistry.files(1);
      file1.permissionRequestsCount.should.eq(0);

      const file2 = await fileRegistry.files(2);
      file2.permissionRequestsCount.should.eq(1);

      const file3 = await fileRegistry.files(3);
      file3.permissionRequestsCount.should.eq(3);

      const file4 = await fileRegistry.files(4);
      file4.permissionRequestsCount.should.eq(0);

      const file5 = await fileRegistry.files(5);
      file5.permissionRequestsCount.should.eq(0);

      const file6 = await fileRegistry.files(6);
      file6.permissionRequestsCount.should.eq(1);

      (await fileRegistry.filePermissionRequests(2, 1)).should.eq(tee1);
      (await fileRegistry.filePermissionRequests(3, 1)).should.eq(tee1);
      (await fileRegistry.filePermissionRequests(3, 2)).should.eq(tee2);
      (await fileRegistry.filePermissionRequests(3, 3)).should.eq(tee3);
      (await fileRegistry.filePermissionRequests(6, 1)).should.eq(tee2);
    });

    it("should reject requestPermission when paused", async function () {
      await fileRegistry.connect(owner).pause();

      await fileRegistry
        .connect(tee1)
        .requestPermission(1)
        .should.be.rejectedWith("EnforcedPause()");
    });
  });

  describe("Authorize", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should addPermissions, one file, one tee", async function () {
      await fileRegistry.connect(user1).addFile("file1");

      await fileRegistry
        .connect(user1)
        .addPermissions(1, [{ account: tee1, key: "key1" }])
        .should.emit(fileRegistry, "PermissionGranted")
        .withArgs(1, tee1);

      (await fileRegistry.filePermissions(1, tee1)).should.eq("key1");
      (await fileRegistry.filePermissions(1, tee2)).should.eq("");
    });

    it("should addPermissions, one file, multiple tees #1", async function () {
      await fileRegistry.connect(user1).addFile("file1");

      await fileRegistry
        .connect(user1)
        .addPermissions(1, [{ account: tee1, key: "key1" }])
        .should.emit(fileRegistry, "PermissionGranted")
        .withArgs(1, tee1);

      await fileRegistry
        .connect(user1)
        .addPermissions(1, [{ account: tee2, key: "key2" }])
        .should.emit(fileRegistry, "PermissionGranted")
        .withArgs(1, tee2);

      (await fileRegistry.filePermissions(1, tee1)).should.eq("key1");
      (await fileRegistry.filePermissions(1, tee2)).should.eq("key2");
    });

    it("should addPermissions, one file, multiple tees #2", async function () {
      await fileRegistry.connect(user1).addFile("file1");

      await fileRegistry
        .connect(user1)
        .addPermissions(1, [
          { account: tee1, key: "key1" },
          { account: tee2, key: "key2" },
        ])
        .should.emit(fileRegistry, "PermissionGranted")
        .withArgs(1, tee1)
        .and.emit(fileRegistry, "PermissionGranted")
        .withArgs(1, tee2);

      (await fileRegistry.filePermissions(1, tee1)).should.eq("key1");
      (await fileRegistry.filePermissions(1, tee2)).should.eq("key2");
    });

    it("should addPermissions, multiple files, one tee", async function () {
      await fileRegistry.connect(user1).addFile("file1");
      await fileRegistry.connect(user2).addFile("file2");
      await fileRegistry.connect(user1).addFile("file3");

      await fileRegistry
        .connect(user2)
        .addPermissions(2, [{ account: tee1, key: "key1" }])
        .should.emit(fileRegistry, "PermissionGranted")
        .withArgs(2, tee1);
      await fileRegistry
        .connect(user1)
        .addPermissions(3, [{ account: tee1, key: "key2" }])
        .should.emit(fileRegistry, "PermissionGranted")
        .withArgs(3, tee1);

      (await fileRegistry.filePermissions(1, tee1)).should.eq("");
      (await fileRegistry.filePermissions(2, tee1)).should.eq("key1");
      (await fileRegistry.filePermissions(3, tee1)).should.eq("key2");
    });

    it("should addPermissions, multiple files, multiple tees", async function () {
      await fileRegistry.connect(user1).addFile("file1");
      await fileRegistry.connect(user2).addFile("file2");
      await fileRegistry.connect(user3).addFile("file3");
      await fileRegistry.connect(user1).addFile("file4");
      await fileRegistry.connect(user2).addFile("file5");
      await fileRegistry.connect(user2).addFile("file6");

      await fileRegistry
        .connect(user2)
        .addPermissions(2, [{ account: tee1, key: "key1" }])
        .should.emit(fileRegistry, "PermissionGranted")
        .withArgs(2, tee1);
      await fileRegistry
        .connect(user3)
        .addPermissions(3, [{ account: tee1, key: "key2" }])
        .should.emit(fileRegistry, "PermissionGranted")
        .withArgs(3, tee1);
      await fileRegistry
        .connect(user3)
        .addPermissions(3, [{ account: tee2, key: "key3" }])
        .should.emit(fileRegistry, "PermissionGranted")
        .withArgs(3, tee2);
      await fileRegistry
        .connect(user3)
        .addPermissions(3, [{ account: tee3, key: "key4" }])
        .should.emit(fileRegistry, "PermissionGranted")
        .withArgs(3, tee3);
      await fileRegistry
        .connect(user2)
        .addPermissions(6, [{ account: tee2, key: "key5" }])
        .should.emit(fileRegistry, "PermissionGranted")
        .withArgs(6, tee2);

      (await fileRegistry.filePermissions(1, tee1)).should.eq("");
      (await fileRegistry.filePermissions(2, tee1)).should.eq("key1");
      (await fileRegistry.filePermissions(3, tee1)).should.eq("key2");
      (await fileRegistry.filePermissions(3, tee2)).should.eq("key3");
      (await fileRegistry.filePermissions(3, tee3)).should.eq("key4");
      (await fileRegistry.filePermissions(6, tee2)).should.eq("key5");
    });

    it("should reject addPermissions when non-owner", async function () {
      await fileRegistry.connect(user1).addFile("file1");

      await fileRegistry
        .connect(user2)
        .addPermissions(1, [{ account: tee1, key: "key1" }])
        .should.be.rejectedWith("NotFileOwner()");
    });

    it("should reject addPermissions when paused", async function () {
      await fileRegistry.connect(user1).addFile("file1");
      await fileRegistry.connect(owner).pause();

      await fileRegistry
        .connect(user1)
        .addPermissions(1, [{ account: tee1, key: "key1" }])
        .should.be.rejectedWith("EnforcedPause()");
    });
  });

  describe("AddFileWithAuthorizations", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should addFileWithPermissions, one file, one tee", async function () {
      await fileRegistry
        .connect(user1)
        .addFileWithPermissions("file1", [{ account: tee1, key: "key1" }])
        .should.emit(fileRegistry, "FileAdded")
        .withArgs(1, user1, "file1")
        .emit(fileRegistry, "PermissionGranted")
        .withArgs(1, tee1);

      (await fileRegistry.filePermissions(1, tee1)).should.eq("key1");
      (await fileRegistry.filePermissions(1, tee2)).should.eq("");
    });

    it("should addFileWithPermissions, one file, multiple tees #1", async function () {
      await fileRegistry
        .connect(user1)
        .addFileWithPermissions("file1", [{ account: tee1, key: "key1" }])
        .should.emit(fileRegistry, "FileAdded")
        .withArgs(1, user1, "file1")
        .emit(fileRegistry, "PermissionGranted")
        .withArgs(1, tee1);

      await fileRegistry
        .connect(user1)
        .addPermissions(1, [{ account: tee2, key: "key2" }])
        .should.emit(fileRegistry, "PermissionGranted")
        .withArgs(1, tee2);

      (await fileRegistry.filePermissions(1, tee1)).should.eq("key1");
      (await fileRegistry.filePermissions(1, tee2)).should.eq("key2");
    });

    it("should addFileWithAuthorisations, one file, multiple tees #2", async function () {
      await fileRegistry
        .connect(user1)
        .addFileWithPermissions("file1", [
          { account: tee1, key: "key1" },
          { account: tee2, key: "key2" },
        ])
        .should.emit(fileRegistry, "FileAdded")
        .withArgs(1, user1, "file1")
        .emit(fileRegistry, "PermissionGranted")
        .withArgs(1, tee1)
        .and.emit(fileRegistry, "PermissionGranted")
        .withArgs(1, tee2);

      (await fileRegistry.filePermissions(1, tee1)).should.eq("key1");
      (await fileRegistry.filePermissions(1, tee2)).should.eq("key2");
    });

    it("should addFileWithAuthorisations, multiple files, one tee", async function () {
      await fileRegistry.connect(user1).addFile("file1");

      await fileRegistry
        .connect(user2)
        .addFileWithPermissions("file2", [{ account: tee1, key: "key1" }])
        .should.emit(fileRegistry, "FileAdded")
        .withArgs(2, user2, "file2")
        .emit(fileRegistry, "PermissionGranted")
        .withArgs(2, tee1);
      await fileRegistry
        .connect(user1)
        .addFileWithPermissions("file3", [{ account: tee1, key: "key2" }])
        .should.emit(fileRegistry, "FileAdded")
        .withArgs(3, user1, "file3")
        .emit(fileRegistry, "PermissionGranted")
        .withArgs(3, tee1);

      (await fileRegistry.filePermissions(1, tee1)).should.eq("");
      (await fileRegistry.filePermissions(2, tee1)).should.eq("key1");
      (await fileRegistry.filePermissions(3, tee1)).should.eq("key2");
    });

    it("should addFileWithAuthorisations, multiple files, multiple tees", async function () {
      await fileRegistry
        .connect(user1)
        .addFileWithPermissions("file1", [])
        .should.emit(fileRegistry, "FileAdded")
        .withArgs(1, user1, "file1");
      await fileRegistry
        .connect(user2)
        .addFileWithPermissions("file2", [{ account: tee1, key: "key1" }])
        .should.emit(fileRegistry, "FileAdded")
        .withArgs(2, user2, "file2")
        .emit(fileRegistry, "PermissionGranted")
        .withArgs(2, tee1);
      await fileRegistry
        .connect(user3)
        .addFileWithPermissions("file3", [
          { account: tee1, key: "key2" },
          { account: tee2, key: "key3" },
          { account: tee3, key: "key4" },
        ])
        .should.emit(fileRegistry, "FileAdded")
        .withArgs(3, user3, "file3")
        .emit(fileRegistry, "PermissionGranted")
        .withArgs(3, tee1)
        .emit(fileRegistry, "PermissionGranted")
        .withArgs(3, tee2)
        .emit(fileRegistry, "PermissionGranted")
        .withArgs(3, tee3);

      await fileRegistry
        .connect(user1)
        .addFileWithPermissions("file4", [])
        .should.emit(fileRegistry, "FileAdded")
        .withArgs(4, user1, "file4");

      await fileRegistry
        .connect(user1)
        .addFileWithPermissions("file5", [])
        .should.emit(fileRegistry, "FileAdded")
        .withArgs(5, user1, "file5");

      await fileRegistry
        .connect(user2)
        .addFileWithPermissions("file6", [{ account: tee2, key: "key5" }])
        .should.emit(fileRegistry, "PermissionGranted")
        .withArgs(6, tee2);

      (await fileRegistry.filePermissions(1, tee1)).should.eq("");
      (await fileRegistry.filePermissions(2, tee1)).should.eq("key1");
      (await fileRegistry.filePermissions(3, tee1)).should.eq("key2");
      (await fileRegistry.filePermissions(3, tee2)).should.eq("key3");
      (await fileRegistry.filePermissions(3, tee3)).should.eq("key4");
      (await fileRegistry.filePermissions(4, tee1)).should.eq("");
      (await fileRegistry.filePermissions(5, tee1)).should.eq("");
      (await fileRegistry.filePermissions(6, tee2)).should.eq("key5");
    });

    it("should reject addFileWithAuthorisations when paused", async function () {
      await fileRegistry.connect(owner).pause();

      await fileRegistry
        .connect(user1)
        .addFileWithPermissions("file1", [{ account: tee1, key: "key1" }])
        .should.be.rejectedWith("EnforcedPause()");
    });
  });

  describe("Proof", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should addProof, one file, one tee", async function () {
      await fileRegistry.connect(user1).addFile("file1");
      await fileRegistry
        .connect(user1)
        .addPermissions(1, [{ account: tee1, key: "key1" }]);

      const proof1 = {
        valid: true,
        score: 1n,
        authenticity: 2n,
        ownership: 3n,
        quality: 4n,
        uniqueness: 5n,
      };

      await fileRegistry
        .connect(tee1)
        .addProof(1, proof1)
        .should.emit(fileRegistry, "ProofAdded")
        .withArgs(1, tee1);

      const file1Proof1 = await fileRegistry.fileProofs(1, tee1);

      file1Proof1.valid.should.eq(proof1.valid);
      file1Proof1.score.should.eq(proof1.score);
      file1Proof1.authenticity.should.eq(proof1.authenticity);
      file1Proof1.ownership.should.eq(proof1.ownership);
      file1Proof1.quality.should.eq(proof1.quality);
      file1Proof1.uniqueness.should.eq(proof1.uniqueness);
    });

    it("should addProof, one file, multiple tee", async function () {
      await fileRegistry.connect(user1).addFile("file1");
      await fileRegistry
        .connect(user1)
        .addPermissions(1, [{ account: tee1, key: "key1" }]);
      await fileRegistry
        .connect(user1)
        .addPermissions(1, [{ account: tee2, key: "key2" }]);

      const proof1 = {
        valid: true,
        score: 1n,
        authenticity: 2n,
        ownership: 3n,
        quality: 4n,
        uniqueness: 5n,
      };

      const proof2 = {
        valid: false,
        score: 6n,
        authenticity: 7n,
        ownership: 8n,
        quality: 9n,
        uniqueness: 10n,
      };

      await fileRegistry
        .connect(tee1)
        .addProof(1, proof1)
        .should.emit(fileRegistry, "ProofAdded")
        .withArgs(1, tee1);

      await fileRegistry
        .connect(tee2)
        .addProof(1, proof2)
        .should.emit(fileRegistry, "ProofAdded")
        .withArgs(1, tee2);

      const file1Proof1 = await fileRegistry.fileProofs(1, tee1);
      file1Proof1.valid.should.eq(proof1.valid);
      file1Proof1.score.should.eq(proof1.score);
      file1Proof1.authenticity.should.eq(proof1.authenticity);
      file1Proof1.ownership.should.eq(proof1.ownership);
      file1Proof1.quality.should.eq(proof1.quality);
      file1Proof1.uniqueness.should.eq(proof1.uniqueness);

      const file1Proof2 = await fileRegistry.fileProofs(1, tee2);
      file1Proof2.valid.should.eq(proof2.valid);
      file1Proof2.score.should.eq(proof2.score);
      file1Proof2.authenticity.should.eq(proof2.authenticity);
      file1Proof2.ownership.should.eq(proof2.ownership);
      file1Proof2.quality.should.eq(proof2.quality);
      file1Proof2.uniqueness.should.eq(proof2.uniqueness);
    });

    it("should addProof, multiple files, one tee", async function () {
      await fileRegistry.connect(user1).addFile("file1");
      await fileRegistry.connect(user2).addFile("file2");
      await fileRegistry.connect(user1).addFile("file3");

      await fileRegistry
        .connect(user2)
        .addPermissions(2, [{ account: tee1, key: "key1" }]);
      await fileRegistry
        .connect(user1)
        .addPermissions(3, [{ account: tee1, key: "key2" }]);

      const proof1 = {
        valid: true,
        score: 1n,
        authenticity: 2n,
        ownership: 3n,
        quality: 4n,
        uniqueness: 5n,
      };

      const proof2 = {
        valid: false,
        score: 6n,
        authenticity: 7n,
        ownership: 8n,
        quality: 9n,
        uniqueness: 10n,
      };

      await fileRegistry
        .connect(tee1)
        .addProof(2, proof1)
        .should.emit(fileRegistry, "ProofAdded")
        .withArgs(2, tee1);
      await fileRegistry
        .connect(tee1)
        .addProof(3, proof2)
        .should.emit(fileRegistry, "ProofAdded")
        .withArgs(3, tee1);

      const file1Proof1 = await fileRegistry.fileProofs(1, tee1);
      file1Proof1.valid.should.eq(false);
      file1Proof1.score.should.eq(0);
      file1Proof1.authenticity.should.eq(0);
      file1Proof1.ownership.should.eq(0);
      file1Proof1.quality.should.eq(0);
      file1Proof1.uniqueness.should.eq(0);

      const file2Proof1 = await fileRegistry.fileProofs(2, tee1);
      file2Proof1.valid.should.eq(proof1.valid);
      file2Proof1.score.should.eq(proof1.score);
      file2Proof1.authenticity.should.eq(proof1.authenticity);
      file2Proof1.ownership.should.eq(proof1.ownership);
      file2Proof1.quality.should.eq(proof1.quality);
      file2Proof1.uniqueness.should.eq(proof1.uniqueness);
    });

    it("should addProof, multiple files, multiple tees", async function () {
      await fileRegistry.connect(user1).addFile("file1");
      await fileRegistry.connect(user2).addFile("file2");
      await fileRegistry.connect(user3).addFile("file3");
      await fileRegistry.connect(user1).addFile("file4");
      await fileRegistry.connect(user2).addFile("file5");
      await fileRegistry.connect(user2).addFile("file6");

      await fileRegistry
        .connect(user2)
        .addPermissions(2, [{ account: tee1, key: "key1" }]);
      await fileRegistry
        .connect(user3)
        .addPermissions(3, [{ account: tee1, key: "key2" }]);
      await fileRegistry
        .connect(user3)
        .addPermissions(3, [{ account: tee2, key: "key3" }]);
      await fileRegistry
        .connect(user3)
        .addPermissions(3, [{ account: tee3, key: "key4" }]);
      await fileRegistry
        .connect(user2)
        .addPermissions(6, [{ account: tee2, key: "key5" }]);

      const proof1 = {
        valid: true,
        score: 1n,
        authenticity: 2n,
        ownership: 3n,
        quality: 4n,
        uniqueness: 5n,
      };

      const proof2 = {
        valid: false,
        score: 6n,
        authenticity: 7n,
        ownership: 8n,
        quality: 9n,
        uniqueness: 10n,
      };

      const proof3 = {
        valid: true,
        score: 11n,
        authenticity: 12n,
        ownership: 13n,
        quality: 14n,
        uniqueness: 15n,
      };

      const proof4 = {
        valid: false,
        score: 16n,
        authenticity: 17n,
        ownership: 18n,
        quality: 19n,
        uniqueness: 20n,
      };

      const proof5 = {
        valid: true,
        score: 21n,
        authenticity: 22n,
        ownership: 23n,
        quality: 24n,
        uniqueness: 25n,
      };

      await fileRegistry
        .connect(tee1)
        .addProof(2, proof1)
        .should.emit(fileRegistry, "ProofAdded")
        .withArgs(2, tee1);
      await fileRegistry.connect(tee1).addProof(3, proof2);
      await fileRegistry.connect(tee2).addProof(3, proof3);
      await fileRegistry.connect(tee3).addProof(3, proof4);
      await fileRegistry.connect(tee2).addProof(6, proof5);

      const file1Proof1 = await fileRegistry.fileProofs(1, tee1);
      file1Proof1.valid.should.eq(false);
      file1Proof1.score.should.eq(0);
      file1Proof1.authenticity.should.eq(0);
      file1Proof1.ownership.should.eq(0);
      file1Proof1.quality.should.eq(0);
      file1Proof1.uniqueness.should.eq(0);

      const file2Proof1 = await fileRegistry.fileProofs(2, tee1);
      file2Proof1.valid.should.eq(proof1.valid);
      file2Proof1.score.should.eq(proof1.score);
      file2Proof1.authenticity.should.eq(proof1.authenticity);
      file2Proof1.ownership.should.eq(proof1.ownership);
      file2Proof1.quality.should.eq(proof1.quality);
      file2Proof1.uniqueness.should.eq(proof1.uniqueness);

      const file3Proof1 = await fileRegistry.fileProofs(3, tee1);
      file3Proof1.valid.should.eq(proof2.valid);
      file3Proof1.score.should.eq(proof2.score);
      file3Proof1.authenticity.should.eq(proof2.authenticity);
      file3Proof1.ownership.should.eq(proof2.ownership);
      file3Proof1.quality.should.eq(proof2.quality);
      file3Proof1.uniqueness.should.eq(proof2.uniqueness);

      const file3Proof2 = await fileRegistry.fileProofs(3, tee2);
      file3Proof2.valid.should.eq(proof3.valid);
      file3Proof2.score.should.eq(proof3.score);
      file3Proof2.authenticity.should.eq(proof3.authenticity);
      file3Proof2.ownership.should.eq(proof3.ownership);
      file3Proof2.quality.should.eq(proof3.quality);
      file3Proof2.uniqueness.should.eq(proof3.uniqueness);

      const file3Proof3 = await fileRegistry.fileProofs(3, tee3);
      file3Proof3.valid.should.eq(proof4.valid);
      file3Proof3.score.should.eq(proof4.score);
      file3Proof3.authenticity.should.eq(proof4.authenticity);
      file3Proof3.ownership.should.eq(proof4.ownership);
      file3Proof3.quality.should.eq(proof4.quality);
      file3Proof3.uniqueness.should.eq(proof4.uniqueness);

      const file6Proof1 = await fileRegistry.fileProofs(6, tee2);
      file6Proof1.valid.should.eq(proof5.valid);
      file6Proof1.score.should.eq(proof5.score);
      file6Proof1.authenticity.should.eq(proof5.authenticity);
      file6Proof1.ownership.should.eq(proof5.ownership);
      file6Proof1.quality.should.eq(proof5.quality);
      file6Proof1.uniqueness.should.eq(proof5.uniqueness);
    });

    it("should reject addProof when non-authorised tee", async function () {
      await fileRegistry.connect(user1).addFile("file1");
      await fileRegistry
        .connect(user1)
        .addPermissions(1, [{ account: tee1, key: "key1" }]);

      const proof1 = {
        valid: true,
        score: 1n,
        authenticity: 2n,
        ownership: 3n,
        quality: 4n,
        uniqueness: 5n,
      };

      await fileRegistry
        .connect(tee2)
        .addProof(1, proof1)
        .should.be.rejectedWith("NotFileAttestator()");
    });

    it("should reject addProof when paused", async function () {
      await fileRegistry.connect(user1).addFile("file1");
      await fileRegistry
        .connect(user1)
        .addPermissions(1, [{ account: tee1, key: "key1" }]);
      await fileRegistry.connect(owner).pause();

      const proof1 = {
        valid: true,
        score: 1n,
        authenticity: 2n,
        ownership: 3n,
        quality: 4n,
        uniqueness: 5n,
      };

      await fileRegistry
        .connect(tee1)
        .addProof(1, proof1)
        .should.be.rejectedWith("EnforcedPause()");
    });
  });
});
