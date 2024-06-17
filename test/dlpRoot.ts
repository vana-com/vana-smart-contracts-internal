import chai, { should } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers, upgrades } from "hardhat";
import { BigNumberish, parseEther } from "ethers";
import { DLPT, DataLiquidityPoolsRoot } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { advanceBlockNTimes, advanceNSeconds, advanceTimeAndBlock, advanceToBlockN, getCurrentBlockNumber, getCurrentBlockTimestamp } from "../utils/timeAndBlockManipulation";
import { dlp } from "../typechain-types/contracts";

chai.use(chaiAsPromised);
should();

describe("DataLiquidityPoolsRoot", () => {
  enum DlpStatus {
    None,
    Registered,
    Active,
    Deregistered,
  };

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

  let dlpRoot: DataLiquidityPoolsRoot;

  const maxNumberOfDlps = 9;
  const epochSize = 100;
  const minStakeAmount = parseEther('50');
  let startBlock: number;
  let epochRewardAmount = parseEther('2');

  const dlpInitialBalance = parseEther('0');

  const deploy = async () => {
    [
      deployer, owner, user1, user2, user3,
      dlp1, dlp1Owner, dlp2, dlp2Owner, dlp3, dlp3Owner, dlp4, dlp4Owner, dlp5, dlp5Owner,
    ] = await ethers.getSigners();

    startBlock = await getCurrentBlockNumber() + 1;

    const dlpRootDeploy = await upgrades.deployProxy(
      await ethers.getContractFactory("DataLiquidityPoolsRoot"),
      [[
        owner.address,
        maxNumberOfDlps,
        minStakeAmount,
        startBlock,
        epochSize,
        epochRewardAmount
      ]],
      {
        kind: "uups"
      }
    );

    dlpRoot = await ethers.getContractAt("DataLiquidityPoolsRoot", dlpRootDeploy.target);
  }

  async function advanceToEpochN(epochNumber: number) {
    const epochNStartBlock =
      startBlock + (epochNumber - 1) * epochSize;

    await advanceToBlockN(epochNStartBlock);
  }

  async function registerDlps() {
    await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
    await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
    await dlpRoot.connect(dlp3Owner).registerDlp(dlp3, dlp3Owner, { value: parseEther('100') });
    await dlpRoot.connect(dlp4Owner).registerDlp(dlp4, dlp4Owner, { value: parseEther('100') });
    await dlpRoot.connect(dlp5Owner).registerDlp(dlp5, dlp5Owner, { value: parseEther('100') });

    await dlpRoot.connect(owner).approveDlp(dlp1);
    await dlpRoot.connect(owner).approveDlp(dlp2);
    await dlpRoot.connect(owner).approveDlp(dlp3);
  }

  async function registerDlp() {
    await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
    await dlpRoot.connect(owner).approveDlp(dlp1);

  }

  describe("Setup", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should have correct params after deploy", async function () {
      (await dlpRoot.owner()).should.eq(owner);
      (await dlpRoot.maxNumberOfDlps()).should.eq(maxNumberOfDlps);
      (await dlpRoot.minStakeAmount()).should.eq(minStakeAmount);
      (await dlpRoot.epochSize()).should.eq(epochSize);
      (await dlpRoot.epochRewardAmount()).should.eq(epochRewardAmount);
      (await dlpRoot.paused()).should.eq(false);

      (await dlpRoot.epochsCount()).should.eq(1);

      const epoch = await dlpRoot.epochs(1);
      epoch.startBlock.should.eq(startBlock);
      epoch.endBlock.should.eq(startBlock + epochSize - 1);
      epoch.reward.should.eq(epochRewardAmount);
      epoch.dlpsListId.should.eq(0);
      (await dlpRoot.dlpsCount()).should.eq(0);
      (await dlpRoot.activeDlpsListsCount()).should.eq(0);
    });

    it("Should pause when owner", async function () {
      await dlpRoot.connect(owner).pause()
        .should.emit(dlpRoot, 'Paused')
        .withArgs(owner.address);
      (await dlpRoot.paused()).should.be.equal(true);
    });

    it("Should reject pause when non-owner", async function () {
      await dlpRoot.connect(dlp1)
        .pause()
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1.address}")`
        );
      (await dlpRoot.paused()).should.be.equal(false);
    });

    it("Should unpause when owner", async function () {
      await dlpRoot.connect(owner).pause();
      await dlpRoot.connect(owner).unpause()
        .should.emit(dlpRoot, 'Unpaused')
        .withArgs(owner.address);
      (await dlpRoot.paused()).should.be.equal(false);
    });

    it("Should reject unpause when non-owner", async function () {
      await dlpRoot.connect(owner).pause();
      await dlpRoot.connect(dlp1Owner)
        .unpause()
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1Owner.address}")`
        );
      (await dlpRoot.paused()).should.be.equal(true);
    });

    it("Should updateMaxNumberOfDlps when owner", async function () {
      await dlpRoot.connect(owner).updateMaxNumberOfDlps(123)
        .should.emit(dlpRoot, 'MaxNumberOfDlpsUpdated')
        .withArgs(123);

      (await dlpRoot.maxNumberOfDlps()).should.eq(123);
    });

    it("Should reject updateMaxNumberOfDlps when non-owner", async function () {
      await dlpRoot.connect(dlp1).updateMaxNumberOfDlps(123)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1.address}")`
        );

      (await dlpRoot.maxNumberOfDlps()).should.eq(maxNumberOfDlps);
    });

    it("Should updateEpochSize when owner", async function () {
      await dlpRoot.connect(owner).updateEpochSize(123)
        .should.emit(dlpRoot, 'EpochSizeUpdated')
        .withArgs(123);

      (await dlpRoot.epochSize()).should.eq(123);
    });

    it("Should reject updateEpochSize when non-owner", async function () {
      await dlpRoot.connect(dlp1).updateEpochSize(123)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1.address}")`
        );

      (await dlpRoot.epochSize()).should.eq(epochSize);
    });

    it("Should updateEpochRewardAmount when owner", async function () {
      (await dlpRoot.epochs(1)).reward.should.eq(epochRewardAmount);

      await dlpRoot.connect(owner).updateEpochRewardAmount(123)
        .should.emit(dlpRoot, 'EpochRewardAmountUpdated')
        .withArgs(123);

      (await dlpRoot.epochRewardAmount()).should.eq(123);

      (await dlpRoot.epochs(1)).reward.should.eq(123);
    });

    it("Should updateEpochRewardAmount starting with the current epoch", async function () {
      await advanceToEpochN(3);
      (await dlpRoot.epochs(1)).reward.should.eq(epochRewardAmount);

      await dlpRoot.connect(owner).updateEpochRewardAmount(123)
        .should.emit(dlpRoot, 'EpochRewardAmountUpdated')
        .withArgs(123);

      (await dlpRoot.epochRewardAmount()).should.eq(123);

      await advanceToEpochN(5);
      await dlpRoot.connect(dlp1).createEpochs();

      (await dlpRoot.epochs(1)).reward.should.eq(epochRewardAmount);
      (await dlpRoot.epochs(2)).reward.should.eq(epochRewardAmount);
      (await dlpRoot.epochs(3)).reward.should.eq(123);
      (await dlpRoot.epochs(4)).reward.should.eq(123);
      (await dlpRoot.epochs(5)).reward.should.eq(123);

    });

    it("Should reject updateEpochSize when non-owner", async function () {
      await dlpRoot.connect(dlp1).updateEpochRewardAmount(123)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1.address}")`
        );

      (await dlpRoot.epochRewardAmount()).should.eq(epochRewardAmount);
    });

    it("Should updateMinStakeAmount when owner", async function () {
      await dlpRoot.connect(owner).updateMinStakeAmount(parseEther('0.2'))
        .should.emit(dlpRoot, 'MinStakeAmountUpdated')
        .withArgs(parseEther('0.2'));

      (await dlpRoot.minStakeAmount()).should.eq(parseEther('0.2'));
    });

    it("Should reject updateMinStakeAmount when non-owner", async function () {
      await dlpRoot.connect(dlp1).updateMinStakeAmount(parseEther('0.2'))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1.address}")`
        );

      (await dlpRoot.minStakeAmount()).should.eq(minStakeAmount);
    });

    it("Should transferOwnership in 2 steps", async function () {
      await dlpRoot.connect(owner).transferOwnership(user2.address)
        .should.emit(dlpRoot, "OwnershipTransferStarted")
        .withArgs(owner, user2);
      (await dlpRoot.owner()).should.eq(owner);

      await dlpRoot.connect(owner).transferOwnership(user3.address)
        .should.emit(dlpRoot, "OwnershipTransferStarted")
        .withArgs(owner, user3);
      (await dlpRoot.owner()).should.eq(owner);

      await dlpRoot.connect(user3).acceptOwnership()
        .should.emit(dlpRoot, "OwnershipTransferred");

      (await dlpRoot.owner()).should.eq(user3);
    });

    it("Should reject transferOwnership when non-owner", async function () {
      await dlpRoot.connect(dlp1Owner)
        .transferOwnership(user2)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1Owner.address}")`
        );
    });
  });

  describe("Epochs", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should createEpochs after the end of the previous one", async function () {
      await advanceToEpochN(2);

      const epoch1 = await dlpRoot.epochs(1);
      epoch1.startBlock.should.eq(startBlock);
      epoch1.endBlock.should.eq(startBlock + epochSize - 1);
      epoch1.reward.should.eq(epochRewardAmount);
      epoch1.dlpsListId.should.eq(0);

      let epoch2 = await dlpRoot.epochs(2);
      epoch2.startBlock.should.eq(0);
      epoch2.endBlock.should.eq(0);
      epoch2.reward.should.eq(0);
      epoch2.dlpsListId.should.eq(0);

      await dlpRoot.connect(owner).createEpochs()
        .should.emit(dlpRoot, 'EpochCreated')
        .withArgs(2);

      (await dlpRoot.epochsCount()).should.eq(2);

      epoch2 = await dlpRoot.epochs(2);
      epoch2.startBlock.should.eq(startBlock + epochSize);
      epoch2.endBlock.should.eq(startBlock + 2 * epochSize - 1);
      epoch2.reward.should.eq(epochRewardAmount);
      epoch2.dlpsListId.should.eq(0);
    });

    it("should createEpochs after long time", async function () {
      await advanceToEpochN(4);
      await dlpRoot.connect(owner).createEpochs().should
        .emit(dlpRoot, 'EpochCreated').withArgs(2)
        .emit(dlpRoot, 'EpochCreated').withArgs(3)
        .emit(dlpRoot, 'EpochCreated').withArgs(4);

      (await dlpRoot.epochsCount()).should.eq(4);

      const epoch2 = await dlpRoot.epochs(2);
      epoch2.startBlock.should.eq(startBlock + epochSize);
      epoch2.endBlock.should.eq(startBlock + 2 * epochSize - 1);
      epoch2.reward.should.eq(epochRewardAmount);
      epoch2.dlpsListId.should.eq(0);

      const epoch3 = await dlpRoot.epochs(3);
      epoch3.startBlock.should.eq(startBlock + 2 * epochSize);
      epoch3.endBlock.should.eq(startBlock + 3 * epochSize - 1);
      epoch3.reward.should.eq(epochRewardAmount);
      epoch3.dlpsListId.should.eq(0);

      const epoch4 = await dlpRoot.epochs(4);
      epoch4.startBlock.should.eq(startBlock + 3 * epochSize);
      epoch4.endBlock.should.eq(startBlock + 4 * epochSize - 1);
      epoch4.reward.should.eq(epochRewardAmount);
      epoch4.dlpsListId.should.eq(0);
    });

    it("should createEpochsUntilBlockNumber after long time", async function () {
      await advanceToEpochN(7);

      const epoch4StartBlock = startBlock + 3 * epochSize;
      await dlpRoot.connect(owner).createEpochsUntilBlockNumber(epoch4StartBlock).should
        .emit(dlpRoot, 'EpochCreated').withArgs(2)
        .emit(dlpRoot, 'EpochCreated').withArgs(3)
        .emit(dlpRoot, 'EpochCreated').withArgs(4);

      (await dlpRoot.epochsCount()).should.eq(4);

      const epoch2 = await dlpRoot.epochs(2);
      epoch2.startBlock.should.eq(startBlock + epochSize);
      epoch2.endBlock.should.eq(startBlock + 2 * epochSize - 1);
      epoch2.reward.should.eq(epochRewardAmount);
      epoch2.dlpsListId.should.eq(0);

      const epoch3 = await dlpRoot.epochs(3);
      epoch3.startBlock.should.eq(startBlock + 2 * epochSize);
      epoch3.endBlock.should.eq(startBlock + 3 * epochSize - 1);
      epoch3.reward.should.eq(epochRewardAmount);
      epoch3.dlpsListId.should.eq(0);

      const epoch4 = await dlpRoot.epochs(4);
      epoch4.startBlock.should.eq(startBlock + 3 * epochSize);
      epoch4.endBlock.should.eq(startBlock + 4 * epochSize - 1);
      epoch4.reward.should.eq(epochRewardAmount);
      epoch4.dlpsListId.should.eq(0);
    });

    it("should create epochs with no active dlps", async function () {
      await advanceToEpochN(3);
      await dlpRoot.connect(owner).createEpochs();

      for (let i = 1; i <= 2; i++) {
        (await dlpRoot.epochs(i)).dlpsListId.should.eq(0);
      }
    });

    it("should createRewardPeriods without staking", async function () {
      await advanceToEpochN(3);

      await dlpRoot.connect(owner).updateMinStakeAmount(0);

      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp2);

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.6'), parseEther('0.4')]);

      await advanceToEpochN(4);

      await dlpRoot.connect(dlp1)
        .createEpochs()
        .should.emit(dlpRoot, 'EpochCreated').withArgs(4)

      const epoch4 = await dlpRoot.epochs(4);
      epoch4.startBlock.should.eq(startBlock + 3 * epochSize);
      epoch4.endBlock.should.eq(startBlock + 4 * epochSize - 1);
      epoch4.reward.should.eq(epochRewardAmount);
      epoch4.dlpsListId.should.eq(2);
    });
  });

  describe("Dlps - registration", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should registerDlp", async function () {
      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const tx = await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      const receipt = await tx.wait();

      await tx.should.emit(dlpRoot, 'DlpRegistered')
        .withArgs(dlp1.address, dlp1Owner.address, parseEther('100'));

      (await dlpRoot.dlpsCount()).should.eq(1);


      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);

      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.ownerAddress.should.eq(dlp1Owner.address);
      dlp1Info.stakeAmount.should.eq(parseEther('100'));
      dlp1Info.status.should.eq(DlpStatus.Registered);
      dlp1Info.grantedAmount.should.eq(0);
      dlp1Info.firstBlockNumber.should.eq(0);
      dlp1Info.lastBlockNumber.should.eq(0);

      (await dlpRoot.dlpsCount()).should.eq(1);
      (await dlpRoot.dlps(1)).should.deep.eq(dlp1Info);

      (await dlpRoot.activeDlpsListsCount()).should.eq(0);

      (await dlpRoot.totalStaked()).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance - parseEther('100') - BigInt(receipt.gasUsed * tx.gasPrice));
      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance + parseEther('100'));
    });

    it("should registerDlp as sponsor", async function () {
      const user1InitialBalance = await ethers.provider.getBalance(user1);
      const tx = await dlpRoot.connect(user1).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      const receipt = await tx.wait();

      await tx.should.emit(dlpRoot, 'DlpRegistered')
        .withArgs(dlp1.address, dlp1Owner.address, parseEther('100'));

      (await dlpRoot.dlpsCount()).should.eq(1);

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);

      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.ownerAddress.should.eq(dlp1Owner.address);
      dlp1Info.stakeAmount.should.eq(parseEther('100'));
      dlp1Info.status.should.eq(DlpStatus.Registered);
      dlp1Info.grantedAmount.should.eq(0);
      dlp1Info.firstBlockNumber.should.eq(0);
      dlp1Info.lastBlockNumber.should.eq(0);

      (await dlpRoot.dlpsCount()).should.eq(1);
      (await dlpRoot.dlps(1)).should.deep.eq(dlp1Info);

      (await dlpRoot.activeDlpsListsCount()).should.eq(0);

      (await dlpRoot.totalStaked()).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(user1)).should.eq(user1InitialBalance - parseEther('100') - BigInt(receipt.gasUsed * tx.gasPrice));
      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance + parseEther('100'));
    });

    it("should registerDlp as DLP owner", async function () {
      const ownerInitialBalance = await ethers.provider.getBalance(owner);
      const tx = await dlpRoot.connect(owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      const receipt = await tx.wait();

      await tx.should.emit(dlpRoot, 'DlpRegistered')
        .withArgs(dlp1.address, dlp1Owner.address, parseEther('100'));

      (await dlpRoot.dlpsCount()).should.eq(1);

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);

      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.ownerAddress.should.eq(dlp1Owner.address);
      dlp1Info.stakeAmount.should.eq(parseEther('100'));
      dlp1Info.status.should.eq(DlpStatus.Registered);
      dlp1Info.grantedAmount.should.eq(parseEther('100'));
      dlp1Info.firstBlockNumber.should.eq(0);
      dlp1Info.lastBlockNumber.should.eq(0);

      (await dlpRoot.dlpsCount()).should.eq(1);
      (await dlpRoot.dlps(1)).should.deep.eq(dlp1Info);

      (await dlpRoot.activeDlpsListsCount()).should.eq(0);

      (await dlpRoot.totalStaked()).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(owner)).should.eq(ownerInitialBalance - parseEther('100') - BigInt(receipt.gasUsed * tx.gasPrice));
      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance + parseEther('100'));
    });

    it("should registerDlp many times", async function () {
      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const dlp2OwnerInitialBalance = await ethers.provider.getBalance(dlp2Owner);
      const dlp3OwnerInitialBalance = await ethers.provider.getBalance(dlp3Owner);

      const tx1 = await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });

      const receipt1 = await tx1.wait();

      const tx2 = await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('200') });
      const receipt2 = await tx2.wait();
      const tx3 = await dlpRoot.connect(dlp3Owner).registerDlp(dlp3, dlp3Owner, { value: parseEther('300') });
      const receipt3 = await tx3.wait();

      await tx1.should.emit(dlpRoot, 'DlpRegistered').withArgs(dlp1.address, dlp1Owner.address, parseEther('100'));
      await tx2.should.emit(dlpRoot, 'DlpRegistered').withArgs(dlp2.address, dlp2Owner.address, parseEther('200'));
      await tx3.should.emit(dlpRoot, 'DlpRegistered').withArgs(dlp3.address, dlp3Owner.address, parseEther('300'));

      (await dlpRoot.dlpsCount()).should.eq(3);

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.ownerAddress.should.eq(dlp1Owner.address);
      dlp1Info.stakeAmount.should.eq(parseEther('100'));
      dlp1Info.status.should.eq(DlpStatus.Registered);
      dlp1Info.grantedAmount.should.eq(0);
      dlp1Info.firstBlockNumber.should.eq(0);
      dlp1Info.lastBlockNumber.should.eq(0);

      const dlp2Info = await dlpRoot.dlpsInfo(dlp2);
      dlp2Info.dlpAddress.should.eq(dlp2);
      dlp2Info.ownerAddress.should.eq(dlp2Owner.address);
      dlp2Info.stakeAmount.should.eq(parseEther('200'));
      dlp2Info.status.should.eq(DlpStatus.Registered);
      dlp2Info.grantedAmount.should.eq(0);
      dlp2Info.firstBlockNumber.should.eq(0);
      dlp2Info.lastBlockNumber.should.eq(0);

      const dlp3Info = await dlpRoot.dlpsInfo(dlp3);
      dlp3Info.dlpAddress.should.eq(dlp3);
      dlp3Info.ownerAddress.should.eq(dlp3Owner.address);
      dlp3Info.stakeAmount.should.eq(parseEther('300'));
      dlp3Info.status.should.eq(DlpStatus.Registered);
      dlp3Info.grantedAmount.should.eq(0);
      dlp3Info.firstBlockNumber.should.eq(0);
      dlp3Info.lastBlockNumber.should.eq(0);

      (await dlpRoot.dlpsCount()).should.eq(3);
      (await dlpRoot.dlps(1)).should.deep.eq(dlp1Info);
      (await dlpRoot.dlps(2)).should.deep.eq(dlp2Info);
      (await dlpRoot.dlps(3)).should.deep.eq(dlp3Info);

      (await dlpRoot.activeDlpsListsCount()).should.eq(0);

      (await dlpRoot.totalStaked()).should.eq(parseEther('100') + parseEther('200') + parseEther('300'));

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance - parseEther('100') - BigInt(receipt1.gasUsed * tx1.gasPrice));
      (await ethers.provider.getBalance(dlp2Owner)).should.eq(dlp2OwnerInitialBalance - parseEther('200') - BigInt(receipt2.gasUsed * tx2.gasPrice));
      (await ethers.provider.getBalance(dlp3Owner)).should.eq(dlp3OwnerInitialBalance - parseEther('300') - BigInt(receipt3.gasUsed * tx3.gasPrice));
      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance + parseEther('100') + parseEther('200') + parseEther('300'));
    });

    it("Should reject registerDlp when paused", async function () {
      await dlpRoot.connect(owner).pause();
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('1') })
        .should.be.rejectedWith(
          `EnforcedPause()`
        );
    });

    it("Should reject registerDlp when stake amount too small", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('1') })
        .should.be.rejectedWith(
          `InvalidStakeAmount()`
        );
    });

    it("Should reject registerDlp when already registered", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') })
        .should.be.rejectedWith(
          `InvalidDlpStatus()`
        );
    });

    it("Should reject registerDlp when already approved", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') })
        .should.be.rejectedWith(
          `InvalidDlpStatus()`
        );
    });

    it("Should reject registerDlp when deregistered", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(dlp1Owner).deregisterDlp(dlp1);
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') })
        .should.be.rejectedWith(
          `InvalidDlpStatus()`
        );
    });

    it("Should reject registerDlp when deregistered", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(dlp1Owner).deregisterDlp(dlp1);
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') })
        .should.be.rejectedWith(
          `InvalidDlpStatus()`
        );
    });

    it("should approveDlp when owner", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1)
        .should.emit(dlpRoot, 'DlpApproved')
        .withArgs(dlp1.address);

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.status.should.eq(DlpStatus.Active);
      dlp1Info.firstBlockNumber.should.eq(await getCurrentBlockNumber());
      dlp1Info.lastBlockNumber.should.eq(0);

      (await dlpRoot.dlpsCount()).should.eq(1);
      (await dlpRoot.dlps(1)).should.deep.eq(dlp1Info);

      (await dlpRoot.activeDlpsListsCount()).should.eq(1);
      (await await dlpRoot.activeDlpsLists(1)).should.deep.eq([dlp1.address]);

      (await dlpRoot.epochs(1)).dlpsListId.should.eq(1);
    });

    it("should approve many dlps", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('200') });
      await dlpRoot.connect(dlp3Owner).registerDlp(dlp3, dlp3Owner, { value: parseEther('300') });
      await dlpRoot.connect(dlp4Owner).registerDlp(dlp4, dlp4Owner, { value: parseEther('400') });
      await dlpRoot.connect(dlp5Owner).registerDlp(dlp5, dlp5Owner, { value: parseEther('500') });

      const currentBlockNumber = await getCurrentBlockNumber();

      await dlpRoot.connect(owner).approveDlp(dlp1).should.emit(dlpRoot, 'DlpApproved').withArgs(dlp1.address);
      await dlpRoot.connect(owner).approveDlp(dlp2).should.emit(dlpRoot, 'DlpApproved').withArgs(dlp2.address);
      await dlpRoot.connect(owner).approveDlp(dlp3).should.emit(dlpRoot, 'DlpApproved').withArgs(dlp3.address);

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.status.should.eq(DlpStatus.Active);
      dlp1Info.firstBlockNumber.should.eq(currentBlockNumber + 1);
      dlp1Info.lastBlockNumber.should.eq(0);

      const dlp2Info = await dlpRoot.dlpsInfo(dlp2);
      dlp2Info.dlpAddress.should.eq(dlp2);
      dlp2Info.status.should.eq(DlpStatus.Active);
      dlp2Info.firstBlockNumber.should.eq(currentBlockNumber + 2);
      dlp2Info.lastBlockNumber.should.eq(0);

      const dlp3Info = await dlpRoot.dlpsInfo(dlp3);
      dlp3Info.dlpAddress.should.eq(dlp3);
      dlp3Info.status.should.eq(DlpStatus.Active);
      dlp3Info.firstBlockNumber.should.eq(currentBlockNumber + 3);
      dlp3Info.lastBlockNumber.should.eq(0);

      const dlp4Info = await dlpRoot.dlpsInfo(dlp4);
      dlp4Info.dlpAddress.should.eq(dlp4);
      dlp4Info.status.should.eq(DlpStatus.Registered);
      dlp4Info.firstBlockNumber.should.eq(0);
      dlp4Info.lastBlockNumber.should.eq(0);

      const dlp5Info = await dlpRoot.dlpsInfo(dlp5);
      dlp5Info.dlpAddress.should.eq(dlp5);
      dlp5Info.status.should.eq(DlpStatus.Registered);
      dlp5Info.firstBlockNumber.should.eq(0);

      (await dlpRoot.dlpsCount()).should.eq(5);
      (await dlpRoot.dlps(1)).should.deep.eq(dlp1Info);
      (await dlpRoot.dlps(2)).should.deep.eq(dlp2Info);
      (await dlpRoot.dlps(3)).should.deep.eq(dlp3Info);
      (await dlpRoot.dlps(4)).should.deep.eq(dlp4Info);
      (await dlpRoot.dlps(5)).should.deep.eq(dlp5Info);

      (await dlpRoot.activeDlpsListsCount()).should.eq(3);
      (await dlpRoot.activeDlpsLists(1)).should.deep.eq([dlp1.address]);
      (await dlpRoot.activeDlpsLists(2)).should.deep.eq([dlp1.address, dlp2.address]);
      (await dlpRoot.activeDlpsLists(3)).should.deep.eq([dlp1.address, dlp2.address, dlp3.address]);

      (await dlpRoot.epochs(1)).dlpsListId.should.eq(3);
    });

    it("Should reject approveDlp when non-owner", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp1Owner).approveDlp(dlp1)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1Owner.address}")`
        );
    });

    it("Should reject approveDlp when already approved", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp1)
        .should.be.rejectedWith(
          `InvalidDlpStatus()`
        );
    });

    it("Should reject approveDlp when not registered", async function () {
      await dlpRoot.connect(owner).approveDlp(dlp1)
        .should.be.rejectedWith(
          `InvalidDlpStatus()`
        );
    });

    it("Should reject approveDlp when deregistered", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(dlp1Owner).deregisterDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp1)
        .should.be.rejectedWith(
          `InvalidDlpStatus()`
        );
    });

    it("should createEpochs when approving dlps", async function () {
      await advanceToEpochN(4);

      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') }).should.be.fulfilled

      await dlpRoot.connect(owner).approveDlp(dlp1).should
        .emit(dlpRoot, 'DlpApproved').withArgs(dlp1.address)
        .emit(dlpRoot, 'EpochCreated').withArgs(2)
        .emit(dlpRoot, 'EpochCreated').withArgs(3)
        .emit(dlpRoot, 'EpochCreated').withArgs(4);

      (await dlpRoot.epochsCount()).should.eq(4);

      const epoch2 = await dlpRoot.epochs(2);
      epoch2.startBlock.should.eq(startBlock + epochSize);
      epoch2.endBlock.should.eq(startBlock + 2 * epochSize - 1);
      epoch2.reward.should.eq(epochRewardAmount);
      epoch2.dlpsListId.should.eq(0);

      const epoch3 = await dlpRoot.epochs(3);
      epoch3.startBlock.should.eq(startBlock + 2 * epochSize);
      epoch3.endBlock.should.eq(startBlock + 3 * epochSize - 1);
      epoch3.reward.should.eq(epochRewardAmount);
      epoch3.dlpsListId.should.eq(0);

      const epoch4 = await dlpRoot.epochs(4);
      epoch4.startBlock.should.eq(startBlock + 3 * epochSize);
      epoch4.endBlock.should.eq(startBlock + 4 * epochSize - 1);
      epoch4.reward.should.eq(epochRewardAmount);
      epoch4.dlpsListId.should.eq(1);
    });

    it("should approve dlps in separate epochs", async function () {
      await advanceToEpochN(2);

      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') }).should.be.fulfilled
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('200') }).should.be.fulfilled
      await dlpRoot.connect(dlp3Owner).registerDlp(dlp3, dlp3Owner, { value: parseEther('300') }).should.be.fulfilled
      await dlpRoot.connect(dlp4Owner).registerDlp(dlp4, dlp4Owner, { value: parseEther('400') }).should.be.fulfilled
      await dlpRoot.connect(dlp5Owner).registerDlp(dlp5, dlp5Owner, { value: parseEther('500') }).should.be.fulfilled

      await dlpRoot.connect(owner).approveDlp(dlp1).should
        .emit(dlpRoot, 'DlpApproved').withArgs(dlp1.address)
        .emit(dlpRoot, 'EpochCreated').withArgs(2);

      await dlpRoot.connect(owner).approveDlp(dlp2).should
        .emit(dlpRoot, 'DlpApproved').withArgs(dlp2.address);;

      await advanceToEpochN(5);

      await dlpRoot.connect(owner).approveDlp(dlp3).should
        .emit(dlpRoot, 'DlpApproved').withArgs(dlp3.address)
        .emit(dlpRoot, 'EpochCreated').withArgs(3)
        .emit(dlpRoot, 'EpochCreated').withArgs(4)
        .emit(dlpRoot, 'EpochCreated').withArgs(5);

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.status.should.eq(DlpStatus.Active);

      const dlp2Info = await dlpRoot.dlpsInfo(dlp2);
      dlp2Info.dlpAddress.should.eq(dlp2);
      dlp2Info.status.should.eq(DlpStatus.Active);

      const dlp3Info = await dlpRoot.dlpsInfo(dlp3);
      dlp3Info.dlpAddress.should.eq(dlp3);
      dlp3Info.status.should.eq(DlpStatus.Active);

      const dlp4Info = await dlpRoot.dlpsInfo(dlp4);
      dlp4Info.dlpAddress.should.eq(dlp4);
      dlp4Info.status.should.eq(DlpStatus.Registered);
      dlp4Info.firstBlockNumber.should.eq(0);
      dlp4Info.lastBlockNumber.should.eq(0);

      const dlp5Info = await dlpRoot.dlpsInfo(dlp5);
      dlp5Info.dlpAddress.should.eq(dlp5);
      dlp5Info.status.should.eq(DlpStatus.Registered);
      dlp5Info.firstBlockNumber.should.eq(0);

      (await dlpRoot.dlpsCount()).should.eq(5);
      (await dlpRoot.dlps(1)).should.deep.eq(dlp1Info);
      (await dlpRoot.dlps(2)).should.deep.eq(dlp2Info);
      (await dlpRoot.dlps(3)).should.deep.eq(dlp3Info);
      (await dlpRoot.dlps(4)).should.deep.eq(dlp4Info);
      (await dlpRoot.dlps(5)).should.deep.eq(dlp5Info);

      (await dlpRoot.activeDlpsListsCount()).should.eq(3);
      const activeDlpsList1 = await dlpRoot.activeDlpsLists(1);
      (await activeDlpsList1).should.deep.eq([dlp1.address]);

      const activeDlpsList2 = await dlpRoot.activeDlpsLists(2);
      (await activeDlpsList2).should.deep.eq([dlp1.address, dlp2.address]);

      const activeDlpsList3 = await dlpRoot.activeDlpsLists(3);
      (await activeDlpsList3).should.deep.eq([dlp1.address, dlp2.address, dlp3.address]);

      (await dlpRoot.epochsCount()).should.eq(5);
      const epoch1 = await dlpRoot.epochs(1);
      epoch1.dlpsListId.should.eq(0);

      const epoch2 = await dlpRoot.epochs(2);
      epoch2.dlpsListId.should.eq(2);

      const epoch3 = await dlpRoot.epochs(3);
      epoch3.dlpsListId.should.eq(2);

      const epoch4 = await dlpRoot.epochs(4);
      epoch4.dlpsListId.should.eq(2);

      const epoch5 = await dlpRoot.epochs(5);
      epoch5.dlpsListId.should.eq(3);
    });

    it("should deregisterDlp when dlp owner", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);

      (await dlpRoot.totalStaked()).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance + parseEther('100'));

      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const tx = await dlpRoot.connect(dlp1Owner).deregisterDlp(dlp1);
      const receipt = await tx.wait();

      await tx.should.emit(dlpRoot, 'DlpDeregistered').withArgs(dlp1.address);

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.lastBlockNumber.should.eq(await getCurrentBlockNumber());

      (await dlpRoot.dlpsCount()).should.eq(1);
      (await dlpRoot.dlps(1)).should.deep.eq(dlp1Info);

      (await dlpRoot.activeDlpsListsCount()).should.eq(2);

      const activeDlpsList1 = await dlpRoot.activeDlpsLists(1);
      (await activeDlpsList1).should.deep.eq([dlp1.address]);

      const activeDlpsList2 = await dlpRoot.activeDlpsLists(2);
      (await activeDlpsList2).should.deep.eq([]);

      (await dlpRoot.totalStaked()).should.eq(0);

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance + parseEther('100') - BigInt(receipt.gasUsed * tx.gasPrice));
      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance);
    });

    it("should deregisterDlp when granted", async function () {
      await dlpRoot.connect(owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);

      (await dlpRoot.totalStaked()).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance + parseEther('100'));

      await dlpRoot.connect(dlp1Owner).deregisterDlp(dlp1).should
        .emit(dlpRoot, 'DlpDeregistered').withArgs(dlp1.address);

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.lastBlockNumber.should.eq(await getCurrentBlockNumber());
      dlp1Info.grantedAmount.should.eq(parseEther('100'));

      (await dlpRoot.dlpsCount()).should.eq(1);
      (await dlpRoot.dlps(1)).should.deep.eq(dlp1Info);

      (await dlpRoot.activeDlpsListsCount()).should.eq(2);

      const activeDlpsList1 = await dlpRoot.activeDlpsLists(1);
      (await activeDlpsList1).should.deep.eq([dlp1.address]);

      const activeDlpsList2 = await dlpRoot.activeDlpsLists(2);
      (await activeDlpsList2).should.deep.eq([]);

      (await dlpRoot.totalStaked()).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance + parseEther('100'));
    });

    it("Should reject deregisterDlp when non dlp owner", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);

      await dlpRoot.connect(owner).deregisterDlp(dlp1)
        .should.be.rejectedWith('NotDlpOwner');

      await dlpRoot.connect(dlp1).deregisterDlp(dlp1)
        .should.be.rejectedWith('NotDlpOwner');

      await dlpRoot.connect(user1).deregisterDlp(dlp1)
        .should.be.rejectedWith('NotDlpOwner');
    });

    it("Should reject deregisterDlp when deregistered", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);

      await dlpRoot.connect(dlp1Owner).deregisterDlp(dlp1);

      await dlpRoot.connect(dlp1Owner).deregisterDlp(dlp1)
        .should.be.rejectedWith(`InvalidDlpStatus()`);
    });

    it("should deregisterDlp #multiple dlps", async function () {
      await registerDlps();

      (await dlpRoot.totalStaked()).should.eq(5n * parseEther('100'));

      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance + 5n * parseEther('100'));

      const currentBlockNumber = await getCurrentBlockNumber();

      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const tx = await dlpRoot.connect(dlp1Owner).deregisterDlp(dlp1);
      const receipt = await tx.wait();

      await tx.should.emit(dlpRoot, 'DlpDeregistered').withArgs(dlp1.address);

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.lastBlockNumber.should.eq(currentBlockNumber + 1);

      const dlp2Info = await dlpRoot.dlpsInfo(dlp2);
      dlp2Info.status.should.eq(DlpStatus.Active);
      dlp2Info.lastBlockNumber.should.eq(0);

      const dlp3Info = await dlpRoot.dlpsInfo(dlp3);
      dlp3Info.status.should.eq(DlpStatus.Active);
      dlp3Info.lastBlockNumber.should.eq(0);

      const dlp4Info = await dlpRoot.dlpsInfo(dlp4);
      dlp4Info.status.should.eq(DlpStatus.Registered);

      const dlp5Info = await dlpRoot.dlpsInfo(dlp5);
      dlp5Info.status.should.eq(DlpStatus.Registered);

      (await dlpRoot.dlpsCount()).should.eq(5);
      (await dlpRoot.dlps(1)).should.deep.eq(dlp1Info);
      (await dlpRoot.dlps(2)).should.deep.eq(dlp2Info);
      (await dlpRoot.dlps(3)).should.deep.eq(dlp3Info);
      (await dlpRoot.dlps(4)).should.deep.eq(dlp4Info);
      (await dlpRoot.dlps(5)).should.deep.eq(dlp5Info);

      (await dlpRoot.activeDlpsListsCount()).should.eq(4);

      const activeDlpsList1 = await dlpRoot.activeDlpsLists(1);
      (await activeDlpsList1).should.deep.eq([dlp1.address]);

      const activeDlpsList2 = await dlpRoot.activeDlpsLists(2);
      (await activeDlpsList2).should.deep.eq([dlp1.address, dlp2.address]);

      const activeDlpsList3 = await dlpRoot.activeDlpsLists(3);
      (await activeDlpsList3).should.deep.eq([dlp1.address, dlp2.address, dlp3.address]);

      const activeDlpsList4 = await dlpRoot.activeDlpsLists(4);
      (await activeDlpsList4).should.deep.eq([dlp2.address, dlp3.address]);

      (await dlpRoot.totalStaked()).should.eq(4n * parseEther('100'));

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance + parseEther('100') - BigInt(receipt.gasUsed * tx.gasPrice));
      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance + 4n * parseEther('100'));
    });

    it("should deregisterDlp when dlp owner #multiple dlps 2", async function () {
      await registerDlps();

      const currentBlockNumber = await getCurrentBlockNumber();

      await dlpRoot.connect(dlp2Owner).deregisterDlp(dlp2)
        .should.emit(dlpRoot, 'DlpDeregistered')
        .withArgs(dlp2.address);

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.status.should.eq(DlpStatus.Active);
      dlp1Info.lastBlockNumber.should.eq(0);

      const dlp2Info = await dlpRoot.dlpsInfo(dlp2);
      dlp2Info.status.should.eq(DlpStatus.Deregistered);
      dlp2Info.lastBlockNumber.should.eq(currentBlockNumber + 1);

      const dlp3Info = await dlpRoot.dlpsInfo(dlp3);
      dlp3Info.status.should.eq(DlpStatus.Active);
      dlp3Info.lastBlockNumber.should.eq(0);

      const dlp4Info = await dlpRoot.dlpsInfo(dlp4);
      dlp4Info.status.should.eq(DlpStatus.Registered);

      const dlp5Info = await dlpRoot.dlpsInfo(dlp5);
      dlp5Info.status.should.eq(DlpStatus.Registered);

      (await dlpRoot.dlpsCount()).should.eq(5);
      (await dlpRoot.dlps(1)).should.deep.eq(dlp1Info);
      (await dlpRoot.dlps(2)).should.deep.eq(dlp2Info);
      (await dlpRoot.dlps(3)).should.deep.eq(dlp3Info);
      (await dlpRoot.dlps(4)).should.deep.eq(dlp4Info);
      (await dlpRoot.dlps(5)).should.deep.eq(dlp5Info);

      (await dlpRoot.activeDlpsListsCount()).should.eq(4);

      const activeDlpsList1 = await dlpRoot.activeDlpsLists(1);
      (await activeDlpsList1).should.deep.eq([dlp1.address]);

      const activeDlpsList2 = await dlpRoot.activeDlpsLists(2);
      (await activeDlpsList2).should.deep.eq([dlp1.address, dlp2.address]);

      const activeDlpsList3 = await dlpRoot.activeDlpsLists(3);
      (await activeDlpsList3).should.deep.eq([dlp1.address, dlp2.address, dlp3.address]);

      const activeDlpsList4 = await dlpRoot.activeDlpsLists(4);
      (await activeDlpsList4).should.deep.eq([dlp1.address, dlp3.address]);
    });

    it("should deregisterDlpByOwner when dlp owner", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);

      (await dlpRoot.totalStaked()).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance + parseEther('100'));

      const ownerInitialBalance = await ethers.provider.getBalance(owner);
      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);

      const tx = await dlpRoot.connect(owner).deregisterDlpByOwner(dlp1, parseEther('100'));
      const receipt = await tx.wait();

      await tx.should
        .emit(dlpRoot, 'DlpDeregistered').withArgs(dlp1.address)
        .emit(dlpRoot, 'DlpDeregisteredByOwner').withArgs(dlp1.address, parseEther('100'), parseEther('0'));

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.lastBlockNumber.should.eq(await getCurrentBlockNumber());

      (await dlpRoot.dlpsCount()).should.eq(1);
      (await dlpRoot.dlps(1)).should.deep.eq(dlp1Info);

      (await dlpRoot.activeDlpsListsCount()).should.eq(2);

      const activeDlpsList1 = await dlpRoot.activeDlpsLists(1);
      (await activeDlpsList1).should.deep.eq([dlp1.address]);

      const activeDlpsList2 = await dlpRoot.activeDlpsLists(2);
      (await activeDlpsList2).should.deep.eq([]);

      (await dlpRoot.totalStaked()).should.eq(0);

      (await ethers.provider.getBalance(owner)).should.eq(ownerInitialBalance - BigInt(receipt.gasUsed * tx.gasPrice));
      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance + parseEther('100'));
      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance);
    });


    it("should deregisterDlpByOwner when granted #full unstake amount", async function () {
      await dlpRoot.connect(owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);

      (await dlpRoot.totalStaked()).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance + parseEther('100'));

      const ownerInitialBalance = await ethers.provider.getBalance(owner);
      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);

      const tx = await dlpRoot.connect(owner).deregisterDlpByOwner(dlp1, parseEther('100'));
      const receipt = await tx.wait();

      await tx.should
        .emit(dlpRoot, 'DlpDeregisteredByOwner').withArgs(dlp1.address, parseEther('100'), parseEther('0'))
        .emit(dlpRoot, 'DlpDeregistered').withArgs(dlp1.address);

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.lastBlockNumber.should.eq(await getCurrentBlockNumber());
      dlp1Info.grantedAmount.should.eq(parseEther('100'));

      (await dlpRoot.dlpsCount()).should.eq(1);
      (await dlpRoot.dlps(1)).should.deep.eq(dlp1Info);

      (await dlpRoot.activeDlpsListsCount()).should.eq(2);

      const activeDlpsList1 = await dlpRoot.activeDlpsLists(1);
      (await activeDlpsList1).should.deep.eq([dlp1.address]);

      const activeDlpsList2 = await dlpRoot.activeDlpsLists(2);
      (await activeDlpsList2).should.deep.eq([]);

      (await dlpRoot.totalStaked()).should.eq(parseEther('0'));

      (await ethers.provider.getBalance(owner)).should.eq(ownerInitialBalance - BigInt(receipt.gasUsed * tx.gasPrice));
      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance + parseEther('100'));
      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance);
    });

    it("should deregisterDlpByOwner when granted #partial unstake amount", async function () {
      await dlpRoot.connect(owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);

      (await dlpRoot.totalStaked()).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance + parseEther('100'));
      const ownerInitialBalance = await ethers.provider.getBalance(owner);
      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);

      const tx = await dlpRoot.connect(owner).deregisterDlpByOwner(dlp1, parseEther('40'));
      const receipt = await tx.wait();

      await tx.should
        .emit(dlpRoot, 'DlpDeregisteredByOwner').withArgs(dlp1.address, parseEther('40'), parseEther('60'))
        .emit(dlpRoot, 'DlpDeregistered').withArgs(dlp1.address);

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.lastBlockNumber.should.eq(await getCurrentBlockNumber());
      dlp1Info.grantedAmount.should.eq(parseEther('100'));

      (await dlpRoot.dlpsCount()).should.eq(1);
      (await dlpRoot.dlps(1)).should.deep.eq(dlp1Info);

      (await dlpRoot.activeDlpsListsCount()).should.eq(2);

      const activeDlpsList1 = await dlpRoot.activeDlpsLists(1);
      (await activeDlpsList1).should.deep.eq([dlp1.address]);

      const activeDlpsList2 = await dlpRoot.activeDlpsLists(2);
      (await activeDlpsList2).should.deep.eq([]);

      (await dlpRoot.totalStaked()).should.eq(parseEther('0'));

      (await ethers.provider.getBalance(owner)).should.eq(ownerInitialBalance + parseEther('60') - BigInt(receipt.gasUsed * tx.gasPrice));
      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance + parseEther('40'));
      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance);
    });

    it("should deregisterDlpByOwner when granted #no unstake amount #2", async function () {
      await dlpRoot.connect(owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);

      (await dlpRoot.totalStaked()).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance + parseEther('100'));

      const ownerInitialBalance = await ethers.provider.getBalance(owner);
      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const tx = await dlpRoot.connect(owner).deregisterDlpByOwner(dlp1, parseEther('0'));
      const receipt = await tx.wait();

      await tx.should
        .emit(dlpRoot, 'DlpDeregisteredByOwner').withArgs(dlp1.address, parseEther('0'), parseEther('100'))
        .emit(dlpRoot, 'DlpDeregistered').withArgs(dlp1.address);

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.lastBlockNumber.should.eq(await getCurrentBlockNumber());
      dlp1Info.grantedAmount.should.eq(parseEther('100'));

      (await dlpRoot.dlpsCount()).should.eq(1);
      (await dlpRoot.dlps(1)).should.deep.eq(dlp1Info);

      (await dlpRoot.activeDlpsListsCount()).should.eq(2);

      const activeDlpsList1 = await dlpRoot.activeDlpsLists(1);
      (await activeDlpsList1).should.deep.eq([dlp1.address]);

      const activeDlpsList2 = await dlpRoot.activeDlpsLists(2);
      (await activeDlpsList2).should.deep.eq([]);

      (await dlpRoot.totalStaked()).should.eq(parseEther('0'));


      (await ethers.provider.getBalance(owner)).should.eq(ownerInitialBalance + parseEther('100') - BigInt(receipt.gasUsed * tx.gasPrice));
      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance);
      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance);
    });

    it("should deregisterDlpByOwner when granted and deregistered", async function () {
      await dlpRoot.connect(owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);

      (await dlpRoot.totalStaked()).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance + parseEther('100'));

      await dlpRoot.connect(dlp1Owner).deregisterDlp(dlp1).should
        .emit(dlpRoot, 'DlpDeregistered').withArgs(dlp1.address);

      const ownerInitialBalance = await ethers.provider.getBalance(owner);
      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);

      const tx = await dlpRoot.connect(owner).deregisterDlpByOwner(dlp1, parseEther('40'));
      const receipt = await tx.wait();

      await tx.should
        .emit(dlpRoot, 'DlpDeregisteredByOwner').withArgs(dlp1.address, parseEther('40'), parseEther('60'));

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.lastBlockNumber.should.eq(await getCurrentBlockNumber() - 1);
      dlp1Info.grantedAmount.should.eq(parseEther('100'));

      (await dlpRoot.dlpsCount()).should.eq(1);
      (await dlpRoot.dlps(1)).should.deep.eq(dlp1Info);

      (await dlpRoot.activeDlpsListsCount()).should.eq(2);

      const activeDlpsList1 = await dlpRoot.activeDlpsLists(1);
      (await activeDlpsList1).should.deep.eq([dlp1.address]);

      const activeDlpsList2 = await dlpRoot.activeDlpsLists(2);
      (await activeDlpsList2).should.deep.eq([]);

      (await dlpRoot.totalStaked()).should.eq(parseEther('0'));

      (await ethers.provider.getBalance(owner)).should.eq(ownerInitialBalance + parseEther('60') - BigInt(receipt.gasUsed * tx.gasPrice));
      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance + parseEther('40'));
      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance);
    });

    it("Should reject deregisterDlpByOwner when non dlp owner", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);

      await dlpRoot.connect(dlp1Owner).deregisterDlpByOwner(dlp1, parseEther('100'))
        .should.be.rejectedWith(`OwnableUnauthorizedAccount("${dlp1Owner.address}")`);

      await dlpRoot.connect(dlp1).deregisterDlpByOwner(dlp1, parseEther('100'))
        .should.be.rejectedWith(`OwnableUnauthorizedAccount("${dlp1.address}")`);

      await dlpRoot.connect(user1).deregisterDlpByOwner(dlp1, parseEther('100'))
        .should.be.rejectedWith(`OwnableUnauthorizedAccount("${user1.address}")`);
    });

    it("Should reject deregisterDlpByOwner when stakeAmount = 0", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);

      await dlpRoot.connect(dlp1Owner).deregisterDlp(dlp1);

      await dlpRoot.connect(owner).deregisterDlpByOwner(dlp1, parseEther('100'))
        .should.be.rejectedWith(`InvalidStakeAmount()`);
    });

    it("should deregisterDlpByOwner #multiple dlps 1", async function () {
      await registerDlps();

      (await dlpRoot.totalStaked()).should.eq(5n * parseEther('100'));

      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance + 5n * parseEther('100'));

      const currentBlockNumber = await getCurrentBlockNumber();

      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      await dlpRoot.connect(owner).deregisterDlpByOwner(dlp1, parseEther('100'))
        .should.emit(dlpRoot, 'DlpDeregistered')
        .withArgs(dlp1.address);

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.lastBlockNumber.should.eq(currentBlockNumber + 1);

      const dlp2Info = await dlpRoot.dlpsInfo(dlp2);
      dlp2Info.status.should.eq(DlpStatus.Active);
      dlp2Info.lastBlockNumber.should.eq(0);

      const dlp3Info = await dlpRoot.dlpsInfo(dlp3);
      dlp3Info.status.should.eq(DlpStatus.Active);
      dlp3Info.lastBlockNumber.should.eq(0);

      const dlp4Info = await dlpRoot.dlpsInfo(dlp4);
      dlp4Info.status.should.eq(DlpStatus.Registered);

      const dlp5Info = await dlpRoot.dlpsInfo(dlp5);
      dlp5Info.status.should.eq(DlpStatus.Registered);

      (await dlpRoot.dlpsCount()).should.eq(5);
      (await dlpRoot.dlps(1)).should.deep.eq(dlp1Info);
      (await dlpRoot.dlps(2)).should.deep.eq(dlp2Info);
      (await dlpRoot.dlps(3)).should.deep.eq(dlp3Info);
      (await dlpRoot.dlps(4)).should.deep.eq(dlp4Info);
      (await dlpRoot.dlps(5)).should.deep.eq(dlp5Info);

      (await dlpRoot.activeDlpsListsCount()).should.eq(4);

      const activeDlpsList1 = await dlpRoot.activeDlpsLists(1);
      (await activeDlpsList1).should.deep.eq([dlp1.address]);

      const activeDlpsList2 = await dlpRoot.activeDlpsLists(2);
      (await activeDlpsList2).should.deep.eq([dlp1.address, dlp2.address]);

      const activeDlpsList3 = await dlpRoot.activeDlpsLists(3);
      (await activeDlpsList3).should.deep.eq([dlp1.address, dlp2.address, dlp3.address]);

      const activeDlpsList4 = await dlpRoot.activeDlpsLists(4);
      (await activeDlpsList4).should.deep.eq([dlp2.address, dlp3.address]);

      (await dlpRoot.totalStaked()).should.eq(4n * parseEther('100'));

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance + parseEther('100'));
      (await ethers.provider.getBalance(dlpRoot)).should.eq(dlpInitialBalance + 4n * parseEther('100'));
    });

    it("should deregisterDlpByOwner when dlp owner #multiple dlps 2", async function () {
      await registerDlps();

      const currentBlockNumber = await getCurrentBlockNumber();

      await dlpRoot.connect(owner).deregisterDlpByOwner(dlp2, parseEther('100'))
        .should.emit(dlpRoot, 'DlpDeregistered')
        .withArgs(dlp2.address);

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.status.should.eq(DlpStatus.Active);
      dlp1Info.lastBlockNumber.should.eq(0);

      const dlp2Info = await dlpRoot.dlpsInfo(dlp2);
      dlp2Info.status.should.eq(DlpStatus.Deregistered);
      dlp2Info.lastBlockNumber.should.eq(currentBlockNumber + 1);

      const dlp3Info = await dlpRoot.dlpsInfo(dlp3);
      dlp3Info.status.should.eq(DlpStatus.Active);
      dlp3Info.lastBlockNumber.should.eq(0);

      const dlp4Info = await dlpRoot.dlpsInfo(dlp4);
      dlp4Info.status.should.eq(DlpStatus.Registered);

      const dlp5Info = await dlpRoot.dlpsInfo(dlp5);
      dlp5Info.status.should.eq(DlpStatus.Registered);

      (await dlpRoot.dlpsCount()).should.eq(5);
      (await dlpRoot.dlps(1)).should.deep.eq(dlp1Info);
      (await dlpRoot.dlps(2)).should.deep.eq(dlp2Info);
      (await dlpRoot.dlps(3)).should.deep.eq(dlp3Info);
      (await dlpRoot.dlps(4)).should.deep.eq(dlp4Info);
      (await dlpRoot.dlps(5)).should.deep.eq(dlp5Info);

      (await dlpRoot.activeDlpsListsCount()).should.eq(4);

      const activeDlpsList1 = await dlpRoot.activeDlpsLists(1);
      (await activeDlpsList1).should.deep.eq([dlp1.address]);

      const activeDlpsList2 = await dlpRoot.activeDlpsLists(2);
      (await activeDlpsList2).should.deep.eq([dlp1.address, dlp2.address]);

      const activeDlpsList3 = await dlpRoot.activeDlpsLists(3);
      (await activeDlpsList3).should.deep.eq([dlp1.address, dlp2.address, dlp3.address]);

      const activeDlpsList4 = await dlpRoot.activeDlpsLists(4);
      (await activeDlpsList4).should.deep.eq([dlp1.address, dlp3.address]);
    });
  });

  describe("Score & Rewards", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should updateScores", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp2);

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.score.should.eq(parseEther('0.25'));

      const dlp2Info = await dlpRoot.dlpsInfo(dlp2);
      dlp2Info.score.should.eq(parseEther('0.75'));
    });

    it("should reject updateScores when non-owner", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp2);

      await dlpRoot.connect(dlp1Owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')])
        .should.be.rejectedWith(`OwnableUnauthorizedAccount("${dlp1Owner.address}")`);

      await dlpRoot.connect(user1).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')])
        .should.be.rejectedWith(`OwnableUnauthorizedAccount("${user1.address}")`);
    });

    it("should reject updateScores when total score != 1 #1", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp2);

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.7')])
        .should.be.rejectedWith(`InvalidScores`);
    });

    it("should reject updateScores when total score != 1 #2", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);

      await dlpRoot.connect(owner).updateScores([dlp1], [parseEther('0.9')])
        .should.be.rejectedWith(`InvalidScores`);
    });

    it("should reject updateScores when arity mismatch #1", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp2);

      await dlpRoot.connect(owner).updateScores([dlp1], [parseEther('0.9')])
        .should.be.rejectedWith(`ArityMismatch`);
    });

    it("should reject updateScores when arity mismatch #2", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp2);

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2, dlp3], [parseEther('0.2'), parseEther('0.3'), parseEther('0.5')])
        .should.be.rejectedWith(`ArityMismatch`);
    });

    it("should reject updateScores when arity mismatch #3", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp2);

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.2'), parseEther('0.3'), parseEther('0.5')])
        .should.be.rejectedWith(`ArityMismatch`);
    });

    it("should reject updateScores when valiadaor not active", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp2);

      await dlpRoot.connect(owner).updateScores([dlp1, dlp3], [parseEther('0.2'), parseEther('0.8')])
        .should.be.rejectedWith(`InvalidDlpStatus`);
    });

    it("should send rewards to dlps", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp2);

      await dlpRoot.addRewardForDlps({ value: parseEther('100') });
      await dlpRoot.totalDlpsRewardAmount().should.eventually.eq(parseEther('100'));

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(2);

      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const dlp2OwnerInitialBalance = await ethers.provider.getBalance(dlp2Owner);
      await dlpRoot.createEpochs();

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.score.should.eq(parseEther('0.25'));

      const dlp2Info = await dlpRoot.dlpsInfo(dlp2);
      dlp2Info.score.should.eq(parseEther('0.75'));

      const epoch1 = await dlpRoot.epochs(1);

      const epoch1Rewards = await dlpRoot.epochRewards(1);
      epoch1Rewards.dlps.should.deep.eq([dlp1.address, dlp2.address]);
      epoch1Rewards.scores.should.deep.eq([parseEther('0.25'), parseEther('0.75')]);
      epoch1Rewards.withdrawnAmounts.should.deep.eq([
        parseEther('0.25') * epoch1.reward / parseEther('1'),
        parseEther('0.75') * epoch1.reward / parseEther('1')
      ]);
      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance + parseEther('0.25') * epoch1.reward / parseEther('1'));
      (await ethers.provider.getBalance(dlp2Owner)).should.eq(dlp2OwnerInitialBalance + parseEther('0.75') * epoch1.reward / parseEther('1'));
    });


    it("should send rewards to dlps #multiple epochs", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp2);

      await dlpRoot.addRewardForDlps({ value: parseEther('100') });
      await dlpRoot.totalDlpsRewardAmount().should.eventually.eq(parseEther('100'));

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(3);

      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const dlp2OwnerInitialBalance = await ethers.provider.getBalance(dlp2Owner);
      await dlpRoot.createEpochs();

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.score.should.eq(parseEther('0.25'));

      const dlp2Info = await dlpRoot.dlpsInfo(dlp2);
      dlp2Info.score.should.eq(parseEther('0.75'));

      const epoch1Rewards = await dlpRoot.epochRewards(1);
      epoch1Rewards.dlps.should.deep.eq([dlp1.address, dlp2.address]);
      epoch1Rewards.scores.should.deep.eq([parseEther('0.25'), parseEther('0.75')]);
      epoch1Rewards.withdrawnAmounts.should.deep.eq([
        parseEther('0.25') * epochRewardAmount / parseEther('1'),
        parseEther('0.75') * epochRewardAmount / parseEther('1')
      ]);

      const epoch2Rewards = await dlpRoot.epochRewards(1);
      epoch2Rewards.dlps.should.deep.eq([dlp1.address, dlp2.address]);
      epoch2Rewards.scores.should.deep.eq([parseEther('0.25'), parseEther('0.75')]);
      epoch2Rewards.withdrawnAmounts.should.deep.eq([
        parseEther('0.25') * epochRewardAmount / parseEther('1'),
        parseEther('0.75') * epochRewardAmount / parseEther('1')
      ]);

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance + 2n * (parseEther('0.25') * epochRewardAmount / parseEther('1')));
      (await ethers.provider.getBalance(dlp2Owner)).should.eq(dlp2OwnerInitialBalance + 2n * (parseEther('0.75') * epochRewardAmount / parseEther('1')));
    });

    it("should send rewards #multiple epochs, scores updated", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp2);

      await dlpRoot.addRewardForDlps({ value: parseEther('100') });
      await dlpRoot.totalDlpsRewardAmount().should.eventually.eq(parseEther('100'));

      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const dlp2OwnerInitialBalance = await ethers.provider.getBalance(dlp2Owner);

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(2);

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.5'), parseEther('0.5')]);

      await advanceToEpochN(3);

      await dlpRoot.createEpochs();

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.score.should.eq(parseEther('0.5'));

      const dlp2Info = await dlpRoot.dlpsInfo(dlp2);
      dlp2Info.score.should.eq(parseEther('.5'));

      const epoch1Rewards = await dlpRoot.epochRewards(1);
      epoch1Rewards.dlps.should.deep.eq([dlp1.address, dlp2.address]);
      epoch1Rewards.scores.should.deep.eq([parseEther('0.25'), parseEther('0.75')]);
      epoch1Rewards.withdrawnAmounts.should.deep.eq([
        parseEther('0.25') * epochRewardAmount / parseEther('1'),
        parseEther('0.75') * epochRewardAmount / parseEther('1')
      ]);

      const epoch2Rewards = await dlpRoot.epochRewards(2);
      epoch2Rewards.dlps.should.deep.eq([dlp1.address, dlp2.address]);
      epoch2Rewards.scores.should.deep.eq([parseEther('0.5'), parseEther('0.5')]);
      epoch2Rewards.withdrawnAmounts.should.deep.eq([
        parseEther('0.5') * epochRewardAmount / parseEther('1'),
        parseEther('0.5') * epochRewardAmount / parseEther('1')
      ]);

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerInitialBalance +
        (parseEther('0.25') * epochRewardAmount / parseEther('1')) +
        (parseEther('0.5') * epochRewardAmount / parseEther('1'))
      );
      (await ethers.provider.getBalance(dlp2Owner)).should.eq(
        dlp2OwnerInitialBalance +
        (parseEther('0.75') * epochRewardAmount / parseEther('1')) +
        (parseEther('0.5') * epochRewardAmount / parseEther('1'))
      );
    });

    it("should send rewards #multiple epochs, scores updated, epochReward updated", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp2);

      await dlpRoot.addRewardForDlps({ value: parseEther('100') });
      await dlpRoot.totalDlpsRewardAmount().should.eventually.eq(parseEther('100'));

      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const dlp2OwnerInitialBalance = await ethers.provider.getBalance(dlp2Owner);

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(2);

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.5'), parseEther('0.5')]);
      await dlpRoot.connect(owner).updateEpochRewardAmount(epochRewardAmount * 2n);

      await advanceToEpochN(3);

      await dlpRoot.createEpochs();

      const epoch1 = await dlpRoot.epochs(1);
      epoch1.reward.should.eq(epochRewardAmount);

      const epoch2 = await dlpRoot.epochs(2);
      epoch2.reward.should.eq(epochRewardAmount * 2n);

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.score.should.eq(parseEther('0.5'));

      const dlp2Info = await dlpRoot.dlpsInfo(dlp2);
      dlp2Info.score.should.eq(parseEther('.5'));

      const epoch1Rewards = await dlpRoot.epochRewards(1);
      epoch1Rewards.dlps.should.deep.eq([dlp1.address, dlp2.address]);
      epoch1Rewards.scores.should.deep.eq([parseEther('0.25'), parseEther('0.75')]);
      epoch1Rewards.withdrawnAmounts.should.deep.eq([
        parseEther('0.25') * epochRewardAmount / parseEther('1'),
        parseEther('0.75') * epochRewardAmount / parseEther('1')
      ]);

      const epoch2Rewards = await dlpRoot.epochRewards(2);
      epoch2Rewards.dlps.should.deep.eq([dlp1.address, dlp2.address]);
      epoch2Rewards.scores.should.deep.eq([parseEther('0.5'), parseEther('0.5')]);
      epoch2Rewards.withdrawnAmounts.should.deep.eq([
        parseEther('0.5') * epochRewardAmount * 2n / parseEther('1'),
        parseEther('0.5') * epochRewardAmount * 2n / parseEther('1')
      ]);

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(
        dlp1OwnerInitialBalance +
        (parseEther('0.25') * epochRewardAmount / parseEther('1')) +
        (parseEther('0.5') * epochRewardAmount * 2n / parseEther('1'))
      );
      (await ethers.provider.getBalance(dlp2Owner)).should.eq(
        dlp2OwnerInitialBalance +
        (parseEther('0.75') * epochRewardAmount / parseEther('1')) +
        (parseEther('0.5') * epochRewardAmount * 2n / parseEther('1'))
      );
    });

    it("should save epoch scores when no rewards", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp2);

      await dlpRoot.totalDlpsRewardAmount().should.eventually.eq(0);

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(2);

      await dlpRoot.createEpochs();

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.score.should.eq(parseEther('0.25'));

      const dlp2Info = await dlpRoot.dlpsInfo(dlp2);
      dlp2Info.score.should.eq(parseEther('0.75'));

      const epoch1Rewards = await dlpRoot.epochRewards(1);
      epoch1Rewards.dlps.should.deep.eq([dlp1.address, dlp2.address]);
      epoch1Rewards.scores.should.deep.eq([parseEther('0.25'), parseEther('0.75')]);
      epoch1Rewards.withdrawnAmounts.should.deep.eq([parseEther('0'), parseEther('0')]);
    });

    it("should create epochs when updating scores #1", async function () {
      await advanceToEpochN(3);

      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp2);

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(4);

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2], [parseEther('1'), parseEther('0')]);

      const epoch1 = await dlpRoot.epochs(1);
      epoch1.dlpsListId.should.eq(0);

      const epoch2 = await dlpRoot.epochs(2);
      epoch2.dlpsListId.should.eq(0);

      const epoch3 = await dlpRoot.epochs(3);
      epoch3.dlpsListId.should.not.eq(0);
    });

    it("should create epochs when updating scores #2", async function () {
      await advanceToEpochN(3);

      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp2);

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.5'), parseEther('0.5')]);

      await advanceToEpochN(4);

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.2'), parseEther('0.8')]);

      for (let i = 1; i <= 2; i++) {
        const epoch = await dlpRoot.epochs(i);
        epoch.dlpsListId.should.eq(0);
      }

      const epoch3 = await dlpRoot.epochs(3);
      epoch3.dlpsListId.should.not.eq(0);
    });

    it("Should reject claimUnsentReward when non dlp owner", async function () {
      await dlpRoot.connect(dlp1Owner).claimUnsentReward(dlp1, 1).should.be.rejectedWith(`NotDlpOwner()`);
    });

    it("should claimUnsentReward", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp2);

      await dlpRoot.totalDlpsRewardAmount().should.eventually.eq(0);

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(2);

      await dlpRoot.createEpochs();

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.score.should.eq(parseEther('0.25'));

      const dlp2Info = await dlpRoot.dlpsInfo(dlp2);
      dlp2Info.score.should.eq(parseEther('0.75'));

      const epoch1Rewards = await dlpRoot.epochRewards(1);
      epoch1Rewards.dlps.should.deep.eq([dlp1.address, dlp2.address]);
      epoch1Rewards.scores.should.deep.eq([parseEther('0.25'), parseEther('0.75')]);
      epoch1Rewards.withdrawnAmounts.should.deep.eq([parseEther('0'), parseEther('0')]);

      await dlpRoot.addRewardForDlps({value: parseEther('100')});

      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const dlp2OwnerInitialBalance = await ethers.provider.getBalance(dlp2Owner);

      const tx = await dlpRoot.connect(dlp1Owner).claimUnsentReward(dlp1, 1);
      const receipt = await tx.wait();

      await tx.should
        .emit(dlpRoot, 'EpochRewardClaimed')
        .withArgs(dlp1, 1, (parseEther('0.25') * epochRewardAmount / parseEther('1')));

        const epoch1RewardsAfter = await dlpRoot.epochRewards(1);
        epoch1RewardsAfter.dlps.should.deep.eq([dlp1.address, dlp2.address]);
        epoch1RewardsAfter.scores.should.deep.eq([parseEther('0.25'), parseEther('0.75')]);
        epoch1RewardsAfter.withdrawnAmounts.should.deep.eq([
          (parseEther('0.25') * epochRewardAmount / parseEther('1')), 
          0n
        ]);
      

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance + (parseEther('0.25') * epochRewardAmount / parseEther('1')) - BigInt(receipt.gasUsed * tx.gasPrice));
      (await ethers.provider.getBalance(dlp2Owner)).should.eq(dlp2OwnerInitialBalance);
    });

    it("should claimUnsentReward #epochRewardAmount update", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp2);

      await dlpRoot.totalDlpsRewardAmount().should.eventually.eq(0);

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(2);

      await dlpRoot.connect(owner).updateEpochRewardAmount(epochRewardAmount * 3n);

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.6'), parseEther('0.4')]);

      await advanceToEpochN(3);

      await dlpRoot.createEpochs();

      const dlp1Info = await dlpRoot.dlpsInfo(dlp1);
      dlp1Info.score.should.eq(parseEther('0.6'));

      const dlp2Info = await dlpRoot.dlpsInfo(dlp2);
      dlp2Info.score.should.eq(parseEther('0.4'));

      const epoch1Rewards = await dlpRoot.epochRewards(1);
      epoch1Rewards.dlps.should.deep.eq([dlp1.address, dlp2.address]);
      epoch1Rewards.scores.should.deep.eq([parseEther('0.25'), parseEther('0.75')]);
      epoch1Rewards.withdrawnAmounts.should.deep.eq([parseEther('0'), parseEther('0')]);

      const epoch2Rewards = await dlpRoot.epochRewards(2);
      epoch2Rewards.dlps.should.deep.eq([dlp1.address, dlp2.address]);
      epoch2Rewards.scores.should.deep.eq([parseEther('0.6'), parseEther('0.4')]);
      epoch2Rewards.withdrawnAmounts.should.deep.eq([parseEther('0'), parseEther('0')]);

      await dlpRoot.addRewardForDlps({value: parseEther('100')});

      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const dlp2OwnerInitialBalance = await ethers.provider.getBalance(dlp2Owner);

      const tx1 = await dlpRoot.connect(dlp1Owner).claimUnsentReward(dlp1, 1);
      const receipt1 = await tx1.wait();

      await tx1.should
        .emit(dlpRoot, 'EpochRewardClaimed')
        .withArgs(dlp1, 1, (parseEther('0.25') * epochRewardAmount / parseEther('1')));

      const tx2 = await dlpRoot.connect(dlp2Owner).claimUnsentReward(dlp2, 2);
      const receipt2 = await tx2.wait();

      await tx2.should
        .emit(dlpRoot, 'EpochRewardClaimed')
        .withArgs(dlp2, 2, (parseEther('0.4') * epochRewardAmount * 3n / parseEther('1')));

        const epoch1RewardsAfter = await dlpRoot.epochRewards(1);
        epoch1RewardsAfter.dlps.should.deep.eq([dlp1.address, dlp2.address]);
        epoch1RewardsAfter.scores.should.deep.eq([parseEther('0.25'), parseEther('0.75')]);
        epoch1RewardsAfter.withdrawnAmounts.should.deep.eq([
          (parseEther('0.25') * epochRewardAmount / parseEther('1')), 
          0n
        ]);

        const epoch2RewardsAfter = await dlpRoot.epochRewards(2);
        epoch2RewardsAfter.dlps.should.deep.eq([dlp1.address, dlp2.address]);
        epoch2RewardsAfter.scores.should.deep.eq([parseEther('0.6'), parseEther('0.4')]);
        epoch2RewardsAfter.withdrawnAmounts.should.deep.eq([
          0, 
          (parseEther('0.4') * epochRewardAmount * 3n / parseEther('1'))
        ]);
      

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance + (parseEther('0.25') * epochRewardAmount / parseEther('1')) - BigInt(receipt1.gasUsed * tx1.gasPrice));
      (await ethers.provider.getBalance(dlp2Owner)).should.eq(dlp2OwnerInitialBalance + (parseEther('0.4') * epochRewardAmount * 3n / parseEther('1')) - BigInt(receipt2.gasUsed * tx2.gasPrice));
    });

    it("should reject claimUnsentReward when already claimed", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp2);

      await dlpRoot.totalDlpsRewardAmount().should.eventually.eq(0);

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(2);

      await dlpRoot.createEpochs();

      await dlpRoot.addRewardForDlps({value: parseEther('100')});

      await dlpRoot.connect(dlp1Owner).claimUnsentReward(dlp1, 1);

      await dlpRoot.connect(dlp1Owner).claimUnsentReward(dlp1, 1).should.be.rejectedWith('NothingToClaim()');
    });

    it("should reject claimUnsentReward when already sent", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp2);

      await dlpRoot.totalDlpsRewardAmount().should.eventually.eq(0);

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(2);

      await dlpRoot.addRewardForDlps({value: parseEther('100')});

      await dlpRoot.createEpochs();

      await dlpRoot.connect(dlp1Owner).claimUnsentReward(dlp1, 1).should.be.rejectedWith('NothingToClaim()');
    });

    it("should reject claimUnsentReward when epoch not finalized", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp2);

      await dlpRoot.totalDlpsRewardAmount().should.eventually.eq(0);

      await dlpRoot.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(2);

      await dlpRoot.createEpochs();

      await dlpRoot.addRewardForDlps({value: parseEther('100')});

      await dlpRoot.connect(dlp1Owner).claimUnsentReward(dlp1, 2).should.be.rejectedWith('NothingToClaim()');
    });

    it("should reject claimUnsentReward when epoch not active validator", async function () {
      await dlpRoot.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, { value: parseEther('100') });
      await dlpRoot.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, { value: parseEther('100') });
      await dlpRoot.connect(owner).approveDlp(dlp1);
      await dlpRoot.connect(owner).approveDlp(dlp2);

      await dlpRoot.connect(dlp1Owner).deregisterDlp(dlp1);

      await dlpRoot.totalDlpsRewardAmount().should.eventually.eq(0);

      await dlpRoot.connect(owner).updateScores([dlp2], [parseEther('1')]);

      await advanceToEpochN(2);

      await dlpRoot.createEpochs();

      await dlpRoot.addRewardForDlps({value: parseEther('100')});

      await dlpRoot.connect(dlp1Owner).claimUnsentReward(dlp1, 1).should.be.rejectedWith('NothingToClaim()');
    });
  });
});
