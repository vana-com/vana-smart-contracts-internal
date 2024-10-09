import chai, { should } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers, upgrades } from "hardhat";
import {
  DataRegistryImplementation,
  TeePoolImplementation,
} from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { getReceipt, parseEther } from "../utils/helpers";
import { deployDataRegistry, proofs } from "./dataRegistry";
import {
  advanceBlockNTimes,
  advanceNSeconds,
  advanceToBlockN,
  getCurrentBlockNumber,
  getCurrentBlockTimestamp,
} from "../utils/timeAndBlockManipulation";

chai.use(chaiAsPromised);
should();

describe("TeePool", () => {
  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let tee0: HardhatEthersSigner;
  let tee1: HardhatEthersSigner;
  let tee2: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;

  let teePool: TeePoolImplementation;
  let dataRegistry: DataRegistryImplementation;
  let cancelDelay: number = 100;

  enum TeeStatus {
    None = 0,
    Active = 1,
    Removed = 2,
  }
  enum JobStatus {
    None = 0,
    Submitted = 1,
    Completed = 2,
    Canceled = 3,
  }

  const deploy = async () => {
    [deployer, owner, tee0, tee1, tee2, user1, user2, user3] =
      await ethers.getSigners();

    dataRegistry = await deployDataRegistry(owner);

    const teePoolDeploy = await upgrades.deployProxy(
      await ethers.getContractFactory("TeePoolImplementation"),
      [owner.address, dataRegistry.target, cancelDelay],
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
      (await teePool.dataRegistry()).should.eq(dataRegistry);
      (await teePool.version()).should.eq(1);
      (await teePool.teeFee()).should.eq(0);
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

    it("Should updateDataRegistry when owner", async function () {
      await teePool.connect(owner).updateDataRegistry(user1.address).should.be
        .fulfilled;

      (await teePool.dataRegistry()).should.eq(user1.address);
    });

    it("Should reject updateDataRegistry when non-owner", async function () {
      await teePool
        .connect(user1)
        .updateDataRegistry(user2.address)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("Should updateTeeFee when owner", async function () {
      await teePool.connect(owner).updateTeeFee(parseEther(0.1)).should.be
        .fulfilled;

      (await teePool.teeFee()).should.eq(parseEther(0.1));
    });

    it("Should reject updateTeeFee when non-owner", async function () {
      await teePool
        .connect(user1)
        .updateTeeFee(parseEther(0.2))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("Should updateCancelDelay when owner", async function () {
      await teePool.connect(owner).updateCancelDelay(200).should.be.fulfilled;

      (await teePool.cancelDelay()).should.eq(200);
    });

    it("Should reject updateCancelDelay when non-owner", async function () {
      await teePool
        .connect(user1)
        .updateCancelDelay(200)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("Should multicall ", async function () {
      const call1 = teePool.interface.encodeFunctionData("owner");
      const call2 = teePool.interface.encodeFunctionData("teeFee");
      const call3 = teePool.interface.encodeFunctionData("jobs", [0]);

      const results = await teePool.multicall.staticCall([call1, call2, call3]);
      const decodedCall1 = teePool.interface.decodeFunctionResult(
        "owner",
        results[0],
      );
      const decodedCall2 = teePool.interface.decodeFunctionResult(
        "teeFee",
        results[1],
      );
      const decodedCall3 = teePool.interface.decodeFunctionResult(
        "jobs",
        results[2],
      );

      decodedCall1[0].should.eq(owner.address);
      decodedCall2[0].should.eq(0);
      decodedCall3[0].should.deep.eq(await teePool.jobs(0));
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
        .addTee(tee0, "tee0Url")
        .should.emit(teePool, "TeeAdded")
        .withArgs(tee0);

      (await teePool.teesCount()).should.eq(1);
      (await teePool.activeTeesCount()).should.eq(1);
      const tee1Info = await teePool.tees(tee0.address);
      tee1Info.status.should.eq(TeeStatus.Active);
      tee1Info.amount.should.eq(0);
      tee1Info.withdrawnAmount.should.eq(0);
      tee1Info.url.should.eq("tee0Url");

      (await teePool.teeListAt(0)).should.deep.eq(tee1Info);
      (await teePool.activeTeeListAt(0)).should.deep.eq(tee1Info);

      (await teePool.teeList()).should.deep.eq([tee0.address]);
      (await teePool.activeTeeList()).should.deep.eq([tee0.address]);
    });

    it("should addTee #multiple tees", async function () {
      (await teePool.teesCount()).should.eq(0);

      await teePool
        .connect(owner)
        .addTee(tee0, "tee0Url")
        .should.emit(teePool, "TeeAdded")
        .withArgs(tee0);

      (await teePool.teeList()).should.deep.eq([tee0.address]);

      await teePool
        .connect(owner)
        .addTee(tee1, "tee1Url")
        .should.emit(teePool, "TeeAdded")
        .withArgs(tee1);

      (await teePool.teesCount()).should.eq(2);
      (await teePool.activeTeesCount()).should.eq(2);

      const tee1Info = await teePool.tees(tee0.address);
      tee1Info.status.should.eq(TeeStatus.Active);
      tee1Info.amount.should.eq(0);
      tee1Info.withdrawnAmount.should.eq(0);
      tee1Info.url.should.eq("tee0Url");

      const tee2Info = await teePool.tees(tee1.address);
      tee2Info.status.should.eq(TeeStatus.Active);
      tee2Info.amount.should.eq(0);
      tee2Info.withdrawnAmount.should.eq(0);
      tee2Info.url.should.eq("tee1Url");

      (await teePool.teeListAt(0)).should.deep.eq(tee1Info);
      (await teePool.activeTeeListAt(0)).should.deep.eq(tee1Info);

      (await teePool.teeListAt(1)).should.deep.eq(tee2Info);
      (await teePool.activeTeeListAt(1)).should.deep.eq(tee2Info);

      (await teePool.teeList()).should.deep.eq([tee0.address, tee1.address]);
      (await teePool.activeTeeList()).should.deep.eq([
        tee0.address,
        tee1.address,
      ]);
    });

    it("should reject addTee when already added", async function () {
      await teePool
        .connect(owner)
        .addTee(tee0, "tee0Url")
        .should.emit(teePool, "TeeAdded")
        .withArgs(tee0);

      await teePool
        .connect(owner)
        .addTee(tee0, "tee0Url")
        .should.be.rejectedWith("TeeAlreadyAdded");
    });

    it("should reject addTee when non-owner", async function () {
      await teePool
        .connect(user1)
        .addTee(tee0, "tee0Url")
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("should removeTee when owner #1", async function () {
      await teePool
        .connect(owner)
        .addTee(tee0, "tee0Url")
        .should.emit(teePool, "TeeAdded")
        .withArgs(tee0);

      await teePool
        .connect(owner)
        .removeTee(tee0)
        .should.emit(teePool, "TeeRemoved")
        .withArgs(tee0);

      (await teePool.teesCount()).should.eq(1);
      (await teePool.activeTeesCount()).should.eq(0);
      const tee1Info = await teePool.tees(tee0.address);
      tee1Info.status.should.eq(TeeStatus.Removed);
      tee1Info.amount.should.eq(0);
      tee1Info.withdrawnAmount.should.eq(0);
      tee1Info.url.should.eq("tee0Url");

      (await teePool.teeListAt(0)).should.deep.eq(tee1Info);

      (await teePool.teeList()).should.deep.eq([tee0.address]);
      (await teePool.activeTeeList()).should.deep.eq([]);
    });

    it("should removeTee when multiple tees", async function () {
      await teePool
        .connect(owner)
        .addTee(tee0, "tee0Url")
        .should.emit(teePool, "TeeAdded")
        .withArgs(tee0);

      await teePool
        .connect(owner)
        .addTee(tee1, "tee1Url")
        .should.emit(teePool, "TeeAdded")
        .withArgs(tee1);

      await teePool
        .connect(owner)
        .addTee(tee2, "tee2Url")
        .should.emit(teePool, "TeeAdded")
        .withArgs(tee2);

      await teePool
        .connect(owner)
        .removeTee(tee1)
        .should.emit(teePool, "TeeRemoved")
        .withArgs(tee1);

      (await teePool.teesCount()).should.eq(3);
      (await teePool.activeTeesCount()).should.eq(2);
      const tee2Info = await teePool.tees(tee1.address);
      tee2Info.status.should.eq(TeeStatus.Removed);
      tee2Info.amount.should.eq(0);
      tee2Info.withdrawnAmount.should.eq(0);
      tee2Info.url.should.eq("tee1Url");

      (await teePool.teeListAt(1)).should.deep.eq(tee2Info);

      (await teePool.teeList()).should.deep.eq([
        tee0.address,
        tee1.address,
        tee2.address,
      ]);
      (await teePool.activeTeeList()).should.deep.eq([
        tee0.address,
        tee2.address,
      ]);
    });

    it("should reject removeTee when non-owner", async function () {
      await teePool
        .connect(owner)
        .addTee(tee0, "tee0Url")
        .should.emit(teePool, "TeeAdded")
        .withArgs(tee0);

      await teePool
        .connect(user1)
        .removeTee(tee0)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("should reject removeTee when not added", async function () {
      await teePool
        .connect(owner)
        .removeTee(tee0)
        .should.be.rejectedWith("TeeNotActive");
    });
  });

  describe("Job", () => {
    beforeEach(async () => {
      await deploy();

      await teePool.connect(owner).addTee(tee0, "tee0Url");
    });

    it("should requestContributionProof", async function () {
      const user1InitialBalance = await ethers.provider.getBalance(
        user1.address,
      );

      const tx = await teePool
        .connect(user1)
        .requestContributionProof(1, { value: parseEther(0.01) });
      const receipt = await getReceipt(tx);

      await tx.should
        .emit(teePool, "JobSubmitted")
        .withArgs(1, 1, tee0, parseEther(0.01));

      (await teePool.jobsCount()).should.eq(1);

      const job1 = await teePool.jobs(1);
      job1.bidAmount.should.eq(parseEther(0.01));
      job1.fileId.should.eq(1);
      job1.addedTimestamp.should.eq(await getCurrentBlockTimestamp());
      job1.ownerAddress.should.eq(user1.address);
      job1.status.should.eq(JobStatus.Submitted);
      job1.teeAddress.should.eq(tee0);

      (await ethers.provider.getBalance(user1.address)).should.eq(
        user1InitialBalance - parseEther(0.01) - receipt.fee,
      );
    });

    it("should submitJob", async function () {
      const user1InitialBalance = await ethers.provider.getBalance(
        user1.address,
      );

      const tx = await teePool
        .connect(user1)
        .submitJob(1, { value: parseEther(0.01) });
      const receipt = await getReceipt(tx);

      await tx.should
        .emit(teePool, "JobSubmitted")
        .withArgs(1, 1, tee0, parseEther(0.01));

      (await teePool.jobsCount()).should.eq(1);

      const job1 = await teePool.jobs(1);
      job1.bidAmount.should.eq(parseEther(0.01));
      job1.fileId.should.eq(1);
      job1.addedTimestamp.should.eq(await getCurrentBlockTimestamp());
      job1.ownerAddress.should.eq(user1.address);
      job1.status.should.eq(JobStatus.Submitted);
      job1.teeAddress.should.eq(tee0);

      (await ethers.provider.getBalance(user1.address)).should.eq(
        user1InitialBalance - parseEther(0.01) - receipt.fee,
      );
    });

    it("should requestContributionProof #same user multiple files", async function () {
      const user1InitialBalance = await ethers.provider.getBalance(user1);

      const tx1 = await teePool
        .connect(user1)
        .requestContributionProof(1, { value: parseEther(0.01) });
      const receipt1 = await getReceipt(tx1);

      const tx2 = await teePool
        .connect(user1)
        .requestContributionProof(123, { value: parseEther(0.02) });
      const receipt2 = await getReceipt(tx2);

      (await teePool.jobsCount()).should.eq(2);

      const job1 = await teePool.jobs(1);
      job1.bidAmount.should.eq(parseEther(0.01));
      job1.fileId.should.eq(1);
      job1.addedTimestamp.should.eq((await getCurrentBlockTimestamp()) - 1);
      job1.ownerAddress.should.eq(user1.address);
      job1.status.should.eq(JobStatus.Submitted);
      job1.teeAddress.should.eq(tee0);

      const job2 = await teePool.jobs(2);
      job2.bidAmount.should.eq(parseEther(0.02));
      job2.fileId.should.eq(123);
      job2.addedTimestamp.should.eq(await getCurrentBlockTimestamp());
      job2.ownerAddress.should.eq(user1.address);
      job2.status.should.eq(JobStatus.Submitted);
      job2.teeAddress.should.eq(tee0);

      (await ethers.provider.getBalance(user1.address)).should.eq(
        user1InitialBalance -
          parseEther(0.03) -
          BigInt(receipt1.fee) -
          BigInt(receipt2.fee),
      );
    });

    it("should requestContributionProof for same file #multiple users same file", async function () {
      const user1InitialBalance = await ethers.provider.getBalance(user1);
      const user2InitialBalance = await ethers.provider.getBalance(user2);

      const tx1 = await teePool
        .connect(user1)
        .requestContributionProof(1, { value: parseEther(0.01) });
      const receipt1 = await getReceipt(tx1);

      const tx2 = await teePool
        .connect(user2)
        .requestContributionProof(1, { value: parseEther(0.02) });
      const receipt2 = await getReceipt(tx2);

      (await teePool.jobsCount()).should.eq(2);

      const job1 = await teePool.jobs(1);
      job1.bidAmount.should.eq(parseEther(0.01));
      job1.fileId.should.eq(1);
      job1.teeAddress.should.eq(tee0);

      const job2 = await teePool.jobs(2);
      job2.bidAmount.should.eq(parseEther(0.02));
      job2.fileId.should.eq(1);
      job2.teeAddress.should.eq(tee0);

      (await ethers.provider.getBalance(user1.address)).should.eq(
        user1InitialBalance - parseEther(0.01) - BigInt(receipt1.fee),
      );

      (await ethers.provider.getBalance(user2.address)).should.eq(
        user2InitialBalance - parseEther(0.02) - BigInt(receipt2.fee),
      );
    });

    it("should requestContributionProof #multiple users multiple files", async function () {
      await teePool
        .connect(owner)
        .requestContributionProof(1, { value: parseEther(0.01) })
        .should.emit(teePool, "JobSubmitted")
        .withArgs(1, 1, tee0, parseEther(0.01));

      await teePool
        .connect(user1)
        .requestContributionProof(123, { value: parseEther(0.02) })
        .should.emit(teePool, "JobSubmitted")
        .withArgs(2, 123, tee0, parseEther(0.02));

      (await teePool.jobsCount()).should.eq(2);

      const job1 = await teePool.jobs(1);
      job1.bidAmount.should.eq(parseEther(0.01));
      job1.fileId.should.eq(1);
      job1.teeAddress.should.eq(tee0);

      const job2 = await teePool.jobs(2);
      job2.bidAmount.should.eq(parseEther(0.02));
      job2.fileId.should.eq(123);
      job2.teeAddress.should.eq(tee0);
    });

    it("should requestContributionProof without bid when teeFee = 0", async function () {
      (await teePool.teeFee()).should.eq(0);

      await teePool
        .connect(owner)
        .requestContributionProof(1)
        .should.emit(teePool, "JobSubmitted")
        .withArgs(1, 1, tee0, 0);

      (await teePool.jobsCount()).should.eq(1);

      const job1 = await teePool.jobs(1);
      job1.bidAmount.should.eq(0);
      job1.fileId.should.eq(1);
      job1.teeAddress.should.eq(tee0);
    });

    it("should reject requestContributionProof when insufficient fee", async function () {
      await teePool.connect(owner).updateTeeFee(parseEther(0.01));

      await teePool
        .connect(user1)
        .requestContributionProof(1, { value: parseEther(0.001) })
        .should.be.rejectedWith("InsufficientFee()");
    });

    it("should cancelJob with bid when teeFee != 0", async function () {
      await teePool.connect(owner).updateTeeFee(parseEther(0.1));

      const user1InitialBalance = await ethers.provider.getBalance(user1);

      const tx1 = await teePool
        .connect(user1)
        .requestContributionProof(1, { value: parseEther(0.1) });

      await tx1.should
        .emit(teePool, "JobSubmitted")
        .withArgs(1, 1, tee0, parseEther(0.1));

      (await teePool.jobsCount()).should.eq(1);

      const job1Before = await teePool.jobs(1);
      job1Before.bidAmount.should.eq(parseEther(0.1));
      job1Before.fileId.should.eq(1);
      job1Before.addedTimestamp.should.eq(await getCurrentBlockTimestamp());
      job1Before.ownerAddress.should.eq(user1.address);
      job1Before.status.should.eq(JobStatus.Submitted);
      job1Before.teeAddress.should.eq(tee0);

      await advanceNSeconds(cancelDelay);
      await advanceBlockNTimes(1);
      const tx2 = await teePool.connect(user1).cancelJob(1);

      await tx2.should.emit(teePool, "JobCanceled").withArgs(1);

      (await ethers.provider.getBalance(user1.address)).should.eq(
        user1InitialBalance -
          (await getReceipt(tx1)).fee -
          (await getReceipt(tx2)).fee,
      );

      const job1After = await teePool.jobs(1);
      job1After.bidAmount.should.eq(parseEther(0.1));
      job1After.fileId.should.eq(1);
      job1After.ownerAddress.should.eq(user1.address);
      job1After.status.should.eq(JobStatus.Canceled);
      job1After.teeAddress.should.eq(tee0);
    });

    it("should cancelJob when multiple jobs #1", async function () {
      await teePool.connect(owner).updateTeeFee(parseEther(0.1));

      const user1InitialBalance = await ethers.provider.getBalance(user1);

      const tx1 = await teePool
        .connect(user1)
        .requestContributionProof(1, { value: parseEther(0.1) });

      await tx1.should
        .emit(teePool, "JobSubmitted")
        .withArgs(1, 1, tee0, parseEther(0.1));

      const tx2 = await teePool
        .connect(user1)
        .requestContributionProof(1, { value: parseEther(0.2) });

      await tx2.should
        .emit(teePool, "JobSubmitted")
        .withArgs(2, 1, tee0, parseEther(0.2));

      (await teePool.jobsCount()).should.eq(2);

      const job1Before = await teePool.jobs(1);
      job1Before.bidAmount.should.eq(parseEther(0.1));
      job1Before.fileId.should.eq(1);
      job1Before.addedTimestamp.should.eq(
        (await getCurrentBlockTimestamp()) - 1,
      );
      job1Before.ownerAddress.should.eq(user1.address);
      job1Before.status.should.eq(JobStatus.Submitted);

      const job2Before = await teePool.jobs(2);
      job2Before.bidAmount.should.eq(parseEther(0.2));
      job2Before.fileId.should.eq(1);
      job2Before.addedTimestamp.should.eq(await getCurrentBlockTimestamp());
      job2Before.ownerAddress.should.eq(user1.address);
      job2Before.status.should.eq(JobStatus.Submitted);

      await advanceNSeconds(cancelDelay);
      await advanceBlockNTimes(1);
      const tx3 = await teePool.connect(user1).cancelJob(1);

      await tx3.should.emit(teePool, "JobCanceled").withArgs(1);

      (await ethers.provider.getBalance(user1.address)).should.eq(
        user1InitialBalance -
          (await getReceipt(tx1)).fee -
          (await getReceipt(tx2)).fee -
          (await getReceipt(tx3)).fee -
          parseEther(0.2),
      );

      const job1After = await teePool.jobs(1);
      job1After.bidAmount.should.eq(parseEther(0.1));
      job1After.fileId.should.eq(1);
      job1After.ownerAddress.should.eq(user1.address);
      job1After.status.should.eq(JobStatus.Canceled);

      const job2After = await teePool.jobs(2);
      job2After.bidAmount.should.eq(parseEther(0.2));
      job2After.fileId.should.eq(1);
      job2After.ownerAddress.should.eq(user1.address);
      job2After.status.should.eq(JobStatus.Submitted);
    });

    it("should cancelJob when multiple jobs #2", async function () {
      await teePool.connect(owner).updateTeeFee(parseEther(0.1));

      const user1InitialBalance = await ethers.provider.getBalance(user1);

      const tx1 = await teePool
        .connect(user1)
        .requestContributionProof(1, { value: parseEther(0.1) });

      await tx1.should
        .emit(teePool, "JobSubmitted")
        .withArgs(1, 1, tee0, parseEther(0.1));

      const tx2 = await teePool
        .connect(user1)
        .requestContributionProof(1, { value: parseEther(0.2) });

      await tx2.should
        .emit(teePool, "JobSubmitted")
        .withArgs(2, 1, tee0, parseEther(0.2));

      (await teePool.jobsCount()).should.eq(2);

      const job1Before = await teePool.jobs(1);
      job1Before.bidAmount.should.eq(parseEther(0.1));
      job1Before.fileId.should.eq(1);
      job1Before.addedTimestamp.should.eq(
        (await getCurrentBlockTimestamp()) - 1,
      );
      job1Before.ownerAddress.should.eq(user1.address);
      job1Before.status.should.eq(JobStatus.Submitted);
      job1Before.teeAddress.should.eq(tee0);

      const job2Before = await teePool.jobs(2);
      job2Before.bidAmount.should.eq(parseEther(0.2));
      job2Before.fileId.should.eq(1);
      job2Before.addedTimestamp.should.eq(await getCurrentBlockTimestamp());
      job2Before.ownerAddress.should.eq(user1.address);
      job2Before.status.should.eq(JobStatus.Submitted);
      job2Before.teeAddress.should.eq(tee0);

      await advanceNSeconds(cancelDelay);
      await advanceBlockNTimes(1);
      const tx3 = await teePool.connect(user1).cancelJob(2);

      await tx3.should.emit(teePool, "JobCanceled").withArgs(2);

      (await ethers.provider.getBalance(user1.address)).should.eq(
        user1InitialBalance -
          (await getReceipt(tx1)).fee -
          (await getReceipt(tx2)).fee -
          (await getReceipt(tx3)).fee -
          parseEther(0.1),
      );

      const job1After = await teePool.jobs(1);
      job1After.bidAmount.should.eq(parseEther(0.1));
      job1After.fileId.should.eq(1);
      job1After.ownerAddress.should.eq(user1.address);
      job1After.status.should.eq(JobStatus.Submitted);
      job1After.teeAddress.should.eq(tee0);

      const job2After = await teePool.jobs(2);
      job2After.bidAmount.should.eq(parseEther(0.2));
      job2After.fileId.should.eq(1);
      job2After.ownerAddress.should.eq(user1.address);
      job2After.status.should.eq(JobStatus.Canceled);
      job2After.teeAddress.should.eq(tee0);
    });

    it("should cancelJob without bid when teeFee = 0", async function () {
      const user1InitialBalance = await ethers.provider.getBalance(user1);

      (await teePool.teeFee()).should.eq(0);

      const tx1 = await teePool.connect(user1).requestContributionProof(1);

      await tx1.should.emit(teePool, "JobSubmitted").withArgs(1, 1, tee0, 0);

      (await teePool.jobsCount()).should.eq(1);

      const job1Before = await teePool.jobs(1);
      job1Before.bidAmount.should.eq(0);
      job1Before.fileId.should.eq(1);
      job1Before.addedTimestamp.should.eq(await getCurrentBlockTimestamp());
      job1Before.ownerAddress.should.eq(user1.address);
      job1Before.status.should.eq(JobStatus.Submitted);
      job1Before.teeAddress.should.eq(tee0);

      await advanceNSeconds(cancelDelay);
      await advanceBlockNTimes(1);

      const tx2 = await teePool.connect(user1).cancelJob(1);

      await tx2.should.emit(teePool, "JobCanceled").withArgs(1);

      (await ethers.provider.getBalance(user1.address)).should.eq(
        user1InitialBalance -
          (await getReceipt(tx1)).fee -
          (await getReceipt(tx2)).fee,
      );

      const job1After = await teePool.jobs(1);
      job1After.bidAmount.should.eq(0);
      job1After.fileId.should.eq(1);
      job1After.ownerAddress.should.eq(user1.address);
      job1After.status.should.eq(JobStatus.Canceled);
      job1After.teeAddress.should.eq(tee0);
    });

    it("should reject cancelJob before cancelDelay", async function () {
      await teePool.connect(owner).updateTeeFee(parseEther(0.1));

      await teePool
        .connect(user1)
        .requestContributionProof(1, { value: parseEther(0.1) });

      (await teePool.jobsCount()).should.eq(1);

      await teePool
        .connect(user1)
        .cancelJob(1)
        .should.be.rejectedWith("CancelDelayNotPassed()");
    });

    it("should reject cancelJob when not job owner", async function () {
      await teePool.connect(owner).updateTeeFee(parseEther(0.1));

      await teePool
        .connect(user1)
        .requestContributionProof(1, { value: parseEther(0.1) });

      (await teePool.jobsCount()).should.eq(1);

      await advanceNSeconds(cancelDelay);
      await advanceBlockNTimes(1);

      await teePool
        .connect(user2)
        .cancelJob(1)
        .should.be.rejectedWith("NotJobOwner()");
    });
  });

  describe("Proof", () => {
    beforeEach(async () => {
      await deploy();

      await teePool.connect(owner).addTee(tee0, "tee0Url");
      await teePool.connect(owner).addTee(tee1, "tee1Url");
      await teePool.connect(owner).addTee(tee2, "tee2Url");

      await dataRegistry.connect(user1).addFile("file1"); //fileId = 1
      await dataRegistry.connect(user1).addFile("file2"); //fileId = 2
      await dataRegistry.connect(user1).addFile("file3"); //fileId = 3 - no job for this file
      await dataRegistry.connect(user2).addFile("file4"); //fileId = 4
      await dataRegistry.connect(user2).addFile("file5"); //fileId = 5
      await dataRegistry.connect(user3).addFile("file6"); //fileId = 6

      await teePool
        .connect(user1)
        .requestContributionProof(1, { value: parseEther(0.01) });
      await teePool
        .connect(user1)
        .requestContributionProof(2, { value: parseEther(0.03) });
      await teePool
        .connect(user1)
        .requestContributionProof(4, { value: parseEther(0.05) });
      await teePool
        .connect(user1)
        .requestContributionProof(5, { value: parseEther(0.07) });
      await teePool
        .connect(user1)
        .requestContributionProof(6, { value: parseEther(0.09) });
    });

    it("should addProof when assigned tee #1", async function () {
      await teePool
        .connect(tee1)
        .addProof(1, proofs[1])
        .should.emit(teePool, "ProofAdded")
        .withArgs(tee1.address, 1, 1)
        .and.to.emit(dataRegistry, "ProofAdded")
        .withArgs(1, 1);

      const job1 = await teePool.jobs(1);
      job1.status.should.eq(JobStatus.Completed);

      const proof1Info = await dataRegistry.fileProofs(1, 1);
      proof1Info.signature.should.eq(proofs[1].signature);
      proof1Info.data.score.should.eq(proofs[1].data.score);
      proof1Info.data.dlpId.should.eq(proofs[1].data.dlpId);
      proof1Info.data.metadata.should.eq(proofs[1].data.metadata);
      proof1Info.data.proofUrl.should.eq(proofs[1].data.proofUrl);
      proof1Info.data.instruction.should.eq(proofs[1].data.instruction);

      const tee2Info = await teePool.tees(tee1.address);
      tee2Info.amount.should.eq(parseEther(0.01));
    });

    it("should addProof when assigned tee #2", async function () {
      await teePool
        .connect(tee1)
        .addProof(1, proofs[1])
        .should.emit(teePool, "ProofAdded")
        .withArgs(tee1.address, 1, 1)
        .and.to.emit(dataRegistry, "ProofAdded")
        .withArgs(1, 1);

      const job1 = await teePool.jobs(1);
      job1.status.should.eq(JobStatus.Completed);

      const proof1Info = await dataRegistry.fileProofs(1, 1);
      proof1Info.signature.should.eq(proofs[1].signature);
      proof1Info.data.score.should.eq(proofs[1].data.score);
      proof1Info.data.dlpId.should.eq(proofs[1].data.dlpId);
      proof1Info.data.metadata.should.eq(proofs[1].data.metadata);
      proof1Info.data.proofUrl.should.eq(proofs[1].data.proofUrl);
      proof1Info.data.instruction.should.eq(proofs[1].data.instruction);

      const tee2Info = await teePool.tees(tee1.address);
      tee2Info.amount.should.eq(parseEther(0.01));
    });

    it("should reject addProof when not tee", async function () {
      await teePool
        .connect(user1)
        .addProof(1, proofs[1])
        .should.be.rejectedWith("TeeNotActive()");
    });

    it("should reject addProof when not active tee", async function () {
      await teePool.connect(owner).removeTee(tee0);
      await teePool
        .connect(tee0)
        .addProof(2, proofs[1])
        .should.be.rejectedWith("TeeNotActive()");
    });

    it("should reject addProof when proof already submitted", async function () {
      await teePool.connect(tee0).addProof(1, proofs[1]).should.be.fulfilled;

      await teePool
        .connect(tee0)
        .addProof(1, proofs[1])
        .should.be.rejectedWith("JobCompleted()");
    });

    it("should addProof for multiple files", async function () {
      await teePool
        .connect(tee0)
        .addProof(1, proofs[1])
        .should.emit(teePool, "ProofAdded")
        .withArgs(tee0.address, 1, 1);

      await teePool
        .connect(tee0)
        .addProof(2, proofs[2])
        .should.emit(teePool, "ProofAdded")
        .withArgs(tee0.address, 2, 2);

      await teePool
        .connect(tee2)
        .addProof(3, proofs[3])
        .should.emit(teePool, "ProofAdded")
        .withArgs(tee2.address, 3, 4);

      const proof1Info = await dataRegistry.fileProofs(1, 1);
      proof1Info.signature.should.eq(proofs[1].signature);
      proof1Info.data.score.should.eq(proofs[1].data.score);
      proof1Info.data.dlpId.should.eq(proofs[1].data.dlpId);
      proof1Info.data.metadata.should.eq(proofs[1].data.metadata);
      proof1Info.data.proofUrl.should.eq(proofs[1].data.proofUrl);
      proof1Info.data.instruction.should.eq(proofs[1].data.instruction);

      const proof2Info = await dataRegistry.fileProofs(2, 1);
      proof2Info.signature.should.eq(proofs[2].signature);
      proof2Info.data.score.should.eq(proofs[2].data.score);
      proof2Info.data.dlpId.should.eq(proofs[2].data.dlpId);
      proof2Info.data.metadata.should.eq(proofs[2].data.metadata);
      proof2Info.data.proofUrl.should.eq(proofs[2].data.proofUrl);
      proof2Info.data.instruction.should.eq(proofs[2].data.instruction);

      const proof3Info = await dataRegistry.fileProofs(4, 1);
      proof3Info.signature.should.eq(proofs[3].signature);
      proof3Info.data.score.should.eq(proofs[3].data.score);
      proof3Info.data.dlpId.should.eq(proofs[3].data.dlpId);
      proof3Info.data.metadata.should.eq(proofs[3].data.metadata);
      proof3Info.data.proofUrl.should.eq(proofs[3].data.proofUrl);
      proof3Info.data.instruction.should.eq(proofs[3].data.instruction);

      const tee1Info = await teePool.tees(tee0);
      tee1Info.amount.should.eq(parseEther(0.01) + parseEther(0.03));

      const tee3Info = await teePool.tees(tee2);
      tee3Info.amount.should.eq(parseEther(0.05));
    });

    describe("Claim", () => {
      it("should claim", async function () {
        await teePool.connect(tee0).addProof(1, proofs[1]);

        const tee1InitialBalance = await ethers.provider.getBalance(tee0);
        const teePoolInitialBalance = await ethers.provider.getBalance(teePool);

        const tee1InfoBefore = await teePool.tees(tee0.address);
        tee1InfoBefore.amount.should.eq(parseEther(0.01));
        tee1InfoBefore.withdrawnAmount.should.eq(0);

        const tx = await teePool.connect(tee0).claim();
        const receipt = await getReceipt(tx);

        tx.should
          .emit(teePool, "Claimed")
          .withArgs(tee0.address, parseEther(0.01));

        const tee1InfoAfter = await teePool.tees(tee0.address);
        tee1InfoAfter.amount.should.eq(parseEther(0.01));
        tee1InfoAfter.withdrawnAmount.should.eq(parseEther(0.01));

        (await ethers.provider.getBalance(tee0)).should.eq(
          tee1InitialBalance + parseEther(0.01) - receipt.fee,
        );
        (await ethers.provider.getBalance(teePool)).should.eq(
          teePoolInitialBalance - parseEther(0.01),
        );
      });

      it("should reject withdraw when not tee", async function () {
        await teePool.connect(tee0).addProof(1, proofs[1]);

        await teePool
          .connect(user1)
          .claim()
          .should.be.rejectedWith("NothingToClaim()");
      });

      it("should reject withdraw when nothing to claim", async function () {
        await teePool
          .connect(tee0)
          .claim()
          .should.be.rejectedWith("NothingToClaim()");
      });

      it("should reject claim when already claimed", async function () {
        await teePool.connect(tee0).addProof(1, proofs[1]);
        await teePool.connect(tee0).claim().should.be.fulfilled;
        await teePool
          .connect(tee0)
          .claim()
          .should.be.rejectedWith("NothingToClaim()");
      });

      it("should claim multiple times", async function () {
        const tee1InitialBalance = await ethers.provider.getBalance(tee0);
        const teePoolInitialBalance = await ethers.provider.getBalance(teePool);

        const tee1Info1 = await teePool.tees(tee0.address);
        tee1Info1.amount.should.eq(parseEther(0));
        tee1Info1.withdrawnAmount.should.eq(0);

        const tx1 = await teePool.connect(tee0).addProof(1, proofs[1]);
        const receipt1 = await getReceipt(tx1);

        const tee1Info2 = await teePool.tees(tee0.address);
        tee1Info2.amount.should.eq(parseEther(0.01));
        tee1Info2.withdrawnAmount.should.eq(0);

        const tx2 = await teePool.connect(tee0).claim();
        const receipt2 = await getReceipt(tx2);

        tx2.should
          .emit(teePool, "Claimed")
          .withArgs(tee0.address, parseEther(0.01));

        const tee1Info3 = await teePool.tees(tee0.address);
        tee1Info3.amount.should.eq(parseEther(0.01));
        tee1Info3.withdrawnAmount.should.eq(parseEther(0.01));

        (await ethers.provider.getBalance(tee0)).should.eq(
          tee1InitialBalance +
            parseEther(0.01) -
            BigInt(receipt1.fee + receipt2.fee),
        );
        (await ethers.provider.getBalance(teePool)).should.eq(
          teePoolInitialBalance - parseEther(0.01),
        );

        const tx3 = await teePool.connect(tee0).addProof(2, proofs[1]);
        const receipt3 = await getReceipt(tx3);

        const tee1Info4 = await teePool.tees(tee0.address);
        tee1Info4.amount.should.eq(parseEther(0.01) + parseEther(0.03));
        tee1Info4.withdrawnAmount.should.eq(parseEther(0.01));

        const tx4 = await teePool.connect(tee0).claim();
        const receipt4 = await getReceipt(tx4);

        tx4.should
          .emit(teePool, "Claimed")
          .withArgs(tee0.address, parseEther(0.03));

        const tee1Info5 = await teePool.tees(tee0.address);
        tee1Info5.amount.should.eq(parseEther(0.01) + parseEther(0.03));
        tee1Info5.withdrawnAmount.should.eq(
          parseEther(0.01) + parseEther(0.03),
        );

        (await ethers.provider.getBalance(tee0)).should.eq(
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

  describe("End to End", () => {
    beforeEach(async () => {
      await deploy();
    });

    it.only("example 1", async function () {
      await teePool.connect(owner).addTee(tee0, "tee0Url");
      await teePool.connect(owner).addTee(tee1, "tee1Url");
      await teePool.connect(owner).addTee(tee2, "tee2Url");

      await dataRegistry.connect(user1).addFile("file1"); //fileId = 1
      await dataRegistry.connect(user1).addFile("file2"); //fileId = 2
      await dataRegistry.connect(user1).addFile("file3"); //fileId = 3
      await dataRegistry.connect(user2).addFile("file4"); //fileId = 4
      await dataRegistry.connect(user2).addFile("file5"); //fileId = 5
      await dataRegistry.connect(user3).addFile("file6"); //fileId = 6

      const timestamp = await getCurrentBlockTimestamp();

      await teePool
        .connect(user1)
        .requestContributionProof(1, { value: parseEther(0.01) })
        .should.emit(teePool, "JobSubmitted")
        .withArgs(1, 1, tee1, parseEther(0.01));
      await teePool
        .connect(user1)
        .requestContributionProof(2, { value: parseEther(0.03) })
        .should.emit(teePool, "JobSubmitted")
        .withArgs(2, 2, tee2, parseEther(0.03));
      await teePool
        .connect(user1)
        .requestContributionProof(4, { value: parseEther(0.05) })
        .should.emit(teePool, "JobSubmitted")
        .withArgs(3, 4, tee0, parseEther(0.05));
      await teePool
        .connect(user1)
        .requestContributionProof(5, { value: parseEther(0.07) })
        .should.emit(teePool, "JobSubmitted")
        .withArgs(4, 5, tee1, parseEther(0.07));
      await teePool
        .connect(user1)
        .requestContributionProof(6, { value: parseEther(0.09) })
        .should.emit(teePool, "JobSubmitted")
        .withArgs(5, 6, tee2, parseEther(0.09));

      const job1 = await teePool.jobs(1);
      job1.bidAmount.should.eq(parseEther(0.01));
      job1.fileId.should.eq(1);
      job1.addedTimestamp.should.eq(timestamp + 1);
      job1.ownerAddress.should.eq(user1.address);
      job1.status.should.eq(JobStatus.Submitted);
      job1.teeAddress.should.eq(tee1);

      const job2 = await teePool.jobs(2);
      job2.bidAmount.should.eq(parseEther(0.03));
      job2.fileId.should.eq(2);
      job2.addedTimestamp.should.eq(timestamp + 2);
      job2.ownerAddress.should.eq(user1.address);
      job2.status.should.eq(JobStatus.Submitted);
      job2.teeAddress.should.eq(tee2);

      const job3 = await teePool.jobs(3);
      job3.bidAmount.should.eq(parseEther(0.05));
      job3.fileId.should.eq(4);
      job3.addedTimestamp.should.eq(timestamp + 3);
      job3.ownerAddress.should.eq(user1.address);
      job3.status.should.eq(JobStatus.Submitted);
      job3.teeAddress.should.eq(tee0);

      const job4 = await teePool.jobs(4);
      job4.bidAmount.should.eq(parseEther(0.07));
      job4.fileId.should.eq(5);
      job4.addedTimestamp.should.eq(timestamp + 4);
      job4.ownerAddress.should.eq(user1.address);
      job4.status.should.eq(JobStatus.Submitted);
      job4.teeAddress.should.eq(tee1);

      const job5 = await teePool.jobs(5);
      job5.bidAmount.should.eq(parseEther(0.09));
      job5.fileId.should.eq(6);
      job5.addedTimestamp.should.eq(timestamp + 5);
      job5.ownerAddress.should.eq(user1.address);
      job5.status.should.eq(JobStatus.Submitted);
      job5.teeAddress.should.eq(tee2);

      (await teePool.fileJobIds(1)).should.deep.eq([1]);
      (await teePool.fileJobIds(2)).should.deep.eq([2]);
      (await teePool.fileJobIds(3)).should.deep.eq([]);
      (await teePool.fileJobIds(4)).should.deep.eq([3]);
      (await teePool.fileJobIds(5)).should.deep.eq([4]);
      (await teePool.fileJobIds(6)).should.deep.eq([5]);

      (await teePool.tees(tee0)).jobsCount.should.eq(1);
      (await teePool.tees(tee1)).jobsCount.should.eq(2);
      (await teePool.tees(tee2)).jobsCount.should.eq(2);

      (await teePool.teeJobIdsPaginated(tee0, 0, 1000)).should.deep.eq([3]);
      (await teePool.teeJobIdsPaginated(tee1, 0, 1000)).should.deep.eq([1, 4]);
      (await teePool.teeJobIdsPaginated(tee2, 0, 1000)).should.deep.eq([2, 5]);

      await teePool
        .connect(tee1)
        .addProof(4, proofs[5])
        .should.emit(teePool, "ProofAdded")
        .withArgs(tee1.address, 4, 5)
        .and.to.emit(dataRegistry, "ProofAdded")
        .withArgs(5, 1);

      const file5Proof1 = await dataRegistry.fileProofs(5, 1);
      file5Proof1.signature.should.eq(proofs[5].signature);
      file5Proof1.data.score.should.eq(proofs[5].data.score);
      file5Proof1.data.dlpId.should.eq(proofs[5].data.dlpId);
      file5Proof1.data.metadata.should.eq(proofs[5].data.metadata);
      file5Proof1.data.proofUrl.should.eq(proofs[5].data.proofUrl);
      file5Proof1.data.instruction.should.eq(proofs[5].data.instruction);

      (await teePool.tees(tee0)).jobsCount.should.eq(1);
      (await teePool.tees(tee1)).jobsCount.should.eq(1);
      (await teePool.tees(tee2)).jobsCount.should.eq(2);

      (await teePool.teeJobIdsPaginated(tee0, 0, 1000)).should.deep.eq([3]);
      (await teePool.teeJobIdsPaginated(tee1, 0, 1000)).should.deep.eq([1]);
      (await teePool.teeJobIdsPaginated(tee2, 0, 1000)).should.deep.eq([2, 5]);

      const tee2Info = await teePool.tees(tee1.address);
      tee2Info.amount.should.eq(parseEther(0.07));
    });
  });
});
