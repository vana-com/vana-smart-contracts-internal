import chai, { should } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers, upgrades } from "hardhat";
import { DataRegistryImplementation } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { getCurrentBlockNumber } from "../utils/timeAndBlockManipulation";
import { parseEther } from "../utils/helpers";

chai.use(chaiAsPromised);
should();

export async function deployDataRegistry(
  owner: HardhatEthersSigner,
): Promise<DataRegistryImplementation> {
  const dataRegistryDeploy = await upgrades.deployProxy(
    await ethers.getContractFactory("DataRegistryImplementation"),
    [owner.address],
    {
      kind: "uups",
    },
  );

  return await ethers.getContractAt(
    "DataRegistryImplementation",
    dataRegistryDeploy.target,
  );
}

export type ProofData = {
  score: bigint;
  dlpId: number;
  metadata: string;
  proofUrl: string;
  instruction: string;
};

export type Proof = {
  signature: string;
  data: ProofData;
};

const proof0: Proof = {
  signature:
    "0x00000000000bdcaa8fe6748edfcb04d5ab59a75123fc06f10f1f82dcc50bd8365677d868ef40572529760d0f093c73d781053d9a6a597e0c169e58b2685f74161c",
  data: {
    score: parseEther(0),
    dlpId: 0,
    metadata: "",
    proofUrl: "",
    instruction: "",
  },
};

const proof1: Proof = {
  signature:
    "0x5347f83fe352b10144e7c6eaca13e682be88e6d72da3c2c12996e5bbdda1122e756d727d97a32279d4cdd236c05ce040440cdd9304ca3bd3941d212354d8a4e41c",
  data: {
    score: parseEther(0.1),
    dlpId: 1,
    metadata: "metadata1",
    proofUrl:
      "https://ipfs.io/ipfs/bafybeihkoviema7g3gxyt6la7vd5ho32ictqbilu3wnlo3rs7ewhnp7ll1",
    instruction:
      "https://ipfs.io/ipfs/qf34f34q4fq3fgdsgjgbdugsgwegqlgqhfejrfqjfwjfeql3u4iq4u47ll1",
  },
};

const proof2: Proof = {
  signature:
    "0x1f7c76080bebdcaa8fe6748edfcb04d5ab59a75123fc06f10f1f82dcc50bd8365677d868ef40572529760d0f093c73d781053d9a6a597e0c169e58b2685f74161c",
  data: {
    score: parseEther(0.3),
    dlpId: 2,
    metadata: "metadata2",
    proofUrl:
      "https://ipfs.io/ipfs/bafybeihkoviema7g3gxyt6la7vd5ho32ictqbilu3wnlo3rs7ewhnp7ll2",
    instruction:
      "https://ipfs.io/ipfs/qf34f34q4fq3fgdsgjgbdugsgwegqlgqhfejrfqjfwjfeql3u4iq4u47ll2",
  },
};

const proof3: Proof = {
  signature:
    "0x3453567892f7ccaa8fe6748edfcb04d5ab59a75123fc06f10f1f82dcc50bd8365677d868ef40572529760d0f093c73d781053d9a6a597e0c169e58b2685f74161c",
  data: {
    score: parseEther(0.5),
    dlpId: 3,
    metadata: "metadata3",
    proofUrl:
      "https://ipfs.io/ipfs/bafybeihkoviema7g3gxyt6la7vd5ho32ictqbilu3wnlo3rs7ewhnp7ll3",
    instruction:
      "https://ipfs.io/ipfs/qf34f34q4fq3fgdsgjgbdugsgwegqlgqhfejrfqjfwjfeql3u4iq4u47ll3",
  },
};

const proof4: Proof = {
  signature:
    "0x4453567892f7ccaa8fe6748edfcb04d5ab59a75123fc06f10f1f82dcc50bd8365677d868ef40572529760d0f093c73d781053d9a6a597e0c169e58b2685f74161c",
  data: {
    score: parseEther(0.7),
    dlpId: 4,
    metadata: "metadata4",
    proofUrl:
      "https://ipfs.io/ipfs/bafybeihkoviema7g3gxyt6la7vd5ho32ictqbilu3wnlo3rs7ewhnp7ll4",
    instruction:
      "https://ipfs.io/ipfs/qf34f34q4fq3fgdsgjgbdugsgwegqlgqhfejrfqjfwjfeql3u4iq4u47ll4",
  },
};

const proof5: Proof = {
  signature:
    "0x5453567892f7ccaa8fe6748edfcb04d5ab59a75123fc06f10f1f82dcc50bd8365677d868ef40572529760d0f093c73d781053d9a6a597e0c169e58b2685f74161c",
  data: {
    score: parseEther(0.9),
    dlpId: 5,
    metadata: "metadata5",
    proofUrl:
      "https://ipfs.io/ipfs/bafybeihkoviema7g3gxyt6la7vd5ho32ictqbilu3wnlo3rs7ewhnp7ll5",
    instruction:
      "https://ipfs.io/ipfs/qf34f34q4fq3fgdsgjgbdugsgwegqlgqhfejrfqjfwjfeql3u4iq4u47ll5",
  },
};

export const proofs: Proof[] = [proof0, proof1, proof2, proof3, proof4, proof5];

export async function signProof(
  signer: HardhatEthersSigner,
  fileUrl: string,
  proofData: ProofData,
): Promise<string> {
  const hash = ethers.solidityPackedKeccak256(
    ["string", "uint256", "uint256", "string", "string", "string"],
    [
      fileUrl,
      proofData.score,
      proofData.dlpId,
      proofData.metadata,
      proofData.proofUrl,
      proofData.instruction,
    ],
  );

  return signer.signMessage(ethers.getBytes(hash));
}

describe("DataRegistry", () => {
  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let tee1: HardhatEthersSigner;
  let tee2: HardhatEthersSigner;
  let tee3: HardhatEthersSigner;
  let dlp1: HardhatEthersSigner;
  let dlp2: HardhatEthersSigner;
  let dlp3: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;

  let dataRegistry: DataRegistryImplementation;

  const deploy = async () => {
    [deployer, owner, tee1, tee2, tee3, dlp1, dlp2, dlp3, user1, user2, user3] =
      await ethers.getSigners();

    dataRegistry = await deployDataRegistry(owner);
  };

  describe("Setup", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should have correct params after deploy", async function () {
      (await dataRegistry.owner()).should.eq(owner);
      (await dataRegistry.version()).should.eq(1);
    });

    it("Should transferOwnership in 2 steps", async function () {
      await dataRegistry
        .connect(owner)
        .transferOwnership(user2.address)
        .should.emit(dataRegistry, "OwnershipTransferStarted")
        .withArgs(owner, user2);
      (await dataRegistry.owner()).should.eq(owner);

      await dataRegistry
        .connect(owner)
        .transferOwnership(user3.address)
        .should.emit(dataRegistry, "OwnershipTransferStarted")
        .withArgs(owner, user3);
      (await dataRegistry.owner()).should.eq(owner);

      await dataRegistry
        .connect(user3)
        .acceptOwnership()
        .should.emit(dataRegistry, "OwnershipTransferred");

      (await dataRegistry.owner()).should.eq(user3);
    });

    it("Should reject transferOwnership when non-owner", async function () {
      await dataRegistry
        .connect(user1)
        .transferOwnership(user2)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("Should reject acceptOwnership when non-newOwner", async function () {
      await dataRegistry
        .connect(owner)
        .transferOwnership(user2.address)
        .should.emit(dataRegistry, "OwnershipTransferStarted")
        .withArgs(owner, user2);
      (await dataRegistry.owner()).should.eq(owner);

      await dataRegistry
        .connect(user3)
        .acceptOwnership()
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user3.address}")`,
        );
    });

    it("Should upgradeTo when owner", async function () {
      await upgrades.upgradeProxy(
        dataRegistry,
        await ethers.getContractFactory(
          "DataRegistryImplementationV2Mock",
          owner,
        ),
      );

      const newRoot = await ethers.getContractAt(
        "DataRegistryImplementationV2Mock",
        dataRegistry,
      );
      (await newRoot.owner()).should.eq(owner);
      (await newRoot.version()).should.eq(2);

      (await newRoot.test()).should.eq("test");
    });

    it("Should upgradeTo when owner and emit event", async function () {
      const newRootImplementation = await ethers.deployContract(
        "DataRegistryImplementationV2Mock",
      );

      await dataRegistry
        .connect(owner)
        .upgradeToAndCall(newRootImplementation, "0x")
        .should.emit(dataRegistry, "Upgraded")
        .withArgs(newRootImplementation);

      const newRoot = await ethers.getContractAt(
        "DataRegistryImplementationV2Mock",
        dataRegistry,
      );

      (await newRoot.owner()).should.eq(owner);
      (await newRoot.version()).should.eq(2);

      (await newRoot.test()).should.eq("test");
    });

    it("Should reject upgradeTo when storage layout is incompatible", async function () {
      await upgrades
        .upgradeProxy(
          dataRegistry,
          await ethers.getContractFactory(
            "DataRegistryImplementationV3Mock",
            owner,
          ),
        )
        .should.be.rejectedWith("New storage layout is incompatible");
    });

    it("Should reject upgradeTo when non owner", async function () {
      const newRootImplementation = await ethers.deployContract(
        "DataRegistryImplementationV2Mock",
      );

      await dataRegistry
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
      await dataRegistry
        .connect(user1)
        .addFile("file1")
        .should.emit(dataRegistry, "FileAdded")
        .withArgs(1, user1, "file1");

      (await dataRegistry.filesCount()).should.eq(1);

      const file1 = await dataRegistry.files(1);
      file1.id.should.eq(1);
      file1.ownerAddress.should.eq(user1.address);
      file1.addedAtBlock.should.eq(await getCurrentBlockNumber());
    });

    it("should addFile multiple times", async function () {
      const currentBlockNumber = await getCurrentBlockNumber();

      await dataRegistry
        .connect(user1)
        .addFile("file1")
        .should.emit(dataRegistry, "FileAdded")
        .withArgs(1, user1, "file1");

      await dataRegistry
        .connect(user2)
        .addFile("file2")
        .should.emit(dataRegistry, "FileAdded")
        .withArgs(2, user2, "file2");

      await dataRegistry
        .connect(user1)
        .addFile("file3")
        .should.emit(dataRegistry, "FileAdded")
        .withArgs(3, user1, "file3");

      (await dataRegistry.filesCount()).should.eq(3);

      const file1 = await dataRegistry.files(1);
      file1.id.should.eq(1);
      file1.ownerAddress.should.eq(user1);
      file1.url.should.eq("file1");
      file1.addedAtBlock.should.eq(currentBlockNumber + 1);

      const file2 = await dataRegistry.files(2);
      file2.id.should.eq(2);
      file2.ownerAddress.should.eq(user2);
      file2.url.should.eq("file2");
      file2.addedAtBlock.should.eq(currentBlockNumber + 2);

      const file3 = await dataRegistry.files(3);
      file3.id.should.eq(3);
      file3.ownerAddress.should.eq(user1);
      file3.url.should.eq("file3");
      file3.addedAtBlock.should.eq(currentBlockNumber + 3);
    });

    it("should allow duplicates", async function () {
      const currentBlockNumber = await getCurrentBlockNumber();

      await dataRegistry
        .connect(user1)
        .addFile("file1")
        .should.emit(dataRegistry, "FileAdded")
        .withArgs(1, user1, "file1");

      await dataRegistry
        .connect(user2)
        .addFile("file1")
        .should.emit(dataRegistry, "FileAdded")
        .withArgs(2, user2, "file1");

      await dataRegistry
        .connect(user1)
        .addFile("file1")
        .should.emit(dataRegistry, "FileAdded")
        .withArgs(3, user1, "file1");

      (await dataRegistry.filesCount()).should.eq(3);

      const file1 = await dataRegistry.files(1);
      file1.id.should.eq(1);
      file1.ownerAddress.should.eq(user1);
      file1.url.should.eq("file1");
      file1.addedAtBlock.should.eq(currentBlockNumber + 1);

      const file2 = await dataRegistry.files(2);
      file2.id.should.eq(2);
      file2.ownerAddress.should.eq(user2);
      file2.url.should.eq("file1");
      file2.addedAtBlock.should.eq(currentBlockNumber + 2);

      const file3 = await dataRegistry.files(3);
      file3.id.should.eq(3);
      file3.ownerAddress.should.eq(user1);
      file3.url.should.eq("file1");
      file3.addedAtBlock.should.eq(currentBlockNumber + 3);
    });

    it("should reject addFile when paused", async function () {
      await dataRegistry.connect(owner).pause();

      await dataRegistry
        .connect(user1)
        .addFile("file1")
        .should.be.rejectedWith("EnforcedPause()");
    });
  });

  describe("Proof", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should addProof, one file, one tee", async function () {
      await dataRegistry.connect(user1).addFile("file1");

      await dataRegistry
        .connect(tee1)
        .addProof(1, proof1)
        .should.emit(dataRegistry, "ProofAdded")
        .withArgs(1, 1);

      const file1Proof1 = await dataRegistry.fileProofs(1, 1);
      file1Proof1.signature.should.eq(proof1.signature);
      file1Proof1.data.score.should.eq(proof1.data.score);
      file1Proof1.data.dlpId.should.eq(proof1.data.dlpId);
      file1Proof1.data.metadata.should.eq(proof1.data.metadata);
      file1Proof1.data.proofUrl.should.eq(proof1.data.proofUrl);
      file1Proof1.data.instruction.should.eq(proof1.data.instruction);
    });

    it("should addProof, one file, multiple tee", async function () {
      await dataRegistry.connect(user1).addFile("file1");

      await dataRegistry
        .connect(tee1)
        .addProof(1, proof1)
        .should.emit(dataRegistry, "ProofAdded")
        .withArgs(1, 1);

      await dataRegistry
        .connect(tee2)
        .addProof(1, proof2)
        .should.emit(dataRegistry, "ProofAdded")
        .withArgs(1, 2);

      const file1Proof1 = await dataRegistry.fileProofs(1, 1);
      file1Proof1.signature.should.eq(proof1.signature);
      file1Proof1.data.score.should.eq(proof1.data.score);
      file1Proof1.data.dlpId.should.eq(proof1.data.dlpId);
      file1Proof1.data.metadata.should.eq(proof1.data.metadata);
      file1Proof1.data.proofUrl.should.eq(proof1.data.proofUrl);
      file1Proof1.data.instruction.should.eq(proof1.data.instruction);

      const file1Proof2 = await dataRegistry.fileProofs(1, 2);
      file1Proof2.signature.should.eq(proof2.signature);
      file1Proof2.data.score.should.eq(proof2.data.score);
      file1Proof2.data.dlpId.should.eq(proof2.data.dlpId);
      file1Proof2.data.metadata.should.eq(proof2.data.metadata);
      file1Proof2.data.proofUrl.should.eq(proof2.data.proofUrl);
      file1Proof2.data.instruction.should.eq(proof2.data.instruction);
    });

    it("should addProof, multiple files, one tee", async function () {
      await dataRegistry.connect(user1).addFile("file1");
      await dataRegistry.connect(user2).addFile("file2");
      await dataRegistry.connect(user1).addFile("file3");

      await dataRegistry
        .connect(tee1)
        .addProof(2, proof1)
        .should.emit(dataRegistry, "ProofAdded")
        .withArgs(2, 1);
      await dataRegistry
        .connect(tee1)
        .addProof(3, proof2)
        .should.emit(dataRegistry, "ProofAdded")
        .withArgs(3, 1);

      const file1Proof1 = await dataRegistry.fileProofs(1, 1);
      file1Proof1.signature.should.eq("0x");
      file1Proof1.data.score.should.eq(0);
      file1Proof1.data.dlpId.should.eq(0);
      file1Proof1.data.metadata.should.eq("");
      file1Proof1.data.proofUrl.should.eq("");
      file1Proof1.data.instruction.should.eq("");

      const file2Proof1 = await dataRegistry.fileProofs(2, 1);
      file2Proof1.signature.should.eq(proof1.signature);
      file2Proof1.data.score.should.eq(proof1.data.score);
      file2Proof1.data.dlpId.should.eq(proof1.data.dlpId);
      file2Proof1.data.metadata.should.eq(proof1.data.metadata);
      file2Proof1.data.proofUrl.should.eq(proof1.data.proofUrl);
      file2Proof1.data.instruction.should.eq(proof1.data.instruction);

      const file3Proof1 = await dataRegistry.fileProofs(3, 1);
      file3Proof1.signature.should.eq(proof2.signature);
      file3Proof1.data.score.should.eq(proof2.data.score);
      file3Proof1.data.dlpId.should.eq(proof2.data.dlpId);
      file3Proof1.data.metadata.should.eq(proof2.data.metadata);
      file3Proof1.data.proofUrl.should.eq(proof2.data.proofUrl);
      file3Proof1.data.instruction.should.eq(proof2.data.instruction);
    });

    it("should addProof, multiple files, multiple tees", async function () {
      await dataRegistry.connect(user1).addFile("file1");
      await dataRegistry.connect(user2).addFile("file2");
      await dataRegistry.connect(user3).addFile("file3");
      await dataRegistry.connect(user1).addFile("file4");
      await dataRegistry.connect(user2).addFile("file5");
      await dataRegistry.connect(user2).addFile("file6");

      await dataRegistry.connect(tee1).addProof(2, proof1);
      await dataRegistry.connect(tee1).addProof(3, proof2);
      await dataRegistry.connect(tee2).addProof(3, proof3);
      await dataRegistry.connect(tee3).addProof(3, proof4);
      await dataRegistry.connect(tee2).addProof(6, proof5);

      const file1Proof1 = await dataRegistry.fileProofs(1, 1);
      file1Proof1.signature.should.eq("0x");
      file1Proof1.data.score.should.eq(0);
      file1Proof1.data.dlpId.should.eq(0);
      file1Proof1.data.metadata.should.eq("");
      file1Proof1.data.proofUrl.should.eq("");
      file1Proof1.data.instruction.should.eq("");

      const file2Proof1 = await dataRegistry.fileProofs(2, 1);
      file2Proof1.signature.should.eq(proof1.signature);
      file2Proof1.data.score.should.eq(proof1.data.score);
      file2Proof1.data.dlpId.should.eq(proof1.data.dlpId);
      file2Proof1.data.metadata.should.eq(proof1.data.metadata);
      file2Proof1.data.proofUrl.should.eq(proof1.data.proofUrl);
      file2Proof1.data.instruction.should.eq(proof1.data.instruction);

      const file3Proof1 = await dataRegistry.fileProofs(3, 1);
      file3Proof1.signature.should.eq(proof2.signature);
      file3Proof1.data.score.should.eq(proof2.data.score);
      file3Proof1.data.dlpId.should.eq(proof2.data.dlpId);
      file3Proof1.data.metadata.should.eq(proof2.data.metadata);
      file3Proof1.data.proofUrl.should.eq(proof2.data.proofUrl);
      file3Proof1.data.instruction.should.eq(proof2.data.instruction);

      const file3Proof2 = await dataRegistry.fileProofs(3, 2);
      file3Proof2.signature.should.eq(proof3.signature);
      file3Proof2.data.score.should.eq(proof3.data.score);
      file3Proof2.data.dlpId.should.eq(proof3.data.dlpId);
      file3Proof2.data.metadata.should.eq(proof3.data.metadata);
      file3Proof2.data.proofUrl.should.eq(proof3.data.proofUrl);
      file3Proof2.data.instruction.should.eq(proof3.data.instruction);

      const file3Proof3 = await dataRegistry.fileProofs(3, 3);
      file3Proof3.signature.should.eq(proof4.signature);
      file3Proof3.data.score.should.eq(proof4.data.score);
      file3Proof3.data.dlpId.should.eq(proof4.data.dlpId);
      file3Proof3.data.metadata.should.eq(proof4.data.metadata);
      file3Proof3.data.proofUrl.should.eq(proof4.data.proofUrl);
      file3Proof3.data.instruction.should.eq(proof4.data.instruction);

      const file6Proof1 = await dataRegistry.fileProofs(6, 1);
      file6Proof1.signature.should.eq(proof5.signature);
      file6Proof1.data.score.should.eq(proof5.data.score);
      file6Proof1.data.dlpId.should.eq(proof5.data.dlpId);
      file6Proof1.data.metadata.should.eq(proof5.data.metadata);
      file6Proof1.data.proofUrl.should.eq(proof5.data.proofUrl);
      file6Proof1.data.instruction.should.eq(proof5.data.instruction);
    });

    it("should reject addProof when paused", async function () {
      await dataRegistry.connect(user1).addFile("file1");
      await dataRegistry.connect(owner).pause();

      await dataRegistry
        .connect(tee1)
        .addProof(1, proof1)
        .should.be.rejectedWith("EnforcedPause()");
    });
  });

  describe("FilePermission", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should addFilePermission, one file, one dlp", async function () {
      await dataRegistry.connect(user1).addFile("file1");

      await dataRegistry
        .connect(user1)
        .addFilePermission(1, dlp1, "key1")
        .should.emit(dataRegistry, "PermissionGranted")
        .withArgs(1, dlp1);

      (await dataRegistry.filePermissions(1, dlp1)).should.eq("key1");
      (await dataRegistry.filePermissions(1, dlp2)).should.eq("");
    });

    it("should addFilePermission, one file, multiple dlps #1", async function () {
      await dataRegistry.connect(user1).addFile("file1");

      await dataRegistry
        .connect(user1)
        .addFilePermission(1, dlp1, "key1")
        .should.emit(dataRegistry, "PermissionGranted")
        .withArgs(1, dlp1);

      await dataRegistry
        .connect(user1)
        .addFilePermission(1, dlp2, "key2")
        .should.emit(dataRegistry, "PermissionGranted")
        .withArgs(1, dlp2);

      (await dataRegistry.filePermissions(1, dlp1)).should.eq("key1");
      (await dataRegistry.filePermissions(1, dlp2)).should.eq("key2");
    });

    it("should addFilePermission, one file, multiple dlps #2", async function () {
      await dataRegistry.connect(user1).addFile("file1");

      await dataRegistry
        .connect(user1)
        .addFilePermission(1, dlp1, "key1")
        .should.emit(dataRegistry, "PermissionGranted")
        .withArgs(1, dlp1);

      await dataRegistry
        .connect(user1)
        .addFilePermission(1, dlp2, "key2")
        .should.emit(dataRegistry, "PermissionGranted")
        .withArgs(1, dlp2);

      (await dataRegistry.filePermissions(1, dlp1)).should.eq("key1");
      (await dataRegistry.filePermissions(1, dlp2)).should.eq("key2");
    });

    it("should addFilePermission, multiple files, one dlp", async function () {
      await dataRegistry.connect(user1).addFile("file1");
      await dataRegistry.connect(user2).addFile("file2");
      await dataRegistry.connect(user1).addFile("file3");

      await dataRegistry
        .connect(user2)
        .addFilePermission(2, dlp1, "key1")
        .should.emit(dataRegistry, "PermissionGranted")
        .withArgs(2, dlp1);
      await dataRegistry
        .connect(user1)
        .addFilePermission(3, dlp1, "key2")
        .should.emit(dataRegistry, "PermissionGranted")
        .withArgs(3, dlp1);

      (await dataRegistry.filePermissions(1, dlp1)).should.eq("");
      (await dataRegistry.filePermissions(2, dlp1)).should.eq("key1");
      (await dataRegistry.filePermissions(3, dlp1)).should.eq("key2");
    });

    it("should addFilePermission, multiple files, multiple dlps", async function () {
      await dataRegistry.connect(user1).addFile("file1");
      await dataRegistry.connect(user2).addFile("file2");
      await dataRegistry.connect(user3).addFile("file3");
      await dataRegistry.connect(user1).addFile("file4");
      await dataRegistry.connect(user2).addFile("file5");
      await dataRegistry.connect(user2).addFile("file6");

      await dataRegistry
        .connect(user2)
        .addFilePermission(2, dlp1, "key1")
        .should.emit(dataRegistry, "PermissionGranted")
        .withArgs(2, dlp1);
      await dataRegistry
        .connect(user3)
        .addFilePermission(3, dlp1, "key2")
        .should.emit(dataRegistry, "PermissionGranted")
        .withArgs(3, dlp1);
      await dataRegistry
        .connect(user3)
        .addFilePermission(3, dlp2, "key3")
        .should.emit(dataRegistry, "PermissionGranted")
        .withArgs(3, dlp2);
      await dataRegistry
        .connect(user3)
        .addFilePermission(3, dlp3, "key4")
        .should.emit(dataRegistry, "PermissionGranted")
        .withArgs(3, dlp3);
      await dataRegistry
        .connect(user2)
        .addFilePermission(6, dlp2, "key5")
        .should.emit(dataRegistry, "PermissionGranted")
        .withArgs(6, dlp2);

      (await dataRegistry.filePermissions(1, dlp1)).should.eq("");
      (await dataRegistry.filePermissions(2, dlp1)).should.eq("key1");
      (await dataRegistry.filePermissions(3, dlp1)).should.eq("key2");
      (await dataRegistry.filePermissions(3, dlp2)).should.eq("key3");
      (await dataRegistry.filePermissions(3, dlp3)).should.eq("key4");
      (await dataRegistry.filePermissions(6, dlp2)).should.eq("key5");
    });

    it("should reject addFilePermission when non-owner", async function () {
      await dataRegistry.connect(user1).addFile("file1");

      await dataRegistry
        .connect(user2)
        .addFilePermission(1, dlp1, "key1")
        .should.be.rejectedWith("NotFileOwner()");
    });

    it("should reject addFilePermission when paused", async function () {
      await dataRegistry.connect(user1).addFile("file1");
      await dataRegistry.connect(owner).pause();

      await dataRegistry
        .connect(user1)
        .addFilePermission(1, dlp1, "key1")
        .should.be.rejectedWith("EnforcedPause()");
    });
  });
});
