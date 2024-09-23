import chai, { should } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers, network, upgrades } from "hardhat";
import { Wallet } from "ethers";
import { DAT, DataLiquidityPoolsRootImplementation } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  advanceBlockNTimes,
  advanceToBlockN,
  getCurrentBlockNumber,
} from "../utils/timeAndBlockManipulation";
import { getReceipt, parseEther } from "../utils/helpers";
import { randomInt } from "node:crypto";

chai.use(chaiAsPromised);
should();

chai.Assertion.addMethod(
  "almostEq",
  function (expected: bigint, tolerance: bigint = 1000n) {
    const actual = this._obj as bigint;

    this.assert(
      actual >= expected - tolerance && actual <= expected + tolerance,
      `expected ${actual} to be almost equal to ${expected} within tolerance of ${tolerance}`,
      `expected ${actual} not to be almost equal to ${expected} within tolerance of ${tolerance}`,
      expected,
      actual,
    );
  },
);

chai.Assertion.addMethod(
  "withAlmostArgs",
  function (
    expectedArgs: Array<any>,
    toleranceIndices: number[],
    tolerance: bigint = 1000n,
  ) {
    const actualArgs = this._obj as unknown[];

    this.assert(
      actualArgs.length === expectedArgs.length &&
        actualArgs.every((actual, index) => {
          const expected = expectedArgs[index];
          if (toleranceIndices.includes(index)) {
            const actualBigInt = BigInt(actual.toString());
            const expectedBigInt = BigInt(expected.toString());
            return (
              actualBigInt >= expectedBigInt - tolerance &&
              actualBigInt <= expectedBigInt + tolerance
            );
          } else {
            return actual === expected;
          }
        }),
      `expected arguments #{act} to be almost equal to #{exp} within tolerance of #{tolerance} at indices ${toleranceIndices}`,
      `expected arguments #{act} not to be almost equal to #{exp} within tolerance of #{tolerance} at indices ${toleranceIndices}`,
      expectedArgs,
      actualArgs,
    );
  },
);

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
  let user4: HardhatEthersSigner;
  let user5: HardhatEthersSigner;

  let root: DataLiquidityPoolsRootImplementation;

  const numberOfTopDlps = 3;
  const maxNumberOfRegisteredDlps = 10000;
  let epochSize = 100;
  const minDlpStakeAmount = parseEther(50);
  let startBlock: number;
  let epochRewardAmount = parseEther(2);

  const ttfPercentage = parseEther(15);
  const tfcPercentage = parseEther(15);
  const vduPercentage = parseEther(50);
  const uwPercentage = parseEther(20);

  const rootInitialBalance = parseEther(0);

  const deploy = async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [],
    });

    [
      deployer,
      owner,
      user1,
      user2,
      user3,
      user4,
      user5,
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
        {
          ownerAddress: owner.address,
          maxNumberOfRegisteredDlps: maxNumberOfRegisteredDlps,
          numberOfTopDlps: numberOfTopDlps,
          minDlpStakeAmount: minDlpStakeAmount,
          startBlock: startBlock,
          epochSize: epochSize,
          epochRewardAmount: epochRewardAmount,
          ttfPercentage: ttfPercentage,
          tfcPercentage: tfcPercentage,
          vduPercentage: vduPercentage,
          uwPercentage: uwPercentage,
        },
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
      .registerDlp(dlp1, dlp1Owner, 0, { value: parseEther(100) });
    await root
      .connect(dlp2Owner)
      .registerDlp(dlp2, dlp2Owner, 0, { value: parseEther(100) });
    await root
      .connect(dlp3Owner)
      .registerDlp(dlp3, dlp3Owner, 0, { value: parseEther(100) });
    await root
      .connect(dlp4Owner)
      .registerDlp(dlp4, dlp4Owner, 0, { value: parseEther(100) });
    await root
      .connect(dlp5Owner)
      .registerDlp(dlp5, dlp5Owner, 0, { value: parseEther(100) });
  }

  async function registerNDlps(stakes: bigint[]) {
    for (let i = 0; i < stakes.length; i++) {
      await root
        .connect(dlp1Owner)
        .registerDlp(Wallet.createRandom(), dlp1Owner, 0, {
          value: stakes[i],
        });
    }
  }

  async function register1Dlp() {
    await root
      .connect(dlp1Owner)
      .registerDlp(dlp1, dlp1Owner, 0, { value: parseEther(100) });
  }

  function generateStakes(length: number, min: bigint, max: bigint): bigint[] {
    return Array.from(
      { length },
      () =>
        min + BigInt(Math.floor(Math.random() * Number(max - min + BigInt(1)))),
    );
  }
  //
  // const generateStakes = (length: number, min: bigint, max: bigint) =>
  // Array.from({ length }, () => BigInt(Math.random()) * (max - min) + min);

  function getTopKStakes(arr: bigint[], k: number): number[] {
    // Create an array of tuples where each tuple is [value, index]
    const indexedArr = arr.map(
      (value, index) => [value, index] as [bigint, number],
    );

    // Sort the array of tuples based on the value in descending order
    indexedArr.sort((a, b) => (b[0] >= a[0] ? 1 : -1));

    // Extract the indexes of the top k elements
    const topKIndexes = indexedArr.slice(0, k).map((tuple) => tuple[1] + 1);

    return topKIndexes;
  }

  function getTopKStakes0(arr: bigint[], k: number): BigInt[] {
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
      (await root.maxNumberOfRegisteredDlps()).should.eq(
        maxNumberOfRegisteredDlps,
      );
      (await root.numberOfTopDlps()).should.eq(numberOfTopDlps);
      (await root.minDlpStakeAmount()).should.eq(minDlpStakeAmount);
      (await root.epochSize()).should.eq(epochSize);
      (await root.epochRewardAmount()).should.eq(epochRewardAmount);
      (await root.paused()).should.eq(false);
      (await root.version()).should.eq(1);

      (await root.ttfPercentage()).should.eq(ttfPercentage);
      (await root.tfcPercentage()).should.eq(tfcPercentage);
      (await root.vduPercentage()).should.eq(vduPercentage);
      (await root.uwPercentage()).should.eq(uwPercentage);

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

    it("Should updateMaxNumberOfRegisteredDlps when owner", async function () {
      await root
        .connect(owner)
        .updateMaxNumberOfRegisteredDlps(123)
        .should.emit(root, "MaxNumberOfRegisteredDlpsUpdated")
        .withArgs(123);

      (await root.maxNumberOfRegisteredDlps()).should.eq(123);
    });

    it("Should reject updateMaxNumberOfRegisteredDlps when non-owner", async function () {
      await root
        .connect(dlp1)
        .updateMaxNumberOfRegisteredDlps(123)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1.address}")`,
        );

      (await root.maxNumberOfRegisteredDlps()).should.eq(
        maxNumberOfRegisteredDlps,
      );
    });

    it("Should updateNumberOfTopDlps when owner", async function () {
      await root
        .connect(owner)
        .updateNumberOfTopDlps(123)
        .should.emit(root, "NumberOfTopDlpsUpdated")
        .withArgs(123);

      (await root.numberOfTopDlps()).should.eq(123);
    });

    it("Should reject updateNumberOfTopDlps when non-owner", async function () {
      await root
        .connect(dlp1)
        .updateNumberOfTopDlps(123)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1.address}")`,
        );

      (await root.numberOfTopDlps()).should.eq(numberOfTopDlps);
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

    it("Should reject updateEpochRewardAmount when not current epoch", async function () {
      await advanceToEpochN(2);

      await root
        .connect(owner)
        .updateEpochRewardAmount(123)
        .should.be.rejectedWith("CurrentEpochNotCreated()");
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

    it("Should updatePerformancePercentages when owner", async function () {
      await root
        .connect(owner)
        .updatePerformancePercentages(
          parseEther(10),
          parseEther(20),
          parseEther(30),
          parseEther(40),
        )
        .should.emit(root, "PerformancePercentagesUpdated")
        .withArgs(
          parseEther(10),
          parseEther(20),
          parseEther(30),
          parseEther(40),
        );

      (await root.ttfPercentage()).should.eq(parseEther(10));
      (await root.tfcPercentage()).should.eq(parseEther(20));
      (await root.vduPercentage()).should.eq(parseEther(30));
      (await root.uwPercentage()).should.eq(parseEther(40));
    });

    it("Should reject updatePerformancePercentages when non-owner", async function () {
      await root
        .connect(dlp1)
        .updatePerformancePercentages(
          parseEther(10),
          parseEther(20),
          parseEther(30),
          parseEther(40),
        )
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1.address}")`,
        );

      (await root.minDlpStakeAmount()).should.eq(minDlpStakeAmount);
    });

    it("Should reject updatePerformancePercentages when invalid percentages", async function () {
      await root
        .connect(owner)
        .updatePerformancePercentages(
          parseEther(10),
          parseEther(10),
          parseEther(30),
          parseEther(40),
        )
        .should.be.rejectedWith(`InvalidPerformancePercentages()`);

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
      (await newRoot.numberOfTopDlps()).should.eq(numberOfTopDlps);
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
      (await newRoot.numberOfTopDlps()).should.eq(numberOfTopDlps);
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

    it("should createEpochs after updating rewardAmount", async function () {
      await advanceToEpochN(1);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(1);

      await root.connect(owner).updateEpochRewardAmount(epochRewardAmount * 2n);
      await advanceToEpochN(2);

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
      epoch2.reward.should.eq(epochRewardAmount * 2n);
      epoch2.dlpIds.should.deep.eq([]);
    });

    it("should createEpochs after updating epochSize", async function () {
      await advanceToEpochN(1);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(1);

      await root.connect(owner).updateEpochSize(epochSize * 3);
      await advanceToEpochN(2);

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
      epoch2.endBlock.should.eq(startBlock + 4 * epochSize - 1);
      epoch2.reward.should.eq(epochRewardAmount);
      epoch2.dlpIds.should.deep.eq([]);
    });

    it("should createEpochs after long time", async function () {
      (await root.epochsCount()).should.eq(0);

      await advanceToEpochN(4);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(1)
        .and.emit(root, "EpochCreated")
        .withArgs(2)
        .and.emit(root, "EpochCreated")
        .withArgs(3)
        .and.emit(root, "EpochCreated")
        .withArgs(4);

      (await root.epochsCount()).should.eq(4);

      const epoch1 = await root.epochs(1);
      epoch1.startBlock.should.eq(startBlock);
      epoch1.endBlock.should.eq(startBlock + epochSize - 1);
      epoch1.reward.should.eq(epochRewardAmount);
      epoch1.dlpIds.should.deep.eq([]);

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
    });

    it("should createEpochsUntilBlockNumber after long time", async function () {
      (await root.epochsCount()).should.eq(0);

      await advanceToEpochN(4);
      await root
        .connect(owner)
        .createEpochsUntilBlockNumber(await getCurrentBlockNumber())
        .should.emit(root, "EpochCreated")
        .withArgs(1)
        .and.emit(root, "EpochCreated")
        .withArgs(2)
        .and.emit(root, "EpochCreated")
        .withArgs(3)
        .and.emit(root, "EpochCreated")
        .withArgs(4);

      (await root.epochsCount()).should.eq(4);

      const epoch1 = await root.epochs(1);
      epoch1.startBlock.should.eq(startBlock);
      epoch1.endBlock.should.eq(startBlock + epochSize - 1);
      epoch1.reward.should.eq(epochRewardAmount);
      epoch1.dlpIds.should.deep.eq([]);

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
    });

    it("should createEpochsUntilBlockNumber with limit", async function () {
      (await root.epochsCount()).should.eq(0);

      await advanceToEpochN(4);
      await root
        .connect(owner)
        .createEpochsUntilBlockNumber(startBlock + epochSize)
        .should.emit(root, "EpochCreated")
        .withArgs(1)
        .and.emit(root, "EpochCreated")
        .withArgs(2);

      (await root.epochsCount()).should.eq(2);

      const epoch1 = await root.epochs(1);
      epoch1.startBlock.should.eq(startBlock);
      epoch1.endBlock.should.eq(startBlock + epochSize - 1);
      epoch1.reward.should.eq(epochRewardAmount);
      epoch1.dlpIds.should.deep.eq([]);
    });

    it("should createEpochsUntilBlockNumber just until current block number", async function () {
      (await root.epochsCount()).should.eq(0);

      await advanceToEpochN(4);
      await root
        .connect(owner)
        .createEpochsUntilBlockNumber(
          (await getCurrentBlockNumber()) + epochSize * 100,
        )
        .should.emit(root, "EpochCreated")
        .withArgs(1)
        .and.emit(root, "EpochCreated")
        .withArgs(2)
        .and.emit(root, "EpochCreated")
        .withArgs(3)
        .and.emit(root, "EpochCreated")
        .withArgs(4);

      (await root.epochsCount()).should.eq(4);
    });

    it("should create epochs with no active dlps", async function () {
      await advanceToEpochN(3);
      await root.connect(owner).createEpochs();

      for (let i = 1; i <= 2; i++) {
        (await root.epochs(i)).dlpIds.should.deep.eq([]);
      }
    });

    it("should createEpochs with one registered dlp #1", async function () {
      await advanceToEpochN(1);

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([]);
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

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([1n]);
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

      const dlp1Epoch2 = await root.dlpEpochs(1, 2);
      dlp1Epoch2.ttf.should.eq(0);
      dlp1Epoch2.tfc.should.eq(0);
      dlp1Epoch2.vdu.should.eq(0);
      dlp1Epoch2.uw.should.eq(0);
      dlp1Epoch2.stakeAmount.should.eq(parseEther(100));
      dlp1Epoch2.isTopDlp.should.eq(true);
      dlp1Epoch2.rewardAmount.should.eq(0);
      dlp1Epoch2.stakersPercentage.should.eq(0);
    });

    it("should createEpochs with one registered dlp #2", async function () {
      await advanceToEpochN(1);

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([]);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(1);

      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, parseEther(25), {
          value: parseEther(200),
        });
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

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([1n]);
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

      const dlp1Epoch2 = await root.dlpEpochs(1, 2);
      dlp1Epoch2.ttf.should.eq(0);
      dlp1Epoch2.tfc.should.eq(0);
      dlp1Epoch2.vdu.should.eq(0);
      dlp1Epoch2.uw.should.eq(0);
      dlp1Epoch2.stakeAmount.should.eq(parseEther(200));
      dlp1Epoch2.isTopDlp.should.eq(true);
      dlp1Epoch2.rewardAmount.should.eq(0);
      dlp1Epoch2.stakersPercentage.should.eq(parseEther(25));
    });

    it("should createEpochs after dlpStakersPercentage changes", async function () {
      await advanceToEpochN(1);

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([]);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(1);

      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, parseEther(25), {
          value: parseEther(200),
        });
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

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([1n]);
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

      const dlp1Epoch2 = await root.dlpEpochs(1, 2);
      dlp1Epoch2.ttf.should.eq(0);
      dlp1Epoch2.tfc.should.eq(0);
      dlp1Epoch2.vdu.should.eq(0);
      dlp1Epoch2.uw.should.eq(0);
      dlp1Epoch2.stakeAmount.should.eq(parseEther(200));
      dlp1Epoch2.isTopDlp.should.eq(true);
      dlp1Epoch2.rewardAmount.should.eq(0);
      dlp1Epoch2.stakersPercentage.should.eq(parseEther(25));

      await root
        .connect(dlp1Owner)
        .updateDlpStakersPercentage(1, parseEther(50));

      await advanceToEpochN(3);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(3);

      const dlp1Epoch3 = await root.dlpEpochs(1, 3);
      dlp1Epoch2.stakeAmount.should.eq(parseEther(200));
      dlp1Epoch2.isTopDlp.should.eq(true);
      dlp1Epoch2.rewardAmount.should.eq(0);
      dlp1Epoch3.stakersPercentage.should.eq(parseEther(50));
    });

    it("should createEpochs with multiple registered dlps #1", async function () {
      await advanceToEpochN(1);

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([]);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(1);

      await registerNDlps([
        parseEther(101),
        parseEther(102),
        parseEther(103),
        parseEther(104),
        parseEther(105),
      ]);

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

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([5n, 4n, 3n]);
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

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([]);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(1);

      await registerNDlps([
        parseEther(101),
        parseEther(106),
        parseEther(103),
        parseEther(103),
        parseEther(103),
      ]);

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

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([2n, 3n, 4n]);
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
      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([]);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(1);

      await registerNDlps([
        parseEther(101),
        parseEther(102),
        parseEther(102),
        parseEther(101),
        parseEther(101),
      ]);

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

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([2n, 3n, 1n]);
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

    it("should createEpochs when 100 dlps and 16  numberOfTopDlps", async function () {
      await root.connect(owner).updateNumberOfTopDlps(16);
      await root.connect(owner).updateMinDlpStakeAmount(1);
      const stakes = generateStakes(100, parseEther(1), parseEther(2));
      const topStakes = getTopKStakes(stakes, 16);
      await registerNDlps(stakes);

      await advanceToEpochN(5);

      (await root.topDlpIds(16)).should.deep.eq(topStakes);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(1)
        .and.emit(root, "EpochCreated")
        .withArgs(2)
        .and.emit(root, "EpochCreated")
        .withArgs(3)
        .and.emit(root, "EpochCreated")
        .withArgs(4)
        .and.emit(root, "EpochCreated")
        .withArgs(5);

      (await root.epochsCount()).should.eq(5);

      (await root.epochs(1)).dlpIds.should.deep.eq(topStakes);
      (await root.epochs(2)).dlpIds.should.deep.eq(topStakes);
      (await root.epochs(3)).dlpIds.should.deep.eq(topStakes);
      (await root.epochs(4)).dlpIds.should.deep.eq(topStakes);
      (await root.epochs(5)).dlpIds.should.deep.eq(topStakes);
    });

    xit("should createEpochs when 1000 dlps and 32  numberOfTopDlps", async function () {
      await root.connect(owner).updateEpochSize(2000);
      await advanceToEpochN(1);
      await root
        .connect(owner)
        .createEpochs()
        .should.emit(root, "EpochCreated")
        .withArgs(1);

      epochSize = 2000;

      await root.connect(owner).updateNumberOfTopDlps(32);
      await root.connect(owner).updateMinDlpStakeAmount(1);
      const stakes = generateStakes(1000, parseEther(1), parseEther(2));
      const topStakes = getTopKStakes(stakes, 32);
      await registerNDlps(stakes);

      await advanceToEpochN(2);

      (await root.topDlpIds(32)).should.deep.eq(topStakes);

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

  describe("Staking", () => {
    beforeEach(async () => {
      await deploy();

      // await advanceToEpochN(1);
      // await root.createEpochs();
    });

    it("should stake and emit event", async function () {
      await register1Dlp();

      const user1InitialBalance = await ethers.provider.getBalance(user1);

      const tx = await root.connect(user1).stake(1, { value: parseEther(10) });
      const receipt = await getReceipt(tx);

      await tx.should.emit(root, "Staked").withArgs(user1, 1, parseEther(10));

      await advanceToEpochN(1);
      await root.createEpochs();

      const dlp1Info = await root.dlps(1);
      dlp1Info.stakeAmount.should.eq(parseEther(110));

      const dlp1Epoch0 = await root.dlpEpochs(1, 0);
      dlp1Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.stakeAmount.should.eq(parseEther(110));

      (await root.stakerDlpsListCount(user1)).should.eq(1);
      const staker1Dlp1 = await root.stakerDlps(user1, 1);
      staker1Dlp1.dlpId.should.eq(1);
      staker1Dlp1.stakeAmount.should.eq(parseEther(10));
      staker1Dlp1.lastClaimedEpochId.should.eq(0);

      (await root.stakerDlpsList(user1)).should.deep.eq([staker1Dlp1]);

      const staker1Dlp1Epoch0 = await root.stakerDlpEpochs(user1, 1, 0);
      staker1Dlp1Epoch0.dlpId.should.eq(1);
      staker1Dlp1Epoch0.epochId.should.eq(0);
      staker1Dlp1Epoch0.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch1 = await root.stakerDlpEpochs(user1, 1, 1);
      staker1Dlp1Epoch1.dlpId.should.eq(1);
      staker1Dlp1Epoch1.epochId.should.eq(1);
      staker1Dlp1Epoch1.stakeAmount.should.eq(parseEther(10));
      staker1Dlp1Epoch1.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch1.claimAmount.should.eq(parseEther(0));

      (await ethers.provider.getBalance(user1)).should.eq(
        user1InitialBalance - parseEther(10) - receipt.fee,
      );
      (await ethers.provider.getBalance(root)).should.eq(parseEther(110));
    });

    it("should stake and after many epochs", async function () {
      await register1Dlp();

      const user1InitialBalance = await ethers.provider.getBalance(user1);

      await advanceToEpochN(19);
      await root.createEpochs();

      const tx = await root.connect(user1).stake(1, { value: parseEther(10) });
      const receipt = await getReceipt(tx);

      await tx.should.emit(root, "Staked").withArgs(user1, 1, parseEther(10));

      await advanceToEpochN(20);
      await root.createEpochs();

      const dlp1Info = await root.dlps(1);
      dlp1Info.stakeAmount.should.eq(parseEther(110));

      const dlp1Epoch0 = await root.dlpEpochs(1, 0);
      dlp1Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.stakeAmount.should.eq(parseEther(100));

      const dlp1Epoch20 = await root.dlpEpochs(1, 20);
      dlp1Epoch20.stakeAmount.should.eq(parseEther(110));

      (await root.stakerDlpsListCount(user1)).should.eq(1);
      const staker1Dlp1 = await root.stakerDlps(user1, 1);
      staker1Dlp1.dlpId.should.eq(1);
      staker1Dlp1.stakeAmount.should.eq(parseEther(10));
      staker1Dlp1.lastClaimedEpochId.should.eq(19);

      (await root.stakerDlpsList(user1)).should.deep.eq([staker1Dlp1]);

      const staker1Dlp1Epoch19 = await root.stakerDlpEpochs(user1, 1, 19);
      staker1Dlp1Epoch19.dlpId.should.eq(1);
      staker1Dlp1Epoch19.epochId.should.eq(19);
      staker1Dlp1Epoch19.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch19.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch19.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch20 = await root.stakerDlpEpochs(user1, 1, 20);
      staker1Dlp1Epoch20.dlpId.should.eq(1);
      staker1Dlp1Epoch20.epochId.should.eq(20);
      staker1Dlp1Epoch20.stakeAmount.should.eq(parseEther(10));
      staker1Dlp1Epoch20.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch20.claimAmount.should.eq(parseEther(0));

      (await ethers.provider.getBalance(user1)).should.eq(
        user1InitialBalance - parseEther(10) - receipt.fee,
      );
      (await ethers.provider.getBalance(root)).should.eq(parseEther(110));
    });

    it("should stake as dlp owner", async function () {
      await register1Dlp();

      const dlpOwner1InitialBalance =
        await ethers.provider.getBalance(dlp1Owner);

      const tx = await root
        .connect(dlp1Owner)
        .stake(1, { value: parseEther(10) });
      const receipt = await getReceipt(tx);

      await tx.should
        .emit(root, "Staked")
        .withArgs(dlp1Owner, 1, parseEther(10));

      await advanceToEpochN(1);
      await root.createEpochs();

      const dlp1Info = await root.dlps(1);
      dlp1Info.stakeAmount.should.eq(parseEther(110));

      const dlp1Epoch0 = await root.dlpEpochs(1, 0);
      dlp1Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.stakeAmount.should.eq(parseEther(110));

      (await root.stakerDlpsListCount(dlp1Owner)).should.eq(1);
      const staker1Dlp1 = await root.stakerDlps(dlp1Owner, 1);
      staker1Dlp1.dlpId.should.eq(1);
      staker1Dlp1.stakeAmount.should.eq(parseEther(110));
      staker1Dlp1.lastClaimedEpochId.should.eq(0);

      (await root.stakerDlpsList(dlp1Owner)).should.deep.eq([staker1Dlp1]);

      const staker1Dlp1Epoch0 = await root.stakerDlpEpochs(dlp1Owner, 1, 0);
      staker1Dlp1Epoch0.dlpId.should.eq(1);
      staker1Dlp1Epoch0.epochId.should.eq(0);
      staker1Dlp1Epoch0.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch1 = await root.stakerDlpEpochs(dlp1Owner, 1, 1);
      staker1Dlp1Epoch1.dlpId.should.eq(1);
      staker1Dlp1Epoch1.epochId.should.eq(1);
      staker1Dlp1Epoch1.stakeAmount.should.eq(parseEther(110));
      staker1Dlp1Epoch1.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch1.claimAmount.should.eq(parseEther(0));

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlpOwner1InitialBalance - parseEther(10) - receipt.fee,
      );
      (await ethers.provider.getBalance(root)).should.eq(parseEther(110));
    });

    it(`should reject stake when dlp doesn't exist`, async function () {
      await root
        .connect(user1)
        .stake(1, { value: parseEther(10) })
        .should.be.rejectedWith("InvalidDlpStatus()");
    });

    it(`should reject stake when dlp is deregistered`, async function () {
      await register1Dlp();

      await root.connect(dlp1Owner).deregisterDlp(1);

      await root
        .connect(user1)
        .stake(1, { value: parseEther(10) })
        .should.be.rejectedWith("InvalidDlpStatus()");
    });

    it("should reject stake when epoch is not created", async function () {
      await register1Dlp();

      await advanceToEpochN(2);

      await root
        .connect(user1)
        .stake(1, { value: parseEther(10) })
        .should.be.rejectedWith("CurrentEpochNotCreated()");
    });

    it("should stake multiple times, one dlp, one epoch", async function () {
      await register1Dlp();

      await root.connect(user1).stake(1, { value: parseEther(10) });
      await root.connect(user1).stake(1, { value: parseEther(20) });

      await advanceToEpochN(1);
      await root.createEpochs();

      const dlp1Info = await root.dlps(1);
      dlp1Info.stakeAmount.should.eq(parseEther(130));

      const dlp1Epoch0 = await root.dlpEpochs(1, 0);
      dlp1Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.stakeAmount.should.eq(parseEther(130));

      (await root.stakerDlpsListCount(user1)).should.eq(1);
      const staker1Dlp1 = await root.stakerDlps(user1, 1);
      staker1Dlp1.dlpId.should.eq(1);
      staker1Dlp1.stakeAmount.should.eq(parseEther(30));
      staker1Dlp1.lastClaimedEpochId.should.eq(0);

      (await root.stakerDlpsList(user1)).should.deep.eq([staker1Dlp1]);

      const staker1Dlp1Epoch0 = await root.stakerDlpEpochs(user1, 1, 0);
      staker1Dlp1Epoch0.dlpId.should.eq(1);
      staker1Dlp1Epoch0.epochId.should.eq(0);
      staker1Dlp1Epoch0.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch1 = await root.stakerDlpEpochs(user1, 1, 1);
      staker1Dlp1Epoch1.dlpId.should.eq(1);
      staker1Dlp1Epoch1.epochId.should.eq(1);
      staker1Dlp1Epoch1.stakeAmount.should.eq(parseEther(30));
      staker1Dlp1Epoch1.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch1.claimAmount.should.eq(parseEther(0));

      (await ethers.provider.getBalance(root)).should.eq(parseEther(130));
    });

    it("should stake multiple times, one dlp, multiple epochs", async function () {
      await register1Dlp();

      await root.connect(user1).stake(1, { value: parseEther(10) });

      await advanceToEpochN(2);
      await root.createEpochs();

      await root.connect(user1).stake(1, { value: parseEther(20) });

      await advanceToEpochN(3);
      await root.createEpochs();

      const dlp1Info = await root.dlps(1);
      dlp1Info.stakeAmount.should.eq(parseEther(130));

      const dlp1Epoch0 = await root.dlpEpochs(1, 0);
      dlp1Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.stakeAmount.should.eq(parseEther(110));

      const dlp1Epoch2 = await root.dlpEpochs(1, 2);
      dlp1Epoch2.stakeAmount.should.eq(parseEther(110));

      const dlp1Epoch3 = await root.dlpEpochs(1, 3);
      dlp1Epoch3.stakeAmount.should.eq(parseEther(130));

      (await root.stakerDlpsListCount(user1)).should.eq(1);
      const staker1Dlp1 = await root.stakerDlps(user1, 1);
      staker1Dlp1.dlpId.should.eq(1);
      staker1Dlp1.stakeAmount.should.eq(parseEther(30));
      staker1Dlp1.lastClaimedEpochId.should.eq(0);

      (await root.stakerDlpsList(user1)).should.deep.eq([staker1Dlp1]);

      const staker1Dlp1Epoch0 = await root.stakerDlpEpochs(user1, 1, 0);
      staker1Dlp1Epoch0.dlpId.should.eq(1);
      staker1Dlp1Epoch0.epochId.should.eq(0);
      staker1Dlp1Epoch0.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch1 = await root.stakerDlpEpochs(user1, 1, 1);
      staker1Dlp1Epoch1.dlpId.should.eq(1);
      staker1Dlp1Epoch1.epochId.should.eq(1);
      staker1Dlp1Epoch1.stakeAmount.should.eq(parseEther(10));
      staker1Dlp1Epoch1.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch1.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch2 = await root.stakerDlpEpochs(user1, 1, 2);
      staker1Dlp1Epoch2.dlpId.should.eq(1);
      staker1Dlp1Epoch2.epochId.should.eq(2);
      staker1Dlp1Epoch2.stakeAmount.should.eq(parseEther(10));
      staker1Dlp1Epoch2.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch2.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch3 = await root.stakerDlpEpochs(user1, 1, 3);
      staker1Dlp1Epoch3.dlpId.should.eq(1);
      staker1Dlp1Epoch3.epochId.should.eq(3);
      staker1Dlp1Epoch3.stakeAmount.should.eq(parseEther(30));
      staker1Dlp1Epoch3.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch3.claimAmount.should.eq(parseEther(0));

      (await ethers.provider.getBalance(root)).should.eq(parseEther(130));
    });

    it("should stake multiple users, multiple dlps, one epoch", async function () {
      await register5Dlps();

      await advanceToEpochN(2);
      await root.createEpochs();

      await root.connect(user1).stake(1, { value: parseEther(10) });
      await root.connect(user2).stake(1, { value: parseEther(20) });
      await root.connect(user1).stake(1, { value: parseEther(30) });
      await root.connect(user2).stake(2, { value: parseEther(40) });
      await root.connect(user1).stake(2, { value: parseEther(50) });
      await root.connect(user2).stake(2, { value: parseEther(60) });
      await root.connect(user1).stake(3, { value: parseEther(70) });
      await root.connect(user2).stake(3, { value: parseEther(80) });
      await root.connect(user1).stake(3, { value: parseEther(90) });
      await root.connect(user2).stake(4, { value: parseEther(100) });

      await advanceToEpochN(3);
      await root.createEpochs();

      const dlp1Info = await root.dlps(1);
      dlp1Info.stakeAmount.should.eq(parseEther(100 + 10 + 20 + 30));

      const dlp2Info = await root.dlps(2);
      dlp2Info.stakeAmount.should.eq(parseEther(100 + 40 + 50 + 60));

      const dlp3Info = await root.dlps(3);
      dlp3Info.stakeAmount.should.eq(parseEther(100 + 70 + 80 + 90));

      const dlp4Info = await root.dlps(4);
      dlp4Info.stakeAmount.should.eq(parseEther(100 + 100));

      const dlp5Info = await root.dlps(5);
      dlp5Info.stakeAmount.should.eq(parseEther(100));

      const dlp1Epoch2 = await root.dlpEpochs(1, 2);
      dlp1Epoch2.stakeAmount.should.eq(parseEther(100));

      const dlp1Epoch3 = await root.dlpEpochs(1, 3);
      dlp1Epoch3.stakeAmount.should.eq(parseEther(100 + 10 + 20 + 30));

      const dlp2Epoch2 = await root.dlpEpochs(2, 2);
      dlp2Epoch2.stakeAmount.should.eq(parseEther(100));

      const dlp2Epoch3 = await root.dlpEpochs(2, 3);
      dlp2Epoch3.stakeAmount.should.eq(parseEther(100 + 40 + 50 + 60));

      const dlp3Epoch2 = await root.dlpEpochs(3, 2);
      dlp3Epoch2.stakeAmount.should.eq(parseEther(100));

      const dlp3Epoch3 = await root.dlpEpochs(3, 3);
      dlp3Epoch3.stakeAmount.should.eq(parseEther(100 + 70 + 80 + 90));

      const dlp4Epoch2 = await root.dlpEpochs(4, 2);
      dlp4Epoch2.stakeAmount.should.eq(parseEther(100));

      const dlp4Epoch3 = await root.dlpEpochs(4, 3);
      dlp4Epoch3.stakeAmount.should.eq(parseEther(100 + 100));

      (await root.stakerDlpsListCount(user1)).should.eq(3);
      (await root.stakerDlpsListCount(user2)).should.eq(4);

      const staker1Dlp1 = await root.stakerDlps(user1, 1);
      staker1Dlp1.stakeAmount.should.eq(parseEther(10 + 30));

      const staker1Dlp2 = await root.stakerDlps(user1, 2);
      staker1Dlp2.stakeAmount.should.eq(parseEther(50));

      const staker1Dlp3 = await root.stakerDlps(user1, 3);
      staker1Dlp3.stakeAmount.should.eq(parseEther(70 + 90));

      const staker1Dlp4 = await root.stakerDlps(user1, 4);
      staker1Dlp4.stakeAmount.should.eq(parseEther(0));

      (await root.stakerDlpsList(user1)).should.deep.eq([
        staker1Dlp1,
        staker1Dlp2,
        staker1Dlp3,
      ]);

      const staker2Dlp1 = await root.stakerDlps(user2, 1);
      staker2Dlp1.stakeAmount.should.eq(parseEther(20));

      const staker2Dlp2 = await root.stakerDlps(user2, 2);
      staker2Dlp2.stakeAmount.should.eq(parseEther(40 + 60));

      const staker2Dlp3 = await root.stakerDlps(user2, 3);
      staker2Dlp3.stakeAmount.should.eq(parseEther(80));

      const staker2Dlp4 = await root.stakerDlps(user2, 4);
      staker2Dlp4.stakeAmount.should.eq(parseEther(100));

      (await root.stakerDlpsList(user2)).should.deep.eq([
        staker2Dlp1,
        staker2Dlp2,
        staker2Dlp3,
        staker2Dlp4,
      ]);

      const staker1Dlp1Epoch2 = await root.stakerDlpEpochs(user1, 1, 2);
      staker1Dlp1Epoch2.stakeAmount.should.eq(parseEther(0));

      const staker1Dlp2Epoch2 = await root.stakerDlpEpochs(user1, 2, 2);
      staker1Dlp2Epoch2.stakeAmount.should.eq(parseEther(0));

      const staker1Dlp3Epoch2 = await root.stakerDlpEpochs(user1, 3, 2);
      staker1Dlp3Epoch2.stakeAmount.should.eq(parseEther(0));

      const staker1Dlp4Epoch2 = await root.stakerDlpEpochs(user1, 4, 2);
      staker1Dlp4Epoch2.stakeAmount.should.eq(parseEther(0));

      const staker2Dlp1Epoch2 = await root.stakerDlpEpochs(user2, 1, 2);
      staker2Dlp1Epoch2.stakeAmount.should.eq(parseEther(0));

      const staker2Dlp2Epoch2 = await root.stakerDlpEpochs(user2, 2, 2);
      staker2Dlp2Epoch2.stakeAmount.should.eq(parseEther(0));

      const staker2Dlp3Epoch2 = await root.stakerDlpEpochs(user2, 3, 2);
      staker2Dlp3Epoch2.stakeAmount.should.eq(parseEther(0));

      const staker2Dlp4Epoch2 = await root.stakerDlpEpochs(user2, 4, 2);
      staker2Dlp4Epoch2.stakeAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch3 = await root.stakerDlpEpochs(user1, 1, 3);
      staker1Dlp1Epoch3.stakeAmount.should.eq(parseEther(10 + 30));

      const staker1Dlp2Epoch3 = await root.stakerDlpEpochs(user1, 2, 3);
      staker1Dlp2Epoch3.stakeAmount.should.eq(parseEther(50));

      const staker1Dlp3Epoch3 = await root.stakerDlpEpochs(user1, 3, 3);
      staker1Dlp3Epoch3.stakeAmount.should.eq(parseEther(70 + 90));

      const staker1Dlp4Epoch3 = await root.stakerDlpEpochs(user1, 4, 3);
      staker1Dlp4Epoch3.stakeAmount.should.eq(parseEther(0));

      const staker2Dlp1Epoch3 = await root.stakerDlpEpochs(user2, 1, 3);
      staker2Dlp1Epoch3.stakeAmount.should.eq(parseEther(20));

      const staker2Dlp2Epoch3 = await root.stakerDlpEpochs(user2, 2, 3);
      staker2Dlp2Epoch3.stakeAmount.should.eq(parseEther(40 + 60));

      const staker2Dlp3Epoch3 = await root.stakerDlpEpochs(user2, 3, 3);
      staker2Dlp3Epoch3.stakeAmount.should.eq(parseEther(80));

      const staker2Dlp4Epoch3 = await root.stakerDlpEpochs(user2, 4, 3);
      staker2Dlp4Epoch3.stakeAmount.should.eq(parseEther(100));

      (await ethers.provider.getBalance(root)).should.eq(
        parseEther(100 * 5 + 10 + 20 + 30 + 40 + 50 + 60 + 70 + 80 + 90 + 100),
      );
    });

    it("should stake multiple users, multiple dlps, multiple epochs", async function () {
      await register5Dlps();

      await advanceToEpochN(2);
      await root.createEpochs();

      await root.connect(user1).stake(1, { value: parseEther(10) });

      await advanceToEpochN(3);
      await root.createEpochs();

      await root.connect(user2).stake(1, { value: parseEther(20) });
      await root.connect(user1).stake(1, { value: parseEther(30) });
      await root.connect(user2).stake(2, { value: parseEther(40) });

      await advanceToEpochN(5);
      await root.createEpochs();

      await root.connect(user1).stake(2, { value: parseEther(50) });
      await root.connect(user2).stake(2, { value: parseEther(60) });
      await root.connect(user1).stake(3, { value: parseEther(70) });
      await root.connect(user2).stake(3, { value: parseEther(80) });

      await advanceToEpochN(6);
      await root.createEpochs();

      await root.connect(user1).stake(3, { value: parseEther(90) });
      await root.connect(user2).stake(4, { value: parseEther(100) });

      await advanceToEpochN(7);
      await root.createEpochs();

      const dlp1Info = await root.dlps(1);
      dlp1Info.stakeAmount.should.eq(parseEther(100 + 10 + 20 + 30));

      const dlp2Info = await root.dlps(2);
      dlp2Info.stakeAmount.should.eq(parseEther(100 + 40 + 50 + 60));

      const dlp3Info = await root.dlps(3);
      dlp3Info.stakeAmount.should.eq(parseEther(100 + 70 + 80 + 90));

      const dlp4Info = await root.dlps(4);
      dlp4Info.stakeAmount.should.eq(parseEther(100 + 100));

      const dlp5Info = await root.dlps(5);
      dlp5Info.stakeAmount.should.eq(parseEther(100));

      const dlp1Epoch0 = await root.dlpEpochs(1, 0);
      dlp1Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.stakeAmount.should.eq(parseEther(100));

      const dlp1Epoch2 = await root.dlpEpochs(1, 2);
      dlp1Epoch2.stakeAmount.should.eq(parseEther(100));

      const dlp1Epoch3 = await root.dlpEpochs(1, 3);
      dlp1Epoch3.stakeAmount.should.eq(parseEther(100 + 10));

      const dlp1Epoch4 = await root.dlpEpochs(1, 4);
      dlp1Epoch4.stakeAmount.should.eq(parseEther(100 + 10 + 20 + 30));

      const dlp1Epoch7 = await root.dlpEpochs(1, 7);
      dlp1Epoch7.stakeAmount.should.eq(parseEther(100 + 10 + 20 + 30));

      const dlp2Epoch0 = await root.dlpEpochs(2, 0);
      dlp2Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp2Epoch1 = await root.dlpEpochs(2, 1);
      dlp2Epoch1.stakeAmount.should.eq(parseEther(100));

      const dlp2Epoch2 = await root.dlpEpochs(2, 2);
      dlp2Epoch2.stakeAmount.should.eq(parseEther(100));

      const dlp2Epoch3 = await root.dlpEpochs(2, 3);
      dlp2Epoch3.stakeAmount.should.eq(parseEther(100));

      const dlp2Epoch4 = await root.dlpEpochs(2, 4);
      dlp2Epoch4.stakeAmount.should.eq(parseEther(100 + 40));

      const dlp2Epoch5 = await root.dlpEpochs(2, 5);
      dlp2Epoch5.stakeAmount.should.eq(parseEther(100 + 40));

      const dlp2Epoch6 = await root.dlpEpochs(2, 6);
      dlp2Epoch6.stakeAmount.should.eq(parseEther(100 + 40 + 50 + 60));

      const dlp2Epoch7 = await root.dlpEpochs(2, 7);
      dlp2Epoch7.stakeAmount.should.eq(parseEther(100 + 40 + 50 + 60));

      const dlp3Epoch0 = await root.dlpEpochs(3, 0);
      dlp3Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp3Epoch1 = await root.dlpEpochs(3, 1);
      dlp3Epoch1.stakeAmount.should.eq(parseEther(100));

      const dlp3Epoch5 = await root.dlpEpochs(3, 5);
      dlp3Epoch5.stakeAmount.should.eq(parseEther(100));

      const dlp3Epoch6 = await root.dlpEpochs(3, 6);
      dlp3Epoch6.stakeAmount.should.eq(parseEther(100 + 70 + 80));

      const dlp3Epoch7 = await root.dlpEpochs(3, 7);
      dlp3Epoch7.stakeAmount.should.eq(parseEther(100 + 70 + 80 + 90));

      const dlp4Epoch0 = await root.dlpEpochs(4, 0);
      dlp4Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp4Epoch1 = await root.dlpEpochs(4, 1);
      dlp4Epoch1.stakeAmount.should.eq(parseEther(100));

      const dlp4Epoch6 = await root.dlpEpochs(4, 6);
      dlp4Epoch6.stakeAmount.should.eq(parseEther(100));

      const dlp4Epoch7 = await root.dlpEpochs(4, 7);
      dlp4Epoch7.stakeAmount.should.eq(parseEther(100 + 100));

      (await root.stakerDlpsListCount(user1)).should.eq(3);
      (await root.stakerDlpsListCount(user2)).should.eq(4);

      const staker1Dlp1 = await root.stakerDlps(user1, 1);
      staker1Dlp1.stakeAmount.should.eq(parseEther(10 + 30));

      const staker1Dlp2 = await root.stakerDlps(user1, 2);
      staker1Dlp2.stakeAmount.should.eq(parseEther(50));

      const staker1Dlp3 = await root.stakerDlps(user1, 3);
      staker1Dlp3.stakeAmount.should.eq(parseEther(70 + 90));

      const staker1Dlp4 = await root.stakerDlps(user1, 4);
      staker1Dlp4.stakeAmount.should.eq(parseEther(0));

      (await root.stakerDlpsList(user1)).should.deep.eq([
        staker1Dlp1,
        staker1Dlp2,
        staker1Dlp3,
      ]);

      const staker2Dlp1 = await root.stakerDlps(user2, 1);
      staker2Dlp1.stakeAmount.should.eq(parseEther(20));

      const staker2Dlp2 = await root.stakerDlps(user2, 2);
      staker2Dlp2.stakeAmount.should.eq(parseEther(40 + 60));

      const staker2Dlp3 = await root.stakerDlps(user2, 3);
      staker2Dlp3.stakeAmount.should.eq(parseEther(80));

      const staker2Dlp4 = await root.stakerDlps(user2, 4);
      staker2Dlp4.stakeAmount.should.eq(parseEther(100));

      (await root.stakerDlpsList(user2)).should.deep.eq([
        staker2Dlp1,
        staker2Dlp2,
        staker2Dlp3,
        staker2Dlp4,
      ]);

      const staker1Dlp1Epoch2 = await root.stakerDlpEpochs(user1, 1, 2);
      staker1Dlp1Epoch2.stakeAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch3 = await root.stakerDlpEpochs(user1, 1, 3);
      staker1Dlp1Epoch3.stakeAmount.should.eq(parseEther(10));

      const staker1Dlp1Epoch4 = await root.stakerDlpEpochs(user1, 1, 4);
      staker1Dlp1Epoch4.stakeAmount.should.eq(parseEther(10 + 30));

      const staker1Dlp1Epoch5 = await root.stakerDlpEpochs(user1, 1, 5);
      staker1Dlp1Epoch5.stakeAmount.should.eq(parseEther(10 + 30));

      const staker2Dlp1Epoch3 = await root.stakerDlpEpochs(user2, 1, 3);
      staker2Dlp1Epoch3.stakeAmount.should.eq(parseEther(0));

      const staker2Dlp1Epoch4 = await root.stakerDlpEpochs(user2, 1, 4);
      staker2Dlp1Epoch4.stakeAmount.should.eq(parseEther(20));

      const staker2Dlp1Epoch5 = await root.stakerDlpEpochs(user2, 1, 5);
      staker2Dlp1Epoch5.stakeAmount.should.eq(parseEther(20));

      const staker1Dlp2Epoch4 = await root.stakerDlpEpochs(user1, 2, 4);
      staker1Dlp2Epoch4.stakeAmount.should.eq(parseEther(0));

      const staker1Dlp2Epoch6 = await root.stakerDlpEpochs(user1, 2, 6);
      staker1Dlp2Epoch6.stakeAmount.should.eq(parseEther(50));

      const staker1Dlp2Epoch7 = await root.stakerDlpEpochs(user1, 2, 7);
      staker1Dlp2Epoch7.stakeAmount.should.eq(parseEther(50));

      const staker2Dlp2Epoch3 = await root.stakerDlpEpochs(user2, 2, 3);
      staker2Dlp2Epoch3.stakeAmount.should.eq(parseEther(0));

      const staker2Dlp2Epoch4 = await root.stakerDlpEpochs(user2, 2, 4);
      staker2Dlp2Epoch4.stakeAmount.should.eq(parseEther(40));

      const staker2Dlp2Epoch5 = await root.stakerDlpEpochs(user2, 2, 5);
      staker2Dlp2Epoch5.stakeAmount.should.eq(parseEther(40));

      const staker2Dlp2Epoch6 = await root.stakerDlpEpochs(user2, 2, 6);
      staker2Dlp2Epoch6.stakeAmount.should.eq(parseEther(40 + 60));

      const staker2Dlp2Epoch7 = await root.stakerDlpEpochs(user2, 2, 7);
      staker2Dlp2Epoch7.stakeAmount.should.eq(parseEther(40 + 60));

      const staker1Dlp3Epoch5 = await root.stakerDlpEpochs(user1, 3, 5);
      staker1Dlp3Epoch5.stakeAmount.should.eq(parseEther(0));

      const staker1Dlp3Epoch6 = await root.stakerDlpEpochs(user1, 3, 6);
      staker1Dlp3Epoch6.stakeAmount.should.eq(parseEther(70));

      const staker1Dlp3Epoch7 = await root.stakerDlpEpochs(user1, 3, 7);
      staker1Dlp3Epoch7.stakeAmount.should.eq(parseEther(70 + 90));

      const staker2Dlp3Epoch5 = await root.stakerDlpEpochs(user2, 3, 5);
      staker2Dlp3Epoch5.stakeAmount.should.eq(parseEther(0));

      const staker2Dlp3Epoch6 = await root.stakerDlpEpochs(user2, 3, 6);
      staker2Dlp3Epoch6.stakeAmount.should.eq(parseEther(80));

      const staker2Dlp3Epoch7 = await root.stakerDlpEpochs(user2, 3, 7);
      staker2Dlp3Epoch7.stakeAmount.should.eq(parseEther(80));

      const staker2Dlp4Epoch6 = await root.stakerDlpEpochs(user2, 4, 6);
      staker2Dlp4Epoch6.stakeAmount.should.eq(parseEther(0));

      const staker2Dlp4Epoch7 = await root.stakerDlpEpochs(user2, 4, 7);
      staker2Dlp4Epoch7.stakeAmount.should.eq(parseEther(100));

      (await ethers.provider.getBalance(root)).should.eq(
        parseEther(100 * 5 + 10 + 20 + 30 + 40 + 50 + 60 + 70 + 80 + 90 + 100),
      );
    });
  });

  describe("Unstaking", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should unstake and emit event", async function () {
      await register1Dlp();

      const user1InitialBalance = await ethers.provider.getBalance(user1);

      const tx1 = await root.connect(user1).stake(1, { value: parseEther(10) });
      const receipt1 = await getReceipt(tx1);

      await advanceToEpochN(1);
      await advanceBlockNTimes(epochSize / 2);
      await root.createEpochs();

      const tx2 = await root.connect(user1).unstake(1, parseEther(4));
      const receipt2 = await getReceipt(tx2);

      await tx2.should.emit(root, "Unstaked").withArgs(user1, 1, parseEther(4));

      await advanceToEpochN(2);
      await root.createEpochs();

      const dlp1Info = await root.dlps(1);
      dlp1Info.stakeAmount.should.eq(parseEther(106));

      const dlp1Epoch0 = await root.dlpEpochs(1, 0);
      dlp1Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.stakeAmount.should.eq(parseEther(110));

      const dlp1Epoch2 = await root.dlpEpochs(1, 2);
      dlp1Epoch2.stakeAmount.should.eq(parseEther(106));

      (await root.stakerDlpsListCount(user1)).should.eq(1);
      const staker1Dlp1 = await root.stakerDlps(user1, 1);
      staker1Dlp1.dlpId.should.eq(1);
      staker1Dlp1.stakeAmount.should.eq(parseEther(6));
      staker1Dlp1.lastClaimedEpochId.should.eq(0);

      (await root.stakerDlpsList(user1)).should.deep.eq([staker1Dlp1]);

      const staker1Dlp1Epoch0 = await root.stakerDlpEpochs(user1, 1, 0);
      staker1Dlp1Epoch0.dlpId.should.eq(1);
      staker1Dlp1Epoch0.epochId.should.eq(0);
      staker1Dlp1Epoch0.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch1 = await root.stakerDlpEpochs(user1, 1, 1);
      staker1Dlp1Epoch1.dlpId.should.eq(1);
      staker1Dlp1Epoch1.epochId.should.eq(1);
      staker1Dlp1Epoch1.stakeAmount.should.eq(parseEther(10));
      staker1Dlp1Epoch1.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch1.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch2 = await root.stakerDlpEpochs(user1, 1, 2);
      staker1Dlp1Epoch2.dlpId.should.eq(1);
      staker1Dlp1Epoch2.epochId.should.eq(2);
      staker1Dlp1Epoch2.stakeAmount.should.eq(parseEther(6));
      staker1Dlp1Epoch2.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch2.claimAmount.should.eq(parseEther(0));

      (await ethers.provider.getBalance(user1)).should.eq(
        user1InitialBalance - parseEther(6) - receipt1.fee - receipt2.fee,
      );
      (await ethers.provider.getBalance(root)).should.eq(parseEther(106));
    });

    it("should unstake multiple times", async function () {
      await register1Dlp();

      const user1InitialBalance = await ethers.provider.getBalance(user1);

      const tx1 = await root.connect(user1).stake(1, { value: parseEther(10) });
      const receipt1 = await getReceipt(tx1);

      await advanceToEpochN(1);
      await advanceBlockNTimes(epochSize / 2);
      await root.createEpochs();

      const tx2 = await root.connect(user1).unstake(1, parseEther(1));
      const receipt2 = await getReceipt(tx2);

      await tx2.should.emit(root, "Unstaked").withArgs(user1, 1, parseEther(1));

      const tx3 = await root.connect(user1).unstake(1, parseEther(3));
      const receipt3 = await getReceipt(tx3);

      await tx3.should.emit(root, "Unstaked").withArgs(user1, 1, parseEther(3));

      await advanceToEpochN(2);
      await root.createEpochs();

      const dlp1Info = await root.dlps(1);
      dlp1Info.stakeAmount.should.eq(parseEther(106));

      const dlp1Epoch0 = await root.dlpEpochs(1, 0);
      dlp1Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.stakeAmount.should.eq(parseEther(110));

      const dlp1Epoch2 = await root.dlpEpochs(1, 2);
      dlp1Epoch2.stakeAmount.should.eq(parseEther(106));

      (await root.stakerDlpsListCount(user1)).should.eq(1);
      const staker1Dlp1 = await root.stakerDlps(user1, 1);
      staker1Dlp1.dlpId.should.eq(1);
      staker1Dlp1.stakeAmount.should.eq(parseEther(6));
      staker1Dlp1.lastClaimedEpochId.should.eq(0);

      (await root.stakerDlpsList(user1)).should.deep.eq([staker1Dlp1]);

      const staker1Dlp1Epoch0 = await root.stakerDlpEpochs(user1, 1, 0);
      staker1Dlp1Epoch0.dlpId.should.eq(1);
      staker1Dlp1Epoch0.epochId.should.eq(0);
      staker1Dlp1Epoch0.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch1 = await root.stakerDlpEpochs(user1, 1, 1);
      staker1Dlp1Epoch1.dlpId.should.eq(1);
      staker1Dlp1Epoch1.epochId.should.eq(1);
      staker1Dlp1Epoch1.stakeAmount.should.eq(parseEther(10));
      staker1Dlp1Epoch1.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch1.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch2 = await root.stakerDlpEpochs(user1, 1, 2);
      staker1Dlp1Epoch2.dlpId.should.eq(1);
      staker1Dlp1Epoch2.epochId.should.eq(2);
      staker1Dlp1Epoch2.stakeAmount.should.eq(parseEther(6));
      staker1Dlp1Epoch2.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch2.claimAmount.should.eq(parseEther(0));

      (await ethers.provider.getBalance(user1)).should.eq(
        user1InitialBalance -
          parseEther(6) -
          receipt1.fee -
          receipt2.fee -
          receipt3.fee,
      );
      (await ethers.provider.getBalance(root)).should.eq(parseEther(106));
    });

    it("should unstake all amount", async function () {
      await register1Dlp();

      const user1InitialBalance = await ethers.provider.getBalance(user1);

      const tx1 = await root.connect(user1).stake(1, { value: parseEther(10) });
      const receipt1 = await getReceipt(tx1);

      await advanceToEpochN(1);
      await advanceBlockNTimes(epochSize / 2);
      await root.createEpochs();

      const tx2 = await root.connect(user1).unstake(1, parseEther(10));
      const receipt2 = await getReceipt(tx2);

      await tx2.should
        .emit(root, "Unstaked")
        .withArgs(user1, 1, parseEther(10));

      await advanceToEpochN(2);
      await root.createEpochs();

      const dlp1Info = await root.dlps(1);
      dlp1Info.stakeAmount.should.eq(parseEther(100));

      const dlp1Epoch0 = await root.dlpEpochs(1, 0);
      dlp1Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.stakeAmount.should.eq(parseEther(110));

      const dlp1Epoch2 = await root.dlpEpochs(1, 2);
      dlp1Epoch2.stakeAmount.should.eq(parseEther(100));

      (await root.stakerDlpsListCount(user1)).should.eq(1);
      const staker1Dlp1 = await root.stakerDlps(user1, 1);
      staker1Dlp1.dlpId.should.eq(1);
      staker1Dlp1.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1.lastClaimedEpochId.should.eq(0);

      (await root.stakerDlpsList(user1)).should.deep.eq([staker1Dlp1]);

      const staker1Dlp1Epoch0 = await root.stakerDlpEpochs(user1, 1, 0);
      staker1Dlp1Epoch0.dlpId.should.eq(1);
      staker1Dlp1Epoch0.epochId.should.eq(0);
      staker1Dlp1Epoch0.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch1 = await root.stakerDlpEpochs(user1, 1, 1);
      staker1Dlp1Epoch1.dlpId.should.eq(1);
      staker1Dlp1Epoch1.epochId.should.eq(1);
      staker1Dlp1Epoch1.stakeAmount.should.eq(parseEther(10));
      staker1Dlp1Epoch1.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch1.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch2 = await root.stakerDlpEpochs(user1, 1, 2);
      staker1Dlp1Epoch2.dlpId.should.eq(1);
      staker1Dlp1Epoch2.epochId.should.eq(2);
      staker1Dlp1Epoch2.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch2.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch2.claimAmount.should.eq(parseEther(0));

      (await ethers.provider.getBalance(user1)).should.eq(
        user1InitialBalance - receipt1.fee - receipt2.fee,
      );
      (await ethers.provider.getBalance(root)).should.eq(parseEther(100));
    });

    it("should reject unstake more than staked amount", async function () {
      await register1Dlp();

      await root.connect(user1).stake(1, { value: parseEther(10) });

      await advanceToEpochN(1);
      await advanceBlockNTimes(epochSize / 2);
      await root.createEpochs();

      await root
        .connect(user1)
        .unstake(1, parseEther(11))
        .should.be.rejectedWith("InvalidUnstakeAmount()");
    });

    it("should reject unstake too early #1", async function () {
      await register1Dlp();

      await root.connect(user1).stake(1, { value: parseEther(10) });

      await advanceBlockNTimes(epochSize / 2);

      await root
        .connect(user1)
        .unstake(1, parseEther(5))
        .should.be.rejectedWith("InvalidUnstakeAmount()");
    });

    it("should reject unstake too early #2", async function () {
      await register1Dlp();

      await advanceToEpochN(2);
      await root.createEpochs();

      await advanceBlockNTimes(epochSize / 2);

      await root.connect(user1).stake(1, { value: parseEther(10) });

      await advanceToEpochN(3);
      await root.createEpochs();

      await root
        .connect(user1)
        .unstake(1, parseEther(5))
        .should.be.rejectedWith("InvalidUnstakeAmount()");
    });

    it("should unstake when dlpOwner", async function () {
      await register1Dlp();

      const dlp1Owner1InitialBalance =
        await ethers.provider.getBalance(dlp1Owner);

      const tx1 = await root
        .connect(dlp1Owner)
        .stake(1, { value: parseEther(10) });
      const receipt1 = await getReceipt(tx1);

      await advanceToEpochN(1);
      await advanceBlockNTimes(epochSize / 2);
      await root.createEpochs();

      const tx2 = await root.connect(dlp1Owner).unstake(1, parseEther(4));
      const receipt2 = await getReceipt(tx2);

      await tx2.should
        .emit(root, "Unstaked")
        .withArgs(dlp1Owner, 1, parseEther(4));

      await advanceToEpochN(2);
      await root.createEpochs();

      const dlp1Info = await root.dlps(1);
      dlp1Info.stakeAmount.should.eq(parseEther(106));

      const dlp1Epoch0 = await root.dlpEpochs(1, 0);
      dlp1Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.stakeAmount.should.eq(parseEther(110));

      const dlp1Epoch2 = await root.dlpEpochs(1, 2);
      dlp1Epoch2.stakeAmount.should.eq(parseEther(106));

      (await root.stakerDlpsListCount(dlp1Owner)).should.eq(1);
      const staker1Dlp1 = await root.stakerDlps(dlp1Owner, 1);
      staker1Dlp1.dlpId.should.eq(1);
      staker1Dlp1.stakeAmount.should.eq(parseEther(106));
      staker1Dlp1.lastClaimedEpochId.should.eq(0);

      (await root.stakerDlpsList(dlp1Owner)).should.deep.eq([staker1Dlp1]);

      const staker1Dlp1Epoch0 = await root.stakerDlpEpochs(dlp1Owner, 1, 0);
      staker1Dlp1Epoch0.dlpId.should.eq(1);
      staker1Dlp1Epoch0.epochId.should.eq(0);
      staker1Dlp1Epoch0.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch1 = await root.stakerDlpEpochs(dlp1Owner, 1, 1);
      staker1Dlp1Epoch1.dlpId.should.eq(1);
      staker1Dlp1Epoch1.epochId.should.eq(1);
      staker1Dlp1Epoch1.stakeAmount.should.eq(parseEther(110));
      staker1Dlp1Epoch1.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch1.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch2 = await root.stakerDlpEpochs(dlp1Owner, 1, 2);
      staker1Dlp1Epoch2.dlpId.should.eq(1);
      staker1Dlp1Epoch2.epochId.should.eq(2);
      staker1Dlp1Epoch2.stakeAmount.should.eq(parseEther(106));
      staker1Dlp1Epoch2.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch2.claimAmount.should.eq(parseEther(0));

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1Owner1InitialBalance - parseEther(6) - receipt1.fee - receipt2.fee,
      );
      (await ethers.provider.getBalance(root)).should.eq(parseEther(106));
    });

    it("should unstake when dlpOwner when dlp was created with a bigger stake", async function () {
      await register1Dlp();

      const dlp1Owner1InitialBalance =
        await ethers.provider.getBalance(dlp1Owner);

      await advanceToEpochN(1);
      await advanceBlockNTimes(epochSize / 2);
      await root.createEpochs();

      const tx2 = await root.connect(dlp1Owner).unstake(1, parseEther(20));
      const receipt2 = await getReceipt(tx2);

      await tx2.should
        .emit(root, "Unstaked")
        .withArgs(dlp1Owner, 1, parseEther(20));

      await advanceToEpochN(2);
      await root.createEpochs();

      const dlp1Info = await root.dlps(1);
      dlp1Info.stakeAmount.should.eq(parseEther(80));

      const dlp1Epoch0 = await root.dlpEpochs(1, 0);
      dlp1Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.stakeAmount.should.eq(parseEther(100));

      const dlp1Epoch2 = await root.dlpEpochs(1, 2);
      dlp1Epoch2.stakeAmount.should.eq(parseEther(80));

      (await root.stakerDlpsListCount(dlp1Owner)).should.eq(1);
      const staker1Dlp1 = await root.stakerDlps(dlp1Owner, 1);
      staker1Dlp1.dlpId.should.eq(1);
      staker1Dlp1.stakeAmount.should.eq(parseEther(80));
      staker1Dlp1.lastClaimedEpochId.should.eq(0);

      (await root.stakerDlpsList(dlp1Owner)).should.deep.eq([staker1Dlp1]);

      const staker1Dlp1Epoch0 = await root.stakerDlpEpochs(dlp1Owner, 1, 0);
      staker1Dlp1Epoch0.dlpId.should.eq(1);
      staker1Dlp1Epoch0.epochId.should.eq(0);
      staker1Dlp1Epoch0.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch1 = await root.stakerDlpEpochs(dlp1Owner, 1, 1);
      staker1Dlp1Epoch1.dlpId.should.eq(1);
      staker1Dlp1Epoch1.epochId.should.eq(1);
      staker1Dlp1Epoch1.stakeAmount.should.eq(parseEther(100));
      staker1Dlp1Epoch1.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch1.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch2 = await root.stakerDlpEpochs(dlp1Owner, 1, 2);
      staker1Dlp1Epoch2.dlpId.should.eq(1);
      staker1Dlp1Epoch2.epochId.should.eq(2);
      staker1Dlp1Epoch2.stakeAmount.should.eq(parseEther(80));
      staker1Dlp1Epoch2.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch2.claimAmount.should.eq(parseEther(0));

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1Owner1InitialBalance + parseEther(20) - receipt2.fee,
      );
      (await ethers.provider.getBalance(root)).should.eq(parseEther(80));
    });

    it("should reject unstake more than dlp minStake when dlpOwner", async function () {
      await register1Dlp();

      await advanceToEpochN(1);
      await root.createEpochs();

      await root.connect(dlp1Owner).unstake(1, parseEther(50)).should.be
        .fulfilled;

      (await root.dlps(1)).stakeAmount.should.eq(minDlpStakeAmount);
      (await root.dlps(1)).stakeAmount.should.eq(minDlpStakeAmount);

      await root
        .connect(dlp1Owner)
        .unstake(1, parseEther(0.0001))
        .should.be.rejectedWith("InvalidUnstakeAmount()");

      await advanceBlockNTimes(epochSize / 2);
    });

    it("should unstake an old stake", async function () {
      await register1Dlp();

      const user1InitialBalance = await ethers.provider.getBalance(user1);

      const tx1 = await root.connect(user1).stake(1, { value: parseEther(10) });
      const receipt1 = await getReceipt(tx1);

      await advanceToEpochN(1);
      await advanceBlockNTimes(epochSize / 2);
      await root.createEpochs();

      const tx2 = await root.connect(user1).stake(1, { value: parseEther(5) });
      const receipt2 = await getReceipt(tx2);

      const tx3 = await root.connect(user1).unstake(1, parseEther(10));
      const receipt3 = await getReceipt(tx3);

      await tx3.should
        .emit(root, "Unstaked")
        .withArgs(user1, 1, parseEther(10));

      await advanceToEpochN(2);
      await root.createEpochs();

      const dlp1Info = await root.dlps(1);
      dlp1Info.stakeAmount.should.eq(parseEther(105));

      const dlp1Epoch0 = await root.dlpEpochs(1, 0);
      dlp1Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.stakeAmount.should.eq(parseEther(110));

      const dlp1Epoch2 = await root.dlpEpochs(1, 2);
      dlp1Epoch2.stakeAmount.should.eq(parseEther(105));

      (await root.stakerDlpsListCount(user1)).should.eq(1);
      const staker1Dlp1 = await root.stakerDlps(user1, 1);
      staker1Dlp1.dlpId.should.eq(1);
      staker1Dlp1.stakeAmount.should.eq(parseEther(5));
      staker1Dlp1.lastClaimedEpochId.should.eq(0);

      (await root.stakerDlpsList(user1)).should.deep.eq([staker1Dlp1]);

      const staker1Dlp1Epoch0 = await root.stakerDlpEpochs(user1, 1, 0);
      staker1Dlp1Epoch0.dlpId.should.eq(1);
      staker1Dlp1Epoch0.epochId.should.eq(0);
      staker1Dlp1Epoch0.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch1 = await root.stakerDlpEpochs(user1, 1, 1);
      staker1Dlp1Epoch1.dlpId.should.eq(1);
      staker1Dlp1Epoch1.epochId.should.eq(1);
      staker1Dlp1Epoch1.stakeAmount.should.eq(parseEther(10));
      staker1Dlp1Epoch1.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch1.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch2 = await root.stakerDlpEpochs(user1, 1, 2);
      staker1Dlp1Epoch2.dlpId.should.eq(1);
      staker1Dlp1Epoch2.epochId.should.eq(2);
      staker1Dlp1Epoch2.stakeAmount.should.eq(parseEther(5));
      staker1Dlp1Epoch2.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch2.claimAmount.should.eq(parseEther(0));

      (await ethers.provider.getBalance(user1)).should.eq(
        user1InitialBalance -
          parseEther(5) -
          receipt1.fee -
          receipt2.fee -
          receipt3.fee,
      );
      (await ethers.provider.getBalance(root)).should.eq(parseEther(105));
    });
  });

  describe("Dlps - registration", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should registerDlp", async function () {
      const dlp1OwnerInitialBalance =
        await ethers.provider.getBalance(dlp1Owner);
      const tx = await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, 0, { value: parseEther(100) });
      const receipt = await getReceipt(tx);

      await tx.should
        .emit(root, "DlpRegistered")
        .withArgs(1, dlp1.address, dlp1Owner.address);

      await advanceToEpochN(1);
      await root.createEpochs();

      (await root.registeredDlps()).should.deep.eq([1n]);

      (await root.dlpsCount()).should.eq(1);

      const dlp1Info = await root.dlps(1);

      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.ownerAddress.should.eq(dlp1Owner.address);
      dlp1Info.stakeAmount.should.eq(parseEther(100));
      dlp1Info.status.should.eq(DlpStatus.Registered);
      dlp1Info.grantedAmount.should.eq(0);
      dlp1Info.registrationBlockNumber.should.eq(0);
      dlp1Info.stakersPercentage.should.eq(0);

      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.epochs(1)).dlpIds.should.deep.eq([1n]);

      const dlp1Epoch0 = await root.dlpEpochs(1, 0);
      dlp1Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.stakeAmount.should.eq(parseEther(100));

      (await root.stakerDlpsListCount(dlp1Owner)).should.eq(1);
      const staker1Dlp1 = await root.stakerDlps(dlp1Owner, 1);
      staker1Dlp1.dlpId.should.eq(1);
      staker1Dlp1.stakeAmount.should.eq(parseEther(100));
      staker1Dlp1.lastClaimedEpochId.should.eq(0);

      (await root.stakerDlpsList(dlp1Owner)).should.deep.eq([staker1Dlp1]);

      const staker1Dlp1Epoch0 = await root.stakerDlpEpochs(dlp1Owner, 1, 0);
      staker1Dlp1Epoch0.dlpId.should.eq(1);
      staker1Dlp1Epoch0.epochId.should.eq(0);
      staker1Dlp1Epoch0.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch1 = await root.stakerDlpEpochs(dlp1Owner, 1, 1);
      staker1Dlp1Epoch1.dlpId.should.eq(1);
      staker1Dlp1Epoch1.epochId.should.eq(1);
      staker1Dlp1Epoch1.stakeAmount.should.eq(parseEther(100));
      staker1Dlp1Epoch1.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch1.claimAmount.should.eq(parseEther(0));

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerInitialBalance - parseEther(100) - receipt.fee,
      );
      (await ethers.provider.getBalance(root)).should.eq(parseEther(100));
    });

    it("should registerDlp as sponsor", async function () {
      const user1InitialBalance = await ethers.provider.getBalance(user1);
      const tx = await root
        .connect(user1)
        .registerDlp(dlp1, dlp1Owner, parseEther(90), {
          value: parseEther(100),
        });
      const receipt = await getReceipt(tx);

      await tx.should
        .emit(root, "DlpRegistered")
        .withArgs(1, dlp1.address, dlp1Owner.address);

      await advanceToEpochN(1);
      await root.createEpochs();

      (await root.registeredDlps()).should.deep.eq([1n]);

      (await root.dlpsCount()).should.eq(1);

      const dlp1Info = await root.dlps(1);

      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.ownerAddress.should.eq(dlp1Owner.address);
      dlp1Info.stakeAmount.should.eq(parseEther(100));
      dlp1Info.status.should.eq(DlpStatus.Registered);
      dlp1Info.grantedAmount.should.eq(0);
      dlp1Info.registrationBlockNumber.should.eq(0);
      dlp1Info.stakersPercentage.should.eq(parseEther(90));

      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.epochs(1)).dlpIds.should.deep.eq([1n]);

      const dlp1Epoch0 = await root.dlpEpochs(1, 0);
      dlp1Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.stakeAmount.should.eq(parseEther(100));

      (await root.stakerDlpsListCount(dlp1Owner)).should.eq(1);
      const staker1Dlp1 = await root.stakerDlps(dlp1Owner, 1);
      staker1Dlp1.dlpId.should.eq(1);
      staker1Dlp1.stakeAmount.should.eq(parseEther(100));
      staker1Dlp1.lastClaimedEpochId.should.eq(0);

      (await root.stakerDlpsList(dlp1Owner)).should.deep.eq([staker1Dlp1]);

      const staker1Dlp1Epoch0 = await root.stakerDlpEpochs(dlp1Owner, 1, 0);
      staker1Dlp1Epoch0.dlpId.should.eq(1);
      staker1Dlp1Epoch0.epochId.should.eq(0);
      staker1Dlp1Epoch0.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch1 = await root.stakerDlpEpochs(dlp1Owner, 1, 1);
      staker1Dlp1Epoch1.dlpId.should.eq(1);
      staker1Dlp1Epoch1.epochId.should.eq(1);
      staker1Dlp1Epoch1.stakeAmount.should.eq(parseEther(100));
      staker1Dlp1Epoch1.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch1.claimAmount.should.eq(parseEther(0));

      (await ethers.provider.getBalance(user1)).should.eq(
        user1InitialBalance - parseEther(100) - receipt.fee,
      );
      (await ethers.provider.getBalance(root)).should.eq(parseEther(100));
    });

    it("should registerDlpWithGrant", async function () {
      const user1InitialBalance = await ethers.provider.getBalance(user1);
      const tx = await root
        .connect(user1)
        .registerDlpWithGrant(dlp1, dlp1Owner, parseEther(8), {
          value: parseEther(100),
        });
      const receipt = await getReceipt(tx);

      await tx.should
        .emit(root, "DlpRegistered")
        .withArgs(1, dlp1.address, dlp1Owner.address);

      await advanceToEpochN(1);
      await root.createEpochs();

      (await root.registeredDlps()).should.deep.eq([1n]);

      (await root.dlpsCount()).should.eq(1);

      const dlp1Info = await root.dlps(1);

      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.ownerAddress.should.eq(dlp1Owner.address);
      dlp1Info.stakeAmount.should.eq(parseEther(100));
      dlp1Info.status.should.eq(DlpStatus.Registered);
      dlp1Info.grantedAmount.should.eq(parseEther(100));
      dlp1Info.registrationBlockNumber.should.eq(0);
      dlp1Info.stakersPercentage.should.eq(parseEther(8));

      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.epochs(1)).dlpIds.should.deep.eq([1n]);

      const dlp1Epoch0 = await root.dlpEpochs(1, 0);
      dlp1Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.stakeAmount.should.eq(parseEther(100));

      (await root.stakerDlpsListCount(dlp1Owner)).should.eq(1);
      const staker1Dlp1 = await root.stakerDlps(dlp1Owner, 1);
      staker1Dlp1.dlpId.should.eq(1);
      staker1Dlp1.stakeAmount.should.eq(parseEther(100));
      staker1Dlp1.lastClaimedEpochId.should.eq(0);

      (await root.stakerDlpsList(dlp1Owner)).should.deep.eq([staker1Dlp1]);

      const staker1Dlp1Epoch0 = await root.stakerDlpEpochs(dlp1Owner, 1, 0);
      staker1Dlp1Epoch0.dlpId.should.eq(1);
      staker1Dlp1Epoch0.epochId.should.eq(0);
      staker1Dlp1Epoch0.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch1 = await root.stakerDlpEpochs(dlp1Owner, 1, 1);
      staker1Dlp1Epoch1.dlpId.should.eq(1);
      staker1Dlp1Epoch1.epochId.should.eq(1);
      staker1Dlp1Epoch1.stakeAmount.should.eq(parseEther(100));
      staker1Dlp1Epoch1.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch1.claimAmount.should.eq(parseEther(0));

      (await ethers.provider.getBalance(user1)).should.eq(
        user1InitialBalance - parseEther(100) - receipt.fee,
      );
      (await ethers.provider.getBalance(root)).should.eq(parseEther(100));
    });

    it("should registerDlp multiple times", async function () {
      const dlp1OwnerInitialBalance =
        await ethers.provider.getBalance(dlp1Owner);
      const dlp2OwnerInitialBalance =
        await ethers.provider.getBalance(dlp2Owner);
      const dlp3OwnerInitialBalance =
        await ethers.provider.getBalance(dlp3Owner);

      const tx1 = await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, 0, { value: parseEther(101) });
      const receipt1 = await getReceipt(tx1);

      await tx1.should
        .emit(root, "DlpRegistered")
        .withArgs(1, dlp1.address, dlp1Owner.address);

      const tx2 = await root
        .connect(dlp2Owner)
        .registerDlp(dlp2, dlp2Owner, parseEther(25), {
          value: parseEther(102),
        });
      const receipt2 = await getReceipt(tx2);

      await tx2.should
        .emit(root, "DlpRegistered")
        .withArgs(2, dlp2.address, dlp2Owner.address);

      const tx3 = await root
        .connect(dlp3Owner)
        .registerDlp(dlp3, dlp3Owner, parseEther(50), {
          value: parseEther(103),
        });
      const receipt3 = await getReceipt(tx3);

      await tx3.should
        .emit(root, "DlpRegistered")
        .withArgs(3, dlp3.address, dlp3Owner.address);

      (await root.registeredDlps()).should.deep.eq([1n, 2n, 3n]);

      (await root.dlpsCount()).should.eq(3);

      (await root.epochs(0)).dlpIds.should.deep.eq([]);
      (await root.epochs(1)).dlpIds.should.deep.eq([]);

      await advanceToEpochN(1);
      await root.createEpochs();

      (await root.epochs(0)).dlpIds.should.deep.eq([]);
      (await root.epochs(1)).dlpIds.should.deep.eq([3n, 2n, 1n]);

      const dlp1Info = await root.dlps(1);

      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.ownerAddress.should.eq(dlp1Owner.address);
      dlp1Info.stakeAmount.should.eq(parseEther(101));
      dlp1Info.status.should.eq(DlpStatus.Registered);
      dlp1Info.grantedAmount.should.eq(0);
      dlp1Info.registrationBlockNumber.should.eq(0);
      dlp1Info.stakersPercentage.should.eq(0);

      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      const dlp1Epoch0 = await root.dlpEpochs(1, 0);
      dlp1Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.stakeAmount.should.eq(parseEther(101));

      (await root.stakerDlpsListCount(dlp1Owner)).should.eq(1);
      const staker1Dlp1 = await root.stakerDlps(dlp1Owner, 1);
      staker1Dlp1.dlpId.should.eq(1);
      staker1Dlp1.stakeAmount.should.eq(parseEther(101));
      staker1Dlp1.lastClaimedEpochId.should.eq(0);

      (await root.stakerDlpsList(dlp1Owner)).should.deep.eq([staker1Dlp1]);

      const staker1Dlp1Epoch0 = await root.stakerDlpEpochs(dlp1Owner, 1, 0);
      staker1Dlp1Epoch0.dlpId.should.eq(1);
      staker1Dlp1Epoch0.epochId.should.eq(0);
      staker1Dlp1Epoch0.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch1 = await root.stakerDlpEpochs(dlp1Owner, 1, 1);
      staker1Dlp1Epoch1.dlpId.should.eq(1);
      staker1Dlp1Epoch1.epochId.should.eq(1);
      staker1Dlp1Epoch1.stakeAmount.should.eq(parseEther(101));
      staker1Dlp1Epoch1.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch1.claimAmount.should.eq(parseEther(0));

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerInitialBalance - parseEther(101) - receipt1.fee,
      );

      const dlp2Info = await root.dlps(2);

      dlp2Info.dlpAddress.should.eq(dlp2);
      dlp2Info.ownerAddress.should.eq(dlp2Owner.address);
      dlp2Info.stakeAmount.should.eq(parseEther(102));
      dlp2Info.status.should.eq(DlpStatus.Registered);
      dlp2Info.grantedAmount.should.eq(0);
      dlp2Info.registrationBlockNumber.should.eq(0);
      dlp2Info.stakersPercentage.should.eq(parseEther(25));

      (await root.dlpsByAddress(dlp2)).should.deep.eq(dlp2Info);

      const dlp2Epoch0 = await root.dlpEpochs(2, 0);
      dlp2Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp2Epoch1 = await root.dlpEpochs(2, 1);
      dlp2Epoch1.stakeAmount.should.eq(parseEther(102));

      (await root.stakerDlpsListCount(dlp2Owner)).should.eq(1);
      const staker1Dlp2 = await root.stakerDlps(dlp2Owner, 2);
      staker1Dlp2.dlpId.should.eq(2);
      staker1Dlp2.stakeAmount.should.eq(parseEther(102));
      staker1Dlp2.lastClaimedEpochId.should.eq(0);

      (await root.stakerDlpsList(dlp2Owner)).should.deep.eq([staker1Dlp2]);

      const staker1Dlp2Epoch0 = await root.stakerDlpEpochs(dlp2Owner, 2, 0);
      staker1Dlp2Epoch0.dlpId.should.eq(2);
      staker1Dlp2Epoch0.epochId.should.eq(0);
      staker1Dlp2Epoch0.stakeAmount.should.eq(parseEther(0));
      staker1Dlp2Epoch0.rewardAmount.should.eq(parseEther(0));
      staker1Dlp2Epoch0.claimAmount.should.eq(parseEther(0));

      const staker1Dlp2Epoch1 = await root.stakerDlpEpochs(dlp2Owner, 2, 1);
      staker1Dlp2Epoch1.dlpId.should.eq(2);
      staker1Dlp2Epoch1.epochId.should.eq(1);
      staker1Dlp2Epoch1.stakeAmount.should.eq(parseEther(102));
      staker1Dlp2Epoch1.rewardAmount.should.eq(parseEther(0));
      staker1Dlp2Epoch1.claimAmount.should.eq(parseEther(0));

      (await ethers.provider.getBalance(dlp2Owner)).should.eq(
        dlp2OwnerInitialBalance - parseEther(102) - receipt2.fee,
      );

      const dlp3Info = await root.dlps(3);

      dlp3Info.dlpAddress.should.eq(dlp3);
      dlp3Info.ownerAddress.should.eq(dlp3Owner.address);
      dlp3Info.stakeAmount.should.eq(parseEther(103));
      dlp3Info.status.should.eq(DlpStatus.Registered);
      dlp3Info.grantedAmount.should.eq(0);
      dlp3Info.registrationBlockNumber.should.eq(0);
      dlp3Info.stakersPercentage.should.eq(parseEther(50));

      (await root.dlpsByAddress(dlp3)).should.deep.eq(dlp3Info);

      const dlp3Epoch0 = await root.dlpEpochs(3, 0);
      dlp3Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp3Epoch1 = await root.dlpEpochs(3, 1);
      dlp3Epoch1.stakeAmount.should.eq(parseEther(103));

      (await root.stakerDlpsListCount(dlp3Owner)).should.eq(1);
      const staker1Dlp3 = await root.stakerDlps(dlp3Owner, 3);
      staker1Dlp3.dlpId.should.eq(3);
      staker1Dlp3.stakeAmount.should.eq(parseEther(103));
      staker1Dlp3.lastClaimedEpochId.should.eq(0);

      (await root.stakerDlpsList(dlp3Owner)).should.deep.eq([staker1Dlp3]);

      const staker1Dlp3Epoch0 = await root.stakerDlpEpochs(dlp3Owner, 3, 0);
      staker1Dlp3Epoch0.dlpId.should.eq(3);
      staker1Dlp3Epoch0.epochId.should.eq(0);
      staker1Dlp3Epoch0.stakeAmount.should.eq(parseEther(0));
      staker1Dlp3Epoch0.rewardAmount.should.eq(parseEther(0));
      staker1Dlp3Epoch0.claimAmount.should.eq(parseEther(0));

      const staker1Dlp3Epoch1 = await root.stakerDlpEpochs(dlp3Owner, 3, 1);
      staker1Dlp3Epoch1.dlpId.should.eq(3);
      staker1Dlp3Epoch1.epochId.should.eq(1);
      staker1Dlp3Epoch1.stakeAmount.should.eq(parseEther(103));
      staker1Dlp3Epoch1.rewardAmount.should.eq(parseEther(0));
      staker1Dlp3Epoch1.claimAmount.should.eq(parseEther(0));

      (await ethers.provider.getBalance(dlp3Owner)).should.eq(
        dlp3OwnerInitialBalance - parseEther(103) - receipt3.fee,
      );
      (await ethers.provider.getBalance(root)).should.eq(
        parseEther(101 + 102 + 103),
      );
    });

    it("Should reject registerDlp when paused", async function () {
      await root.connect(owner).pause();
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, 0, { value: parseEther(1) })
        .should.be.rejectedWith(`EnforcedPause()`);
    });

    it("Should reject registerDlp when stake amount too small", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, 0, { value: parseEther(1) })
        .should.be.rejectedWith(`InvalidStakeAmount()`);
    });

    it("Should reject registerDlp when already registered", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, 0, { value: parseEther(100) });
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, 0, { value: parseEther(100) })
        .should.be.rejectedWith(`InvalidDlpStatus()`);
    });

    it("Should reject registerDlp when deregistered", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, 0, { value: parseEther(100) });
      await root.connect(dlp1Owner).deregisterDlp(1);
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, 0, { value: parseEther(100) })
        .should.be.rejectedWith(`InvalidDlpStatus()`);
    });

    it("Should reject registerDlp when too many registered dlps", async function () {
      await register5Dlps();

      await root.connect(owner).updateMaxNumberOfRegisteredDlps(5);

      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, 0, { value: parseEther(100) })
        .should.be.rejectedWith(`TooManyDlps()`);
    });

    it("should deregisterDlp when dlp owner", async function () {
      const dlp1OwnerInitialBalance =
        await ethers.provider.getBalance(dlp1Owner);
      const tx1 = await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, 0, { value: parseEther(100) });
      const receipt1 = await getReceipt(tx1);

      await tx1.should
        .emit(root, "DlpRegistered")
        .withArgs(1, dlp1.address, dlp1Owner.address);

      const tx2 = await root.connect(dlp1Owner).deregisterDlp(1);
      const receipt2 = await getReceipt(tx2);

      await tx2.should.emit(root, "DlpDeregistered").withArgs(1);

      await advanceToEpochN(1);
      await root.createEpochs();

      (await root.registeredDlps()).should.deep.eq([]);

      (await root.dlpsCount()).should.eq(1);
      const dlp1Info = await root.dlps(1);

      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.ownerAddress.should.eq(dlp1Owner.address);
      dlp1Info.stakeAmount.should.eq(parseEther(0));
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.grantedAmount.should.eq(0);
      dlp1Info.registrationBlockNumber.should.eq(0);
      dlp1Info.stakersPercentage.should.eq(0);

      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.epochs(1)).dlpIds.should.deep.eq([]);

      const dlp1Epoch0 = await root.dlpEpochs(1, 0);
      dlp1Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.stakeAmount.should.eq(parseEther(0));

      (await root.stakerDlpsListCount(dlp1Owner)).should.eq(1);
      const staker1Dlp1 = await root.stakerDlps(dlp1Owner, 1);
      staker1Dlp1.dlpId.should.eq(1);
      staker1Dlp1.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1.lastClaimedEpochId.should.eq(0);

      (await root.stakerDlpsList(dlp1Owner)).should.deep.eq([staker1Dlp1]);

      const staker1Dlp1Epoch0 = await root.stakerDlpEpochs(dlp1Owner, 1, 0);
      staker1Dlp1Epoch0.dlpId.should.eq(1);
      staker1Dlp1Epoch0.epochId.should.eq(0);
      staker1Dlp1Epoch0.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch1 = await root.stakerDlpEpochs(dlp1Owner, 1, 1);
      staker1Dlp1Epoch1.dlpId.should.eq(1);
      staker1Dlp1Epoch1.epochId.should.eq(1);
      staker1Dlp1Epoch1.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch1.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch1.claimAmount.should.eq(parseEther(0));

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerInitialBalance - receipt1.fee - receipt2.fee,
      );
      (await ethers.provider.getBalance(root)).should.eq(parseEther(0));
    });

    it("should deregister granted dlp when dlp owner", async function () {
      const tx1 = await root
        .connect(owner)
        .registerDlpWithGrant(dlp1, dlp1Owner, 0, { value: parseEther(100) });

      await tx1.should
        .emit(root, "DlpRegistered")
        .withArgs(1, dlp1.address, dlp1Owner.address);

      const tx2 = await root.connect(dlp1Owner).deregisterDlp(1);
      await tx2.should.emit(root, "DlpDeregistered").withArgs(1);

      await advanceToEpochN(1);
      await root.createEpochs();

      (await root.registeredDlps()).should.deep.eq([]);

      (await root.dlpsCount()).should.eq(1);
      const dlp1Info = await root.dlps(1);

      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.ownerAddress.should.eq(dlp1Owner.address);
      dlp1Info.stakeAmount.should.eq(parseEther(100));
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.grantedAmount.should.eq(parseEther(100));
      dlp1Info.registrationBlockNumber.should.eq(0);
      dlp1Info.stakersPercentage.should.eq(0);

      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.epochs(1)).dlpIds.should.deep.eq([]);

      const dlp1Epoch0 = await root.dlpEpochs(1, 0);
      dlp1Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.stakeAmount.should.eq(parseEther(100));

      (await root.stakerDlpsListCount(dlp1Owner)).should.eq(1);
      const staker1Dlp1 = await root.stakerDlps(dlp1Owner, 1);
      staker1Dlp1.dlpId.should.eq(1);
      staker1Dlp1.stakeAmount.should.eq(parseEther(100));
      staker1Dlp1.lastClaimedEpochId.should.eq(0);

      (await root.stakerDlpsList(dlp1Owner)).should.deep.eq([staker1Dlp1]);

      const staker1Dlp1Epoch0 = await root.stakerDlpEpochs(dlp1Owner, 1, 0);
      staker1Dlp1Epoch0.dlpId.should.eq(1);
      staker1Dlp1Epoch0.epochId.should.eq(0);
      staker1Dlp1Epoch0.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch1 = await root.stakerDlpEpochs(dlp1Owner, 1, 1);
      staker1Dlp1Epoch1.dlpId.should.eq(1);
      staker1Dlp1Epoch1.epochId.should.eq(1);
      staker1Dlp1Epoch1.stakeAmount.should.eq(parseEther(100));
      staker1Dlp1Epoch1.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch1.claimAmount.should.eq(parseEther(0));

      (await ethers.provider.getBalance(root)).should.eq(parseEther(100));
    });

    it("should deregister granted dlp when dlp owner and extra stake", async function () {
      const dlp1OwnerInitialBalance =
        await ethers.provider.getBalance(dlp1Owner);

      const tx1 = await root
        .connect(owner)
        .registerDlpWithGrant(dlp1, dlp1Owner, parseEther(1), {
          value: parseEther(100),
        });

      await tx1.should
        .emit(root, "DlpRegistered")
        .withArgs(1, dlp1.address, dlp1Owner.address);

      const receipt1 = await getReceipt(tx1);

      const tx2 = await root
        .connect(dlp1Owner)
        .stake(1, { value: parseEther(60) });
      const receipt2 = await getReceipt(tx2);

      const tx3 = await root.connect(dlp1Owner).deregisterDlp(1);
      await tx3.should.emit(root, "DlpDeregistered").withArgs(1);

      const receipt3 = await getReceipt(tx3);

      await advanceToEpochN(1);
      await root.createEpochs();

      (await root.registeredDlps()).should.deep.eq([]);

      (await root.dlpsCount()).should.eq(1);
      const dlp1Info = await root.dlps(1);

      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.ownerAddress.should.eq(dlp1Owner.address);
      dlp1Info.stakeAmount.should.eq(parseEther(100));
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.grantedAmount.should.eq(parseEther(100));
      dlp1Info.registrationBlockNumber.should.eq(0);
      dlp1Info.stakersPercentage.should.eq(parseEther(1));

      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.epochs(1)).dlpIds.should.deep.eq([]);

      const dlp1Epoch0 = await root.dlpEpochs(1, 0);
      dlp1Epoch0.stakeAmount.should.eq(parseEther(0));

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.stakeAmount.should.eq(parseEther(100));

      (await root.stakerDlpsListCount(dlp1Owner)).should.eq(1);
      const staker1Dlp1 = await root.stakerDlps(dlp1Owner, 1);
      staker1Dlp1.dlpId.should.eq(1);
      staker1Dlp1.stakeAmount.should.eq(parseEther(100));
      staker1Dlp1.lastClaimedEpochId.should.eq(0);

      (await root.stakerDlpsList(dlp1Owner)).should.deep.eq([staker1Dlp1]);

      const staker1Dlp1Epoch0 = await root.stakerDlpEpochs(dlp1Owner, 1, 0);
      staker1Dlp1Epoch0.dlpId.should.eq(1);
      staker1Dlp1Epoch0.epochId.should.eq(0);
      staker1Dlp1Epoch0.stakeAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch0.claimAmount.should.eq(parseEther(0));

      const staker1Dlp1Epoch1 = await root.stakerDlpEpochs(dlp1Owner, 1, 1);
      staker1Dlp1Epoch1.dlpId.should.eq(1);
      staker1Dlp1Epoch1.epochId.should.eq(1);
      staker1Dlp1Epoch1.stakeAmount.should.eq(parseEther(100));
      staker1Dlp1Epoch1.rewardAmount.should.eq(parseEther(0));
      staker1Dlp1Epoch1.claimAmount.should.eq(parseEther(0));

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerInitialBalance - receipt2.fee - receipt3.fee,
      );
      (await ethers.provider.getBalance(root)).should.eq(parseEther(100));
    });

    it("Should reject deregisterDlp when non dlp owner", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, 0, { value: parseEther(100) });

      await root
        .connect(owner)
        .deregisterDlp(1)
        .should.be.rejectedWith("NotDlpOwner()");

      await root
        .connect(dlp1)
        .deregisterDlp(1)
        .should.be.rejectedWith("NotDlpOwner()");

      await root
        .connect(user1)
        .deregisterDlp(1)
        .should.be.rejectedWith("NotDlpOwner()");
    });

    it("Should reject deregisterDlp when deregistered", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, 0, { value: parseEther(100) });

      await root.connect(dlp1Owner).deregisterDlp(1);

      await root
        .connect(dlp1Owner)
        .deregisterDlp(1)
        .should.be.rejectedWith(`InvalidDlpStatus()`);
    });

    it("should deregisterDlp #multiple dlps", async function () {
      await register5Dlps();

      (await ethers.provider.getBalance(root)).should.eq(
        rootInitialBalance + 5n * parseEther(100),
      );

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

      (await root.stakerDlps(dlp1Owner, 1)).stakeAmount.should.eq(0);
      (await root.dlps(1)).stakeAmount.should.eq(0);

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerInitialBalance + parseEther(100) - receipt.fee,
      );
      (await ethers.provider.getBalance(root)).should.eq(
        rootInitialBalance + 4n * parseEther(100),
      );
    });

    it("should deregisterDlp when dlp owner #multiple dlps", async function () {
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

    it("should distributeStakeAfterDeregistration #dlpOwnerAmount = granted", async function () {
      await root
        .connect(owner)
        .registerDlpWithGrant(dlp1, dlp1Owner, 0, { value: parseEther(100) });
      (await root.stakerDlps(dlp1Owner, 1)).stakeAmount.should.eq(
        parseEther(100),
      );
      (await root.dlps(1)).stakeAmount.should.eq(parseEther(100));

      (await ethers.provider.getBalance(root)).should.eq(
        rootInitialBalance + parseEther(100),
      );

      const ownerInitialBalance = await ethers.provider.getBalance(owner);
      const dlp1OwnerInitialBalance =
        await ethers.provider.getBalance(dlp1Owner);

      (await root.registeredDlps()).should.deep.eq([1]);

      const tx1 = await root.connect(dlp1Owner).deregisterDlp(1);
      const receipt1 = await getReceipt(tx1);

      await tx1.should.emit(root, "DlpDeregistered").withArgs(1);

      const tx2 = await root
        .connect(owner)
        .distributeStakeAfterDeregistration(1, parseEther(100));
      const receipt2 = await getReceipt(tx2);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.grantedAmount.should.eq(parseEther(100));

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.registeredDlps()).should.deep.eq([]);

      (await root.stakerDlps(dlp1Owner, 1)).stakeAmount.should.eq(0);
      (await root.dlps(1)).stakeAmount.should.eq(0);

      (await ethers.provider.getBalance(owner)).should.eq(
        ownerInitialBalance - receipt2.fee,
      );

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerInitialBalance - receipt1.fee + parseEther(100),
      );
      (await ethers.provider.getBalance(root)).should.eq(rootInitialBalance);
    });

    it("should distributeStakeAfterDeregistration #dlpOwnerAmount < granted", async function () {
      await root
        .connect(owner)
        .registerDlpWithGrant(dlp1, dlp1Owner, 0, { value: parseEther(100) });
      (await root.stakerDlps(dlp1Owner, 1)).stakeAmount.should.eq(
        parseEther(100),
      );
      (await root.dlps(1)).stakeAmount.should.eq(parseEther(100));

      (await ethers.provider.getBalance(root)).should.eq(parseEther(100));

      const ownerInitialBalance = await ethers.provider.getBalance(owner);
      const dlp1OwnerInitialBalance =
        await ethers.provider.getBalance(dlp1Owner);

      (await root.registeredDlps()).should.deep.eq([1]);

      const tx1 = await root.connect(dlp1Owner).deregisterDlp(1);
      const receipt1 = await getReceipt(tx1);

      await tx1.should.emit(root, "DlpDeregistered").withArgs(1);

      const tx2 = await root
        .connect(owner)
        .distributeStakeAfterDeregistration(1, parseEther(70));
      const receipt2 = await getReceipt(tx2);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.grantedAmount.should.eq(parseEther(100));

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.registeredDlps()).should.deep.eq([]);

      (await root.stakerDlps(dlp1Owner, 1)).stakeAmount.should.eq(0);
      (await root.dlps(1)).stakeAmount.should.eq(0);

      (await ethers.provider.getBalance(owner)).should.eq(
        ownerInitialBalance - receipt2.fee + parseEther(30),
      );

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerInitialBalance - receipt1.fee + parseEther(70),
      );
      (await ethers.provider.getBalance(root)).should.eq(rootInitialBalance);
    });

    it("should distributeStakeAfterDeregistration #dlpOwnerAmount = 0", async function () {
      await root
        .connect(owner)
        .registerDlpWithGrant(dlp1, dlp1Owner, 0, { value: parseEther(100) });
      (await root.stakerDlps(dlp1Owner, 1)).stakeAmount.should.eq(
        parseEther(100),
      );
      (await root.dlps(1)).stakeAmount.should.eq(parseEther(100));

      (await ethers.provider.getBalance(root)).should.eq(parseEther(100));

      const ownerInitialBalance = await ethers.provider.getBalance(owner);
      const dlp1OwnerInitialBalance =
        await ethers.provider.getBalance(dlp1Owner);

      (await root.registeredDlps()).should.deep.eq([1]);

      const tx1 = await root.connect(dlp1Owner).deregisterDlp(1);
      const receipt1 = await getReceipt(tx1);

      await tx1.should.emit(root, "DlpDeregistered").withArgs(1);

      const tx2 = await root
        .connect(owner)
        .distributeStakeAfterDeregistration(1, parseEther(0));
      const receipt2 = await getReceipt(tx2);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.grantedAmount.should.eq(parseEther(100));

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.registeredDlps()).should.deep.eq([]);

      (await root.stakerDlps(dlp1Owner, 1)).stakeAmount.should.eq(0);
      (await root.dlps(1)).stakeAmount.should.eq(0);

      (await ethers.provider.getBalance(owner)).should.eq(
        ownerInitialBalance - receipt2.fee + parseEther(100),
      );

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerInitialBalance - receipt1.fee + parseEther(0),
      );
      (await ethers.provider.getBalance(root)).should.eq(rootInitialBalance);
    });

    it("should reject distributeStakeAfterDeregistration when dlp still active", async function () {
      await root
        .connect(owner)
        .registerDlpWithGrant(dlp1, dlp1Owner, 0, { value: parseEther(100) });

      await root
        .connect(owner)
        .distributeStakeAfterDeregistration(1, parseEther(100))
        .should.be.rejectedWith(`InvalidDlpStatus()`);
    });

    it("should reject distributeStakeAfterDeregistration when dlp was self funded", async function () {
      await root
        .connect(owner)
        .registerDlp(dlp1, dlp1Owner, 0, { value: parseEther(100) });

      await root.connect(dlp1Owner).deregisterDlp(1);

      await root
        .connect(owner)
        .distributeStakeAfterDeregistration(1, parseEther(100))
        .should.be.rejectedWith(`AlreadyDistributed()`);
    });

    it("should reject distributeStakeAfterDeregistration when already distributed", async function () {
      await root
        .connect(owner)
        .registerDlpWithGrant(dlp1, dlp1Owner, 0, { value: parseEther(100) });

      await root.connect(dlp1Owner).deregisterDlp(1);

      await root
        .connect(owner)
        .distributeStakeAfterDeregistration(1, parseEther(100)).should.be
        .fulfilled;

      await root
        .connect(owner)
        .distributeStakeAfterDeregistration(1, parseEther(100))
        .should.be.rejectedWith(`AlreadyDistributed()`);
    });

    it("Should reject distributeStakeAfterDeregistration when non dlp owner", async function () {
      await root
        .connect(owner)
        .registerDlpWithGrant(dlp1, dlp1Owner, 0, { value: parseEther(100) });

      await root.connect(dlp1Owner).deregisterDlp(1);

      await root
        .connect(dlp1Owner)
        .distributeStakeAfterDeregistration(1, parseEther(100))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1Owner.address}")`,
        );
    });

    it("Should reject registerDlp with stakersPercentage > 100e18", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, parseEther(100.1), {
          value: parseEther(100),
        })
        .should.be.rejectedWith("InvalidStakersPercentage()");
    });

    it("Should reject registerDlpWithGrant with stakersPercentage > 100e18", async function () {
      await root
        .connect(owner)
        .registerDlpWithGrant(dlp1, dlp1Owner, parseEther(100.1), {
          value: parseEther(100),
        })
        .should.be.rejectedWith("InvalidStakersPercentage()");
    });

    it("Should updateDlpStakersPercentage when dlpOwner", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlpWithGrant(dlp1, dlp1Owner, 0, { value: parseEther(100) });

      await root
        .connect(dlp1Owner)
        .updateDlpStakersPercentage(1, parseEther(40))
        .should.emit(root, "DlpStakersPercentageUpdated")
        .withArgs(1, parseEther(40));

      (await root.dlps(1)).stakersPercentage.should.eq(parseEther(40));
    });

    it("Should reject updateDlpStakersPercentage with stakersPercentage > 100e18", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlpWithGrant(dlp1, dlp1Owner, 0, { value: parseEther(100) });
      await root
        .connect(dlp1Owner)
        .updateDlpStakersPercentage(1, parseEther(100.1))
        .should.be.rejectedWith("InvalidStakersPercentage()");
    });

    it("Should reject updateDlpStakersPercentage when non-dlpOwner", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlpWithGrant(dlp1, dlp1Owner, 0, { value: parseEther(100) });
      await root
        .connect(dlp2Owner)
        .updateDlpStakersPercentage(1, parseEther(40))
        .should.be.rejectedWith("NotDlpOwner()");
    });
  });

  describe("Performance", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should saveEpochDlpPerformance one dlp", async function () {
      await registerNDlps([parseEther(100)]);

      await advanceToEpochN(2);

      await root.connect(owner).createEpochs();

      await root
        .connect(owner)
        .saveEpochPerformances(
          1,
          [{ dlpId: 1, ttf: 2, tfc: 3, vdu: 4, uw: 5 }],
          true,
        )
        .should.emit(root, "EpochPerformancesSaved")
        .withArgs(1, true);

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.ttf.should.eq(2);
      dlp1Epoch1.tfc.should.eq(3);
      dlp1Epoch1.vdu.should.eq(4);
      dlp1Epoch1.uw.should.eq(5);
      dlp1Epoch1.rewardAmount.should.eq(epochRewardAmount);

      (await root.epochs(1)).isFinalised.should.eq(true);
    });

    it("should saveEpochDlpPerformance one dlp before epoch end", async function () {
      await registerNDlps([parseEther(100)]);

      await advanceToEpochN(1);

      await root.connect(owner).createEpochs();

      await root
        .connect(owner)
        .saveEpochPerformances(
          1,
          [{ dlpId: 1, ttf: 2, tfc: 3, vdu: 4, uw: 5 }],
          false,
        )
        .should.emit(root, "EpochPerformancesSaved")
        .withArgs(1, false);

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.ttf.should.eq(2);
      dlp1Epoch1.tfc.should.eq(3);
      dlp1Epoch1.vdu.should.eq(4);
      dlp1Epoch1.uw.should.eq(5);
      dlp1Epoch1.rewardAmount.should.eq(epochRewardAmount);

      (await root.epochs(1)).isFinalised.should.eq(false);
    });

    it("should saveEpochDlpPerformance without and with final flag", async function () {
      await registerNDlps([parseEther(100)]);

      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      await root
        .connect(owner)
        .saveEpochPerformances(
          1,
          [{ dlpId: 1, ttf: 2, tfc: 3, vdu: 4, uw: 5 }],
          false,
        )
        .should.emit(root, "EpochPerformancesSaved")
        .withArgs(1, false);

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.ttf.should.eq(2);
      dlp1Epoch1.tfc.should.eq(3);
      dlp1Epoch1.vdu.should.eq(4);
      dlp1Epoch1.uw.should.eq(5);
      dlp1Epoch1.rewardAmount.should.eq(epochRewardAmount);

      (await root.epochs(1)).isFinalised.should.eq(false);

      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      await root
        .connect(owner)
        .saveEpochPerformances(
          1,
          [{ dlpId: 1, ttf: 7, tfc: 8, vdu: 9, uw: 10 }],
          true,
        )
        .should.emit(root, "EpochPerformancesSaved")
        .withArgs(1, true);

      const dlp1Epoch1Final = await root.dlpEpochs(1, 1);
      dlp1Epoch1Final.ttf.should.eq(7);
      dlp1Epoch1Final.tfc.should.eq(8);
      dlp1Epoch1Final.vdu.should.eq(9);
      dlp1Epoch1Final.uw.should.eq(10);
      dlp1Epoch1Final.rewardAmount.should.eq(epochRewardAmount);

      (await root.epochs(1)).isFinalised.should.eq(true);
    });

    it("should saveEpochDlpPerformance multiple dlps before epoch end", async function () {
      await registerNDlps([parseEther(100), parseEther(200)]);
      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      await root
        .connect(owner)
        .saveEpochPerformances(
          1,
          [
            { dlpId: 1, ttf: 2, tfc: 3, vdu: 4, uw: 5 },
            { dlpId: 2, ttf: 2, tfc: 3, vdu: 4, uw: 5 },
          ],
          false,
        )
        .should.emit(root, "EpochPerformancesSaved")
        .withArgs(1, false);

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.ttf.should.eq(2);
      dlp1Epoch1.tfc.should.eq(3);
      dlp1Epoch1.vdu.should.eq(4);
      dlp1Epoch1.uw.should.eq(5);
      dlp1Epoch1.rewardAmount.should.eq(epochRewardAmount / 2n);

      const dlp2Epoch1 = await root.dlpEpochs(2, 1);
      dlp2Epoch1.ttf.should.eq(2);
      dlp2Epoch1.tfc.should.eq(3);
      dlp2Epoch1.vdu.should.eq(4);
      dlp2Epoch1.uw.should.eq(5);
      dlp2Epoch1.rewardAmount.should.eq(epochRewardAmount / 2n);
    });

    it("should saveEpochDlpPerformance multiple dlps #1", async function () {
      await registerNDlps([parseEther(100), parseEther(200)]);
      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      await root
        .connect(owner)
        .saveEpochPerformances(
          1,
          [
            { dlpId: 1, ttf: 2, tfc: 3, vdu: 4, uw: 5 },
            { dlpId: 2, ttf: 2, tfc: 3, vdu: 4, uw: 5 },
          ],
          true,
        )
        .should.emit(root, "EpochPerformancesSaved")
        .withArgs(1, true);

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.ttf.should.eq(2);
      dlp1Epoch1.tfc.should.eq(3);
      dlp1Epoch1.vdu.should.eq(4);
      dlp1Epoch1.uw.should.eq(5);
      dlp1Epoch1.rewardAmount.should.eq(epochRewardAmount / 2n);

      const dlp2Epoch1 = await root.dlpEpochs(2, 1);
      dlp2Epoch1.ttf.should.eq(2);
      dlp2Epoch1.tfc.should.eq(3);
      dlp2Epoch1.vdu.should.eq(4);
      dlp2Epoch1.uw.should.eq(5);
      dlp2Epoch1.rewardAmount.should.eq(epochRewardAmount / 2n);
    });

    it("should saveEpochDlpPerformance multiple dlps #2", async function () {
      await registerNDlps([parseEther(100), parseEther(200)]);
      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      await root
        .connect(owner)
        .saveEpochPerformances(
          1,
          [
            { dlpId: 1, ttf: 2, tfc: 3, vdu: 4, uw: 5 },
            { dlpId: 2, ttf: 6, tfc: 9, vdu: 12, uw: 15 },
          ],
          true,
        )
        .should.emit(root, "EpochPerformancesSaved")
        .withArgs(1, true);

      const totalScore =
        (2n + 6n) * ttfPercentage +
        (3n + 9n) * tfcPercentage +
        (4n + 12n) * vduPercentage +
        (5n + 15n) * uwPercentage;

      const dlp1Epoch1Score =
        2n * ttfPercentage +
        3n * tfcPercentage +
        4n * vduPercentage +
        5n * uwPercentage;
      const dlp2Epoch1Score =
        6n * ttfPercentage +
        9n * tfcPercentage +
        12n * vduPercentage +
        15n * uwPercentage;

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.ttf.should.eq(2);
      dlp1Epoch1.tfc.should.eq(3);
      dlp1Epoch1.vdu.should.eq(4);
      dlp1Epoch1.uw.should.eq(5);
      dlp1Epoch1.rewardAmount.should.eq(epochRewardAmount / 4n);
      dlp1Epoch1.rewardAmount.should.eq(
        (epochRewardAmount * dlp1Epoch1Score) / totalScore,
      );

      const dlp2Epoch1 = await root.dlpEpochs(2, 1);
      dlp2Epoch1.ttf.should.eq(6);
      dlp2Epoch1.tfc.should.eq(9);
      dlp2Epoch1.vdu.should.eq(12);
      dlp2Epoch1.uw.should.eq(15);
      dlp2Epoch1.rewardAmount.should.eq((epochRewardAmount / 4n) * 3n);
      dlp2Epoch1.rewardAmount.should.eq(
        (epochRewardAmount * dlp2Epoch1Score) / totalScore,
      );
    });

    it("should saveEpochDlpPerformance multiple dlps #3", async function () {
      await registerNDlps([parseEther(100), parseEther(200), parseEther(200)]);
      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      await root
        .connect(owner)
        .saveEpochPerformances(
          1,
          [
            { dlpId: 1, ttf: 2, tfc: 3, vdu: 5, uw: 7 },
            { dlpId: 2, ttf: 11, tfc: 13, vdu: 17, uw: 19 },
            { dlpId: 3, ttf: 23, tfc: 29, vdu: 31, uw: 37 },
          ],
          true,
        )
        .should.emit(root, "EpochPerformancesSaved")
        .withArgs(1, true);

      const totalScore =
        (2n + 11n + 23n) * ttfPercentage +
        (3n + 13n + 29n) * tfcPercentage +
        (5n + 17n + 31n) * vduPercentage +
        (7n + 19n + 37n) * uwPercentage;

      const dlp1Epoch1Score =
        2n * ttfPercentage +
        3n * tfcPercentage +
        5n * vduPercentage +
        7n * uwPercentage;
      const dlp2Epoch1Score =
        11n * ttfPercentage +
        13n * tfcPercentage +
        17n * vduPercentage +
        19n * uwPercentage;
      const dlp3Epoch1Score =
        23n * ttfPercentage +
        29n * tfcPercentage +
        31n * vduPercentage +
        37n * uwPercentage;

      const dlp1Epoch1 = await root.dlpEpochs(1, 1);
      dlp1Epoch1.ttf.should.eq(2);
      dlp1Epoch1.tfc.should.eq(3);
      dlp1Epoch1.vdu.should.eq(5);
      dlp1Epoch1.uw.should.eq(7);
      dlp1Epoch1.rewardAmount.should.eq(
        (epochRewardAmount * dlp1Epoch1Score) / totalScore,
      );

      const dlp2Epoch1 = await root.dlpEpochs(2, 1);
      dlp2Epoch1.ttf.should.eq(11);
      dlp2Epoch1.tfc.should.eq(13);
      dlp2Epoch1.vdu.should.eq(17);
      dlp2Epoch1.uw.should.eq(19);
      dlp2Epoch1.rewardAmount.should.eq(
        (epochRewardAmount * dlp2Epoch1Score) / totalScore,
      );

      const dlp3Epoch1 = await root.dlpEpochs(3, 1);
      dlp3Epoch1.ttf.should.eq(23);
      dlp3Epoch1.tfc.should.eq(29);
      dlp3Epoch1.vdu.should.eq(31);
      dlp3Epoch1.uw.should.eq(37);
      dlp3Epoch1.rewardAmount.should.eq(
        (epochRewardAmount * dlp3Epoch1Score) / totalScore,
      );
    });

    it("should reject saveEpochDlpPerformance when non owner", async function () {
      await registerNDlps([parseEther(100), parseEther(200), parseEther(200)]);
      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      await root
        .connect(dlp1Owner)
        .saveEpochPerformances(
          1,
          [
            { dlpId: 1, ttf: 2, tfc: 3, vdu: 5, uw: 7 },
            { dlpId: 2, ttf: 11, tfc: 13, vdu: 17, uw: 19 },
            { dlpId: 3, ttf: 23, tfc: 29, vdu: 31, uw: 37 },
          ],
          true,
        )
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1Owner.address}")`,
        );

      await root
        .connect(dlp1)
        .saveEpochPerformances(
          1,
          [
            { dlpId: 1, ttf: 2, tfc: 3, vdu: 5, uw: 7 },
            { dlpId: 2, ttf: 11, tfc: 13, vdu: 17, uw: 19 },
            { dlpId: 3, ttf: 23, tfc: 29, vdu: 31, uw: 37 },
          ],
          true,
        )
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1.address}")`,
        );

      await root
        .connect(user1)
        .saveEpochPerformances(
          1,
          [
            { dlpId: 1, ttf: 2, tfc: 3, vdu: 5, uw: 7 },
            { dlpId: 2, ttf: 11, tfc: 13, vdu: 17, uw: 19 },
            { dlpId: 3, ttf: 23, tfc: 29, vdu: 31, uw: 37 },
          ],
          true,
        )
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("should reject saveEpochDlpPerformance with isFinalised = false when epoch is finished", async function () {
      await registerNDlps([parseEther(100), parseEther(200), parseEther(200)]);
      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      await root
        .connect(owner)
        .saveEpochPerformances(
          1,
          [
            { dlpId: 1, ttf: 2, tfc: 3, vdu: 5, uw: 7 },
            { dlpId: 2, ttf: 11, tfc: 13, vdu: 17, uw: 19 },
            { dlpId: 3, ttf: 23, tfc: 29, vdu: 31, uw: 37 },
          ],
          false,
        )
        .should.be.rejectedWith(`EpochEnded`);

      await root.connect(owner).saveEpochPerformances(
        1,
        [
          { dlpId: 1, ttf: 2, tfc: 3, vdu: 5, uw: 7 },
          { dlpId: 2, ttf: 11, tfc: 13, vdu: 17, uw: 19 },
          { dlpId: 3, ttf: 23, tfc: 29, vdu: 31, uw: 37 },
        ],
        true,
      ).should.be.fulfilled;
    });

    it("should reject saveEpochDlpPerformance when dlp not in epoch #1", async function () {
      await registerNDlps([parseEther(100), parseEther(200), parseEther(200)]);
      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      await root
        .connect(owner)
        .saveEpochPerformances(
          1,
          [
            { dlpId: 1, ttf: 2, tfc: 3, vdu: 5, uw: 7 },
            { dlpId: 2, ttf: 11, tfc: 13, vdu: 17, uw: 19 },
            { dlpId: 4, ttf: 23, tfc: 29, vdu: 31, uw: 37 },
          ],
          true,
        )
        .should.be.rejectedWith(`InvalidDlpList()`);
    });

    it("should reject saveEpochDlpPerformance when dlp not in epoch #2", async function () {
      await registerNDlps([
        parseEther(100),
        parseEther(200),
        parseEther(200),
        parseEther(300),
      ]);
      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      await root
        .connect(owner)
        .saveEpochPerformances(
          1,
          [
            { dlpId: 1, ttf: 2, tfc: 3, vdu: 5, uw: 7 },
            { dlpId: 2, ttf: 11, tfc: 13, vdu: 17, uw: 19 },
            { dlpId: 3, ttf: 23, tfc: 29, vdu: 31, uw: 37 },
          ],
          true,
        )
        .should.be.rejectedWith(`InvalidDlpList()`);
    });

    it("should reject saveEpochDlpPerformance with too less dlps", async function () {
      await registerNDlps([parseEther(100), parseEther(200), parseEther(200)]);
      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      await root
        .connect(owner)
        .saveEpochPerformances(
          1,
          [
            { dlpId: 1, ttf: 2, tfc: 3, vdu: 5, uw: 7 },
            { dlpId: 2, ttf: 11, tfc: 13, vdu: 17, uw: 19 },
          ],
          true,
        )
        .should.be.rejectedWith(`ArityMismatch()`);
    });

    it("should reject saveEpochDlpPerformance with final flag when epoch is not ended", async function () {
      await registerNDlps([parseEther(100), parseEther(200), parseEther(200)]);
      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      await root
        .connect(owner)
        .saveEpochPerformances(
          1,
          [
            { dlpId: 1, ttf: 2, tfc: 3, vdu: 5, uw: 7 },
            { dlpId: 2, ttf: 11, tfc: 13, vdu: 17, uw: 19 },
            { dlpId: 3, ttf: 23, tfc: 29, vdu: 31, uw: 37 },
          ],
          true,
        )
        .should.be.rejectedWith(`EpochNotEnded()`);
    });
  });

  describe("TopDlps", () => {
    const minStakeAmount = 100;

    beforeEach(async () => {
      await deploy();

      await root.connect(owner).updateMinDlpStakeAmount(minStakeAmount);
    });

    const topDlpTests = [
      { dlpsCount: 0, numberOfTopDlps: 16 },
      { dlpsCount: 1, numberOfTopDlps: 1 },
      { dlpsCount: 2, numberOfTopDlps: 2 },
      { dlpsCount: 3, numberOfTopDlps: 3 },
      { dlpsCount: 16, numberOfTopDlps: 16 },
      { dlpsCount: 32, numberOfTopDlps: 32 },
      { dlpsCount: 2, numberOfTopDlps: 1 },
      { dlpsCount: 3, numberOfTopDlps: 1 },
      { dlpsCount: 16, numberOfTopDlps: 1 },
      { dlpsCount: 32, numberOfTopDlps: 1 },
      { dlpsCount: 1, numberOfTopDlps: 16 },
      { dlpsCount: 2, numberOfTopDlps: 16 },
      { dlpsCount: 3, numberOfTopDlps: 16 },
      { dlpsCount: 16, numberOfTopDlps: 16 },
      { dlpsCount: 30, numberOfTopDlps: 16 },
      { dlpsCount: 40, numberOfTopDlps: 16 },
      { dlpsCount: 50, numberOfTopDlps: 16 },
      { dlpsCount: 60, numberOfTopDlps: 16 },
      { dlpsCount: 100, numberOfTopDlps: 16 },
      { dlpsCount: 200, numberOfTopDlps: 16 },
      { dlpsCount: 300, numberOfTopDlps: 16 },
      { dlpsCount: 1000, numberOfTopDlps: 16 },
      { dlpsCount: 1000, numberOfTopDlps: 32 },
    ];

    topDlpTests.forEach((test) => {
      it(`should set topDlps when creating new epoch (dlpsCount = ${test.dlpsCount},  numberOfTopDlps = ${test.numberOfTopDlps})`, async () => {
        await root.connect(owner).updateEpochSize(2000);
        await advanceToEpochN(1);

        await root.connect(owner).createEpochs();

        const dlpStakes = generateStakes(test.dlpsCount, 1000n, 5000n);

        await registerNDlps(dlpStakes);
        await root.connect(owner).updateNumberOfTopDlps(test.numberOfTopDlps);

        const topKDlpIdsExpected = getTopKStakes(
          dlpStakes,
          test.numberOfTopDlps,
        );

        (await root.topDlpIds(test.numberOfTopDlps)).should.deep.eq(
          topKDlpIdsExpected,
        );

        await advanceBlockNTimes(2000); //epoch2
        await root.connect(owner).createEpochs();

        const epoch = await root.epochs(2);
        epoch.dlpIds.should.deep.eq(topKDlpIdsExpected);

        topKDlpIdsExpected.forEach(async (dlpId) => {
          (await root.dlpEpochs(dlpId, 2)).stakeAmount.should.eq(
            dlpStakes[dlpId - 1],
          );
        });
      });
    });

    it(`should set topDlps when creating new epoch after dlpOwner staking`, async () => {
      await registerNDlps([100n, 200n, 300n, 400n, 500n]);

      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([5, 4, 3]);
      (await root.epochs(1)).dlpIds.should.deep.eq([5, 4, 3]);

      await root.connect(dlp1Owner).stake(1, { value: 350n });

      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([5, 1, 4]);
      (await root.epochs(2)).dlpIds.should.deep.eq([5, 1, 4]);

      (await root.dlpEpochs(1, 2)).stakeAmount.should.eq(450n);
      (await root.dlpEpochs(1, 2)).isTopDlp.should.eq(true);

      (await root.dlpEpochs(2, 2)).stakeAmount.should.eq(200);
      (await root.dlpEpochs(2, 2)).isTopDlp.should.eq(false);

      (await root.dlpEpochs(3, 2)).stakeAmount.should.eq(300);
      (await root.dlpEpochs(3, 2)).isTopDlp.should.eq(false);

      (await root.dlpEpochs(4, 2)).stakeAmount.should.eq(400);
      (await root.dlpEpochs(4, 2)).isTopDlp.should.eq(true);

      (await root.dlpEpochs(5, 2)).stakeAmount.should.eq(500);
      (await root.dlpEpochs(5, 2)).isTopDlp.should.eq(true);
    });

    it(`should set topDlps when creating new epoch after user staking`, async () => {
      await registerNDlps([100n, 200n, 300n, 400n, 500n]);

      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([5, 4, 3]);
      (await root.epochs(1)).dlpIds.should.deep.eq([5, 4, 3]);

      await root.connect(user1).stake(1, { value: 350n });

      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([5, 1, 4]);
      (await root.epochs(2)).dlpIds.should.deep.eq([5, 1, 4]);

      (await root.dlpEpochs(1, 2)).stakeAmount.should.eq(450n);
      (await root.dlpEpochs(1, 2)).isTopDlp.should.eq(true);

      (await root.dlpEpochs(2, 2)).stakeAmount.should.eq(200);
      (await root.dlpEpochs(2, 2)).isTopDlp.should.eq(false);

      (await root.dlpEpochs(3, 2)).stakeAmount.should.eq(300);
      (await root.dlpEpochs(3, 2)).isTopDlp.should.eq(false);

      (await root.dlpEpochs(4, 2)).stakeAmount.should.eq(400);
      (await root.dlpEpochs(4, 2)).isTopDlp.should.eq(true);

      (await root.dlpEpochs(5, 2)).stakeAmount.should.eq(500);
      (await root.dlpEpochs(5, 2)).isTopDlp.should.eq(true);
    });

    it(`should set topDlps when creating new epoch after unstaking`, async () => {
      await registerNDlps([100n, 200n, 300n, 400n, 500n]);

      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([5, 4, 3]);
      (await root.epochs(1)).dlpIds.should.deep.eq([5, 4, 3]);

      await root.connect(dlp1Owner).unstake(4, 200n);

      await advanceToEpochN(3);
      await root.connect(owner).createEpochs();

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([5, 3, 2]);
      (await root.epochs(3)).dlpIds.should.deep.eq([5, 3, 2]);

      (await root.dlpEpochs(1, 3)).stakeAmount.should.eq(100);
      (await root.dlpEpochs(1, 3)).isTopDlp.should.eq(false);

      (await root.dlpEpochs(2, 3)).stakeAmount.should.eq(200);
      (await root.dlpEpochs(2, 3)).isTopDlp.should.eq(true);

      (await root.dlpEpochs(3, 3)).stakeAmount.should.eq(300);
      (await root.dlpEpochs(3, 3)).isTopDlp.should.eq(true);

      (await root.dlpEpochs(4, 3)).stakeAmount.should.eq(200);
      (await root.dlpEpochs(4, 3)).isTopDlp.should.eq(false);

      (await root.dlpEpochs(5, 3)).stakeAmount.should.eq(500);
      (await root.dlpEpochs(5, 3)).isTopDlp.should.eq(true);
    });

    it(`should set topDlps when creating new epoch after registering new DLPs`, async () => {
      await registerNDlps([100n, 200n, 300n, 400n, 500n]);

      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([5, 4, 3]);
      (await root.epochs(1)).dlpIds.should.deep.eq([5, 4, 3]);

      await registerNDlps([100n, parseEther(600)]);

      await advanceToEpochN(5);
      await root.connect(owner).createEpochs();

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([7, 5, 4]);
      (await root.epochs(5)).dlpIds.should.deep.eq([7, 5, 4]);
    });

    it(`should set topDlps when creating new epoch after deregistering a DLP`, async () => {
      await registerNDlps([100n, 200n, 300n, 400n, 500n]);

      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([5, 4, 3]);
      (await root.epochs(1)).dlpIds.should.deep.eq([5, 4, 3]);

      await root.connect(dlp1Owner).deregisterDlp(4);

      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([5, 3, 2]);
      (await root.epochs(2)).dlpIds.should.deep.eq([5, 3, 2]);
    });

    it(`should set topDlps when creating new epoch after updating the maximum number of DLPs #updateNumberOfTopDlps`, async () => {
      await registerNDlps([100n, 200n, 300n, 400n, 500n]);

      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([5, 4, 3]);
      (await root.epochs(1)).dlpIds.should.deep.eq([5, 4, 3]);

      await root.connect(owner).updateNumberOfTopDlps(2);

      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      (await root.topDlpIds(2)).should.deep.eq([5, 4]);
      (await root.epochs(2)).dlpIds.should.deep.eq([5, 4]);

      await root.connect(owner).updateNumberOfTopDlps(4);

      await advanceToEpochN(3);
      await root.connect(owner).createEpochs();

      (await root.topDlpIds(4)).should.deep.eq([5, 4, 3, 2]);
      (await root.epochs(3)).dlpIds.should.deep.eq([5, 4, 3, 2]);
    });

    it(`should set topDlps when creating new epoch #staking, unstaking, registration, deregistration, updateNumberOfTopDlps`, async () => {
      await registerNDlps([100n, 200n, 300n, 400n, 500n]);

      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([5, 4, 3]);
      (await root.epochs(1)).dlpIds.should.deep.eq([5, 4, 3]);

      await root.connect(dlp1Owner).stake(1, { value: 350n });

      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([5, 1, 4]);
      (await root.epochs(2)).dlpIds.should.deep.eq([5, 1, 4]);

      await root.connect(dlp1Owner).deregisterDlp(5);

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([1, 4, 3]);

      await advanceToEpochN(3);
      await root.connect(owner).createEpochs();

      (await root.topDlpIds(numberOfTopDlps)).should.deep.eq([1, 4, 3]);
      (await root.epochs(3)).dlpIds.should.deep.eq([1, 4, 3]);

      await root.connect(owner).updateNumberOfTopDlps(2);

      await advanceToEpochN(4);
      await root.connect(owner).createEpochs();

      (await root.topDlpIds(2)).should.deep.eq([1, 4]);
      (await root.epochs(4)).dlpIds.should.deep.eq([1, 4]);

      await registerNDlps([100n, 600n]);

      await advanceToEpochN(5);
      await root.connect(owner).createEpochs();

      (await root.topDlpIds(2)).should.deep.eq([7, 1]);
      (await root.epochs(5)).dlpIds.should.deep.eq([7, 1]);

      await root.connect(owner).updateNumberOfTopDlps(4);

      await advanceToEpochN(6);
      await root.connect(owner).createEpochs();

      (await root.topDlpIds(4)).should.deep.eq([7, 1, 4, 3]);
      (await root.epochs(6)).dlpIds.should.deep.eq([7, 1, 4, 3]);

      await root.connect(dlp1Owner).unstake(1, 300n);

      await advanceToEpochN(7);
      await root.connect(owner).createEpochs();

      (await root.topDlpIds(4)).should.deep.eq([7, 4, 3, 2]);
      (await root.epochs(7)).dlpIds.should.deep.eq([7, 4, 3, 2]);
    });
  });

  describe("ClaimReward", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should claimReward when only dlpOwners has staked, stakersPercentages = 100%", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, parseEther(100), {
          value: parseEther(100),
        });
      await root
        .connect(dlp2Owner)
        .registerDlp(dlp2, dlp2Owner, parseEther(100), {
          value: parseEther(100),
        });
      await root
        .connect(dlp3Owner)
        .registerDlp(dlp3, dlp3Owner, parseEther(100), {
          value: parseEther(100),
        });

      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      await root.connect(owner).saveEpochPerformances(
        1,
        [
          { dlpId: 1, ttf: 20, tfc: 20, vdu: 20, uw: 20 },
          { dlpId: 2, ttf: 30, tfc: 30, vdu: 30, uw: 30 },
          { dlpId: 3, ttf: 50, tfc: 50, vdu: 50, uw: 50 },
        ],
        true,
      );

      const dlp1Epoch1Reward = (epochRewardAmount * 20n) / 100n;
      const dlp2Epoch1Reward = (epochRewardAmount * 30n) / 100n;
      const dlp3Epoch1Reward = (epochRewardAmount * 50n) / 100n;

      const dlp1OwnerDlp1Epoch1Reward = dlp1Epoch1Reward;
      const dlp2OwnerDlp2Epoch1Reward = dlp2Epoch1Reward;
      const dlp3OwnerDlp3Epoch1Reward = dlp3Epoch1Reward;

      (await root.stakerDlps(dlp1Owner, 1)).lastClaimedEpochId.should.eq(0);
      (await root.stakerDlps(dlp2Owner, 2)).lastClaimedEpochId.should.eq(0);
      (await root.stakerDlps(dlp3Owner, 3)).lastClaimedEpochId.should.eq(0);

      (await root.dlpEpochs(1, 1)).rewardAmount.should.eq(dlp1Epoch1Reward);
      (await root.dlpEpochs(2, 1)).rewardAmount.should.eq(dlp2Epoch1Reward);
      (await root.dlpEpochs(3, 1)).rewardAmount.should.eq(dlp3Epoch1Reward);

      (await root.claimableAmount(dlp1Owner, 1)).should.eq(
        dlp1OwnerDlp1Epoch1Reward,
      );
      (await root.claimableAmount(dlp2Owner, 2)).should.eq(
        dlp2OwnerDlp2Epoch1Reward,
      );
      (await root.claimableAmount(dlp3Owner, 3)).should.eq(
        dlp3OwnerDlp3Epoch1Reward,
      );

      const dlp1OwnerBalanceBefore =
        await ethers.provider.getBalance(dlp1Owner);
      const dlp2OwnerBalanceBefore =
        await ethers.provider.getBalance(dlp2Owner);
      const dlp3OwnerBalanceBefore =
        await ethers.provider.getBalance(dlp3Owner);

      const tx1 = await root.connect(dlp1Owner).claimReward(1);
      await tx1.should
        .emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(dlp1Owner, 1, 1, dlp1OwnerDlp1Epoch1Reward);
      const tx2 = await root.connect(dlp2Owner).claimReward(2);
      await tx2.should
        .emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(dlp2Owner, 2, 1, dlp2OwnerDlp2Epoch1Reward);
      const tx3 = await root.connect(dlp3Owner).claimReward(3);
      await tx3.should
        .emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(dlp3Owner, 3, 1, dlp3OwnerDlp3Epoch1Reward);

      (await root.stakerDlpEpochs(dlp1Owner, 1, 1)).claimAmount.should.eq(
        dlp1OwnerDlp1Epoch1Reward,
      );
      (await root.stakerDlpEpochs(dlp2Owner, 2, 1)).claimAmount.should.eq(
        dlp2OwnerDlp2Epoch1Reward,
      );
      (await root.stakerDlpEpochs(dlp3Owner, 3, 1)).claimAmount.should.eq(
        dlp3OwnerDlp3Epoch1Reward,
      );

      (await root.stakerDlps(dlp1Owner, 1)).lastClaimedEpochId.should.eq(1);
      (await root.stakerDlps(dlp2Owner, 2)).lastClaimedEpochId.should.eq(1);
      (await root.stakerDlps(dlp3Owner, 3)).lastClaimedEpochId.should.eq(1);

      (await root.claimableAmount(dlp1Owner, 1)).should.eq(0);
      (await root.claimableAmount(dlp2Owner, 2)).should.eq(0);
      (await root.claimableAmount(dlp3Owner, 3)).should.eq(0);

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerBalanceBefore +
          dlp1OwnerDlp1Epoch1Reward -
          (await getReceipt(tx1)).fee,
      );

      (await ethers.provider.getBalance(dlp2Owner)).should.eq(
        dlp2OwnerBalanceBefore +
          dlp2OwnerDlp2Epoch1Reward -
          (await getReceipt(tx2)).fee,
      );

      (await ethers.provider.getBalance(dlp3Owner)).should.eq(
        dlp3OwnerBalanceBefore +
          dlp3OwnerDlp3Epoch1Reward -
          (await getReceipt(tx3)).fee,
      );
    });

    it("should claimReward when only dlpOwners has staked, stakersPercentages != 100%", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, parseEther(25), {
          value: parseEther(100),
        });
      await root
        .connect(dlp2Owner)
        .registerDlp(dlp2, dlp2Owner, parseEther(50), {
          value: parseEther(100),
        });
      await root
        .connect(dlp3Owner)
        .registerDlp(dlp3, dlp3Owner, parseEther(80), {
          value: parseEther(100),
        });

      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      await root.connect(owner).saveEpochPerformances(
        1,
        [
          { dlpId: 1, ttf: 20, tfc: 20, vdu: 20, uw: 20 },
          { dlpId: 2, ttf: 30, tfc: 30, vdu: 30, uw: 30 },
          { dlpId: 3, ttf: 50, tfc: 50, vdu: 50, uw: 50 },
        ],
        true,
      );

      const dlp1Epoch1Reward = (epochRewardAmount * 20n) / 100n;
      const dlp2Epoch1Reward = (epochRewardAmount * 30n) / 100n;
      const dlp3Epoch1Reward = (epochRewardAmount * 50n) / 100n;

      const dlp1OwnerDlp1Epoch1Reward = (dlp1Epoch1Reward * 25n) / 100n;
      const dlp2OwnerDlp2Epoch1Reward = (dlp2Epoch1Reward * 50n) / 100n;
      const dlp3OwnerDlp3Epoch1Reward = (dlp3Epoch1Reward * 80n) / 100n;

      (await root.stakerDlps(dlp1Owner, 1)).lastClaimedEpochId.should.eq(0);
      (await root.stakerDlps(dlp2Owner, 2)).lastClaimedEpochId.should.eq(0);
      (await root.stakerDlps(dlp3Owner, 3)).lastClaimedEpochId.should.eq(0);

      (await root.dlpEpochs(1, 1)).rewardAmount.should.eq(dlp1Epoch1Reward);
      (await root.dlpEpochs(2, 1)).rewardAmount.should.eq(dlp2Epoch1Reward);
      (await root.dlpEpochs(3, 1)).rewardAmount.should.eq(dlp3Epoch1Reward);

      (await root.claimableAmount(dlp1Owner, 1)).should.eq(
        dlp1OwnerDlp1Epoch1Reward,
      );
      (await root.claimableAmount(dlp2Owner, 2)).should.eq(
        dlp2OwnerDlp2Epoch1Reward,
      );
      (await root.claimableAmount(dlp3Owner, 3)).should.eq(
        dlp3OwnerDlp3Epoch1Reward,
      );

      const dlp1OwnerBalanceBefore =
        await ethers.provider.getBalance(dlp1Owner);
      const dlp2OwnerBalanceBefore =
        await ethers.provider.getBalance(dlp2Owner);
      const dlp3OwnerBalanceBefore =
        await ethers.provider.getBalance(dlp3Owner);

      const tx1 = await root.connect(dlp1Owner).claimReward(1);
      await tx1.should
        .emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(dlp1Owner, 1, 1, dlp1OwnerDlp1Epoch1Reward);
      const tx2 = await root.connect(dlp2Owner).claimReward(2);
      await tx2.should
        .emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(dlp2Owner, 2, 1, dlp2OwnerDlp2Epoch1Reward);
      const tx3 = await root.connect(dlp3Owner).claimReward(3);
      await tx3.should
        .emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(dlp3Owner, 3, 1, dlp3OwnerDlp3Epoch1Reward);

      (await root.stakerDlpEpochs(dlp1Owner, 1, 1)).claimAmount.should.eq(
        dlp1OwnerDlp1Epoch1Reward,
      );
      (await root.stakerDlpEpochs(dlp2Owner, 2, 1)).claimAmount.should.eq(
        dlp2OwnerDlp2Epoch1Reward,
      );
      (await root.stakerDlpEpochs(dlp3Owner, 3, 1)).claimAmount.should.eq(
        dlp3OwnerDlp3Epoch1Reward,
      );

      (await root.stakerDlps(dlp1Owner, 1)).lastClaimedEpochId.should.eq(1);
      (await root.stakerDlps(dlp2Owner, 2)).lastClaimedEpochId.should.eq(1);
      (await root.stakerDlps(dlp3Owner, 3)).lastClaimedEpochId.should.eq(1);

      (await root.claimableAmount(dlp1Owner, 1)).should.eq(0);
      (await root.claimableAmount(dlp2Owner, 2)).should.eq(0);
      (await root.claimableAmount(dlp3Owner, 3)).should.eq(0);

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerBalanceBefore +
          dlp1OwnerDlp1Epoch1Reward -
          (await getReceipt(tx1)).fee,
      );

      (await ethers.provider.getBalance(dlp2Owner)).should.eq(
        dlp2OwnerBalanceBefore +
          dlp2OwnerDlp2Epoch1Reward -
          (await getReceipt(tx2)).fee,
      );

      (await ethers.provider.getBalance(dlp3Owner)).should.eq(
        dlp3OwnerBalanceBefore +
          dlp3OwnerDlp3Epoch1Reward -
          (await getReceipt(tx3)).fee,
      );
    });

    it("should claimReward #1", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, parseEther(25), {
          value: parseEther(100),
        });
      await root
        .connect(dlp2Owner)
        .registerDlp(dlp2, dlp2Owner, parseEther(50), {
          value: parseEther(100),
        });
      await root
        .connect(dlp3Owner)
        .registerDlp(dlp3, dlp3Owner, parseEther(80), {
          value: parseEther(100),
        });

      await root.connect(user1).stake(1, { value: parseEther(75) });

      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      await root.connect(owner).saveEpochPerformances(
        1,
        [
          { dlpId: 1, ttf: 20, tfc: 20, vdu: 20, uw: 20 },
          { dlpId: 2, ttf: 30, tfc: 30, vdu: 30, uw: 30 },
          { dlpId: 3, ttf: 50, tfc: 50, vdu: 50, uw: 50 },
        ],
        true,
      );

      const dlp1Epoch1Reward = (epochRewardAmount * 20n) / 100n;
      const dlp2Epoch1Reward = (epochRewardAmount * 30n) / 100n;
      const dlp3Epoch1Reward = (epochRewardAmount * 50n) / 100n;

      const dlp1Epoch1StakersReward = (dlp1Epoch1Reward * 25n) / 100n;
      const dlp2Epoch1StakersReward = (dlp2Epoch1Reward * 50n) / 100n;
      const dlp3Epoch1StakersReward = (dlp3Epoch1Reward * 80n) / 100n;

      (await root.stakerDlps(dlp1Owner, 1)).lastClaimedEpochId.should.eq(0);
      (await root.stakerDlps(dlp2Owner, 2)).lastClaimedEpochId.should.eq(0);
      (await root.stakerDlps(dlp3Owner, 3)).lastClaimedEpochId.should.eq(0);
      (await root.stakerDlps(user1, 1)).lastClaimedEpochId.should.eq(0);

      (await root.dlpEpochs(1, 1)).rewardAmount.should.eq(dlp1Epoch1Reward);
      (await root.dlpEpochs(2, 1)).rewardAmount.should.eq(dlp2Epoch1Reward);
      (await root.dlpEpochs(3, 1)).rewardAmount.should.eq(dlp3Epoch1Reward);

      (await root.claimableAmount(dlp1Owner, 1)).should.eq(
        (dlp1Epoch1StakersReward * 100n) / 175n,
      );
      (await root.claimableAmount(user1, 1)).should.eq(
        (dlp1Epoch1StakersReward * 75n) / 175n,
      );
      (await root.claimableAmount(dlp2Owner, 2)).should.eq(
        dlp2Epoch1StakersReward,
      );
      (await root.claimableAmount(dlp3Owner, 3)).should.eq(
        dlp3Epoch1StakersReward,
      );

      const dlp1OwnerBalanceBefore =
        await ethers.provider.getBalance(dlp1Owner);
      const dlp2OwnerBalanceBefore =
        await ethers.provider.getBalance(dlp2Owner);
      const dlp3OwnerBalanceBefore =
        await ethers.provider.getBalance(dlp3Owner);
      const user1BalanceBefore = await ethers.provider.getBalance(user1);

      const tx1 = await root.connect(dlp1Owner).claimReward(1);
      await tx1.should
        .emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(dlp1Owner, 1, 1, (dlp1Epoch1StakersReward * 100n) / 175n);
      const tx2 = await root.connect(dlp2Owner).claimReward(2);
      await tx2.should
        .emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(dlp2Owner, 2, 1, dlp2Epoch1StakersReward);
      const tx3 = await root.connect(dlp3Owner).claimReward(3);
      await tx3.should
        .emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(dlp3Owner, 3, 1, dlp3Epoch1StakersReward);

      const tx4 = await root.connect(user1).claimReward(1);
      await tx4.should
        .emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(user1, 1, 1, (dlp1Epoch1StakersReward * 75n) / 175n);

      (await root.stakerDlpEpochs(dlp1Owner, 1, 1)).claimAmount.should.eq(
        (dlp1Epoch1StakersReward * 100n) / 175n,
      );
      (await root.stakerDlpEpochs(dlp2Owner, 2, 1)).claimAmount.should.eq(
        dlp2Epoch1StakersReward,
      );
      (await root.stakerDlpEpochs(dlp3Owner, 3, 1)).claimAmount.should.eq(
        dlp3Epoch1StakersReward,
      );

      (await root.stakerDlpEpochs(user1, 1, 1)).claimAmount.should.eq(
        (dlp1Epoch1StakersReward * 75n) / 175n,
      );

      (await root.stakerDlps(dlp1Owner, 1)).lastClaimedEpochId.should.eq(1);
      (await root.stakerDlps(dlp2Owner, 2)).lastClaimedEpochId.should.eq(1);
      (await root.stakerDlps(dlp3Owner, 3)).lastClaimedEpochId.should.eq(1);
      (await root.stakerDlps(user1, 1)).lastClaimedEpochId.should.eq(1);

      (await root.claimableAmount(dlp1Owner, 1)).should.eq(0);
      (await root.claimableAmount(dlp2Owner, 2)).should.eq(0);
      (await root.claimableAmount(dlp3Owner, 3)).should.eq(0);
      (await root.claimableAmount(user1, 1)).should.eq(0);

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerBalanceBefore +
          (dlp1Epoch1StakersReward * 100n) / 175n -
          (await getReceipt(tx1)).fee,
      );

      (await ethers.provider.getBalance(dlp2Owner)).should.eq(
        dlp2OwnerBalanceBefore +
          dlp2Epoch1StakersReward -
          (await getReceipt(tx2)).fee,
      );

      (await ethers.provider.getBalance(dlp3Owner)).should.eq(
        dlp3OwnerBalanceBefore +
          dlp3Epoch1StakersReward -
          (await getReceipt(tx3)).fee,
      );

      (await ethers.provider.getBalance(user1)).should.eq(
        user1BalanceBefore +
          (dlp1Epoch1StakersReward * 75n) / 175n -
          (await getReceipt(tx4)).fee,
      );
    });

    it("should reject claimReward when already claimed", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, parseEther(25), {
          value: parseEther(100),
        });
      await root
        .connect(dlp2Owner)
        .registerDlp(dlp2, dlp2Owner, parseEther(50), {
          value: parseEther(100),
        });
      await root
        .connect(dlp3Owner)
        .registerDlp(dlp3, dlp3Owner, parseEther(80), {
          value: parseEther(100),
        });

      await root.connect(user1).stake(1, { value: parseEther(75) });

      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      await root.connect(owner).saveEpochPerformances(
        1,
        [
          { dlpId: 1, ttf: 20, tfc: 20, vdu: 20, uw: 20 },
          { dlpId: 2, ttf: 30, tfc: 30, vdu: 30, uw: 30 },
          { dlpId: 3, ttf: 50, tfc: 50, vdu: 50, uw: 50 },
        ],
        true,
      );

      await root.connect(dlp2Owner).claimReward(2);
      await root.connect(dlp3Owner).claimReward(3);
      await root.connect(dlp1Owner).claimReward(1);
      await root.connect(user1).claimReward(1);

      (await root.stakerDlps(dlp1Owner, 1)).lastClaimedEpochId.should.eq(1);
      (await root.stakerDlps(dlp2Owner, 2)).lastClaimedEpochId.should.eq(1);
      (await root.stakerDlps(dlp3Owner, 3)).lastClaimedEpochId.should.eq(1);
      (await root.stakerDlps(user1, 1)).lastClaimedEpochId.should.eq(1);

      (await root.claimableAmount(dlp1Owner, 1)).should.eq(0);
      (await root.claimableAmount(dlp2Owner, 2)).should.eq(0);
      (await root.claimableAmount(dlp3Owner, 3)).should.eq(0);
      (await root.claimableAmount(user1, 1)).should.eq(0);

      await root
        .connect(dlp2Owner)
        .claimReward(2)
        .should.be.rejectedWith("NothingToClaim()");
      await root
        .connect(dlp3Owner)
        .claimReward(3)
        .should.be.rejectedWith("NothingToClaim()");
      await root
        .connect(dlp1Owner)
        .claimReward(1)
        .should.be.rejectedWith("NothingToClaim()");
      await root
        .connect(user1)
        .claimReward(1)
        .should.be.rejectedWith("NothingToClaim()");
    });

    it("should reject claimReward when stakersReward = 0", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, parseEther(0), {
          value: parseEther(100),
        });
      await root
        .connect(dlp2Owner)
        .registerDlp(dlp2, dlp2Owner, parseEther(50), {
          value: parseEther(100),
        });
      await root
        .connect(dlp3Owner)
        .registerDlp(dlp3, dlp3Owner, parseEther(80), {
          value: parseEther(100),
        });

      await root.connect(user1).stake(1, { value: parseEther(75) });

      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      await root.connect(owner).saveEpochPerformances(
        1,
        [
          { dlpId: 1, ttf: 20, tfc: 20, vdu: 20, uw: 20 },
          { dlpId: 2, ttf: 30, tfc: 30, vdu: 30, uw: 30 },
          { dlpId: 3, ttf: 50, tfc: 50, vdu: 50, uw: 50 },
        ],
        true,
      );

      await root
        .connect(dlp1Owner)
        .claimReward(1)
        .should.be.rejectedWith("NothingToClaim()");
      await root.connect(dlp2Owner).claimReward(2);
      await root.connect(dlp3Owner).claimReward(3);
      await root
        .connect(user1)
        .claimReward(1)
        .should.be.rejectedWith("NothingToClaim()");

      (await root.stakerDlps(dlp1Owner, 1)).lastClaimedEpochId.should.eq(0);
      (await root.stakerDlps(dlp2Owner, 2)).lastClaimedEpochId.should.eq(1);
      (await root.stakerDlps(dlp3Owner, 3)).lastClaimedEpochId.should.eq(1);
      (await root.stakerDlps(user1, 1)).lastClaimedEpochId.should.eq(0);
    });

    it("should reject claimReward when dlp not in epoch", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, parseEther(50), {
          value: parseEther(100),
        });
      await root
        .connect(dlp2Owner)
        .registerDlp(dlp2, dlp2Owner, parseEther(50), {
          value: parseEther(200),
        });
      await root
        .connect(dlp3Owner)
        .registerDlp(dlp3, dlp3Owner, parseEther(80), {
          value: parseEther(200),
        });
      await root
        .connect(dlp4Owner)
        .registerDlp(dlp4, dlp4Owner, parseEther(80), {
          value: parseEther(200),
        });

      await root.connect(user1).stake(1, { value: parseEther(75) });

      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      await root.connect(owner).saveEpochPerformances(
        1,
        [
          { dlpId: 2, ttf: 20, tfc: 20, vdu: 20, uw: 20 },
          { dlpId: 3, ttf: 30, tfc: 30, vdu: 30, uw: 30 },
          { dlpId: 4, ttf: 50, tfc: 50, vdu: 50, uw: 50 },
        ],
        true,
      );

      await root
        .connect(user1)
        .claimReward(1)
        .should.be.rejectedWith("NothingToClaim()");
      await root
        .connect(dlp1Owner)
        .claimReward(1)
        .should.be.rejectedWith("NothingToClaim()");
    });

    it("should reject claimReward when no staking", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, parseEther(25), {
          value: parseEther(100),
        });
      await root
        .connect(dlp2Owner)
        .registerDlp(dlp2, dlp2Owner, parseEther(50), {
          value: parseEther(100),
        });
      await root
        .connect(dlp3Owner)
        .registerDlp(dlp3, dlp3Owner, parseEther(80), {
          value: parseEther(100),
        });

      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      await root.connect(owner).saveEpochPerformances(
        1,
        [
          { dlpId: 1, ttf: 20, tfc: 20, vdu: 20, uw: 20 },
          { dlpId: 2, ttf: 30, tfc: 30, vdu: 30, uw: 30 },
          { dlpId: 3, ttf: 50, tfc: 50, vdu: 50, uw: 50 },
        ],
        true,
      );

      await root.connect(dlp1Owner).claimReward(1);
      await root.connect(dlp2Owner).claimReward(2);
      await root.connect(dlp3Owner).claimReward(3);
      await root
        .connect(user1)
        .claimReward(1)
        .should.be.rejectedWith("NothingToClaim()");
    });

    it("should claimReward #master test", async function () {
      await root
        .connect(dlp1Owner)
        .registerDlp(dlp1, dlp1Owner, parseEther(25), {
          value: parseEther(100),
        });
      await root
        .connect(dlp2Owner)
        .registerDlp(dlp2, dlp2Owner, parseEther(50), {
          value: parseEther(100),
        });
      await root
        .connect(dlp3Owner)
        .registerDlp(dlp3, dlp3Owner, parseEther(80), {
          value: parseEther(100),
        });
      await root
        .connect(dlp4Owner)
        .registerDlp(dlp4, dlp4Owner, parseEther(10), {
          value: parseEther(100),
        });

      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      await root.connect(user1).stake(1, { value: parseEther(50) });

      await advanceToEpochN(2);
      await root.connect(owner).createEpochs();

      await root.connect(user2).stake(2, { value: parseEther(350) });
      await root.connect(user3).stake(3, { value: parseEther(250) });
      await root.connect(user4).stake(4, { value: parseEther(150) });

      (await root.epochs(1)).dlpIds.should.deep.eq([1, 2, 3]);
      await root.connect(owner).saveEpochPerformances(
        1,
        [
          { dlpId: 1, ttf: 20, tfc: 20, vdu: 20, uw: 20 },
          { dlpId: 2, ttf: 30, tfc: 30, vdu: 30, uw: 30 },
          { dlpId: 3, ttf: 50, tfc: 50, vdu: 50, uw: 50 },
        ],
        true,
      );
      const dlp1Epoch1Reward = (epochRewardAmount * 20n) / 100n;
      const dlp2Epoch1Reward = (epochRewardAmount * 30n) / 100n;
      const dlp3Epoch1Reward = (epochRewardAmount * 50n) / 100n;
      const dlp4Epoch1Reward = (epochRewardAmount * 0n) / 100n;

      (await root.dlpEpochs(1, 1)).rewardAmount.should.eq(dlp1Epoch1Reward);
      (await root.dlpEpochs(2, 1)).rewardAmount.should.eq(dlp2Epoch1Reward);
      (await root.dlpEpochs(3, 1)).rewardAmount.should.eq(dlp3Epoch1Reward);
      (await root.dlpEpochs(4, 1)).rewardAmount.should.eq(dlp4Epoch1Reward);

      const dlp1Epoch1StakersReward = (dlp1Epoch1Reward * 25n) / 100n;
      const dlp2Epoch1StakersReward = (dlp2Epoch1Reward * 50n) / 100n;
      const dlp3Epoch1StakersReward = (dlp3Epoch1Reward * 80n) / 100n;

      const dlp1OwnerDlp1Epoch1Reward = dlp1Epoch1StakersReward;
      const dlp2OwnerDlp2Epoch1Reward = dlp2Epoch1StakersReward;
      const dlp3OwnerDlp3Epoch1Reward = dlp3Epoch1StakersReward;
      const dlp4OwnerDlp4Epoch1Reward = 0n;

      (await root.claimableAmount(dlp1Owner, 1)).should.eq(
        dlp1OwnerDlp1Epoch1Reward,
      );
      (await root.claimableAmount(dlp2Owner, 2)).should.eq(
        dlp2OwnerDlp2Epoch1Reward,
      );
      (await root.claimableAmount(dlp3Owner, 3)).should.eq(
        dlp3OwnerDlp3Epoch1Reward,
      );
      (await root.claimableAmount(dlp4Owner, 4)).should.eq(
        dlp4OwnerDlp4Epoch1Reward,
      );

      await advanceToEpochN(3);
      await root.connect(owner).createEpochs();

      await root.connect(user2).stake(1, { value: parseEther(450) });

      await root
        .connect(dlp1Owner)
        .updateDlpStakersPercentage(1, parseEther(70));

      (await root.epochs(2)).dlpIds.should.deep.eq([1, 2, 3]);
      await root.connect(owner).saveEpochPerformances(
        2,
        [
          { dlpId: 1, ttf: 30, tfc: 30, vdu: 30, uw: 30 },
          { dlpId: 2, ttf: 30, tfc: 30, vdu: 30, uw: 30 },
          { dlpId: 3, ttf: 40, tfc: 40, vdu: 40, uw: 40 },
        ],
        true,
      );
      const dlp1Epoch2Reward = (epochRewardAmount * 30n) / 100n;
      const dlp2Epoch2Reward = (epochRewardAmount * 30n) / 100n;
      const dlp3Epoch2Reward = (epochRewardAmount * 40n) / 100n;
      const dlp4Epoch2Reward = 0;

      (await root.dlpEpochs(1, 2)).rewardAmount.should.eq(dlp1Epoch2Reward);
      (await root.dlpEpochs(2, 2)).rewardAmount.should.eq(dlp2Epoch2Reward);
      (await root.dlpEpochs(3, 2)).rewardAmount.should.eq(dlp3Epoch2Reward);
      (await root.dlpEpochs(4, 2)).rewardAmount.should.eq(dlp4Epoch2Reward);

      const dlp1Epoch2StakersReward = (dlp1Epoch2Reward * 25n) / 100n;
      const dlp2Epoch2StakersReward = (dlp2Epoch2Reward * 50n) / 100n;
      const dlp3Epoch2StakersReward = (dlp3Epoch2Reward * 80n) / 100n;

      const dlp1OwnerDlp1Epoch2Reward =
        (dlp1Epoch2StakersReward * 100n) / (100n + 50n);
      const dlp2OwnerDlp2Epoch2Reward = dlp2Epoch2StakersReward;
      const dlp3OwnerDlp3Epoch2Reward = dlp3Epoch2StakersReward;
      const dlp4OwnerDlp4Epoch2Reward = 0n;
      const user1Dlp1Epoch2Reward =
        (dlp1Epoch2StakersReward * 50n) / (100n + 50n);
      const user2Dlp2Epoch2Reward = 0n;
      const user3Dlp3Epoch2Reward = 0n;
      const user4Dlp4Epoch2Reward = 0n;

      (await root.claimableAmount(dlp1Owner, 1)).should.eq(
        dlp1OwnerDlp1Epoch1Reward + dlp1OwnerDlp1Epoch2Reward,
      );
      (await root.claimableAmount(dlp2Owner, 2)).should.eq(
        dlp2OwnerDlp2Epoch1Reward + dlp2OwnerDlp2Epoch2Reward,
      );
      (await root.claimableAmount(dlp3Owner, 3)).should.eq(
        dlp3OwnerDlp3Epoch1Reward + dlp3OwnerDlp3Epoch2Reward,
      );
      (await root.claimableAmount(dlp4Owner, 4)).should.eq(
        dlp4OwnerDlp4Epoch1Reward + dlp4OwnerDlp4Epoch2Reward,
      );
      (await root.claimableAmount(user1, 1)).should.eq(user1Dlp1Epoch2Reward);
      (await root.claimableAmount(user2, 2)).should.eq(user2Dlp2Epoch2Reward);
      (await root.claimableAmount(user3, 3)).should.eq(user3Dlp3Epoch2Reward);
      (await root.claimableAmount(user4, 4)).should.eq(user4Dlp4Epoch2Reward);

      await advanceToEpochN(5);
      await root.connect(owner).createEpochs();

      (await root.epochs(3)).dlpIds.should.deep.eq([2, 3, 4]);
      await root.connect(owner).saveEpochPerformances(
        3,
        [
          { dlpId: 2, ttf: 80, tfc: 80, vdu: 80, uw: 80 },
          { dlpId: 3, ttf: 10, tfc: 10, vdu: 10, uw: 10 },
          { dlpId: 4, ttf: 10, tfc: 10, vdu: 10, uw: 10 },
        ],
        true,
      );
      const dlp1Epoch3Reward = (epochRewardAmount * 0n) / 100n;
      const dlp2Epoch3Reward = (epochRewardAmount * 80n) / 100n;
      const dlp3Epoch3Reward = (epochRewardAmount * 10n) / 100n;
      const dlp4Epoch3Reward = (epochRewardAmount * 10n) / 100n;

      (await root.dlpEpochs(1, 3)).rewardAmount.should.eq(dlp1Epoch3Reward);
      (await root.dlpEpochs(2, 3)).rewardAmount.should.eq(dlp2Epoch3Reward);
      (await root.dlpEpochs(3, 3)).rewardAmount.should.eq(dlp3Epoch3Reward);
      (await root.dlpEpochs(4, 3)).rewardAmount.should.eq(dlp4Epoch3Reward);

      const dlp2Epoch3StakersReward = (dlp2Epoch3Reward * 50n) / 100n;
      const dlp3Epoch3StakersReward = (dlp3Epoch3Reward * 80n) / 100n;
      const dlp4Epoch3StakersReward = (dlp4Epoch3Reward * 10n) / 100n;

      const dlp1OwnerDlp1Epoch3Reward = 0n;
      const dlp2OwnerDlp2Epoch3Reward =
        (dlp2Epoch3StakersReward * 100n) / (100n + 350n);
      const dlp3OwnerDlp3Epoch3Reward =
        (dlp3Epoch3StakersReward * 100n) / (100n + 250n);
      const dlp4OwnerDlp4Epoch3Reward =
        (dlp4Epoch3StakersReward * 100n) / (100n + 150n);
      const user1Dlp1Epoch3Reward = 0n;
      const user2Dlp2Epoch3Reward =
        (dlp2Epoch3StakersReward * 350n) / (100n + 350n);
      const user3Dlp3Epoch3Reward =
        (dlp3Epoch3StakersReward * 250n) / (100n + 250n);
      const user4Dlp4Epoch3Reward =
        (dlp4Epoch3StakersReward * 150n) / (100n + 150n);

      (await root.claimableAmount(dlp1Owner, 1)).should.eq(
        dlp1OwnerDlp1Epoch1Reward +
          dlp1OwnerDlp1Epoch2Reward +
          dlp1OwnerDlp1Epoch3Reward,
      );
      (await root.claimableAmount(dlp2Owner, 2)).should.eq(
        dlp2OwnerDlp2Epoch1Reward +
          dlp2OwnerDlp2Epoch2Reward +
          dlp2OwnerDlp2Epoch3Reward,
      );
      (await root.claimableAmount(dlp3Owner, 3)).should.to.be.almostEq(
        dlp3OwnerDlp3Epoch1Reward +
          dlp3OwnerDlp3Epoch2Reward +
          dlp3OwnerDlp3Epoch3Reward,
        1000n,
      );
      (await root.claimableAmount(dlp4Owner, 4)).should.eq(
        dlp4OwnerDlp4Epoch1Reward +
          dlp4OwnerDlp4Epoch2Reward +
          dlp4OwnerDlp4Epoch3Reward,
      );
      (await root.claimableAmount(user1, 1)).should.eq(
        user1Dlp1Epoch2Reward + user1Dlp1Epoch3Reward,
      );
      (await root.claimableAmount(user2, 2)).should.eq(
        user2Dlp2Epoch2Reward + user2Dlp2Epoch3Reward,
      );
      (await root.claimableAmount(user3, 3)).should.eq(
        user3Dlp3Epoch2Reward + user3Dlp3Epoch3Reward,
      );
      (await root.claimableAmount(user4, 4)).should.eq(
        user4Dlp4Epoch2Reward + user4Dlp4Epoch3Reward,
      );

      (await root.epochs(4)).dlpIds.should.deep.eq([1, 2, 3]);
      await root.connect(owner).saveEpochPerformances(
        4,
        [
          { dlpId: 1, ttf: 20, tfc: 20, vdu: 20, uw: 20 },
          { dlpId: 2, ttf: 20, tfc: 20, vdu: 20, uw: 20 },
          { dlpId: 3, ttf: 60, tfc: 60, vdu: 60, uw: 60 },
        ],
        true,
      );
      const dlp1Epoch4Reward = (epochRewardAmount * 20n) / 100n;
      const dlp2Epoch4Reward = (epochRewardAmount * 20n) / 100n;
      const dlp3Epoch4Reward = (epochRewardAmount * 60n) / 100n;
      const dlp4Epoch4Reward = 0n;

      (await root.dlpEpochs(1, 4)).rewardAmount.should.eq(dlp1Epoch4Reward);
      (await root.dlpEpochs(2, 4)).rewardAmount.should.eq(dlp2Epoch4Reward);
      (await root.dlpEpochs(3, 4)).rewardAmount.should.eq(dlp3Epoch4Reward);
      (await root.dlpEpochs(4, 4)).rewardAmount.should.eq(dlp4Epoch4Reward);

      const dlp1Epoch4StakersReward = (dlp1Epoch4Reward * 70n) / 100n;
      const dlp2Epoch4StakersReward = (dlp2Epoch4Reward * 50n) / 100n;
      const dlp3Epoch4StakersReward = (dlp3Epoch4Reward * 80n) / 100n;

      const dlp1OwnerDlp1Epoch4Reward =
        (dlp1Epoch4StakersReward * 100n) / (100n + 50n + 450n);
      const dlp2OwnerDlp2Epoch4Reward =
        (dlp2Epoch4StakersReward * 100n) / (100n + 350n);
      const dlp3OwnerDlp3Epoch4Reward =
        (dlp3Epoch4StakersReward * 100n) / (100n + 250n);
      const dlp4OwnerDlp4Epoch4Reward = 0n;
      const user1Dlp1Epoch4Reward =
        (dlp1Epoch4StakersReward * 50n) / (100n + 50n + 450n);
      const user2Dlp1Epoch4Reward =
        (dlp1Epoch4StakersReward * 450n) / (100n + 50n + 450n);
      const user2Dlp2Epoch4Reward =
        (dlp2Epoch4StakersReward * 350n) / (100n + 350n);
      const user3Dlp3Epoch4Reward =
        (dlp3Epoch4StakersReward * 250n) / (100n + 250n);
      const user4Dlp4Epoch4Reward = 0n;

      (await root.claimableAmount(dlp1Owner, 1)).should.eq(
        dlp1OwnerDlp1Epoch1Reward +
          dlp1OwnerDlp1Epoch2Reward +
          dlp1OwnerDlp1Epoch3Reward +
          dlp1OwnerDlp1Epoch4Reward,
      );
      (await root.claimableAmount(dlp2Owner, 2)).should.eq(
        dlp2OwnerDlp2Epoch1Reward +
          dlp2OwnerDlp2Epoch2Reward +
          dlp2OwnerDlp2Epoch3Reward +
          dlp2OwnerDlp2Epoch4Reward,
      );
      (await root.claimableAmount(dlp3Owner, 3)).should.almostEq(
        dlp3OwnerDlp3Epoch1Reward +
          dlp3OwnerDlp3Epoch2Reward +
          dlp3OwnerDlp3Epoch3Reward +
          dlp3OwnerDlp3Epoch4Reward,
      );
      (await root.claimableAmount(dlp4Owner, 4)).should.eq(
        dlp4OwnerDlp4Epoch1Reward +
          dlp4OwnerDlp4Epoch2Reward +
          dlp4OwnerDlp4Epoch3Reward +
          dlp4OwnerDlp4Epoch4Reward,
      );
      (await root.claimableAmount(user1, 1)).should.eq(
        user1Dlp1Epoch2Reward + user1Dlp1Epoch3Reward + user1Dlp1Epoch4Reward,
      );
      (await root.claimableAmount(user2, 1)).should.eq(user2Dlp1Epoch4Reward);
      (await root.claimableAmount(user2, 2)).should.eq(
        user2Dlp2Epoch2Reward + user2Dlp2Epoch3Reward + user2Dlp2Epoch4Reward,
      );
      (await root.claimableAmount(user3, 3)).should.almostEq(
        user3Dlp3Epoch2Reward + user3Dlp3Epoch3Reward + user3Dlp3Epoch4Reward,
      );
      (await root.claimableAmount(user4, 4)).should.eq(
        user4Dlp4Epoch2Reward + user4Dlp4Epoch3Reward + user4Dlp4Epoch4Reward,
      );

      // *****************************

      (await root.stakerDlps(dlp1Owner, 1)).lastClaimedEpochId.should.eq(0);
      (await root.stakerDlps(dlp2Owner, 2)).lastClaimedEpochId.should.eq(0);
      (await root.stakerDlps(dlp3Owner, 3)).lastClaimedEpochId.should.eq(0);
      (await root.stakerDlps(user1, 1)).lastClaimedEpochId.should.eq(1);
      (await root.stakerDlps(user2, 1)).lastClaimedEpochId.should.eq(3);
      (await root.stakerDlps(user2, 2)).lastClaimedEpochId.should.eq(2);
      (await root.stakerDlps(user3, 3)).lastClaimedEpochId.should.eq(2);
      (await root.stakerDlps(user4, 4)).lastClaimedEpochId.should.eq(2);

      const dlp1OwnerBalanceBefore =
        await ethers.provider.getBalance(dlp1Owner);
      const dlp2OwnerBalanceBefore =
        await ethers.provider.getBalance(dlp2Owner);
      const dlp3OwnerBalanceBefore =
        await ethers.provider.getBalance(dlp3Owner);
      const dlp4OwnerBalanceBefore =
        await ethers.provider.getBalance(dlp4Owner);
      const user1BalanceBefore = await ethers.provider.getBalance(user1);
      const user2BalanceBefore = await ethers.provider.getBalance(user2);
      const user3BalanceBefore = await ethers.provider.getBalance(user3);
      const user4BalanceBefore = await ethers.provider.getBalance(user4);

      const tx1 = await root.connect(dlp1Owner).claimReward(1);
      await tx1.should
        .emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(dlp1Owner, 1, 1, dlp1OwnerDlp1Epoch1Reward)
        .and.emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(dlp1Owner, 1, 2, dlp1OwnerDlp1Epoch2Reward)
        .and.emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(dlp1Owner, 1, 4, dlp1OwnerDlp1Epoch4Reward);

      const tx2 = await root.connect(dlp2Owner).claimReward(2);
      await tx2.should
        .emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(dlp2Owner, 2, 1, dlp2OwnerDlp2Epoch1Reward)
        .and.emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(dlp2Owner, 2, 2, dlp2OwnerDlp2Epoch2Reward)
        .and.emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(dlp2Owner, 2, 3, dlp2OwnerDlp2Epoch3Reward)
        .and.emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(dlp2Owner, 2, 4, dlp2OwnerDlp2Epoch4Reward);

      const tx3 = await root.connect(dlp3Owner).claimReward(3);
      await tx3.should
        .emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(dlp3Owner, 3, 1, dlp3OwnerDlp3Epoch1Reward)
        .and.emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(dlp3Owner, 3, 2, dlp3OwnerDlp3Epoch2Reward)
        // .and.emit(root, "StakerDlpEpochRewardClaimed")
        // .withArgs(dlp3Owner, 3, 3, dlp3OwnerDlp3Epoch3Reward)
        .and.emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(dlp3Owner, 3, 4, dlp3OwnerDlp3Epoch4Reward);

      const tx4 = await root.connect(dlp4Owner).claimReward(4);
      await tx4.should
        .emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(dlp4Owner, 4, 3, dlp4OwnerDlp4Epoch3Reward);

      const tx5 = await root.connect(user1).claimReward(1);
      await tx5.should
        .emit(root, "StakerDlpEpochRewardClaimed")
        .and.emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(user1, 1, 2, user1Dlp1Epoch2Reward)
        .and.emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(user1, 1, 4, user1Dlp1Epoch4Reward);

      const tx6 = await root.connect(user2).claimReward(1);
      await tx6.should
        .emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(user2, 1, 4, user2Dlp1Epoch4Reward);

      const tx7 = await root.connect(user2).claimReward(2);
      await tx7.should
        .emit(root, "StakerDlpEpochRewardClaimed")
        .and.emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(user2, 2, 3, user2Dlp2Epoch3Reward)
        .and.emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(user2, 2, 4, user2Dlp2Epoch4Reward);

      const tx8 = await root.connect(user3).claimReward(3);
      await tx8.should
        .emit(root, "StakerDlpEpochRewardClaimed")
        .and.emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(user3, 3, 3, user3Dlp3Epoch3Reward);
      // .and.emit(root, "StakerDlpEpochRewardClaimed")
      // .withArgs(user3, 3, 4, user3Dlp3Epoch4Reward);

      const tx9 = await root.connect(user4).claimReward(4);
      await tx9.should
        .emit(root, "StakerDlpEpochRewardClaimed")
        .and.emit(root, "StakerDlpEpochRewardClaimed")
        .withArgs(user4, 4, 3, user4Dlp4Epoch3Reward);

      (await root.stakerDlpEpochs(dlp1Owner, 1, 1)).claimAmount.should.eq(
        dlp1OwnerDlp1Epoch1Reward,
      );
      (await root.stakerDlpEpochs(dlp1Owner, 1, 2)).claimAmount.should.eq(
        dlp1OwnerDlp1Epoch2Reward,
      );
      (await root.stakerDlpEpochs(dlp1Owner, 1, 3)).claimAmount.should.eq(
        dlp1OwnerDlp1Epoch3Reward,
      );
      (await root.stakerDlpEpochs(dlp1Owner, 1, 4)).claimAmount.should.eq(
        dlp1OwnerDlp1Epoch4Reward,
      );
      (await root.stakerDlpEpochs(dlp2Owner, 2, 1)).claimAmount.should.eq(
        dlp2OwnerDlp2Epoch1Reward,
      );
      (await root.stakerDlpEpochs(dlp2Owner, 2, 2)).claimAmount.should.eq(
        dlp2OwnerDlp2Epoch2Reward,
      );
      (await root.stakerDlpEpochs(dlp2Owner, 2, 3)).claimAmount.should.eq(
        dlp2OwnerDlp2Epoch3Reward,
      );
      (await root.stakerDlpEpochs(dlp2Owner, 2, 4)).claimAmount.should.eq(
        dlp2OwnerDlp2Epoch4Reward,
      );
      (await root.stakerDlpEpochs(dlp3Owner, 3, 1)).claimAmount.should.eq(
        dlp3OwnerDlp3Epoch1Reward,
      );
      (await root.stakerDlpEpochs(dlp3Owner, 3, 2)).claimAmount.should.eq(
        dlp3OwnerDlp3Epoch2Reward,
      );
      (await root.stakerDlpEpochs(dlp3Owner, 3, 3)).claimAmount.should.almostEq(
        dlp3OwnerDlp3Epoch3Reward,
      );
      (await root.stakerDlpEpochs(dlp3Owner, 3, 4)).claimAmount.should.eq(
        dlp3OwnerDlp3Epoch4Reward,
      );
      (await root.stakerDlpEpochs(dlp4Owner, 4, 3)).claimAmount.should.eq(
        dlp4OwnerDlp4Epoch3Reward,
      );
      (await root.stakerDlpEpochs(user1, 1, 2)).claimAmount.should.eq(
        user1Dlp1Epoch2Reward,
      );
      (await root.stakerDlpEpochs(user1, 1, 3)).claimAmount.should.eq(
        user1Dlp1Epoch3Reward,
      );
      (await root.stakerDlpEpochs(user1, 1, 4)).claimAmount.should.eq(
        user1Dlp1Epoch4Reward,
      );
      (await root.stakerDlpEpochs(user2, 1, 4)).claimAmount.should.eq(
        user2Dlp1Epoch4Reward,
      );
      (await root.stakerDlpEpochs(user2, 2, 2)).claimAmount.should.eq(
        user2Dlp2Epoch2Reward,
      );
      (await root.stakerDlpEpochs(user2, 2, 3)).claimAmount.should.eq(
        user2Dlp2Epoch3Reward,
      );
      (await root.stakerDlpEpochs(user2, 2, 4)).claimAmount.should.eq(
        user2Dlp2Epoch4Reward,
      );
      (await root.stakerDlpEpochs(user3, 3, 2)).claimAmount.should.eq(
        user3Dlp3Epoch2Reward,
      );
      (await root.stakerDlpEpochs(user3, 3, 3)).claimAmount.should.eq(
        user3Dlp3Epoch3Reward,
      );
      (await root.stakerDlpEpochs(user3, 3, 4)).claimAmount.should.almostEq(
        user3Dlp3Epoch4Reward,
      );
      (await root.stakerDlpEpochs(user4, 4, 2)).claimAmount.should.eq(
        user4Dlp4Epoch2Reward,
      );
      (await root.stakerDlpEpochs(user4, 4, 3)).claimAmount.should.eq(
        user4Dlp4Epoch3Reward,
      );
      (await root.stakerDlpEpochs(user4, 4, 4)).claimAmount.should.eq(
        user4Dlp4Epoch4Reward,
      );

      (await root.stakerDlps(dlp1Owner, 1)).lastClaimedEpochId.should.eq(4);
      (await root.stakerDlps(dlp2Owner, 2)).lastClaimedEpochId.should.eq(4);
      (await root.stakerDlps(dlp3Owner, 3)).lastClaimedEpochId.should.eq(4);
      (await root.stakerDlps(dlp4Owner, 4)).lastClaimedEpochId.should.eq(4);
      (await root.stakerDlps(user1, 1)).lastClaimedEpochId.should.eq(4);
      (await root.stakerDlps(user2, 1)).lastClaimedEpochId.should.eq(4);
      (await root.stakerDlps(user2, 2)).lastClaimedEpochId.should.eq(4);
      (await root.stakerDlps(user3, 3)).lastClaimedEpochId.should.eq(4);
      (await root.stakerDlps(user4, 4)).lastClaimedEpochId.should.eq(4);

      (await root.claimableAmount(dlp1Owner, 1)).should.eq(0);
      (await root.claimableAmount(dlp2Owner, 2)).should.eq(0);
      (await root.claimableAmount(dlp3Owner, 3)).should.eq(0);
      (await root.claimableAmount(dlp4Owner, 4)).should.eq(0);
      (await root.claimableAmount(user1, 1)).should.eq(0);
      (await root.claimableAmount(user2, 1)).should.eq(0);
      (await root.claimableAmount(user2, 2)).should.eq(0);
      (await root.claimableAmount(user3, 3)).should.eq(0);
      (await root.claimableAmount(user4, 4)).should.eq(0);

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerBalanceBefore +
          dlp1OwnerDlp1Epoch1Reward +
          dlp1OwnerDlp1Epoch2Reward +
          dlp1OwnerDlp1Epoch3Reward +
          dlp1OwnerDlp1Epoch4Reward -
          (await getReceipt(tx1)).fee,
      );

      (await ethers.provider.getBalance(dlp2Owner)).should.eq(
        dlp2OwnerBalanceBefore +
          dlp2OwnerDlp2Epoch1Reward +
          dlp2OwnerDlp2Epoch2Reward +
          dlp2OwnerDlp2Epoch3Reward +
          dlp2OwnerDlp2Epoch4Reward -
          (await getReceipt(tx2)).fee,
      );

      (await ethers.provider.getBalance(dlp3Owner)).should.almostEq(
        dlp3OwnerBalanceBefore +
          dlp3OwnerDlp3Epoch1Reward +
          dlp3OwnerDlp3Epoch2Reward +
          dlp3OwnerDlp3Epoch3Reward +
          dlp3OwnerDlp3Epoch4Reward -
          (await getReceipt(tx3)).fee,
      );

      (await ethers.provider.getBalance(dlp4Owner)).should.eq(
        dlp4OwnerBalanceBefore +
          dlp4OwnerDlp4Epoch1Reward +
          dlp4OwnerDlp4Epoch2Reward +
          dlp4OwnerDlp4Epoch3Reward +
          dlp4OwnerDlp4Epoch4Reward -
          (await getReceipt(tx4)).fee,
      );

      (await ethers.provider.getBalance(user1)).should.eq(
        user1BalanceBefore +
          user1Dlp1Epoch2Reward +
          user1Dlp1Epoch3Reward +
          user1Dlp1Epoch4Reward -
          (await getReceipt(tx5)).fee,
      );

      (await ethers.provider.getBalance(user2)).should.eq(
        user2BalanceBefore +
          user2Dlp1Epoch4Reward +
          user2Dlp2Epoch2Reward +
          user2Dlp2Epoch3Reward +
          user2Dlp2Epoch4Reward -
          (await getReceipt(tx6)).fee -
          (await getReceipt(tx7)).fee,
      );

      (await ethers.provider.getBalance(user3)).should.almostEq(
        user3BalanceBefore +
          user3Dlp3Epoch2Reward +
          user3Dlp3Epoch3Reward +
          user3Dlp3Epoch4Reward -
          (await getReceipt(tx8)).fee,
      );

      (await ethers.provider.getBalance(user4)).should.eq(
        user4BalanceBefore +
          user4Dlp4Epoch2Reward +
          user4Dlp4Epoch3Reward +
          user4Dlp4Epoch4Reward -
          (await getReceipt(tx9)).fee,
      );
    });
  });
});
