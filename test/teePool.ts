import chai, { should } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers, upgrades } from "hardhat";
import {
  FileRegistryImplementation,
  TeePoolImplementation,
} from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { getReceipt, parseEther } from "../utils/helpers";
import { deployFileRegistry } from "./fileRegistry";

chai.use(chaiAsPromised);
should();

describe("TeePool", () => {
  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let tee1: HardhatEthersSigner;
  let tee2: HardhatEthersSigner;
  let tee3: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;

  let teePool: TeePoolImplementation;
  let fileRegistry: FileRegistryImplementation;

  enum TeeStatus {
    None = 0,
    Active = 1,
    Removed = 2,
  }
  enum JobStatus {
    None = 0,
    Completed = 1,
  }

  const deploy = async () => {
    [deployer, owner, tee1, tee2, tee3, user1, user2, user3] =
      await ethers.getSigners();

    fileRegistry = await deployFileRegistry(owner);

    const teePoolDeploy = await upgrades.deployProxy(
      await ethers.getContractFactory("TeePoolImplementation"),
      [owner.address, fileRegistry.target],
      {
        kind: "uups",
      },
    );

    teePool = await ethers.getContractAt(
      "TeePoolImplementation",
      teePoolDeploy.target,
    );
  };

  describe("Setup", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should have correct params after deploy", async function () {
      (await teePool.owner()).should.eq(owner);
      (await teePool.fileRegistry()).should.eq(fileRegistry);
      (await teePool.version()).should.eq(1);
    });

    it("Should transferOwnership in 2 steps", async function () {
      await teePool
        .connect(owner)
        .transferOwnership(user2.address)
        .should.emit(teePool, "OwnershipTransferStarted")
        .withArgs(owner, user2);
      (await teePool.owner()).should.eq(owner);

      await teePool
        .connect(owner)
        .transferOwnership(user3.address)
        .should.emit(teePool, "OwnershipTransferStarted")
        .withArgs(owner, user3);
      (await teePool.owner()).should.eq(owner);

      await teePool
        .connect(user3)
        .acceptOwnership()
        .should.emit(teePool, "OwnershipTransferred");

      (await teePool.owner()).should.eq(user3);
    });

    it("Should reject transferOwnership when non-owner", async function () {
      await teePool
        .connect(user1)
        .transferOwnership(user2)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("Should reject acceptOwnership when non-newOwner", async function () {
      await teePool
        .connect(owner)
        .transferOwnership(user2.address)
        .should.emit(teePool, "OwnershipTransferStarted")
        .withArgs(owner, user2);
      (await teePool.owner()).should.eq(owner);

      await teePool
        .connect(user3)
        .acceptOwnership()
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user3.address}")`,
        );
    });

    it("Should updateFileRegistry when owner", async function () {
      await teePool.connect(owner).updateFileRegistry(user1.address).should.be
        .fulfilled;

      (await teePool.fileRegistry()).should.eq(user1.address);
    });

    it("Should reject updateFileRegistry when non-owner", async function () {
      await teePool
        .connect(user1)
        .updateFileRegistry(user2.address)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("Should upgradeTo when owner", async function () {
      await upgrades.upgradeProxy(
        teePool,
        await ethers.getContractFactory("TeePoolImplementationV2Mock", owner),
      );

      const newRoot = await ethers.getContractAt(
        "TeePoolImplementationV2Mock",
        teePool,
      );
      (await newRoot.owner()).should.eq(owner);
      (await newRoot.version()).should.eq(2);

      (await newRoot.test()).should.eq("test");
    });

    it("Should upgradeTo when owner and emit event", async function () {
      const newRootImplementation = await ethers.deployContract(
        "TeePoolImplementationV2Mock",
      );

      await teePool
        .connect(owner)
        .upgradeToAndCall(newRootImplementation, "0x")
        .should.emit(teePool, "Upgraded")
        .withArgs(newRootImplementation);

      const newRoot = await ethers.getContractAt(
        "TeePoolImplementationV2Mock",
        teePool,
      );

      (await newRoot.owner()).should.eq(owner);
      (await newRoot.version()).should.eq(2);

      (await newRoot.test()).should.eq("test");
    });

    it("Should reject upgradeTo when storage layout is incompatible", async function () {
      await upgrades
        .upgradeProxy(
          teePool,
          await ethers.getContractFactory("TeePoolImplementationV3Mock", owner),
        )
        .should.be.rejectedWith("New storage layout is incompatible");
    });

    it("Should reject upgradeTo when non owner", async function () {
      const newRootImplementation = await ethers.deployContract(
        "TeePoolImplementationV2Mock",
      );

      await teePool
        .connect(user1)
        .upgradeToAndCall(newRootImplementation, "0x")
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });
  });

  describe("Tee management", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should addTee when owner", async function () {
      (await teePool.teesCount()).should.eq(0);

      await teePool
        .connect(owner)
        .addTee(tee1)
        .should.emit(teePool, "TeeAdded")
        .withArgs(tee1);

      (await teePool.teesCount()).should.eq(1);
      (await teePool.activeTeesCount()).should.eq(1);
      const tee1Info = await teePool.tees(tee1.address);
      tee1Info.status.should.eq(TeeStatus.Active);
      tee1Info.amount.should.eq(0);
      tee1Info.withdrawnAmount.should.eq(0);

      (await teePool.teeListAt(0)).should.deep.eq(tee1Info);
      (await teePool.activeTeeListAt(0)).should.deep.eq(tee1Info);

      (await teePool.teeList()).should.deep.eq([tee1.address]);
      (await teePool.activeTeeList()).should.deep.eq([tee1.address]);
    });

    it("should addTee #multiple tees", async function () {
      (await teePool.teesCount()).should.eq(0);

      await teePool
        .connect(owner)
        .addTee(tee1)
        .should.emit(teePool, "TeeAdded")
        .withArgs(tee1);

      (await teePool.teeList()).should.deep.eq([tee1.address]);

      await teePool
        .connect(owner)
        .addTee(tee2)
        .should.emit(teePool, "TeeAdded")
        .withArgs(tee2);

      (await teePool.teesCount()).should.eq(2);
      (await teePool.activeTeesCount()).should.eq(2);

      const tee1Info = await teePool.tees(tee1.address);
      tee1Info.status.should.eq(TeeStatus.Active);
      tee1Info.amount.should.eq(0);
      tee1Info.withdrawnAmount.should.eq(0);

      const tee2Info = await teePool.tees(tee2.address);
      tee2Info.status.should.eq(TeeStatus.Active);
      tee2Info.amount.should.eq(0);
      tee2Info.withdrawnAmount.should.eq(0);

      (await teePool.teeListAt(0)).should.deep.eq(tee1Info);
      (await teePool.activeTeeListAt(0)).should.deep.eq(tee1Info);

      (await teePool.teeListAt(1)).should.deep.eq(tee2Info);
      (await teePool.activeTeeListAt(1)).should.deep.eq(tee2Info);

      (await teePool.teeList()).should.deep.eq([tee1.address, tee2.address]);
      (await teePool.activeTeeList()).should.deep.eq([
        tee1.address,
        tee2.address,
      ]);
    });

    it("should reject addTee when already added", async function () {
      await teePool
        .connect(owner)
        .addTee(tee1)
        .should.emit(teePool, "TeeAdded")
        .withArgs(tee1);

      await teePool
        .connect(owner)
        .addTee(tee1)
        .should.be.rejectedWith("TeeAlreadyAdded");
    });

    it("should reject addTee when non-owner", async function () {
      await teePool
        .connect(user1)
        .addTee(tee1)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("should removeTee when owner #1", async function () {
      await teePool
        .connect(owner)
        .addTee(tee1)
        .should.emit(teePool, "TeeAdded")
        .withArgs(tee1);

      await teePool
        .connect(owner)
        .removeTee(tee1)
        .should.emit(teePool, "TeeRemoved")
        .withArgs(tee1);

      (await teePool.teesCount()).should.eq(1);
      (await teePool.activeTeesCount()).should.eq(0);
      const tee1Info = await teePool.tees(tee1.address);
      tee1Info.status.should.eq(TeeStatus.Removed);
      tee1Info.amount.should.eq(0);
      tee1Info.withdrawnAmount.should.eq(0);

      (await teePool.teeListAt(0)).should.deep.eq(tee1Info);

      (await teePool.teeList()).should.deep.eq([tee1.address]);
      (await teePool.activeTeeList()).should.deep.eq([]);
    });

    it("should removeTee when multiple tees", async function () {
      await teePool
        .connect(owner)
        .addTee(tee1)
        .should.emit(teePool, "TeeAdded")
        .withArgs(tee1);

      await teePool
        .connect(owner)
        .addTee(tee2)
        .should.emit(teePool, "TeeAdded")
        .withArgs(tee2);

      await teePool
        .connect(owner)
        .addTee(tee3)
        .should.emit(teePool, "TeeAdded")
        .withArgs(tee3);

      await teePool
        .connect(owner)
        .removeTee(tee2)
        .should.emit(teePool, "TeeRemoved")
        .withArgs(tee2);

      (await teePool.teesCount()).should.eq(3);
      (await teePool.activeTeesCount()).should.eq(2);
      const tee2Info = await teePool.tees(tee2.address);
      tee2Info.status.should.eq(TeeStatus.Removed);
      tee2Info.amount.should.eq(0);
      tee2Info.withdrawnAmount.should.eq(0);

      (await teePool.teeListAt(1)).should.deep.eq(tee2Info);

      (await teePool.teeList()).should.deep.eq([
        tee1.address,
        tee2.address,
        tee3.address,
      ]);
      (await teePool.activeTeeList()).should.deep.eq([
        tee1.address,
        tee3.address,
      ]);
    });

    it("should reject removeTee when non-owner", async function () {
      await teePool
        .connect(owner)
        .addTee(tee1)
        .should.emit(teePool, "TeeAdded")
        .withArgs(tee1);

      await teePool
        .connect(user1)
        .removeTee(tee1)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("should reject removeTee when not added", async function () {
      await teePool
        .connect(owner)
        .removeTee(tee1)
        .should.be.rejectedWith("TeeNotActive");
    });
  });

  describe("Job", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should submitValidationJob", async function () {
      const user1InitialBalance = await ethers.provider.getBalance(
        user1.address,
      );

      const tx = await teePool
        .connect(user1)
        .submitValidationJob(1, { value: parseEther(0.01) });
      const receipt = await getReceipt(tx);

      await tx.should
        .emit(teePool, "JobSubmitted")
        .withArgs(1, 1, parseEther(0.01));

      (await teePool.jobsCount()).should.eq(1);

      const job1 = await teePool.jobs(1);
      job1.bidAmount.should.eq(parseEther(0.01));
      job1.fileId.should.eq(1);

      (await ethers.provider.getBalance(user1.address)).should.eq(
        user1InitialBalance - parseEther(0.01) - BigInt(receipt.fee),
      );
    });

    it("should submitValidationJob #same user multiple files", async function () {
      const user1InitialBalance = await ethers.provider.getBalance(user1);

      const tx1 = await teePool
        .connect(user1)
        .submitValidationJob(1, { value: parseEther(0.01) });
      const receipt1 = await getReceipt(tx1);

      const tx2 = await teePool
        .connect(user1)
        .submitValidationJob(123, { value: parseEther(0.02) });
      const receipt2 = await getReceipt(tx2);

      (await teePool.jobsCount()).should.eq(2);

      const job1 = await teePool.jobs(1);
      job1.bidAmount.should.eq(parseEther(0.01));
      job1.fileId.should.eq(1);

      const job2 = await teePool.jobs(2);
      job2.bidAmount.should.eq(parseEther(0.02));
      job2.fileId.should.eq(123);

      (await ethers.provider.getBalance(user1.address)).should.eq(
        user1InitialBalance -
          parseEther(0.03) -
          BigInt(receipt1.fee) -
          BigInt(receipt2.fee),
      );
    });

    it("should submitValidationJob for same file #multiple users same file", async function () {
      const user1InitialBalance = await ethers.provider.getBalance(user1);
      const user2InitialBalance = await ethers.provider.getBalance(user2);

      const tx1 = await teePool
        .connect(user1)
        .submitValidationJob(1, { value: parseEther(0.01) });
      const receipt1 = await getReceipt(tx1);

      const tx2 = await teePool
        .connect(user2)
        .submitValidationJob(1, { value: parseEther(0.02) });
      const receipt2 = await getReceipt(tx2);

      (await teePool.jobsCount()).should.eq(2);

      const job1 = await teePool.jobs(1);
      job1.bidAmount.should.eq(parseEther(0.01));
      job1.fileId.should.eq(1);

      const job2 = await teePool.jobs(2);
      job2.bidAmount.should.eq(parseEther(0.02));
      job2.fileId.should.eq(1);

      (await ethers.provider.getBalance(user1.address)).should.eq(
        user1InitialBalance - parseEther(0.01) - BigInt(receipt1.fee),
      );

      (await ethers.provider.getBalance(user2.address)).should.eq(
        user2InitialBalance - parseEther(0.02) - BigInt(receipt2.fee),
      );
    });

    it("should submitValidationJob #multiple users multiple files", async function () {
      await teePool
        .connect(owner)
        .submitValidationJob(1, { value: parseEther(0.01) })
        .should.emit(teePool, "JobSubmitted")
        .withArgs(1, 1, parseEther(0.01));

      await teePool
        .connect(user1)
        .submitValidationJob(123, { value: parseEther(0.02) })
        .should.emit(teePool, "JobSubmitted")
        .withArgs(2, 123, parseEther(0.02));

      (await teePool.jobsCount()).should.eq(2);

      const job1 = await teePool.jobs(1);
      job1.bidAmount.should.eq(parseEther(0.01));
      job1.fileId.should.eq(1);

      const job2 = await teePool.jobs(2);
      job2.bidAmount.should.eq(parseEther(0.02));
      job2.fileId.should.eq(123);
    });

    it("should submitValidationJob without bid", async function () {
      await teePool
        .connect(owner)
        .submitValidationJob(1)
        .should.emit(teePool, "JobSubmitted")
        .withArgs(1, 1, 0);

      (await teePool.jobsCount()).should.eq(1);

      const job1 = await teePool.jobs(1);
      job1.bidAmount.should.eq(0);
      job1.fileId.should.eq(1);
    });
  });

  describe("Proof", () => {
    const proofDefault = {
      valid: true,
      score: 1n,
      authenticity: 2n,
      ownership: 3n,
      quality: 4n,
      uniqueness: 5n,
    };

    beforeEach(async () => {
      await deploy();

      await teePool.connect(owner).addTee(tee1);
      await teePool.connect(owner).addTee(tee2);
      await teePool.connect(owner).addTee(tee3);

      await fileRegistry.connect(user1).addFile("file1"); //fileId = 1
      await fileRegistry.connect(user1).addFile("file2"); //fileId = 2
      await fileRegistry.connect(user1).addFile("file3"); //fileId = 3 - no job for this file
      await fileRegistry.connect(user2).addFile("file4"); //fileId = 4
      await fileRegistry.connect(user2).addFile("file5"); //fileId = 5
      await fileRegistry.connect(user3).addFile("file6"); //fileId = 6

      await fileRegistry
        .connect(user1)
        .addPermissions(1, [{ account: tee1, key: "key1" }]);
      await fileRegistry
        .connect(user1)
        .addPermissions(1, [{ account: tee2, key: "key2" }]);
      await fileRegistry
        .connect(user1)
        .addPermissions(2, [{ account: tee1, key: "key3" }]);
      await fileRegistry
        .connect(user2)
        .addPermissions(4, [{ account: tee3, key: "key4" }]);

      await teePool
        .connect(user1)
        .submitValidationJob(1, { value: parseEther(0.01) });
      await teePool
        .connect(user1)
        .submitValidationJob(2, { value: parseEther(0.03) });
      await teePool
        .connect(user1)
        .submitValidationJob(4, { value: parseEther(0.05) });
      await teePool
        .connect(user1)
        .submitValidationJob(5, { value: parseEther(0.07) });
      await teePool
        .connect(user1)
        .submitValidationJob(6, { value: parseEther(0.09) });
    });

    it("should addProof", async function () {
      const proof1 = {
        valid: true,
        score: 1n,
        authenticity: 2n,
        ownership: 3n,
        quality: 4n,
        uniqueness: 5n,
      };

      await teePool
        .connect(tee1)
        .submitProof(1, proof1)
        .should.emit(teePool, "ProofAdded")
        .withArgs(tee1.address, 1, 1)
        .and.to.emit(fileRegistry, "ProofAdded")
        .withArgs(1, tee1.address);

      const job1 = await teePool.jobs(1);
      job1.status.should.eq(JobStatus.Completed);

      const proof1Info = await fileRegistry.fileProofs(1, tee1.address);
      proof1Info.valid.should.eq(proof1.valid);
      proof1Info.score.should.eq(proof1.score);
      proof1Info.authenticity.should.eq(proof1.authenticity);
      proof1Info.ownership.should.eq(proof1.ownership);
      proof1Info.quality.should.eq(proof1.quality);
      proof1Info.uniqueness.should.eq(proof1.uniqueness);

      const tee1Info = await teePool.tees(tee1.address);
      tee1Info.amount.should.eq(parseEther(0.01));
    });

    it("should reject addProof when not tee", async function () {
      await teePool
        .connect(user1)
        .submitProof(1, proofDefault)
        .should.be.rejectedWith("TeeNotActive()");
    });

    it("should reject addProof when not active tee", async function () {
      await teePool.connect(owner).removeTee(tee1);
      await teePool
        .connect(tee1)
        .submitProof(2, proofDefault)
        .should.be.rejectedWith("TeeNotActive()");
    });

    it("should reject addProof when not authorized", async function () {
      await teePool
        .connect(tee3)
        .submitProof(1, proofDefault)
        .should.be.rejectedWith("NotFileAttestator()");
    });

    it("should reject addProof when not job", async function () {
      await teePool
        .connect(tee1)
        .submitProof(123, proofDefault)
        .should.be.rejectedWith("NotFileAttestator()");
    });

    it("should reject addProof when proof already submitted", async function () {
      await teePool.connect(tee1).submitProof(1, proofDefault).should.be
        .fulfilled;

      await teePool
        .connect(tee1)
        .submitProof(1, proofDefault)
        .should.be.rejectedWith("JobCompleted()");
    });

    it("should addProof for multiple files", async function () {
      const proof1 = {
        valid: true,
        score: 1n,
        authenticity: 2n,
        ownership: 3n,
        quality: 4n,
        uniqueness: 5n,
      };

      const proof2 = {
        valid: true,
        score: 6n,
        authenticity: 6n,
        ownership: 8n,
        quality: 9n,
        uniqueness: 10n,
      };

      const proof3 = {
        valid: false,
        score: 11n,
        authenticity: 12n,
        ownership: 13n,
        quality: 14n,
        uniqueness: 15n,
      };

      await teePool
        .connect(tee1)
        .submitProof(1, proof1)
        .should.emit(teePool, "ProofAdded")
        .withArgs(tee1.address, 1, 1);

      await teePool
        .connect(tee1)
        .submitProof(2, proof2)
        .should.emit(teePool, "ProofAdded")
        .withArgs(tee1.address, 2, 2);

      await teePool
        .connect(tee3)
        .submitProof(3, proof3)
        .should.emit(teePool, "ProofAdded")
        .withArgs(tee3.address, 3, 4);

      const proof1Info = await fileRegistry.fileProofs(1, tee1.address);
      proof1Info.valid.should.eq(proof1.valid);
      proof1Info.score.should.eq(proof1.score);
      proof1Info.authenticity.should.eq(proof1.authenticity);
      proof1Info.ownership.should.eq(proof1.ownership);
      proof1Info.quality.should.eq(proof1.quality);
      proof1Info.uniqueness.should.eq(proof1.uniqueness);

      const proof2Info = await fileRegistry.fileProofs(2, tee1.address);
      proof2Info.valid.should.eq(proof2.valid);
      proof2Info.score.should.eq(proof2.score);
      proof2Info.authenticity.should.eq(proof2.authenticity);
      proof2Info.ownership.should.eq(proof2.ownership);
      proof2Info.quality.should.eq(proof2.quality);
      proof2Info.uniqueness.should.eq(proof2.uniqueness);

      const proof3Info = await fileRegistry.fileProofs(4, tee3.address);
      proof3Info.valid.should.eq(proof3.valid);
      proof3Info.score.should.eq(proof3.score);
      proof3Info.authenticity.should.eq(proof3.authenticity);
      proof3Info.ownership.should.eq(proof3.ownership);
      proof3Info.quality.should.eq(proof3.quality);
      proof3Info.uniqueness.should.eq(proof3.uniqueness);

      const tee1Info = await teePool.tees(tee1);
      tee1Info.amount.should.eq(parseEther(0.01) + parseEther(0.03));

      const tee3Info = await teePool.tees(tee3);
      tee3Info.amount.should.eq(parseEther(0.05));
    });

    describe("Withdraw", () => {
      it("should withdraw", async function () {
        await teePool.connect(tee1).submitProof(1, proofDefault);

        const tee1InitialBalance = await ethers.provider.getBalance(tee1);
        const teePoolInitialBalance = await ethers.provider.getBalance(teePool);

        const tee1InfoBefore = await teePool.tees(tee1.address);
        tee1InfoBefore.amount.should.eq(parseEther(0.01));
        tee1InfoBefore.withdrawnAmount.should.eq(0);

        const tx = await teePool.connect(tee1).claim();
        const receipt = await getReceipt(tx);

        tx.should
          .emit(teePool, "Claimed")
          .withArgs(tee1.address, parseEther(0.01));

        const tee1InfoAfter = await teePool.tees(tee1.address);
        tee1InfoAfter.amount.should.eq(parseEther(0.01));
        tee1InfoAfter.withdrawnAmount.should.eq(parseEther(0.01));

        (await ethers.provider.getBalance(tee1)).should.eq(
          tee1InitialBalance + parseEther(0.01) - BigInt(receipt.fee),
        );
        (await ethers.provider.getBalance(teePool)).should.eq(
          teePoolInitialBalance - parseEther(0.01),
        );
      });

      it("should reject withdraw when not tee", async function () {
        await teePool.connect(tee1).submitProof(1, proofDefault);

        await teePool
          .connect(user1)
          .claim()
          .should.be.rejectedWith("NothingToClaim()");
      });

      it("should reject withdraw when nothing to claim", async function () {
        await teePool
          .connect(tee1)
          .claim()
          .should.be.rejectedWith("NothingToClaim()");
      });

      it("should reject claim when already claimed", async function () {
        await teePool.connect(tee1).submitProof(1, proofDefault);
        await teePool.connect(tee1).claim().should.be.fulfilled;
        await teePool
          .connect(tee1)
          .claim()
          .should.be.rejectedWith("NothingToClaim()");
      });

      it("should claim multiple times", async function () {
        const tee1InitialBalance = await ethers.provider.getBalance(tee1);
        const teePoolInitialBalance = await ethers.provider.getBalance(teePool);

        const tee1Info1 = await teePool.tees(tee1.address);
        tee1Info1.amount.should.eq(parseEther(0));
        tee1Info1.withdrawnAmount.should.eq(0);

        const tx1 = await teePool.connect(tee1).submitProof(1, proofDefault);
        const receipt1 = await getReceipt(tx1);

        const tee1Info2 = await teePool.tees(tee1.address);
        tee1Info2.amount.should.eq(parseEther(0.01));
        tee1Info2.withdrawnAmount.should.eq(0);

        const tx2 = await teePool.connect(tee1).claim();
        const receipt2 = await getReceipt(tx2);

        tx2.should
          .emit(teePool, "Claimed")
          .withArgs(tee1.address, parseEther(0.01));

        const tee1Info3 = await teePool.tees(tee1.address);
        tee1Info3.amount.should.eq(parseEther(0.01));
        tee1Info3.withdrawnAmount.should.eq(parseEther(0.01));

        (await ethers.provider.getBalance(tee1)).should.eq(
          tee1InitialBalance +
            parseEther(0.01) -
            BigInt(receipt1.fee + receipt2.fee),
        );
        (await ethers.provider.getBalance(teePool)).should.eq(
          teePoolInitialBalance - parseEther(0.01),
        );

        const tx3 = await teePool.connect(tee1).submitProof(2, proofDefault);
        const receipt3 = await getReceipt(tx3);

        const tee1Info4 = await teePool.tees(tee1.address);
        tee1Info4.amount.should.eq(parseEther(0.01) + parseEther(0.03));
        tee1Info4.withdrawnAmount.should.eq(parseEther(0.01));

        const tx4 = await teePool.connect(tee1).claim();
        const receipt4 = await getReceipt(tx4);

        tx4.should
          .emit(teePool, "Claimed")
          .withArgs(tee1.address, parseEther(0.03));

        const tee1Info5 = await teePool.tees(tee1.address);
        tee1Info5.amount.should.eq(parseEther(0.01) + parseEther(0.03));
        tee1Info5.withdrawnAmount.should.eq(
          parseEther(0.01) + parseEther(0.03),
        );

        (await ethers.provider.getBalance(tee1)).should.eq(
          tee1InitialBalance +
            parseEther(0.01) +
            parseEther(0.03) -
            BigInt(receipt1.fee + receipt2.fee + receipt3.fee + receipt4.fee),
        );

        (await ethers.provider.getBalance(teePool)).should.eq(
          teePoolInitialBalance - parseEther(0.01) - parseEther(0.03),
        );
      });
    });
  });
});
