import chai, { should } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers, upgrades } from "hardhat";
import { ContractTransactionReceipt, Wallet } from "ethers";
import { DAT, DataLiquidityPoolsRootImplementation } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  advanceToBlockN,
  getCurrentBlockNumber,
} from "../utils/timeAndBlockManipulation";
import { getReceipt, parseEther } from "../utils/helpers";

chai.use(chaiAsPromised);
should();

describe("DataLiquidityPoolsRoot", () => {
  enum DlpStatus {
    None,
    Registered,
    Deregistered,
  }

  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let dlp1: HardhatEthersSigner;
  let dlp1Owner: HardhatEthersSigner;
  let dlp2: HardhatEthersSigner;
  let dlp2Owner: HardhatEthersSigner;
  let dlp3: HardhatEthersSigner;
  let dlp3Owner: HardhatEthersSigner;
  let dlp4: HardhatEthersSigner;
  let dlp4Owner: HardhatEthersSigner;
  let dlp5: HardhatEthersSigner;
  let dlp5Owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;

  let root: DataLiquidityPoolsRootImplementation;

  const maxNumberOfDlps = 3;
  let epochSize = 100;
  const minDlpStakeAmount = parseEther(50);
  let startBlock: number;
  let epochRewardAmount = parseEther(2);

  const ttfPercentage = 15;
  const tfcPercentage = 15;
  const vduPercentage = 50;
  const uwPercentage = 20;

  const dlpInitialBalance = parseEther(0);

  const deploy = async () => {
    [
      deployer,
      owner,
      user1,
      user2,
      user3,
      dlp1,
      dlp1Owner,
      dlp2,
      dlp2Owner,
      dlp3,
      dlp3Owner,
      dlp4,
      dlp4Owner,
      dlp5,
      dlp5Owner,
    ] = await ethers.getSigners();

    startBlock = (await getCurrentBlockNumber()) + 200;

    const dlpRootDeploy = await upgrades.deployProxy(
      await ethers.getContractFactory("DataLiquidityPoolsRootImplementation"),
      [
        [
          owner.address,
          maxNumberOfDlps,
          minDlpStakeAmount,
          startBlock,
          epochSize,
          epochRewardAmount,
        ],
      ],
      {
        kind: "uups",
      },
    );

    root = await ethers.getContractAt(
      "DataLiquidityPoolsRootImplementation",
      dlpRootDeploy.target,
    );
  };

  async function advanceToEpochN(epochNumber: number) {
    const epochNStartBlock = startBlock + (epochNumber - 1) * epochSize;

    await advanceToBlockN(epochNStartBlock);
  }

  async function register5Dlps() {
    await root
      .connect(dlp1Owner)
      .registerDlp(dlp1, dlp1Owner, false, { value: parseEther(100) });
    await root
      .connect(dlp2Owner)
      .registerDlp(dlp2, dlp2Owner, false, { value: parseEther(100) });
    await root
      .connect(dlp3Owner)
      .registerDlp(dlp3, dlp3Owner, false, { value: parseEther(100) });
    await root
      .connect(dlp4Owner)
      .registerDlp(dlp4, dlp4Owner, false, { value: parseEther(100) });
    await root
      .connect(dlp5Owner)
      .registerDlp(dlp5, dlp5Owner, false, { value: parseEther(100) });
  }

  async function registerNDlps(stakes: number[]) {
    for (let i = 0; i < stakes.length; i++) {
      await root
        .connect(dlp1Owner)
        .registerDlp(Wallet.createRandom(), dlp1Owner, false, {
          value: parseEther(stakes[i].toString()),
        });
    }
  }

  async function register1Dlp() {
    await root
      .connect(dlp1Owner)
      .registerDlp(dlp1, dlp1Owner, false, { value: parseEther(100) });
  }

  const generateStakes = (length: number, min: number, max: number) =>
    Array.from({ length }, () => Math.random() * (max - min) + min);

  function getTopKStakes(arr: number[], k: number): BigInt[] {
    // Create an array of objects with value and original index
    const indexedArray = arr.map((value, index) => ({ value, index }));

    // Sort the array by value in descending order
    indexedArray.sort((a, b) => b.value - a.value);

    // Slice the first k elements
    const largestKElements = indexedArray.slice(0, k);

    return largestKElements.map((element) => BigInt(element.index + 1));
  }

  describe("Setup", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should have correct params after deploy", async function () {
      (await root.owner()).should.eq(owner);
      (await root.maxNumberOfDlps()).should.eq(maxNumberOfDlps);
      (await root.minDlpStakeAmount()).should.eq(minDlpStakeAmount);
      (await root.epochSize()).should.eq(epochSize);
      (await root.epochRewardAmount()).should.eq(epochRewardAmount);
      (await root.paused()).should.eq(false);
      (await root.version()).should.eq(1);

      (await root.epochsCount()).should.eq(0);

      const epoch = await root.epochs(0);
      epoch.startBlock.should.eq(await getCurrentBlockNumber());
      epoch.endBlock.should.eq(startBlock - 1);
      epoch.dlpIds.should.deep.eq([]);
    });

    it("Should pause when owner", async function () {
      await root
        .connect(owner)
        .pause()
        .should.emit(root, "Paused")
        .withArgs(owner.address);
      (await root.paused()).should.be.equal(true);
    });

    it("Should reject pause when non-owner", async function () {
      await root
        .connect(dlp1)
        .pause()
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1.address}")`,
        );
      (await root.paused()).should.be.equal(false);
    });

    it("Should unpause when owner", async function () {
      await root.connect(owner).pause();
      await root
        .connect(owner)
        .unpause()
        .should.emit(root, "Unpaused")
        .withArgs(owner.address);
      (await root.paused()).should.be.equal(false);
    });

    it("Should reject unpause when non-owner", async function () {
      await root.connect(owner).pause();
      await root
        .connect(dlp1Owner)
        .unpause()
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1Owner.address}")`,
        );
      (await root.paused()).should.be.equal(true);
    });

    it("Should updateMaxNumberOfDlps when owner", async function () {
      await root
        .connect(owner)
        .updateMaxNumberOfDlps(123)
        .should.emit(root, "MaxNumberOfDlpsUpdated")
        .withArgs(123);

      (await root.maxNumberOfDlps()).should.eq(123);
    });

    it("Should reject updateMaxNumberOfDlps when non-owner", async function () {
      await root
        .connect(dlp1)
        .updateMaxNumberOfDlps(123)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1.address}")`,
        );

      (await root.maxNumberOfDlps()).should.eq(maxNumberOfDlps);
    });

    it("Should updateEpochSize when owner", async function () {
      await root
        .connect(owner)
        .updateEpochSize(123)
        .should.emit(root, "EpochSizeUpdated")
        .withArgs(123);

      (await root.epochSize()).should.eq(123);
    });

    it("Should reject updateEpochSize when non-owner", async function () {
      await root
        .connect(dlp1)
        .updateEpochSize(123)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1.address}")`,
        );

      (await root.epochSize()).should.eq(epochSize);
    });

    it("Should updateEpochRewardAmount when owner", async function () {
      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      (await root.epochs(1)).reward.should.eq(epochRewardAmount);

      await root
        .connect(owner)
        .updateEpochRewardAmount(123)
        .should.emit(root, "EpochRewardAmountUpdated")
        .withArgs(123);

      (await root.epochRewardAmount()).should.eq(123);

      (await root.epochs(1)).reward.should.eq(epochRewardAmount);
    });

    it("Should updateEpochRewardAmount starting with the current epoch", async function () {
      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();
      await advanceToEpochN(3);
      (await root.epochs(1)).reward.should.eq(epochRewardAmount);

      await root
        .connect(owner)
        .updateEpochRewardAmount(123)
        .should.emit(root, "EpochRewardAmountUpdated")
        .withArgs(123);

      (await root.epochRewardAmount()).should.eq(123);

      await advanceToEpochN(5);
      await root.connect(dlp1).createEpochs();

      (await root.epochs(1)).reward.should.eq(epochRewardAmount);
      (await root.epochs(2)).reward.should.eq(epochRewardAmount);
      (await root.epochs(3)).reward.should.eq(epochRewardAmount);
      (await root.epochs(4)).reward.should.eq(123);
      (await root.epochs(5)).reward.should.eq(123);
    });

    it("Should reject updateEpochSize when non-owner", async function () {
      await root
        .connect(dlp1)
        .updateEpochRewardAmount(123)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1.address}")`,
        );

      (await root.epochRewardAmount()).should.eq(epochRewardAmount);
    });

    it("Should updateMinDlpStakeAmount when owner", async function () {
      await root
        .connect(owner)
        .updateMinDlpStakeAmount(parseEther(0.2))
        .should.emit(root, "MinDlpStakeAmountUpdated")
        .withArgs(parseEther(0.2));

      (await root.minDlpStakeAmount()).should.eq(parseEther(0.2));
    });

    it("Should reject updateMinDlpStakeAmount when non-owner", async function () {
      await root
        .connect(dlp1)
        .updateMinDlpStakeAmount(parseEther(0.2))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1.address}")`,
        );

      (await root.minDlpStakeAmount()).should.eq(minDlpStakeAmount);
    });

    it("Should transferOwnership in 2 steps", async function () {
      await root
        .connect(owner)
        .transferOwnership(user2.address)
        .should.emit(root, "OwnershipTransferStarted")
        .withArgs(owner, user2);
      (await root.owner()).should.eq(owner);

      await root
        .connect(owner)
        .transferOwnership(user3.address)
        .should.emit(root, "OwnershipTransferStarted")
        .withArgs(owner, user3);
      (await root.owner()).should.eq(owner);

      await root
        .connect(user3)
        .acceptOwnership()
        .should.emit(root, "OwnershipTransferred");

      (await root.owner()).should.eq(user3);
    });

    it("Should reject transferOwnership when non-owner", async function () {
      await root
        .connect(dlp1Owner)
        .transferOwnership(user2)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1Owner.address}")`,
        );
    });

    it("Should reject acceptOwnership when non-newOwner", async function () {
      await root
        .connect(owner)
        .transferOwnership(user2.address)
        .should.emit(root, "OwnershipTransferStarted")
        .withArgs(owner, user2);
      (await root.owner()).should.eq(owner);

      await root
        .connect(user3)
        .acceptOwnership()
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user3.address}")`,
        );
    });

    it("Should upgradeTo when owner", async function () {
      await upgrades.upgradeProxy(
        root,
        await ethers.getContractFactory(
          "DataLiquidityPoolsRootImplementationV2Mock",
          owner,
        ),
      );

      const newRoot = await ethers.getContractAt(
        "DataLiquidityPoolsRootImplementationV2Mock",
        root,
      );
      (await newRoot.owner()).should.eq(owner);
      (await newRoot.maxNumberOfDlps()).should.eq(maxNumberOfDlps);
      (await newRoot.minDlpStakeAmount()).should.eq(minDlpStakeAmount);
      (await newRoot.epochSize()).should.eq(epochSize);
      (await newRoot.epochRewardAmount()).should.eq(epochRewardAmount);
      (await newRoot.paused()).should.eq(false);
      (await newRoot.version()).should.eq(2);

      (await newRoot.epochsCount()).should.eq(0);

      (await newRoot.test()).should.eq("test");
    });

    it("Should upgradeTo when owner and emit event", async function () {
      const newRootImplementation = await ethers.deployContract(
        "DataLiquidityPoolsRootImplementationV2Mock",
      );

      await root
        .connect(owner)
        .upgradeToAndCall(newRootImplementation, "0x")
        .should.emit(root, "Upgraded")
        .withArgs(newRootImplementation);

      const newRoot = await ethers.getContractAt(
        "DataLiquidityPoolsRootImplementationV2Mock",
        root,
      );

      (await newRoot.owner()).should.eq(owner);
      (await newRoot.maxNumberOfDlps()).should.eq(maxNumberOfDlps);
      (await newRoot.minDlpStakeAmount()).should.eq(minDlpStakeAmount);
      (await newRoot.epochSize()).should.eq(epochSize);
      (await newRoot.epochRewardAmount()).should.eq(epochRewardAmount);
      (await newRoot.paused()).should.eq(false);
      (await newRoot.version()).should.eq(2);

      (await newRoot.epochsCount()).should.eq(0);

      (await newRoot.test()).should.eq("test");
    });

    it("Should reject upgradeTo when storage layout is incompatible", async function () {
      await upgrades
        .upgradeProxy(
          root,
          await ethers.getContractFactory(
            "DataLiquidityPoolsRootImplementationV3Mock",
            owner,
          ),
        )
        .should.be.rejectedWith("New storage layout is incompatible");
    });

    it("Should reject upgradeTo when non owner", async function () {
      const newRootImplementation = await ethers.deployContract(
        "DataLiquidityPoolsRootImplementationV2Mock",
      );

      await root
        .connect(user1)
        .upgradeToAndCall(newRootImplementation, "0x")
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });
  });

  describe("Epochs", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should createEpochs after the end of the previous one", async function () {
      await advanceToEpochN(1);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(1);
      await advanceToEpochN(2);

      const epoch1 = await root.epochs(1);
      epoch1.startBlock.should.eq(startBlock);
      epoch1.endBlock.should.eq(startBlock + epochSize - 1);
      epoch1.reward.should.eq(epochRewardAmount);
      epoch1.dlpIds.should.deep.eq([]);

      let epoch2 = await root.epochs(2);
      epoch2.startBlock.should.eq(0);
      epoch2.endBlock.should.eq(0);
      epoch2.reward.should.eq(0);
      epoch2.dlpIds.should.deep.eq([]);

      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(2);

      (await root.epochsCount()).should.eq(2);

      epoch2 = await root.epochs(2);
      epoch2.startBlock.should.eq(startBlock + epochSize);
      epoch2.endBlock.should.eq(startBlock + 2 * epochSize - 1);
      epoch2.reward.should.eq(epochRewardAmount);
      epoch2.dlpIds.should.deep.eq([]);
    });

    it("should createEpochs after long time", async function () {
      await advanceToEpochN(4);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(2)
        .emit(root, "EpochCreated")
        .withArgs(3)
        .emit(root, "EpochCreated")
        .withArgs(4);

      (await root.epochsCount()).should.eq(4);

      const epoch2 = await root.epochs(2);
      epoch2.startBlock.should.eq(startBlock + epochSize);
      epoch2.endBlock.should.eq(startBlock + 2 * epochSize - 1);
      epoch2.reward.should.eq(epochRewardAmount);
      epoch2.dlpIds.should.deep.eq([]);

      const epoch3 = await root.epochs(3);
      epoch3.startBlock.should.eq(startBlock + 2 * epochSize);
      epoch3.endBlock.should.eq(startBlock + 3 * epochSize - 1);
      epoch3.reward.should.eq(epochRewardAmount);
      epoch3.dlpIds.should.deep.eq([]);

      const epoch4 = await root.epochs(4);
      epoch4.startBlock.should.eq(startBlock + 3 * epochSize);
      epoch4.endBlock.should.eq(startBlock + 4 * epochSize - 1);
      epoch4.reward.should.eq(epochRewardAmount);
      epoch4.dlpIds.should.deep.eq([]);
    });

    it("should createEpochsUntilBlockNumber after long time", async function () {
      await advanceToEpochN(7);

      const epoch4StartBlock = startBlock + 3 * epochSize;
      await root
        .connect(owner)
        .createEpochsUntilBlockNumber(epoch4StartBlock)
        .should.emit(root, "EpochCreated")
        .withArgs(2)
        .emit(root, "EpochCreated")
        .withArgs(3)
        .emit(root, "EpochCreated")
        .withArgs(4);

      (await root.epochsCount()).should.eq(4);

      const epoch2 = await root.epochs(2);
      epoch2.startBlock.should.eq(startBlock + epochSize);
      epoch2.endBlock.should.eq(startBlock + 2 * epochSize - 1);
      epoch2.reward.should.eq(epochRewardAmount);
      epoch2.dlpIds.should.deep.eq([]);

      const epoch3 = await root.epochs(3);
      epoch3.startBlock.should.eq(startBlock + 2 * epochSize);
      epoch3.endBlock.should.eq(startBlock + 3 * epochSize - 1);
      epoch3.reward.should.eq(epochRewardAmount);
      epoch3.dlpIds.should.deep.eq([]);

      const epoch4 = await root.epochs(4);
      epoch4.startBlock.should.eq(startBlock + 3 * epochSize);
      epoch4.endBlock.should.eq(startBlock + 4 * epochSize - 1);
      epoch4.reward.should.eq(epochRewardAmount);
      epoch4.dlpIds.should.deep.eq([]);
    });

    it("should createEpochsUntilBlockNumber after long time #2", async function () {
      await registerNDlps([101, 102, 103, 104, 101]);
      await advanceToEpochN(7);

      (await root.getTopDlpsIds(maxNumberOfDlps)).should.deep.eq([4n, 3n, 2n]);
      const epoch4StartBlock = startBlock + 3 * epochSize;
      await root
        .connect(owner)
        .createEpochsUntilBlockNumber(epoch4StartBlock)
        .should.emit(root, "EpochCreated")
        .withArgs(2)
        .emit(root, "EpochCreated")
        .withArgs(3)
        .emit(root, "EpochCreated")
        .withArgs(4);

      (await root.epochsCount()).should.eq(4);

      const epoch2 = await root.epochs(2);
      epoch2.startBlock.should.eq(startBlock + epochSize);
      epoch2.endBlock.should.eq(startBlock + 2 * epochSize - 1);
      epoch2.reward.should.eq(epochRewardAmount);
      epoch2.dlpIds.should.deep.eq([4n, 3n, 2n]);

      const epoch3 = await root.epochs(3);
      epoch3.startBlock.should.eq(startBlock + 2 * epochSize);
      epoch3.endBlock.should.eq(startBlock + 3 * epochSize - 1);
      epoch3.reward.should.eq(epochRewardAmount);
      epoch3.dlpIds.should.deep.eq([4n, 3n, 2n]);

      const epoch4 = await root.epochs(4);
      epoch4.startBlock.should.eq(startBlock + 3 * epochSize);
      epoch4.endBlock.should.eq(startBlock + 4 * epochSize - 1);
      epoch4.reward.should.eq(epochRewardAmount);
      epoch4.dlpIds.should.deep.eq([4n, 3n, 2n]);
    });

    it("should create epochs with no active dlps", async function () {
      await advanceToEpochN(3);
      await root.connect(owner).createEpochs();

      for (let i = 1; i <= 2; i++) {
        (await root.epochs(i)).dlpIds.should.deep.eq([]);
      }
    });

    it("should createEpochs with one registered dlp", async function () {
      await advanceToEpochN(1);

      (await root.getTopDlpsIds(maxNumberOfDlps)).should.deep.eq([]);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(1);

      await register1Dlp();

      await advanceToEpochN(2);

      const epoch1 = await root.epochs(1);
      epoch1.startBlock.should.eq(startBlock);
      epoch1.endBlock.should.eq(startBlock + epochSize - 1);
      epoch1.reward.should.eq(epochRewardAmount);
      epoch1.dlpIds.should.deep.eq([]);

      let epoch2 = await root.epochs(2);
      epoch2.startBlock.should.eq(0);
      epoch2.endBlock.should.eq(0);
      epoch2.reward.should.eq(0);
      epoch2.dlpIds.should.deep.eq([]);

      (await root.getTopDlpsIds(maxNumberOfDlps)).should.deep.eq([1n]);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(2);

      (await root.epochsCount()).should.eq(2);

      epoch2 = await root.epochs(2);
      epoch2.startBlock.should.eq(startBlock + epochSize);
      epoch2.endBlock.should.eq(startBlock + 2 * epochSize - 1);
      epoch2.reward.should.eq(epochRewardAmount);
      epoch2.dlpIds.should.deep.eq([1]);
    });

    it("should createEpochs with multiple registered dlps #1", async function () {
      await advanceToEpochN(1);

      (await root.getTopDlpsIds(maxNumberOfDlps)).should.deep.eq([]);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(1);

      await registerNDlps([101, 102, 103, 104, 105]);

      await advanceToEpochN(2);

      const epoch1 = await root.epochs(1);
      epoch1.startBlock.should.eq(startBlock);
      epoch1.endBlock.should.eq(startBlock + epochSize - 1);
      epoch1.reward.should.eq(epochRewardAmount);
      epoch1.dlpIds.should.deep.eq([]);

      let epoch2 = await root.epochs(2);
      epoch2.startBlock.should.eq(0);
      epoch2.endBlock.should.eq(0);
      epoch2.reward.should.eq(0);
      epoch2.dlpIds.should.deep.eq([]);

      (await root.getTopDlpsIds(maxNumberOfDlps)).should.deep.eq([5n, 4n, 3n]);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(2);

      (await root.epochsCount()).should.eq(2);

      epoch2 = await root.epochs(2);
      epoch2.startBlock.should.eq(startBlock + epochSize);
      epoch2.endBlock.should.eq(startBlock + 2 * epochSize - 1);
      epoch2.reward.should.eq(epochRewardAmount);
      epoch2.dlpIds.should.deep.eq([5n, 4n, 3n]);
    });

    it("should createEpochs with multiple registered dlps #2", async function () {
      await advanceToEpochN(1);

      (await root.getTopDlpsIds(maxNumberOfDlps)).should.deep.eq([]);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(1);

      await registerNDlps([101, 106, 103, 103, 103]);

      await advanceToEpochN(2);

      const epoch1 = await root.epochs(1);
      epoch1.startBlock.should.eq(startBlock);
      epoch1.endBlock.should.eq(startBlock + epochSize - 1);
      epoch1.reward.should.eq(epochRewardAmount);
      epoch1.dlpIds.should.deep.eq([]);

      let epoch2 = await root.epochs(2);
      epoch2.startBlock.should.eq(0);
      epoch2.endBlock.should.eq(0);
      epoch2.reward.should.eq(0);
      epoch2.dlpIds.should.deep.eq([]);

      (await root.getTopDlpsIds(maxNumberOfDlps)).should.deep.eq([2n, 3n, 4n]);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(2);

      (await root.epochsCount()).should.eq(2);

      epoch2 = await root.epochs(2);
      epoch2.startBlock.should.eq(startBlock + epochSize);
      epoch2.endBlock.should.eq(startBlock + 2 * epochSize - 1);
      epoch2.reward.should.eq(epochRewardAmount);
      epoch2.dlpIds.should.deep.eq([2n, 3n, 4n]);
    });

    it("should createEpochs with multiple registered dlps #3", async function () {
      await advanceToEpochN(1);
      (await root.getTopDlpsIds(maxNumberOfDlps)).should.deep.eq([]);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(1);

      await registerNDlps([101, 102, 102, 101, 101]);

      await advanceToEpochN(2);

      const epoch1 = await root.epochs(1);
      epoch1.startBlock.should.eq(startBlock);
      epoch1.endBlock.should.eq(startBlock + epochSize - 1);
      epoch1.reward.should.eq(epochRewardAmount);
      epoch1.dlpIds.should.deep.eq([]);

      let epoch2 = await root.epochs(2);
      epoch2.startBlock.should.eq(0);
      epoch2.endBlock.should.eq(0);
      epoch2.reward.should.eq(0);
      epoch2.dlpIds.should.deep.eq([]);

      (await root.getTopDlpsIds(maxNumberOfDlps)).should.deep.eq([2n, 3n, 1n]);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(2);

      (await root.epochsCount()).should.eq(2);

      epoch2 = await root.epochs(2);
      epoch2.startBlock.should.eq(startBlock + epochSize);
      epoch2.endBlock.should.eq(startBlock + 2 * epochSize - 1);
      epoch2.reward.should.eq(epochRewardAmount);
      epoch2.dlpIds.should.deep.eq([2n, 3n, 1n]);
    });

    it("should createEpochs when 100 dlps and 16 maxNumberOfDlps", async function () {
      await root.connect(owner).updateMaxNumberOfDlps(16);
      await root.connect(owner).updateMinDlpStakeAmount(1);
      const stakes = generateStakes(100, 1, 2);
      const topStakes = getTopKStakes(stakes, 16);
      await registerNDlps(stakes);

      await advanceToEpochN(2);

      (await root.getTopDlpsIds(16)).should.deep.eq(topStakes);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(1)
        .emit(root, "EpochCreated")
        .withArgs(2);

      (await root.epochsCount()).should.eq(2);

      const epoch1 = await root.epochs(1);
      epoch1.startBlock.should.eq(startBlock);
      epoch1.endBlock.should.eq(startBlock + epochSize - 1);
      epoch1.reward.should.eq(epochRewardAmount);
      epoch1.dlpIds.should.deep.eq(topStakes);

      const epoch2 = await root.epochs(2);
      epoch2.startBlock.should.eq(startBlock + epochSize);
      epoch2.endBlock.should.eq(startBlock + 2 * epochSize - 1);
      epoch2.reward.should.eq(epochRewardAmount);
      epoch2.dlpIds.should.deep.eq(topStakes);
    });

    xit("should createEpochs when 1000 dlps and 32 maxNumberOfDlps", async function () {
      await root.connect(owner).updateEpochSize(2000);
      await advanceToEpochN(1);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(1);

      epochSize = 2000;

      await root.connect(owner).updateMaxNumberOfDlps(32);
      await root.connect(owner).updateMinDlpStakeAmount(1);
      const stakes = generateStakes(1000, 1, 2);
      const topStakes = getTopKStakes(stakes, 32);
      await registerNDlps(stakes);

      await advanceToEpochN(2);

      (await root.getTopDlpsIds(32)).should.deep.eq(topStakes);

      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(2);

      (await root.epochsCount()).should.eq(2);

      const epoch1 = await root.epochs(1);
      epoch1.startBlock.should.eq(startBlock);
      epoch1.endBlock.should.eq(startBlock + epochSize - 1);
      epoch1.reward.should.eq(epochRewardAmount);
      epoch1.dlpIds.should.deep.eq([]);

      const epoch2 = await root.epochs(2);
      epoch2.startBlock.should.eq(startBlock + epochSize);
      epoch2.endBlock.should.eq(startBlock + 2 * epochSize - 1);
      epoch2.reward.should.eq(epochRewardAmount);
      epoch2.dlpIds.should.deep.eq(topStakes);
    });
  });

  describe("Dlps - staking", () => {
    beforeEach(async () => {
      await deploy();

      await advanceToEpochN(1);
      await root.createEpochs();
    });

    it("should stake and emit event", async function () {
      await register1Dlp();

      const user1InitialBalance = await ethers.provider.getBalance(user1);

      const tx = await root.connect(user1).stake(1, { value: parseEther(10) });
      const receipt = await getReceipt(tx);

      await tx.should.emit(root, "Staked").withArgs(user1, 1, parseEther(10));

      const dlp1Info = await root.dlps(1);
      dlp1Info.stakeAmount.should.eq(parseEther(110));

      (await root.stakers(user1)).should.eq(parseEther(10));
      (await root.stakerDlps(user1, 1)).should.eq(parseEther(10));
      (await root.stakerDlpEpochs(user1, 1, 1)).stakedAmount.should.eq(
        parseEther(10),
      );
      (await root.dlps(1)).stakeAmount.should.eq(parseEther(110));

      (await ethers.provider.getBalance(user1)).should.eq(
        user1InitialBalance -
          parseEther(10) -
          BigInt(receipt.gasUsed * tx.gasPrice),
      );
      (await ethers.provider.getBalance(root)).should.eq(parseEther(110));
    });

    it(`should reject stake when dlp doesn't exist`, async function () {
      await root
        .connect(user1)
        .stake(1, { value: parseEther(10) })
        .should.be.rejectedWith("InvalidDlpStatus");
    });

    it("should reject stake when epoch is not active", async function () {
      await register1Dlp();

      await advanceToEpochN(2);

      await root
        .connect(user1)
        .stake(1, { value: parseEther(10) })
        .should.be.rejectedWith("CurrentEpochNotInitialized");
    });

    it("should stake multiple times, same epoch", async function () {
      await register1Dlp();

      await root.connect(user1).stake(1, { value: parseEther(10) });
      await root.connect(user1).stake(1, { value: parseEther(20) });

      const dlp1Info = await root.dlps(1);
      dlp1Info.stakeAmount.should.eq(parseEther(130));

      (await root.stakers(user1)).should.eq(parseEther(30));
      (await root.stakerDlps(user1, 1)).should.eq(parseEther(30));
      (await root.stakerDlpEpochs(user1, 1, 1)).stakedAmount.should.eq(
        parseEther(30),
      );
      (await root.dlps(1)).stakeAmount.should.eq(parseEther(130));
      (await ethers.provider.getBalance(root)).should.eq(parseEther(130));
    });

    it("should stake multiple times, different epochs", async function () {
      await register1Dlp();

      await root.connect(user1).stake(1, { value: parseEther(10) });

      await advanceToEpochN(2);
      await root.createEpochs();

      await root.connect(user1).stake(1, { value: parseEther(20) });

      const dlp1Info = await root.dlps(1);
      dlp1Info.stakeAmount.should.eq(parseEther(130));

      (await root.stakers(user1)).should.eq(parseEther(30));
      (await root.stakerDlps(user1, 1)).should.eq(parseEther(30));
      (await root.stakerDlpEpochs(user1, 1, 1)).stakedAmount.should.eq(
        parseEther(10),
      );
      (await root.stakerDlpEpochs(user1, 1, 2)).stakedAmount.should.eq(
        parseEther(20),
      );
      (await root.dlps(1)).stakeAmount.should.eq(parseEther(130));
      (await ethers.provider.getBalance(root)).should.eq(parseEther(130));
    });

    it("should stake multiple users", async function () {
      await register1Dlp();

      await root.connect(user1).stake(1, { value: parseEther(10) });
      await root.connect(user2).stake(1, { value: parseEther(20) });

      const dlp1Info = await root.dlps(1);
      dlp1Info.stakeAmount.should.eq(parseEther(130));

      (await root.stakers(user1)).should.eq(parseEther(10));
      (await root.stakers(user2)).should.eq(parseEther(20));
      (await root.stakerDlps(user1, 1)).should.eq(parseEther(10));
      (await root.stakerDlps(user2, 1)).should.eq(parseEther(20));
      (await root.stakerDlpEpochs(user1, 1, 1)).stakedAmount.should.eq(
        parseEther(10),
      );
      (await root.stakerDlpEpochs(user2, 1, 1)).stakedAmount.should.eq(
        parseEther(20),
      );
      (await root.dlps(1)).stakeAmount.should.eq(parseEther(130));
      (await ethers.provider.getBalance(root)).should.eq(parseEther(130));
    });

    it("should stake one user, multiple dlps", async function () {
      await registerNDlps([101, 102, 103]);

      await root.connect(user1).stake(1, { value: parseEther(10) });
      await root.connect(user1).stake(2, { value: parseEther(20) });

      const dlp1Info = await root.dlps(1);
      dlp1Info.stakeAmount.should.eq(parseEther(111));

      const dlp2Info = await root.dlps(2);
      dlp2Info.stakeAmount.should.eq(parseEther(122));

      (await root.stakers(user1)).should.eq(parseEther(30));
      (await root.stakerDlps(user1, 1)).should.eq(parseEther(10));
      (await root.stakerDlps(user1, 2)).should.eq(parseEther(20));
      (await root.stakerDlpEpochs(user1, 1, 1)).stakedAmount.should.eq(
        parseEther(10),
      );
      (await root.stakerDlpEpochs(user1, 2, 1)).stakedAmount.should.eq(
        parseEther(20),
      );
      (await root.dlps(1)).stakeAmount.should.eq(parseEther(111));
      (await root.dlps(2)).stakeAmount.should.eq(parseEther(122));
      (await ethers.provider.getBalance(root)).should.eq(
        parseEther(101 + 102 + 103 + 30),
      );
    });

    it("should stake multiple users, multiple dlps", async function () {
      await registerNDlps([101, 102, 103]);

      await root.connect(user1).stake(1, { value: parseEther(10) });
      await root.connect(user1).stake(3, { value: parseEther(20) });
      await root.connect(user2).stake(1, { value: parseEther(30) });
      await root.connect(user2).stake(2, { value: parseEther(40) });

      (await root.stakers(user1)).should.eq(parseEther(10 + 20));
      (await root.stakers(user2)).should.eq(parseEther(30 + 40));
      (await root.stakerDlps(user1, 1)).should.eq(parseEther(10));
      (await root.stakerDlps(user2, 1)).should.eq(parseEther(30));
      (await root.stakerDlps(user1, 2)).should.eq(parseEther(0));
      (await root.stakerDlps(user2, 2)).should.eq(parseEther(40));
      (await root.stakerDlps(user1, 3)).should.eq(parseEther(20));
      (await root.stakerDlps(user2, 3)).should.eq(parseEther(0));
      (await root.stakerDlpEpochs(user1, 1, 1)).stakedAmount.should.eq(
        parseEther(10),
      );
      (await root.stakerDlpEpochs(user2, 1, 1)).stakedAmount.should.eq(
        parseEther(30),
      );
      (await root.stakerDlpEpochs(user1, 2, 1)).stakedAmount.should.eq(
        parseEther(0),
      );
      (await root.stakerDlpEpochs(user2, 2, 1)).stakedAmount.should.eq(
        parseEther(40),
      );
      (await root.stakerDlpEpochs(user1, 3, 1)).stakedAmount.should.eq(
        parseEther(20),
      );
      (await root.stakerDlpEpochs(user2, 3, 1)).stakedAmount.should.eq(
        parseEther(0),
      );
      (await root.dlps(1)).stakeAmount.should.eq(parseEther(101 + 10 + 30));
      (await root.dlps(2)).stakeAmount.should.eq(parseEther(102 + 40));
      (await root.dlps(3)).stakeAmount.should.eq(parseEther(103 + 20));

      (await ethers.provider.getBalance(root)).should.eq(
        parseEther(101 + 102 + 103 + 10 + 20 + 30 + 40),
      );
    });
  });

  describe("Dlps - registration", () => {
    beforeEach(async () => {
      await deploy();

      await advanceToEpochN(1);
      await root.createEpochs();
    });

    it("should registerDlp", async function () {
      const dlp1OwnerInitialBalance =
        await ethers.provider.getBalance(dlp1Owner);
      const tx = await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, false, { value: parseEther(100) });
      const receipt = await getReceipt(tx);

      await tx.should
        .emit(root, "DlpRegistered")
        .withArgs(1, dlp1.address, dlp1Owner.address);

      (await root.dlpsCount()).should.eq(1);

      const dlp1Info = await root.dlps(1);

      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.ownerAddress.should.eq(dlp1Owner.address);
      dlp1Info.stakeAmount.should.eq(parseEther(100));
      dlp1Info.status.should.eq(DlpStatus.Registered);
      dlp1Info.grantedAmount.should.eq(0);
      dlp1Info.registrationBlockNumber.should.eq(0);

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.epochs(1)).dlpIds.should.deep.eq([]);

      (await root.stakers(dlp1Owner)).should.eq(parseEther(100));
      (await root.stakerDlps(dlp1Owner, 1)).should.eq(parseEther(100));

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerInitialBalance -
          parseEther(100) -
          BigInt(receipt.gasUsed * tx.gasPrice),
      );
      (await ethers.provider.getBalance(root)).should.eq(
        dlpInitialBalance + parseEther(100),
      );
    });

    it("should registerDlp as sponsor", async function () {
      const user1InitialBalance = await ethers.provider.getBalance(user1);
      const tx = await root
        .connect(user1)
        .registerDlp(dlp1, dlp1Owner, false, { value: parseEther(100) });
      const receipt = await getReceipt(tx);

      await tx.should
        .emit(root, "DlpRegistered")
        .withArgs(1, dlp1.address, dlp1Owner.address);

      (await root.dlpsCount()).should.eq(1);

      const dlp1Info = await root.dlps(1);

      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.ownerAddress.should.eq(dlp1Owner.address);
      dlp1Info.stakeAmount.should.eq(parseEther(100));
      dlp1Info.status.should.eq(DlpStatus.Registered);
      dlp1Info.grantedAmount.should.eq(0);
      dlp1Info.registrationBlockNumber.should.eq(0);

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.epochs(1)).dlpIds.should.deep.eq([]);

      (await root.stakers(dlp1Owner)).should.eq(parseEther(100));
      (await root.stakerDlps(dlp1Owner, 1)).should.eq(parseEther(100));

      (await ethers.provider.getBalance(user1)).should.eq(
        user1InitialBalance -
          parseEther(100) -
          BigInt(receipt.gasUsed * tx.gasPrice),
      );
      (await ethers.provider.getBalance(root)).should.eq(
        dlpInitialBalance + parseEther(100),
      );
    });

    it("should registerDlp as with grant", async function () {
      const ownerInitialBalance = await ethers.provider.getBalance(owner);
      const tx = await root
        .connect(owner)
        .registerDlp(dlp1, dlp1Owner, true, { value: parseEther(100) });
      const receipt = await getReceipt(tx);

      await tx.should
        .emit(root, "DlpRegistered")
        .withArgs(1, dlp1.address, dlp1Owner.address);

      (await root.dlpsCount()).should.eq(1);

      const dlp1Info = await root.dlps(1);

      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.ownerAddress.should.eq(dlp1Owner.address);
      dlp1Info.stakeAmount.should.eq(parseEther(100));
      dlp1Info.status.should.eq(DlpStatus.Registered);
      dlp1Info.grantedAmount.should.eq(parseEther(100));
      dlp1Info.registrationBlockNumber.should.eq(0);

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.epochs(1)).dlpIds.should.deep.eq([]);

      (await root.stakers(dlp1Owner)).should.eq(parseEther(100));
      (await root.stakerDlps(dlp1Owner, 1)).should.eq(parseEther(100));

      (await ethers.provider.getBalance(owner)).should.eq(
        ownerInitialBalance -
          parseEther(100) -
          BigInt(receipt.gasUsed * tx.gasPrice),
      );
      (await ethers.provider.getBalance(root)).should.eq(
        dlpInitialBalance + parseEther(100),
      );
    });

    it("should register multiple dlps", async function () {
      const dlp1OwnerInitialBalance =
        await ethers.provider.getBalance(dlp1Owner);
      const dlp2OwnerInitialBalance =
        await ethers.provider.getBalance(dlp2Owner);
      const dlp3OwnerInitialBalance =
        await ethers.provider.getBalance(dlp3Owner);

      const tx1 = await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, false, { value: parseEther(100) });

      const receipt1 = await getReceipt(tx1);

      const tx2 = await root
        .connect(dlp2Owner)
        .registerDlp(dlp2, dlp2Owner, false, { value: parseEther(200) });
      const receipt2 = await getReceipt(tx2);
      const tx3 = await root
        .connect(dlp3Owner)
        .registerDlp(dlp3, dlp3Owner, false, { value: parseEther(300) });
      const receipt3 = await getReceipt(tx3);

      return;

      await tx1.should
        .emit(root, "DlpRegistered")
        .withArgs(1, dlp1.address, dlp1Owner.address);
      await tx2.should
        .emit(root, "DlpRegistered")
        .withArgs(2, dlp2.address, dlp2Owner.address);
      await tx3.should
        .emit(root, "DlpRegistered")
        .withArgs(3, dlp3.address, dlp3Owner.address);

      (await root.dlpsCount()).should.eq(3);

      const dlp1Info = await root.dlps(1);
      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.ownerAddress.should.eq(dlp1Owner.address);
      dlp1Info.stakeAmount.should.eq(parseEther(100));
      dlp1Info.status.should.eq(DlpStatus.Registered);
      dlp1Info.grantedAmount.should.eq(0);
      dlp1Info.registrationBlockNumber.should.eq(0);

      const dlp2Info = await root.dlps(2);
      dlp2Info.dlpAddress.should.eq(dlp2);
      dlp2Info.ownerAddress.should.eq(dlp2Owner.address);
      dlp2Info.stakeAmount.should.eq(parseEther(200));
      dlp2Info.status.should.eq(DlpStatus.Registered);
      dlp2Info.grantedAmount.should.eq(0);
      dlp2Info.registrationBlockNumber.should.eq(0);

      const dlp3Info = await root.dlps(3);
      dlp3Info.dlpAddress.should.eq(dlp3);
      dlp3Info.ownerAddress.should.eq(dlp3Owner.address);
      dlp3Info.stakeAmount.should.eq(parseEther(300));
      dlp3Info.status.should.eq(DlpStatus.Registered);
      dlp3Info.grantedAmount.should.eq(0);
      dlp3Info.registrationBlockNumber.should.eq(0);

      (await root.dlpsCount()).should.eq(3);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);
      (await root.dlpsByAddress(dlp2)).should.deep.eq(dlp2Info);
      (await root.dlpsByAddress(dlp3)).should.deep.eq(dlp3Info);

      (await root.epochs(1)).dlpIds.should.deep.eq([]);

      (await root.stakers(dlp1Owner)).should.eq(parseEther(100));
      (await root.stakerDlps(dlp1Owner, 1)).should.eq(parseEther(100));

      (await root.stakers(dlp2Owner)).should.eq(parseEther(200));
      (await root.stakerDlps(dlp2Owner, 2)).should.eq(parseEther(200));

      (await root.stakers(dlp3Owner)).should.eq(parseEther(300));
      (await root.stakerDlps(dlp3Owner, 3)).should.eq(parseEther(300));

      (await root.registeredDlps()).should.deep.eq([1, 2, 3]);

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerInitialBalance -
          parseEther(100) -
          BigInt(receipt1.gasUsed * tx1.gasPrice),
      );
      (await ethers.provider.getBalance(dlp2Owner)).should.eq(
        dlp2OwnerInitialBalance -
          parseEther(200) -
          BigInt(receipt2.gasUsed * tx2.gasPrice),
      );
      (await ethers.provider.getBalance(dlp3Owner)).should.eq(
        dlp3OwnerInitialBalance -
          parseEther(300) -
          BigInt(receipt3.gasUsed * tx3.gasPrice),
      );
      (await ethers.provider.getBalance(root)).should.eq(
        dlpInitialBalance + parseEther(100) + parseEther(200) + parseEther(300),
      );
    });

    it("Should reject registerDlp when paused", async function () {
      await root.connect(owner).pause();
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, false, { value: parseEther(1) })
        .should.be.rejectedWith(`EnforcedPause()`);
    });

    it("Should reject registerDlp when stake amount too small", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, false, { value: parseEther(1) })
        .should.be.rejectedWith(`InvalidStakeAmount()`);
    });

    it("Should reject registerDlp when already registered", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, false, { value: parseEther(100) });
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, false, { value: parseEther(100) })
        .should.be.rejectedWith(`InvalidDlpStatus()`);
    });

    it("Should reject registerDlp when deregistered", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, false, { value: parseEther(100) });
      await root.connect(dlp1Owner).deregisterDlp(1);
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, false, { value: parseEther(100) })
        .should.be.rejectedWith(`InvalidDlpStatus()`);
    });

    it("should deregisterDlp when dlp owner", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, false, { value: parseEther(100) });

      (await root.stakers(dlp1Owner)).should.eq(parseEther(100));
      (await root.stakerDlps(dlp1Owner, 1)).should.eq(parseEther(100));

      (await ethers.provider.getBalance(root)).should.eq(
        dlpInitialBalance + parseEther(100),
      );

      const dlp1OwnerInitialBalance =
        await ethers.provider.getBalance(dlp1Owner);
      const tx = await root.connect(dlp1Owner).deregisterDlp(1);
      const receipt = await getReceipt(tx);

      await tx.should.emit(root, "DlpDeregistered").withArgs(1);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.registeredDlps()).should.deep.eq([]);

      (await root.stakers(dlp1Owner)).should.eq(0);
      (await root.stakerDlps(dlp1Owner, 1)).should.eq(0);

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerInitialBalance +
          parseEther(100) -
          BigInt(receipt.gasUsed * tx.gasPrice),
      );
      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance);
    });

    it("should deregisterDlp when granted", async function () {
      await root
        .connect(owner)
        .registerDlp(dlp1, dlp1Owner, true, { value: parseEther(100) });

      (await root.stakers(dlp1Owner)).should.eq(parseEther(100));
      (await root.stakerDlps(dlp1Owner, 1)).should.eq(parseEther(100));

      (await ethers.provider.getBalance(root)).should.eq(
        dlpInitialBalance + parseEther(100),
      );

      await root
        .connect(dlp1Owner)
        .deregisterDlp(1)
        .should.emit(root, "DlpDeregistered")
        .withArgs(1);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.grantedAmount.should.eq(parseEther(100));

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.registeredDlps()).should.deep.eq([]);

      (await root.stakers(dlp1Owner)).should.eq(parseEther(100));
      (await root.stakerDlps(dlp1Owner, 1)).should.eq(parseEther(100));

      (await ethers.provider.getBalance(root)).should.eq(
        dlpInitialBalance + parseEther(100),
      );
    });

    it("Should reject deregisterDlp when non dlp owner", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, false, { value: parseEther(100) });

      await root
        .connect(owner)
        .deregisterDlp(1)
        .should.be.rejectedWith("NotDlpOwner");

      await root
        .connect(dlp1)
        .deregisterDlp(1)
        .should.be.rejectedWith("NotDlpOwner");

      await root
        .connect(user1)
        .deregisterDlp(1)
        .should.be.rejectedWith("NotDlpOwner");
    });

    it("Should reject deregisterDlp when deregistered", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, false, { value: parseEther(100) });

      await root.connect(dlp1Owner).deregisterDlp(1);

      await root
        .connect(dlp1Owner)
        .deregisterDlp(1)
        .should.be.rejectedWith(`InvalidDlpStatus()`);
    });

    it("should deregisterDlp #multiple dlps", async function () {
      await register5Dlps();

      (await ethers.provider.getBalance(root)).should.eq(
        dlpInitialBalance + 5n * parseEther(100),
      );

      const currentBlockNumber = await getCurrentBlockNumber();

      const dlp1OwnerInitialBalance =
        await ethers.provider.getBalance(dlp1Owner);
      const tx = await root.connect(dlp1Owner).deregisterDlp(1);
      const receipt = await getReceipt(tx);

      await tx.should.emit(root, "DlpDeregistered").withArgs(1);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);

      const dlp2Info = await root.dlps(2);
      dlp2Info.status.should.eq(DlpStatus.Registered);

      const dlp3Info = await root.dlps(3);
      dlp3Info.status.should.eq(DlpStatus.Registered);

      const dlp4Info = await root.dlps(4);
      dlp4Info.status.should.eq(DlpStatus.Registered);

      const dlp5Info = await root.dlps(5);
      dlp5Info.status.should.eq(DlpStatus.Registered);

      (await root.dlpsCount()).should.eq(5);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);
      (await root.dlpsByAddress(dlp2)).should.deep.eq(dlp2Info);
      (await root.dlpsByAddress(dlp3)).should.deep.eq(dlp3Info);
      (await root.dlpsByAddress(dlp4)).should.deep.eq(dlp4Info);
      (await root.dlpsByAddress(dlp5)).should.deep.eq(dlp5Info);

      (await root.registeredDlps()).should.deep.eq([5, 2, 3, 4]);

      (await root.stakers(dlp1Owner)).should.eq(0);
      (await root.stakerDlps(dlp1Owner, 1)).should.eq(0);

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerInitialBalance +
          parseEther(100) -
          BigInt(receipt.gasUsed * tx.gasPrice),
      );
      (await ethers.provider.getBalance(root)).should.eq(
        dlpInitialBalance + 4n * parseEther(100),
      );
    });

    it("should deregisterDlp when dlp owner #multiple dlps 2", async function () {
      await register5Dlps();

      const currentBlockNumber = await getCurrentBlockNumber();

      await root
        .connect(dlp2Owner)
        .deregisterDlp(2)
        .should.emit(root, "DlpDeregistered")
        .withArgs(2);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Registered);

      const dlp2Info = await root.dlps(2);
      dlp2Info.status.should.eq(DlpStatus.Deregistered);

      const dlp3Info = await root.dlps(3);
      dlp3Info.status.should.eq(DlpStatus.Registered);

      const dlp4Info = await root.dlps(4);
      dlp4Info.status.should.eq(DlpStatus.Registered);

      const dlp5Info = await root.dlps(5);
      dlp5Info.status.should.eq(DlpStatus.Registered);

      (await root.dlpsCount()).should.eq(5);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);
      (await root.dlpsByAddress(dlp2)).should.deep.eq(dlp2Info);
      (await root.dlpsByAddress(dlp3)).should.deep.eq(dlp3Info);
      (await root.dlpsByAddress(dlp4)).should.deep.eq(dlp4Info);
      (await root.dlpsByAddress(dlp5)).should.deep.eq(dlp5Info);

      (await root.registeredDlps()).should.deep.eq([1, 5, 3, 4]);
    });

    it("should deregisterDlpByOwner when dlp owner", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, false, { value: parseEther(100) });

      (await root.stakers(dlp1Owner)).should.eq(parseEther(100));
      (await root.stakerDlps(dlp1Owner, 1)).should.eq(parseEther(100));

      (await ethers.provider.getBalance(root)).should.eq(
        dlpInitialBalance + parseEther(100),
      );

      const ownerInitialBalance = await ethers.provider.getBalance(owner);
      const dlp1OwnerInitialBalance =
        await ethers.provider.getBalance(dlp1Owner);

      const tx = await root
        .connect(owner)
        .deregisterDlpByOwner(1, parseEther(100));
      const receipt = await getReceipt(tx);

      await tx.should
        .emit(root, "DlpDeregistered")
        .withArgs(1)
        .emit(root, "DlpDeregisteredByOwner")
        .withArgs(1, parseEther(100), 0);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.registeredDlps()).should.deep.eq([]);
      (await root.stakers(dlp1Owner)).should.eq(0);
      (await root.stakerDlps(dlp1Owner, 1)).should.eq(0);

      (await ethers.provider.getBalance(owner)).should.eq(
        ownerInitialBalance - BigInt(receipt.gasUsed * tx.gasPrice),
      );
      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerInitialBalance + parseEther(100),
      );
      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance);
    });

    it("should deregisterDlpByOwner when granted #full unstake amount", async function () {
      await root
        .connect(owner)
        .registerDlp(dlp1, dlp1Owner, true, { value: parseEther(100) });
      (await root.stakers(dlp1Owner)).should.eq(parseEther(100));
      (await root.stakerDlps(dlp1Owner, 1)).should.eq(parseEther(100));

      (await ethers.provider.getBalance(root)).should.eq(
        dlpInitialBalance + parseEther(100),
      );

      const ownerInitialBalance = await ethers.provider.getBalance(owner);
      const dlp1OwnerInitialBalance =
        await ethers.provider.getBalance(dlp1Owner);

      (await root.registeredDlps()).should.deep.eq([1]);

      const tx = await root
        .connect(owner)
        .deregisterDlpByOwner(1, parseEther(100));
      const receipt = await getReceipt(tx);

      await tx.should
        .emit(root, "DlpDeregisteredByOwner")
        .withArgs(1, parseEther(100), 0)
        .emit(root, "DlpDeregistered")
        .withArgs(1);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.grantedAmount.should.eq(parseEther(100));

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.registeredDlps()).should.deep.eq([]);

      (await root.stakers(dlp1Owner)).should.eq(0);
      (await root.stakerDlps(dlp1Owner, 1)).should.eq(0);

      (await ethers.provider.getBalance(owner)).should.eq(
        ownerInitialBalance - BigInt(receipt.gasUsed * tx.gasPrice),
      );
      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerInitialBalance + parseEther(100),
      );
      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance);
    });

    it("should deregisterDlpByOwner when granted #partial unstake amount", async function () {
      await root
        .connect(owner)
        .registerDlp(dlp1, dlp1Owner, true, { value: parseEther(100) });

      (await root.stakers(dlp1Owner)).should.eq(parseEther(100));
      (await root.stakerDlps(dlp1Owner, 1)).should.eq(parseEther(100));

      (await ethers.provider.getBalance(root)).should.eq(
        dlpInitialBalance + parseEther(100),
      );
      const ownerInitialBalance = await ethers.provider.getBalance(owner);
      const dlp1OwnerInitialBalance =
        await ethers.provider.getBalance(dlp1Owner);

      const tx = await root
        .connect(owner)
        .deregisterDlpByOwner(1, parseEther(40));
      const receipt = await getReceipt(tx);

      await tx.should
        .emit(root, "DlpDeregisteredByOwner")
        .withArgs(1, parseEther(40), parseEther(60))
        .emit(root, "DlpDeregistered")
        .withArgs(1);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.grantedAmount.should.eq(parseEther(100));

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.registeredDlps()).should.deep.eq([]);

      (await root.stakers(dlp1Owner)).should.eq(0);
      (await root.stakerDlps(dlp1Owner, 1)).should.eq(0);

      (await ethers.provider.getBalance(owner)).should.eq(
        ownerInitialBalance +
          parseEther(60) -
          BigInt(receipt.gasUsed * tx.gasPrice),
      );
      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerInitialBalance + parseEther(40),
      );
      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance);
    });

    it("should deregisterDlpByOwner when granted #no unstake amount #2", async function () {
      await root
        .connect(owner)
        .registerDlp(dlp1, dlp1Owner, true, { value: parseEther(100) });

      (await root.stakers(dlp1Owner)).should.eq(parseEther(100));
      (await root.stakerDlps(dlp1Owner, 1)).should.eq(parseEther(100));

      (await ethers.provider.getBalance(root)).should.eq(
        dlpInitialBalance + parseEther(100),
      );

      const ownerInitialBalance = await ethers.provider.getBalance(owner);
      const dlp1OwnerInitialBalance =
        await ethers.provider.getBalance(dlp1Owner);
      const tx = await root.connect(owner).deregisterDlpByOwner(1, 0);
      const receipt = await getReceipt(tx);

      await tx.should
        .emit(root, "DlpDeregisteredByOwner")
        .withArgs(1, 0, parseEther(100))
        .emit(root, "DlpDeregistered")
        .withArgs(1);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.grantedAmount.should.eq(parseEther(100));

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.registeredDlps()).should.deep.eq([]);

      (await root.stakers(dlp1Owner)).should.eq(0);
      (await root.stakerDlps(dlp1Owner, 1)).should.eq(0);

      (await ethers.provider.getBalance(owner)).should.eq(
        ownerInitialBalance +
          parseEther(100) -
          BigInt(receipt.gasUsed * tx.gasPrice),
      );
      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerInitialBalance,
      );
      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance);
    });

    it("should deregisterDlpByOwner when granted and deregistered", async function () {
      await root
        .connect(owner)
        .registerDlp(dlp1, dlp1Owner, true, { value: parseEther(100) });

      (await root.stakers(dlp1Owner)).should.eq(parseEther(100));
      (await root.stakerDlps(dlp1Owner, 1)).should.eq(parseEther(100));

      (await ethers.provider.getBalance(root)).should.eq(
        dlpInitialBalance + parseEther(100),
      );

      await root
        .connect(dlp1Owner)
        .deregisterDlp(1)
        .should.emit(root, "DlpDeregistered")
        .withArgs(1);

      const ownerInitialBalance = await ethers.provider.getBalance(owner);
      const dlp1OwnerInitialBalance =
        await ethers.provider.getBalance(dlp1Owner);

      const tx = await root
        .connect(owner)
        .deregisterDlpByOwner(1, parseEther(40));
      const receipt = await getReceipt(tx);

      await tx.should
        .emit(root, "DlpDeregisteredByOwner")
        .withArgs(1, parseEther(40), parseEther(60));

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.grantedAmount.should.eq(parseEther(100));

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.registeredDlps()).should.deep.eq([]);

      (await root.stakers(dlp1Owner)).should.eq(0);
      (await root.stakerDlps(dlp1Owner, 1)).should.eq(0);

      (await ethers.provider.getBalance(owner)).should.eq(
        ownerInitialBalance +
          parseEther(60) -
          BigInt(receipt.gasUsed * tx.gasPrice),
      );
      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerInitialBalance + parseEther(40),
      );
      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance);
    });

    it("Should reject deregisterDlpByOwner when non dlp owner", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, false, { value: parseEther(100) });

      await root
        .connect(dlp1Owner)
        .deregisterDlpByOwner(1, parseEther(100))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1Owner.address}")`,
        );

      await root
        .connect(dlp1)
        .deregisterDlpByOwner(1, parseEther(100))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1.address}")`,
        );

      await root
        .connect(user1)
        .deregisterDlpByOwner(1, parseEther(100))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("Should reject deregisterDlpByOwner when stakeAmount = 0", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, false, { value: parseEther(100) });

      await root.connect(dlp1Owner).deregisterDlp(1);

      await root
        .connect(owner)
        .deregisterDlpByOwner(1, parseEther(100))
        .should.be.rejectedWith(`InvalidStakeAmount()`);
    });

    it("should deregisterDlpByOwner #multiple dlps 1", async function () {
      await register5Dlps();

      (await ethers.provider.getBalance(root)).should.eq(
        dlpInitialBalance + 5n * parseEther(100),
      );

      const currentBlockNumber = await getCurrentBlockNumber();

      const dlp1OwnerInitialBalance =
        await ethers.provider.getBalance(dlp1Owner);
      await root
        .connect(owner)
        .deregisterDlpByOwner(1, parseEther(100))
        .should.emit(root, "DlpDeregistered")
        .withArgs(1);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);

      const dlp2Info = await root.dlps(2);
      dlp2Info.status.should.eq(DlpStatus.Registered);

      const dlp3Info = await root.dlps(3);
      dlp3Info.status.should.eq(DlpStatus.Registered);

      const dlp4Info = await root.dlps(4);
      dlp4Info.status.should.eq(DlpStatus.Registered);

      const dlp5Info = await root.dlps(5);
      dlp5Info.status.should.eq(DlpStatus.Registered);

      (await root.dlpsCount()).should.eq(5);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);
      (await root.dlpsByAddress(dlp2)).should.deep.eq(dlp2Info);
      (await root.dlpsByAddress(dlp3)).should.deep.eq(dlp3Info);
      (await root.dlpsByAddress(dlp4)).should.deep.eq(dlp4Info);
      (await root.dlpsByAddress(dlp5)).should.deep.eq(dlp5Info);

      (await root.registeredDlps()).should.deep.eq([5, 2, 3, 4]);

      (await root.stakers(dlp1Owner)).should.eq(0);
      (await root.stakerDlps(dlp1Owner, 1)).should.eq(0);

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerInitialBalance + parseEther(100),
      );
      (await ethers.provider.getBalance(root)).should.eq(
        dlpInitialBalance + 4n * parseEther(100),
      );
    });

    it("should deregisterDlpByOwner when dlp owner #multiple dlps 2", async function () {
      await register5Dlps();

      const currentBlockNumber = await getCurrentBlockNumber();

      await root
        .connect(owner)
        .deregisterDlpByOwner(2, parseEther(100))
        .should.emit(root, "DlpDeregistered")
        .withArgs(2);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Registered);

      const dlp2Info = await root.dlps(2);
      dlp2Info.status.should.eq(DlpStatus.Deregistered);

      const dlp3Info = await root.dlps(3);
      dlp3Info.status.should.eq(DlpStatus.Registered);

      const dlp4Info = await root.dlps(4);
      dlp4Info.status.should.eq(DlpStatus.Registered);

      const dlp5Info = await root.dlps(5);
      dlp5Info.status.should.eq(DlpStatus.Registered);

      (await root.dlpsCount()).should.eq(5);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);
      (await root.dlpsByAddress(dlp2)).should.deep.eq(dlp2Info);
      (await root.dlpsByAddress(dlp3)).should.deep.eq(dlp3Info);
      (await root.dlpsByAddress(dlp4)).should.deep.eq(dlp4Info);
      (await root.dlpsByAddress(dlp5)).should.deep.eq(dlp5Info);

      (await root.registeredDlps()).should.deep.eq([1, 5, 3, 4]);
    });
  });

  describe("Performance", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should saveEpochDlpPerformance one dlp", async function () {
      await registerNDlps([100]);

      await advanceToEpochN(1);

      await root.connect(owner).createEpochs();

      await root
        .connect(owner)
        .saveEpochPerformances(1, [{ dlpId: 1, ttf: 2, tfc: 3, vdu: 4, uw: 5 }])
        .should.emit(root, "EpochPerformancesSaved")
        .withArgs(1);

      const epoch1Dlp1 = await root.epochDlps(1, 1);
      epoch1Dlp1.ttf.should.eq(2);
      epoch1Dlp1.tfc.should.eq(3);
      epoch1Dlp1.vdu.should.eq(4);
      epoch1Dlp1.uw.should.eq(5);
      epoch1Dlp1.rewardAmount.should.eq(epochRewardAmount);
    });

    it("should saveEpochDlpPerformance multiple dlps #1", async function () {
      await registerNDlps([100, 200]);
      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      await root
        .connect(owner)
        .saveEpochPerformances(1, [
          { dlpId: 1, ttf: 2, tfc: 3, vdu: 4, uw: 5 },
          { dlpId: 2, ttf: 2, tfc: 3, vdu: 4, uw: 5 },
        ])
        .should.emit(root, "EpochPerformancesSaved")
        .withArgs(1);

      const epoch1Dlp1 = await root.epochDlps(1, 1);
      epoch1Dlp1.ttf.should.eq(2);
      epoch1Dlp1.tfc.should.eq(3);
      epoch1Dlp1.vdu.should.eq(4);
      epoch1Dlp1.uw.should.eq(5);
      epoch1Dlp1.rewardAmount.should.eq(epochRewardAmount / 2n);

      const epoch1Dlp2 = await root.epochDlps(1, 2);
      epoch1Dlp2.ttf.should.eq(2);
      epoch1Dlp2.tfc.should.eq(3);
      epoch1Dlp2.vdu.should.eq(4);
      epoch1Dlp2.uw.should.eq(5);
      epoch1Dlp2.rewardAmount.should.eq(epochRewardAmount / 2n);
    });

    it("should saveEpochDlpPerformance multiple dlps #2", async function () {
      await registerNDlps([100, 200]);
      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      await root
        .connect(owner)
        .saveEpochPerformances(1, [
          { dlpId: 1, ttf: 2, tfc: 3, vdu: 4, uw: 5 },
          { dlpId: 2, ttf: 6, tfc: 9, vdu: 12, uw: 15 },
        ])
        .should.emit(root, "EpochPerformancesSaved")
        .withArgs(1);

      const totalScore = BigInt(
        (2 + 6) * ttfPercentage +
          (3 + 9) * tfcPercentage +
          (4 + 12) * vduPercentage +
          (5 + 15) * uwPercentage,
      );

      const epoch1Dlp1Score = BigInt(
        2 * ttfPercentage +
          3 * tfcPercentage +
          4 * vduPercentage +
          5 * uwPercentage,
      );
      const epoch1Dlp2Score = BigInt(
        6 * ttfPercentage +
          9 * tfcPercentage +
          12 * vduPercentage +
          15 * uwPercentage,
      );

      const epoch1Dlp1 = await root.epochDlps(1, 1);
      epoch1Dlp1.ttf.should.eq(2);
      epoch1Dlp1.tfc.should.eq(3);
      epoch1Dlp1.vdu.should.eq(4);
      epoch1Dlp1.uw.should.eq(5);
      epoch1Dlp1.rewardAmount.should.eq(epochRewardAmount / 4n);
      epoch1Dlp1.rewardAmount.should.eq(
        (epochRewardAmount * epoch1Dlp1Score) / totalScore,
      );

      const epoch1Dlp2 = await root.epochDlps(1, 2);
      epoch1Dlp2.ttf.should.eq(6);
      epoch1Dlp2.tfc.should.eq(9);
      epoch1Dlp2.vdu.should.eq(12);
      epoch1Dlp2.uw.should.eq(15);
      epoch1Dlp2.rewardAmount.should.eq((epochRewardAmount / 4n) * 3n);
      epoch1Dlp2.rewardAmount.should.eq(
        (epochRewardAmount * epoch1Dlp2Score) / totalScore,
      );
    });

    it("should saveEpochDlpPerformance multiple dlps #3", async function () {
      await registerNDlps([100, 200, 200]);
      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      await root
        .connect(owner)
        .saveEpochPerformances(1, [
          { dlpId: 1, ttf: 2, tfc: 3, vdu: 5, uw: 7 },
          { dlpId: 2, ttf: 11, tfc: 13, vdu: 17, uw: 19 },
          { dlpId: 3, ttf: 23, tfc: 29, vdu: 31, uw: 37 },
        ])
        .should.emit(root, "EpochPerformancesSaved")
        .withArgs(1);

      const totalScore = BigInt(
        (2 + 11 + 23) * ttfPercentage +
          (3 + 13 + 29) * tfcPercentage +
          (5 + 17 + 31) * vduPercentage +
          (7 + 19 + 37) * uwPercentage,
      );

      const epoch1Dlp1Score = BigInt(
        2 * ttfPercentage +
          3 * tfcPercentage +
          5 * vduPercentage +
          7 * uwPercentage,
      );
      const epoch1Dlp2Score = BigInt(
        11 * ttfPercentage +
          13 * tfcPercentage +
          17 * vduPercentage +
          19 * uwPercentage,
      );
      const epoch1Dlp3Score = BigInt(
        23 * ttfPercentage +
          29 * tfcPercentage +
          31 * vduPercentage +
          37 * uwPercentage,
      );

      const epoch1Dlp1 = await root.epochDlps(1, 1);
      epoch1Dlp1.ttf.should.eq(2);
      epoch1Dlp1.tfc.should.eq(3);
      epoch1Dlp1.vdu.should.eq(5);
      epoch1Dlp1.uw.should.eq(7);
      epoch1Dlp1.rewardAmount.should.eq(
        (epochRewardAmount * epoch1Dlp1Score) / totalScore,
      );

      const epoch1Dlp2 = await root.epochDlps(1, 2);
      epoch1Dlp2.ttf.should.eq(11);
      epoch1Dlp2.tfc.should.eq(13);
      epoch1Dlp2.vdu.should.eq(17);
      epoch1Dlp2.uw.should.eq(19);
      epoch1Dlp2.rewardAmount.should.eq(
        (epochRewardAmount * epoch1Dlp2Score) / totalScore,
      );

      const epoch1Dlp3 = await root.epochDlps(1, 3);
      epoch1Dlp3.ttf.should.eq(23);
      epoch1Dlp3.tfc.should.eq(29);
      epoch1Dlp3.vdu.should.eq(31);
      epoch1Dlp3.uw.should.eq(37);
      epoch1Dlp3.rewardAmount.should.eq(
        (epochRewardAmount * epoch1Dlp3Score) / totalScore,
      );
    });

    it("should reject saveEpochDlpPerformance when non owner", async function () {
      await registerNDlps([100, 200, 200]);
      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      await root
        .connect(dlp1Owner)
        .saveEpochPerformances(1, [
          { dlpId: 1, ttf: 2, tfc: 3, vdu: 5, uw: 7 },
          { dlpId: 2, ttf: 11, tfc: 13, vdu: 17, uw: 19 },
          { dlpId: 3, ttf: 23, tfc: 29, vdu: 31, uw: 37 },
        ])
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1Owner.address}")`,
        );

      await root
        .connect(dlp1)
        .saveEpochPerformances(1, [
          { dlpId: 1, ttf: 2, tfc: 3, vdu: 5, uw: 7 },
          { dlpId: 2, ttf: 11, tfc: 13, vdu: 17, uw: 19 },
          { dlpId: 3, ttf: 23, tfc: 29, vdu: 31, uw: 37 },
        ])
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1.address}")`,
        );

      await root
        .connect(user1)
        .saveEpochPerformances(1, [
          { dlpId: 1, ttf: 2, tfc: 3, vdu: 5, uw: 7 },
          { dlpId: 2, ttf: 11, tfc: 13, vdu: 17, uw: 19 },
          { dlpId: 3, ttf: 23, tfc: 29, vdu: 31, uw: 37 },
        ])
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("should reject saveEpochDlpPerformance when already saved", async function () {
      await registerNDlps([100, 200, 200]);
      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      await root.connect(owner).saveEpochPerformances(1, [
        { dlpId: 1, ttf: 2, tfc: 3, vdu: 5, uw: 7 },
        { dlpId: 2, ttf: 11, tfc: 13, vdu: 17, uw: 19 },
        { dlpId: 3, ttf: 23, tfc: 29, vdu: 31, uw: 37 },
      ]);

      await root
        .connect(owner)
        .saveEpochPerformances(1, [
          { dlpId: 1, ttf: 2, tfc: 3, vdu: 5, uw: 7 },
          { dlpId: 2, ttf: 11, tfc: 13, vdu: 17, uw: 19 },
          { dlpId: 3, ttf: 23, tfc: 29, vdu: 31, uw: 37 },
        ])
        .should.be.rejectedWith(`EpochPerformancesAlreadySet`);
    });

    it("should reject saveEpochDlpPerformance when dlp not in epoch #1", async function () {
      await registerNDlps([100, 200, 200]);
      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      await root
        .connect(owner)
        .saveEpochPerformances(1, [
          { dlpId: 1, ttf: 2, tfc: 3, vdu: 5, uw: 7 },
          { dlpId: 2, ttf: 11, tfc: 13, vdu: 17, uw: 19 },
          { dlpId: 4, ttf: 23, tfc: 29, vdu: 31, uw: 37 },
        ])
        .should.be.rejectedWith(`InvalidPerformances`);
    });

    it("should reject saveEpochDlpPerformance when dlp not in epoch #2", async function () {
      await registerNDlps([100, 200, 200, 300]);
      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      await root
        .connect(owner)
        .saveEpochPerformances(1, [
          { dlpId: 1, ttf: 2, tfc: 3, vdu: 5, uw: 7 },
          { dlpId: 2, ttf: 11, tfc: 13, vdu: 17, uw: 19 },
          { dlpId: 3, ttf: 23, tfc: 29, vdu: 31, uw: 37 },
        ])
        .should.be.rejectedWith(`InvalidPerformances`);
    });
  });

  describe("ClaimReward", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should claimReward when only dlpOwners has staked", async function () {
      await registerNDlps([100, 200, 200]);
      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      await root.connect(owner).saveEpochPerformances(1, [
        { dlpId: 1, ttf: 2, tfc: 3, vdu: 5, uw: 7 },
        { dlpId: 2, ttf: 11, tfc: 13, vdu: 17, uw: 19 },
        { dlpId: 3, ttf: 23, tfc: 29, vdu: 31, uw: 37 },
      ]);

      const totalScore = BigInt(
        (2 + 11 + 23) * ttfPercentage +
          (3 + 13 + 29) * tfcPercentage +
          (5 + 17 + 31) * vduPercentage +
          (7 + 19 + 37) * uwPercentage,
      );

      const epoch1Dlp1Reward =
        (epochRewardAmount *
          BigInt(
            2 * ttfPercentage +
              3 * tfcPercentage +
              5 * vduPercentage +
              7 * uwPercentage,
          )) /
        totalScore;
      const epoch1Dlp2Reward =
        (epochRewardAmount *
          BigInt(
            11 * ttfPercentage +
              13 * tfcPercentage +
              17 * vduPercentage +
              19 * uwPercentage,
          )) /
        totalScore;
      const epoch1Dlp3Reward =
        (epochRewardAmount *
          BigInt(
            23 * ttfPercentage +
              29 * tfcPercentage +
              31 * vduPercentage +
              37 * uwPercentage,
          )) /
        totalScore;

      await root
        .connect(dlp1Owner)
        .claimReward(1, 1)
        .should.emit(root, "EpochRewardClaimed")
        .withArgs(dlp1Owner, 1, 1, epoch1Dlp1Reward);
      await root
        .connect(dlp1Owner)
        .claimReward(1, 2)
        .should.emit(root, "EpochRewardClaimed")
        .withArgs(dlp1Owner, 1, 2, epoch1Dlp2Reward);
      await root
        .connect(dlp1Owner)
        .claimReward(1, 3)
        .should.emit(root, "EpochRewardClaimed")
        .withArgs(dlp1Owner, 1, 3, epoch1Dlp3Reward);
    });
    it("should claimReward when staker", async function () {
      await registerNDlps([100, 200, 200]);

      await root.connect(user1).stake(1, { value: parseEther(300) });

      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      await root.connect(owner).saveEpochPerformances(1, [
        { dlpId: 1, ttf: 2, tfc: 3, vdu: 5, uw: 7 },
        { dlpId: 2, ttf: 11, tfc: 13, vdu: 17, uw: 19 },
        { dlpId: 3, ttf: 23, tfc: 29, vdu: 31, uw: 37 },
      ]);

      const totalScore = BigInt(
        (2 + 11 + 23) * ttfPercentage +
          (3 + 13 + 29) * tfcPercentage +
          (5 + 17 + 31) * vduPercentage +
          (7 + 19 + 37) * uwPercentage,
      );

      const epoch1Dlp1Reward =
        (epochRewardAmount *
          BigInt(
            2 * ttfPercentage +
              3 * tfcPercentage +
              5 * vduPercentage +
              7 * uwPercentage,
          )) /
        totalScore;
      const epoch1Dlp2Reward =
        (epochRewardAmount *
          BigInt(
            11 * ttfPercentage +
              13 * tfcPercentage +
              17 * vduPercentage +
              19 * uwPercentage,
          )) /
        totalScore;
      const epoch1Dlp3Reward =
        (epochRewardAmount *
          BigInt(
            23 * ttfPercentage +
              29 * tfcPercentage +
              31 * vduPercentage +
              37 * uwPercentage,
          )) /
        totalScore;

      await root
        .connect(dlp1Owner)
        .claimReward(1, 1)
        .should.emit(root, "EpochRewardClaimed")
        .withArgs(dlp1Owner, 1, 1, epoch1Dlp1Reward / 4n);
      await root
        .connect(user1)
        .claimReward(1, 1)
        .should.emit(root, "EpochRewardClaimed")
        .withArgs(user1, 1, 1, (epoch1Dlp1Reward * 3n) / 4n);
      await root
        .connect(dlp1Owner)
        .claimReward(1, 2)
        .should.emit(root, "EpochRewardClaimed")
        .withArgs(dlp1Owner, 1, 2, epoch1Dlp2Reward);
      await root
        .connect(dlp1Owner)
        .claimReward(1, 3)
        .should.emit(root, "EpochRewardClaimed")
        .withArgs(dlp1Owner, 1, 3, epoch1Dlp3Reward);
    });
  });

  describe("Withdraw", () => {
    let dat: DAT;

    let rootInitialDatBalance = parseEther(1000);
    let user1InitialDatBalance = parseEther(100);

    let rootInitialBalance = parseEther(100);

    before(async function () {});

    beforeEach(async () => {
      await deploy();

      dat = await ethers.deployContract("DAT", [
        "Test Data Autonomy Token",
        "TDAT",
        owner.address,
      ]);

      await dat.connect(owner).mint(root, rootInitialDatBalance);
      await dat.connect(owner).mint(user1, user1InitialDatBalance);

      await root.connect(owner).addRewardForDlps({ value: rootInitialBalance });
    });

    it("should withdraw token when owner", async function () {
      const withdrawAmount = parseEther(40);

      await root
        .connect(owner)
        .withdraw(dat, user1, withdrawAmount)
        .should.emit(dat, "Transfer")
        .withArgs(root, user1, withdrawAmount);

      (await dat.balanceOf(root)).should.eq(
        rootInitialDatBalance - withdrawAmount,
      );
      (await dat.balanceOf(user1)).should.eq(
        user1InitialDatBalance + withdrawAmount,
      );
    });

    it("should not withdraw token when non owner", async function () {
      await root
        .connect(user1)
        .withdraw(dat, user1, rootInitialDatBalance)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("should withdraw VANA when owner", async function () {
      let user1InitialBalance = await ethers.provider.getBalance(user1.address);

      const withdrawAmount = parseEther(40);

      await root
        .connect(owner)
        .withdraw(ethers.ZeroAddress, user1, withdrawAmount).should.be
        .fulfilled;

      (await ethers.provider.getBalance(root)).should.eq(
        rootInitialBalance - withdrawAmount,
      );
      (await ethers.provider.getBalance(user1)).should.eq(
        user1InitialBalance + withdrawAmount,
      );
    });

    it("should not withdraw VANA when non owner", async function () {
      await root
        .connect(user1)
        .withdraw(ethers.ZeroAddress, user1, parseEther(100))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });
  });
});
