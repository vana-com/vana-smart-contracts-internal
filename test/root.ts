import chai, { should } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers, upgrades } from "hardhat";
import {ContractTransactionReceipt, parseEther} from "ethers";
import { DataLiquidityPoolsRoot } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { advanceToBlockN, getCurrentBlockNumber } from "../utils/timeAndBlockManipulation";

chai.use(chaiAsPromised);
should();

describe("DataLiquidityPoolsRoot", () => {
  enum DlpStatus {
    None,
    Registered,
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

  let root: DataLiquidityPoolsRoot;

  const maxNumberOfDlps = 9;
  const epochSize = 100;
  const minDlpStakeAmount = parseEther('50');
  let startBlock: number;
  let epochRewardAmount = parseEther('2');

  const dlpInitialBalance = parseEther('0');

  const deploy = async () => {
    [
      deployer, owner, user1, user2, user3,
      dlp1, dlp1Owner, dlp2, dlp2Owner, dlp3, dlp3Owner, dlp4, dlp4Owner, dlp5, dlp5Owner,
    ] = await ethers.getSigners();

    startBlock = await getCurrentBlockNumber() + 10;

    const dlpRootDeploy = await upgrades.deployProxy(
      await ethers.getContractFactory("DataLiquidityPoolsRoot"),
      [[
        owner.address,
        maxNumberOfDlps,
        minDlpStakeAmount,
        startBlock,
        epochSize,
        epochRewardAmount
      ]],
      {
        kind: "uups"
      }
    );

    root = await ethers.getContractAt("DataLiquidityPoolsRoot", dlpRootDeploy.target);
  }

  async function advanceToEpochN(epochNumber: number) {
    const epochNStartBlock =
      startBlock + (epochNumber - 1) * epochSize;

    await advanceToBlockN(epochNStartBlock);
  }

  async function registerDlps() {
    await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
    await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('100') });
    await root.connect(dlp3Owner).registerDlp(dlp3, dlp3Owner, false, { value: parseEther('100') });
    await root.connect(dlp4Owner).registerDlp(dlp4, dlp4Owner, false, { value: parseEther('100') });
    await root.connect(dlp5Owner).registerDlp(dlp5, dlp5Owner, false, { value: parseEther('100') });
  }

  async function registerDlp() {
    await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
  }

  async function getReceipt(tx: any): Promise<ContractTransactionReceipt> {
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("No receipt");
    }
    return receipt;
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

      (await root.epochsCount()).should.eq(0);

      const epoch = await root.epochs(0);
      epoch.startBlock.should.eq(await getCurrentBlockNumber());
      epoch.endBlock.should.eq(startBlock - 1);
      epoch.dlpIds.should.deep.eq([]);
    });

    it("Should pause when owner", async function () {
      await root.connect(owner).pause()
        .should.emit(root, 'Paused')
        .withArgs(owner.address);
      (await root.paused()).should.be.equal(true);
    });

    it("Should reject pause when non-owner", async function () {
      await root.connect(dlp1)
        .pause()
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1.address}")`
        );
      (await root.paused()).should.be.equal(false);
    });

    it("Should unpause when owner", async function () {
      await root.connect(owner).pause();
      await root.connect(owner).unpause()
        .should.emit(root, 'Unpaused')
        .withArgs(owner.address);
      (await root.paused()).should.be.equal(false);
    });

    it("Should reject unpause when non-owner", async function () {
      await root.connect(owner).pause();
      await root.connect(dlp1Owner)
        .unpause()
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1Owner.address}")`
        );
      (await root.paused()).should.be.equal(true);
    });

    it("Should updateMaxNumberOfDlps when owner", async function () {
      await root.connect(owner).updateMaxNumberOfDlps(123)
        .should.emit(root, 'MaxNumberOfDlpsUpdated')
        .withArgs(123);

      (await root.maxNumberOfDlps()).should.eq(123);
    });

    it("Should reject updateMaxNumberOfDlps when non-owner", async function () {
      await root.connect(dlp1).updateMaxNumberOfDlps(123)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1.address}")`
        );

      (await root.maxNumberOfDlps()).should.eq(maxNumberOfDlps);
    });

    it("Should updateEpochSize when owner", async function () {
      await root.connect(owner).updateEpochSize(123)
        .should.emit(root, 'EpochSizeUpdated')
        .withArgs(123);

      (await root.epochSize()).should.eq(123);
    });

    it("Should reject updateEpochSize when non-owner", async function () {
      await root.connect(dlp1).updateEpochSize(123)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1.address}")`
        );

      (await root.epochSize()).should.eq(epochSize);
    });

    it("Should updateEpochRewardAmount when owner", async function () {
      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();

      (await root.epochs(1)).reward.should.eq(epochRewardAmount);

      await root.connect(owner).updateEpochRewardAmount(123)
        .should.emit(root, 'EpochRewardAmountUpdated')
        .withArgs(123);

      (await root.epochRewardAmount()).should.eq(123);

      (await root.epochs(1)).reward.should.eq(123);
    });

    it("Should updateEpochRewardAmount starting with the current epoch", async function () {
      await advanceToEpochN(1);
      await root.connect(owner).createEpochs();
      await advanceToEpochN(3);
      (await root.epochs(1)).reward.should.eq(epochRewardAmount);

      await root.connect(owner).updateEpochRewardAmount(123)
        .should.emit(root, 'EpochRewardAmountUpdated')
        .withArgs(123);

      (await root.epochRewardAmount()).should.eq(123);

      await advanceToEpochN(5);
      await root.connect(dlp1).createEpochs();

      (await root.epochs(1)).reward.should.eq(epochRewardAmount);
      (await root.epochs(2)).reward.should.eq(epochRewardAmount);
      (await root.epochs(3)).reward.should.eq(123);
      (await root.epochs(4)).reward.should.eq(123);
      (await root.epochs(5)).reward.should.eq(123);

    });

    it("Should reject updateEpochSize when non-owner", async function () {
      await root.connect(dlp1).updateEpochRewardAmount(123)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1.address}")`
        );

      (await root.epochRewardAmount()).should.eq(epochRewardAmount);
    });

    it("Should updateMinDlpStakeAmount when owner", async function () {
      await root.connect(owner).updateMinDlpStakeAmount(parseEther('0.2'))
        .should.emit(root, 'MinDlpStakeAmountUpdated')
        .withArgs(parseEther('0.2'));

      (await root.minDlpStakeAmount()).should.eq(parseEther('0.2'));
    });

    it("Should reject updateMinDlpStakeAmount when non-owner", async function () {
      await root.connect(dlp1).updateMinDlpStakeAmount(parseEther('0.2'))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${dlp1.address}")`
        );

      (await root.minDlpStakeAmount()).should.eq(minDlpStakeAmount);
    });

    it("Should transferOwnership in 2 steps", async function () {
      await root.connect(owner).transferOwnership(user2.address)
        .should.emit(root, "OwnershipTransferStarted")
        .withArgs(owner, user2);
      (await root.owner()).should.eq(owner);

      await root.connect(owner).transferOwnership(user3.address)
        .should.emit(root, "OwnershipTransferStarted")
        .withArgs(owner, user3);
      (await root.owner()).should.eq(owner);

      await root.connect(user3).acceptOwnership()
        .should.emit(root, "OwnershipTransferred");

      (await root.owner()).should.eq(user3);
    });

    it("Should reject transferOwnership when non-owner", async function () {
      await root.connect(dlp1Owner)
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
      await advanceToEpochN(1);
        await root.connect(owner).createEpochs().should
            .emit(root, 'EpochCreated').withArgs(1);
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

      await root.connect(owner).createEpochs()
        .should.emit(root, 'EpochCreated')
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
      await root.connect(owner).createEpochs().should
        .emit(root, 'EpochCreated').withArgs(2)
        .emit(root, 'EpochCreated').withArgs(3)
        .emit(root, 'EpochCreated').withArgs(4);

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
      await root.connect(owner).createEpochsUntilBlockNumber(epoch4StartBlock).should
        .emit(root, 'EpochCreated').withArgs(2)
        .emit(root, 'EpochCreated').withArgs(3)
        .emit(root, 'EpochCreated').withArgs(4);

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

    it("should create epochs with no active dlps", async function () {
      await advanceToEpochN(3);
      await root.connect(owner).createEpochs();

      for (let i = 1; i <= 2; i++) {
        (await root.epochs(i)).dlpIds.should.deep.eq([]);
      }
    });
  });

  describe("Dlps - registration", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should registerDlp", async function () {
      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const tx = await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      const receipt = await getReceipt(tx);

      if (!receipt) {
        throw new Error("No receipt");
      }

      await tx.should.emit(root, 'DlpRegistered')
        .withArgs(1, dlp1.address, dlp1Owner.address);

      (await root.dlpsCount()).should.eq(1);

      const dlp1Info = await root.dlps(1);

      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.ownerAddress.should.eq(dlp1Owner.address);
      dlp1Info.stakeAmount.should.eq(parseEther('100'));
      dlp1Info.status.should.eq(DlpStatus.Registered);
      dlp1Info.grantedAmount.should.eq(0);
      dlp1Info.firstBlockNumber.should.eq(0);
      dlp1Info.lastBlockNumber.should.eq(0);

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.epochs(1)).dlpIds.should.deep.eq([]);

      (await root.stakers(dlp1Owner)).should.eq(parseEther('100'));
      (await root.stakedDlps(dlp1Owner, 1)).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance - parseEther('100') - BigInt(receipt.gasUsed * tx.gasPrice));
      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance + parseEther('100'));
    });

    it("should registerDlp as sponsor", async function () {
      const user1InitialBalance = await ethers.provider.getBalance(user1);
      const tx = await root.connect(user1).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      const receipt = await getReceipt(tx);

      await tx.should.emit(root, 'DlpRegistered')
        .withArgs(1, dlp1.address, dlp1Owner.address);

      (await root.dlpsCount()).should.eq(1);

      const dlp1Info = await root.dlps(1);

      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.ownerAddress.should.eq(dlp1Owner.address);
      dlp1Info.stakeAmount.should.eq(parseEther('100'));
      dlp1Info.status.should.eq(DlpStatus.Registered);
      dlp1Info.grantedAmount.should.eq(parseEther('0'));
      dlp1Info.firstBlockNumber.should.eq(0);
      dlp1Info.lastBlockNumber.should.eq(0);

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.epochs(1)).dlpIds.should.deep.eq([]);

      (await root.stakers(dlp1Owner)).should.eq(parseEther('100'));
      (await root.stakedDlps(dlp1Owner, 1)).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(user1)).should.eq(user1InitialBalance - parseEther('100') - BigInt(receipt.gasUsed * tx.gasPrice));
      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance + parseEther('100'));
    });

    it("should registerDlp as with grant", async function () {
      const ownerInitialBalance = await ethers.provider.getBalance(owner);
      const tx = await root.connect(owner).registerDlp(dlp1, dlp1Owner, true, { value: parseEther('100') });
      const receipt = await getReceipt(tx);

      await tx.should.emit(root, 'DlpRegistered')
        .withArgs(1, dlp1.address, dlp1Owner.address);

      (await root.dlpsCount()).should.eq(1);

      const dlp1Info = await root.dlps(1);

      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.ownerAddress.should.eq(dlp1Owner.address);
      dlp1Info.stakeAmount.should.eq(parseEther('100'));
      dlp1Info.status.should.eq(DlpStatus.Registered);
      dlp1Info.grantedAmount.should.eq(parseEther('100'));
      dlp1Info.firstBlockNumber.should.eq(0);
      dlp1Info.lastBlockNumber.should.eq(0);

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.epochs(1)).dlpIds.should.deep.eq([]);

      (await root.stakers(dlp1Owner)).should.eq(parseEther('100'));
      (await root.stakedDlps(dlp1Owner, 1)).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(owner)).should.eq(ownerInitialBalance - parseEther('100') - BigInt(receipt.gasUsed * tx.gasPrice));
      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance + parseEther('100'));
    });

    it("should registerDlp many times", async function () {
      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const dlp2OwnerInitialBalance = await ethers.provider.getBalance(dlp2Owner);
      const dlp3OwnerInitialBalance = await ethers.provider.getBalance(dlp3Owner);

      const tx1 = await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });

      const receipt1 = await getReceipt(tx1);

      const tx2 = await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('200') });
      const receipt2 = await getReceipt(tx2);
      const tx3 = await root.connect(dlp3Owner).registerDlp(dlp3, dlp3Owner, false, { value: parseEther('300') });
      const receipt3 = await getReceipt(tx3);

      await tx1.should.emit(root, 'DlpRegistered').withArgs(1, dlp1.address, dlp1Owner.address);
      await tx2.should.emit(root, 'DlpRegistered').withArgs(2, dlp2.address, dlp2Owner.address);
      await tx3.should.emit(root, 'DlpRegistered').withArgs(3, dlp3.address, dlp3Owner.address);

      (await root.dlpsCount()).should.eq(3);

      const dlp1Info = await root.dlps(1);
      dlp1Info.dlpAddress.should.eq(dlp1);
      dlp1Info.ownerAddress.should.eq(dlp1Owner.address);
      dlp1Info.stakeAmount.should.eq(parseEther('100'));
      dlp1Info.status.should.eq(DlpStatus.Registered);
      dlp1Info.grantedAmount.should.eq(0);
      dlp1Info.firstBlockNumber.should.eq(0);
      dlp1Info.lastBlockNumber.should.eq(0);

      const dlp2Info = await root.dlps(2);
      dlp2Info.dlpAddress.should.eq(dlp2);
      dlp2Info.ownerAddress.should.eq(dlp2Owner.address);
      dlp2Info.stakeAmount.should.eq(parseEther('200'));
      dlp2Info.status.should.eq(DlpStatus.Registered);
      dlp2Info.grantedAmount.should.eq(0);
      dlp2Info.firstBlockNumber.should.eq(0);
      dlp2Info.lastBlockNumber.should.eq(0);

      const dlp3Info = await root.dlps(3);
      dlp3Info.dlpAddress.should.eq(dlp3);
      dlp3Info.ownerAddress.should.eq(dlp3Owner.address);
      dlp3Info.stakeAmount.should.eq(parseEther('300'));
      dlp3Info.status.should.eq(DlpStatus.Registered);
      dlp3Info.grantedAmount.should.eq(0);
      dlp3Info.firstBlockNumber.should.eq(0);
      dlp3Info.lastBlockNumber.should.eq(0);

      (await root.dlpsCount()).should.eq(3);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);
      (await root.dlpsByAddress(dlp2)).should.deep.eq(dlp2Info);
      (await root.dlpsByAddress(dlp3)).should.deep.eq(dlp3Info);

      (await root.epochs(1)).dlpIds.should.deep.eq([]);

      (await root.stakers(dlp1Owner)).should.eq(parseEther('100'));
      (await root.stakedDlps(dlp1Owner, 1)).should.eq(parseEther('100'));

      (await root.stakers(dlp2Owner)).should.eq(parseEther('200'));
      (await root.stakedDlps(dlp2Owner, 2)).should.eq(parseEther('200'));

      (await root.stakers(dlp3Owner)).should.eq(parseEther('300'));
      (await root.stakedDlps(dlp3Owner, 3)).should.eq(parseEther('300'));

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance - parseEther('100') - BigInt(receipt1.gasUsed * tx1.gasPrice));
      (await ethers.provider.getBalance(dlp2Owner)).should.eq(dlp2OwnerInitialBalance - parseEther('200') - BigInt(receipt2.gasUsed * tx2.gasPrice));
      (await ethers.provider.getBalance(dlp3Owner)).should.eq(dlp3OwnerInitialBalance - parseEther('300') - BigInt(receipt3.gasUsed * tx3.gasPrice));
      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance + parseEther('100') + parseEther('200') + parseEther('300'));
    });

    it("Should reject registerDlp when paused", async function () {
      await root.connect(owner).pause();
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('1') })
        .should.be.rejectedWith(
          `EnforcedPause()`
        );
    });

    it("Should reject registerDlp when stake amount too small", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('1') })
        .should.be.rejectedWith(
          `InvalidStakeAmount()`
        );
    });

    it("Should reject registerDlp when already registered", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') })
        .should.be.rejectedWith(
          `InvalidDlpStatus()`
        );
    });

    it("Should reject registerDlp when deregistered", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp1Owner).deregisterDlp(1);
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') })
        .should.be.rejectedWith(
          `InvalidDlpStatus()`
        );
    });

    it("should deregisterDlp when dlp owner", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });

      (await root.stakers(dlp1Owner)).should.eq(parseEther('100'));
      (await root.stakedDlps(dlp1Owner, 1)).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance + parseEther('100'));

      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const tx = await root.connect(dlp1Owner).deregisterDlp(1);
      const receipt = await getReceipt(tx);

      await tx.should.emit(root, 'DlpDeregistered').withArgs(1);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.lastBlockNumber.should.eq(await getCurrentBlockNumber());

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.registeredDlps()).should.deep.eq([]);

      (await root.stakers(dlp1Owner)).should.eq(parseEther('0'));
      (await root.stakedDlps(dlp1Owner, 1)).should.eq(parseEther('0'));

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance + parseEther('100') - BigInt(receipt.gasUsed * tx.gasPrice));
      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance);
    });

    it("should deregisterDlp when granted", async function () {
      await root.connect(owner).registerDlp(dlp1, dlp1Owner, true, { value: parseEther('100') });

      (await root.stakers(dlp1Owner)).should.eq(parseEther('100'));
      (await root.stakedDlps(dlp1Owner, 1)).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance + parseEther('100'));

      await root.connect(dlp1Owner).deregisterDlp(1).should
        .emit(root, 'DlpDeregistered').withArgs(1);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.lastBlockNumber.should.eq(await getCurrentBlockNumber());
      dlp1Info.grantedAmount.should.eq(parseEther('100'));

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.registeredDlps()).should.deep.eq([]);

      (await root.stakers(dlp1Owner)).should.eq(parseEther('100'));
      (await root.stakedDlps(dlp1Owner, 1)).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance + parseEther('100'));
    });

    it("Should reject deregisterDlp when non dlp owner", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });

      await root.connect(owner).deregisterDlp(1)
        .should.be.rejectedWith('NotDlpOwner');

      await root.connect(dlp1).deregisterDlp(1)
        .should.be.rejectedWith('NotDlpOwner');

      await root.connect(user1).deregisterDlp(1)
        .should.be.rejectedWith('NotDlpOwner');
    });

    it("Should reject deregisterDlp when deregistered", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });

      await root.connect(dlp1Owner).deregisterDlp(1);

      await root.connect(dlp1Owner).deregisterDlp(1)
        .should.be.rejectedWith(`InvalidDlpStatus()`);
    });

    it("should deregisterDlp #multiple dlps", async function () {
      await registerDlps();

      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance + 5n * parseEther('100'));

      const currentBlockNumber = await getCurrentBlockNumber();

      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const tx = await root.connect(dlp1Owner).deregisterDlp(1);
      const receipt = await getReceipt(tx);

      await tx.should.emit(root, 'DlpDeregistered').withArgs(1);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.lastBlockNumber.should.eq(currentBlockNumber + 1);

      const dlp2Info = await root.dlps(2);
      dlp2Info.status.should.eq(DlpStatus.Registered);
      dlp2Info.lastBlockNumber.should.eq(0);

      const dlp3Info = await root.dlps(3);
      dlp3Info.status.should.eq(DlpStatus.Registered);
      dlp3Info.lastBlockNumber.should.eq(0);

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

      (await root.registeredDlps()).should.deep.eq([5,2,3,4]);

      (await root.stakers(dlp1Owner)).should.eq(parseEther('0'));
      (await root.stakedDlps(dlp1Owner, 1)).should.eq(parseEther('0'));

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance + parseEther('100') - BigInt(receipt.gasUsed * tx.gasPrice));
      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance + 4n * parseEther('100'));
    });

    it("should deregisterDlp when dlp owner #multiple dlps 2", async function () {
      await registerDlps();

      const currentBlockNumber = await getCurrentBlockNumber();

      await root.connect(dlp2Owner).deregisterDlp(2)
        .should.emit(root, 'DlpDeregistered')
        .withArgs(2);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Registered);
      dlp1Info.lastBlockNumber.should.eq(0);

      const dlp2Info = await root.dlps(2);
      dlp2Info.status.should.eq(DlpStatus.Deregistered);
      dlp2Info.lastBlockNumber.should.eq(currentBlockNumber + 1);

      const dlp3Info = await root.dlps(3);
      dlp3Info.status.should.eq(DlpStatus.Registered);
      dlp3Info.lastBlockNumber.should.eq(0);

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

      (await root.registeredDlps()).should.deep.eq([1,5,3,4]);
    });

    it("should deregisterDlpByOwner when dlp owner", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });

      (await root.stakers(dlp1Owner)).should.eq(parseEther('100'));
      (await root.stakedDlps(dlp1Owner, 1)).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance + parseEther('100'));

      const ownerInitialBalance = await ethers.provider.getBalance(owner);
      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);

      const tx = await root.connect(owner).deregisterDlpByOwner(1, parseEther('100'));
      const receipt = await getReceipt(tx);

      await tx.should
        .emit(root, 'DlpDeregistered').withArgs(1)
        .emit(root, 'DlpDeregisteredByOwner').withArgs(1, parseEther('100'), parseEther('0'));

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.lastBlockNumber.should.eq(await getCurrentBlockNumber());

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.registeredDlps()).should.deep.eq([]);

      (await root.stakers(dlp1Owner)).should.eq(parseEther('0'));
      (await root.stakedDlps(dlp1Owner, 1)).should.eq(parseEther('0'));

      (await ethers.provider.getBalance(owner)).should.eq(ownerInitialBalance - BigInt(receipt.gasUsed * tx.gasPrice));
      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance + parseEther('100'));
      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance);
    });


    it("should deregisterDlpByOwner when granted #full unstake amount", async function () {
      await root.connect(owner).registerDlp(dlp1, dlp1Owner, true, { value: parseEther('100') });
      (await root.stakers(dlp1Owner)).should.eq(parseEther('100'));
      (await root.stakedDlps(dlp1Owner, 1)).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance + parseEther('100'));

      const ownerInitialBalance = await ethers.provider.getBalance(owner);
      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);

      (await root.registeredDlps()).should.deep.eq([1]);


      const tx = await root.connect(owner).deregisterDlpByOwner(1, parseEther('100'));
      const receipt = await getReceipt(tx);

      await tx.should
        .emit(root, 'DlpDeregisteredByOwner').withArgs(1, parseEther('100'), parseEther('0'))
        .emit(root, 'DlpDeregistered').withArgs(1);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.lastBlockNumber.should.eq(await getCurrentBlockNumber());
      dlp1Info.grantedAmount.should.eq(parseEther('100'));

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.registeredDlps()).should.deep.eq([]);

      (await root.stakers(dlp1Owner)).should.eq(parseEther('0'));
      (await root.stakedDlps(dlp1Owner, 1)).should.eq(parseEther('0'));

      (await ethers.provider.getBalance(owner)).should.eq(ownerInitialBalance - BigInt(receipt.gasUsed * tx.gasPrice));
      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance + parseEther('100'));
      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance);
    });

    it("should deregisterDlpByOwner when granted #partial unstake amount", async function () {
      await root.connect(owner).registerDlp(dlp1, dlp1Owner, true, { value: parseEther('100') });

      (await root.stakers(dlp1Owner)).should.eq(parseEther('100'));
      (await root.stakedDlps(dlp1Owner, 1)).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance + parseEther('100'));
      const ownerInitialBalance = await ethers.provider.getBalance(owner);
      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);

      const tx = await root.connect(owner).deregisterDlpByOwner(1, parseEther('40'));
      const receipt = await getReceipt(tx);

      await tx.should
        .emit(root, 'DlpDeregisteredByOwner').withArgs(1, parseEther('40'), parseEther('60'))
        .emit(root, 'DlpDeregistered').withArgs(1);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.lastBlockNumber.should.eq(await getCurrentBlockNumber());
      dlp1Info.grantedAmount.should.eq(parseEther('100'));

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.registeredDlps()).should.deep.eq([]);

      (await root.stakers(dlp1Owner)).should.eq(parseEther('0'));
      (await root.stakedDlps(dlp1Owner, 1)).should.eq(parseEther('0'));

      (await ethers.provider.getBalance(owner)).should.eq(ownerInitialBalance + parseEther('60') - BigInt(receipt.gasUsed * tx.gasPrice));
      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance + parseEther('40'));
      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance);
    });

    it("should deregisterDlpByOwner when granted #no unstake amount #2", async function () {
      await root.connect(owner).registerDlp(dlp1, dlp1Owner, true, { value: parseEther('100') });

      (await root.stakers(dlp1Owner)).should.eq(parseEther('100'));
      (await root.stakedDlps(dlp1Owner, 1)).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance + parseEther('100'));

      const ownerInitialBalance = await ethers.provider.getBalance(owner);
      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const tx = await root.connect(owner).deregisterDlpByOwner(1, parseEther('0'));
      const receipt = await getReceipt(tx);

      await tx.should
        .emit(root, 'DlpDeregisteredByOwner').withArgs(1, parseEther('0'), parseEther('100'))
        .emit(root, 'DlpDeregistered').withArgs(1);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.lastBlockNumber.should.eq(await getCurrentBlockNumber());
      dlp1Info.grantedAmount.should.eq(parseEther('100'));

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.registeredDlps()).should.deep.eq([]);

      (await root.stakers(dlp1Owner)).should.eq(parseEther('0'));
      (await root.stakedDlps(dlp1Owner, 1)).should.eq(parseEther('0'));

      (await ethers.provider.getBalance(owner)).should.eq(ownerInitialBalance + parseEther('100') - BigInt(receipt.gasUsed * tx.gasPrice));
      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance);
      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance);
    });

    it("should deregisterDlpByOwner when granted and deregistered", async function () {
      await root.connect(owner).registerDlp(dlp1, dlp1Owner, true, { value: parseEther('100') });

      (await root.stakers(dlp1Owner)).should.eq(parseEther('100'));
      (await root.stakedDlps(dlp1Owner, 1)).should.eq(parseEther('100'));

      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance + parseEther('100'));

      await root.connect(dlp1Owner).deregisterDlp(1).should
        .emit(root, 'DlpDeregistered').withArgs(1);

      const ownerInitialBalance = await ethers.provider.getBalance(owner);
      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);

      const tx = await root.connect(owner).deregisterDlpByOwner(1, parseEther('40'));
      const receipt = await getReceipt(tx);

      await tx.should
        .emit(root, 'DlpDeregisteredByOwner').withArgs(1, parseEther('40'), parseEther('60'));

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.lastBlockNumber.should.eq(await getCurrentBlockNumber() - 1);
      dlp1Info.grantedAmount.should.eq(parseEther('100'));

      (await root.dlpsCount()).should.eq(1);
      (await root.dlpsByAddress(dlp1)).should.deep.eq(dlp1Info);

      (await root.registeredDlps()).should.deep.eq([]);

      (await root.stakers(dlp1Owner)).should.eq(parseEther('0'));
      (await root.stakedDlps(dlp1Owner, 1)).should.eq(parseEther('0'));

      (await ethers.provider.getBalance(owner)).should.eq(ownerInitialBalance + parseEther('60') - BigInt(receipt.gasUsed * tx.gasPrice));
      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance + parseEther('40'));
      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance);
    });

    it("Should reject deregisterDlpByOwner when non dlp owner", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });

      await root.connect(dlp1Owner).deregisterDlpByOwner(1, parseEther('100'))
        .should.be.rejectedWith(`OwnableUnauthorizedAccount("${dlp1Owner.address}")`);

      await root.connect(dlp1).deregisterDlpByOwner(1, parseEther('100'))
        .should.be.rejectedWith(`OwnableUnauthorizedAccount("${dlp1.address}")`);

      await root.connect(user1).deregisterDlpByOwner(1, parseEther('100'))
        .should.be.rejectedWith(`OwnableUnauthorizedAccount("${user1.address}")`);
    });

    it("Should reject deregisterDlpByOwner when stakeAmount = 0", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });

      await root.connect(dlp1Owner).deregisterDlp(1);

      await root.connect(owner).deregisterDlpByOwner(1, parseEther('100'))
        .should.be.rejectedWith(`InvalidStakeAmount()`);
    });

    it("should deregisterDlpByOwner #multiple dlps 1", async function () {
      await registerDlps();

      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance + 5n * parseEther('100'));

      const currentBlockNumber = await getCurrentBlockNumber();

      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      await root.connect(owner).deregisterDlpByOwner(1, parseEther('100'))
        .should.emit(root, 'DlpDeregistered')
        .withArgs(1);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Deregistered);
      dlp1Info.lastBlockNumber.should.eq(currentBlockNumber + 1);

      const dlp2Info = await root.dlps(2);
      dlp2Info.status.should.eq(DlpStatus.Registered);
      dlp2Info.lastBlockNumber.should.eq(0);

      const dlp3Info = await root.dlps(3);
      dlp3Info.status.should.eq(DlpStatus.Registered);
      dlp3Info.lastBlockNumber.should.eq(0);

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

      (await root.registeredDlps()).should.deep.eq([5,2,3,4]);

      (await root.stakers(dlp1Owner)).should.eq(parseEther('0'));
      (await root.stakedDlps(dlp1Owner, 1)).should.eq(parseEther('0'));

      (await ethers.provider.getBalance(dlp1Owner)).should.eq(dlp1OwnerInitialBalance + parseEther('100'));
      (await ethers.provider.getBalance(root)).should.eq(dlpInitialBalance + 4n * parseEther('100'));
    });

    it("should deregisterDlpByOwner when dlp owner #multiple dlps 2", async function () {
      await registerDlps();

      const currentBlockNumber = await getCurrentBlockNumber();

      await root.connect(owner).deregisterDlpByOwner(2, parseEther('100'))
        .should.emit(root, 'DlpDeregistered')
        .withArgs(2);

      const dlp1Info = await root.dlps(1);
      dlp1Info.status.should.eq(DlpStatus.Registered);
      dlp1Info.lastBlockNumber.should.eq(0);

      const dlp2Info = await root.dlps(2);
      dlp2Info.status.should.eq(DlpStatus.Deregistered);
      dlp2Info.lastBlockNumber.should.eq(currentBlockNumber + 1);

      const dlp3Info = await root.dlps(3);
      dlp3Info.status.should.eq(DlpStatus.Registered);
      dlp3Info.lastBlockNumber.should.eq(0);

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

      (await root.registeredDlps()).should.deep.eq([1,5,3,4]);
    });
  });

  describe("Stake", () => {
    beforeEach(async () => {
      await deploy();

      await registerDlps();
    });

    it("should stake", async function () {
      await root.connect(user1).stake(1, { value: parseEther('100') })
          .should.emit(root, 'Staked')
          .withArgs(1, parseEther('100'), parseEther('100'));
    })
  });

  describe("Score & Rewards", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should updateScores", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('100') });
      await root.connect(owner).approveDlp(dlp1);
      await root.connect(owner).approveDlp(dlp2);

      await root.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      const dlp1Info = await root.dlps(dlp1);
      dlp1Info.score.should.eq(parseEther('0.25'));

      const dlp2Info = await root.dlps(dlp2);
      dlp2Info.score.should.eq(parseEther('0.75'));
    });

    it("should reject updateScores when non-owner", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('100') });
      await root.connect(owner).approveDlp(dlp1);
      await root.connect(owner).approveDlp(dlp2);

      await root.connect(dlp1Owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')])
        .should.be.rejectedWith(`OwnableUnauthorizedAccount("${dlp1Owner.address}")`);

      await root.connect(user1).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')])
        .should.be.rejectedWith(`OwnableUnauthorizedAccount("${user1.address}")`);
    });

    it("should reject updateScores when total score != 1 #1", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('100') });
      await root.connect(owner).approveDlp(dlp1);
      await root.connect(owner).approveDlp(dlp2);

      await root.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.7')])
        .should.be.rejectedWith(`InvalidScores`);
    });

    it("should reject updateScores when total score != 1 #2", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(owner).approveDlp(dlp1);

      await root.connect(owner).updateScores([dlp1], [parseEther('0.9')])
        .should.be.rejectedWith(`InvalidScores`);
    });

    it("should reject updateScores when arity mismatch #1", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('100') });
      await root.connect(owner).approveDlp(dlp1);
      await root.connect(owner).approveDlp(dlp2);

      await root.connect(owner).updateScores([dlp1], [parseEther('0.9')])
        .should.be.rejectedWith(`ArityMismatch`);
    });

    it("should reject updateScores when arity mismatch #2", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('100') });
      await root.connect(owner).approveDlp(dlp1);
      await root.connect(owner).approveDlp(dlp2);

      await root.connect(owner).updateScores([dlp1, dlp2, dlp3], [parseEther('0.2'), parseEther('0.3'), parseEther('0.5')])
        .should.be.rejectedWith(`ArityMismatch`);
    });

    it("should reject updateScores when arity mismatch #3", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('100') });
      await root.connect(owner).approveDlp(dlp1);
      await root.connect(owner).approveDlp(dlp2);

      await root.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.2'), parseEther('0.3'), parseEther('0.5')])
        .should.be.rejectedWith(`ArityMismatch`);
    });

    it("should reject updateScores when valiadaor not active", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('100') });
      await root.connect(owner).approveDlp(dlp1);
      await root.connect(owner).approveDlp(dlp2);

      await root.connect(owner).updateScores([dlp1, dlp3], [parseEther('0.2'), parseEther('0.8')])
        .should.be.rejectedWith(`InvalidDlpStatus`);
    });

    it("should send rewards to dlps", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('100') });
      await root.connect(owner).approveDlp(dlp1);
      await root.connect(owner).approveDlp(dlp2);

      await root.addRewardForDlps({ value: parseEther('100') });
      await root.totalDlpsRewardAmount().should.eventually.eq(parseEther('100'));

      await root.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(2);

      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const dlp2OwnerInitialBalance = await ethers.provider.getBalance(dlp2Owner);
      await root.createEpochs();

      const dlp1Info = await root.dlps(dlp1);
      dlp1Info.score.should.eq(parseEther('0.25'));

      const dlp2Info = await root.dlps(dlp2);
      dlp2Info.score.should.eq(parseEther('0.75'));

      const epoch1 = await root.epochs(1);

      const epoch1Rewards = await root.epochRewards(1);
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
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('100') });
      await root.connect(owner).approveDlp(dlp1);
      await root.connect(owner).approveDlp(dlp2);

      await root.addRewardForDlps({ value: parseEther('100') });
      await root.totalDlpsRewardAmount().should.eventually.eq(parseEther('100'));

      await root.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(3);

      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const dlp2OwnerInitialBalance = await ethers.provider.getBalance(dlp2Owner);
      await root.createEpochs();

      const dlp1Info = await root.dlps(dlp1);
      dlp1Info.score.should.eq(parseEther('0.25'));

      const dlp2Info = await root.dlps(dlp2);
      dlp2Info.score.should.eq(parseEther('0.75'));

      const epoch1Rewards = await root.epochRewards(1);
      epoch1Rewards.dlps.should.deep.eq([dlp1.address, dlp2.address]);
      epoch1Rewards.scores.should.deep.eq([parseEther('0.25'), parseEther('0.75')]);
      epoch1Rewards.withdrawnAmounts.should.deep.eq([
        parseEther('0.25') * epochRewardAmount / parseEther('1'),
        parseEther('0.75') * epochRewardAmount / parseEther('1')
      ]);

      const epoch2Rewards = await root.epochRewards(1);
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
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('100') });
      await root.connect(owner).approveDlp(dlp1);
      await root.connect(owner).approveDlp(dlp2);

      await root.addRewardForDlps({ value: parseEther('100') });
      await root.totalDlpsRewardAmount().should.eventually.eq(parseEther('100'));

      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const dlp2OwnerInitialBalance = await ethers.provider.getBalance(dlp2Owner);

      await root.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(2);

      await root.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.5'), parseEther('0.5')]);

      await advanceToEpochN(3);

      await root.createEpochs();

      const dlp1Info = await root.dlps(dlp1);
      dlp1Info.score.should.eq(parseEther('0.5'));

      const dlp2Info = await root.dlps(dlp2);
      dlp2Info.score.should.eq(parseEther('.5'));

      const epoch1Rewards = await root.epochRewards(1);
      epoch1Rewards.dlps.should.deep.eq([dlp1.address, dlp2.address]);
      epoch1Rewards.scores.should.deep.eq([parseEther('0.25'), parseEther('0.75')]);
      epoch1Rewards.withdrawnAmounts.should.deep.eq([
        parseEther('0.25') * epochRewardAmount / parseEther('1'),
        parseEther('0.75') * epochRewardAmount / parseEther('1')
      ]);

      const epoch2Rewards = await root.epochRewards(2);
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
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('100') });
      await root.connect(owner).approveDlp(dlp1);
      await root.connect(owner).approveDlp(dlp2);

      await root.addRewardForDlps({ value: parseEther('100') });
      await root.totalDlpsRewardAmount().should.eventually.eq(parseEther('100'));

      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const dlp2OwnerInitialBalance = await ethers.provider.getBalance(dlp2Owner);

      await root.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(2);

      await root.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.5'), parseEther('0.5')]);
      await root.connect(owner).updateEpochRewardAmount(epochRewardAmount * 2n);

      await advanceToEpochN(3);

      await root.createEpochs();

      const epoch1 = await root.epochs(1);
      epoch1.reward.should.eq(epochRewardAmount);

      const epoch2 = await root.epochs(2);
      epoch2.reward.should.eq(epochRewardAmount * 2n);

      const dlp1Info = await root.dlps(dlp1);
      dlp1Info.score.should.eq(parseEther('0.5'));

      const dlp2Info = await root.dlps(dlp2);
      dlp2Info.score.should.eq(parseEther('.5'));

      const epoch1Rewards = await root.epochRewards(1);
      epoch1Rewards.dlps.should.deep.eq([dlp1.address, dlp2.address]);
      epoch1Rewards.scores.should.deep.eq([parseEther('0.25'), parseEther('0.75')]);
      epoch1Rewards.withdrawnAmounts.should.deep.eq([
        parseEther('0.25') * epochRewardAmount / parseEther('1'),
        parseEther('0.75') * epochRewardAmount / parseEther('1')
      ]);

      const epoch2Rewards = await root.epochRewards(2);
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
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('100') });
      await root.connect(owner).approveDlp(dlp1);
      await root.connect(owner).approveDlp(dlp2);

      await root.totalDlpsRewardAmount().should.eventually.eq(0);

      await root.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(2);

      await root.createEpochs();

      const dlp1Info = await root.dlps(dlp1);
      dlp1Info.score.should.eq(parseEther('0.25'));

      const dlp2Info = await root.dlps(dlp2);
      dlp2Info.score.should.eq(parseEther('0.75'));

      const epoch1Rewards = await root.epochRewards(1);
      epoch1Rewards.dlps.should.deep.eq([dlp1.address, dlp2.address]);
      epoch1Rewards.scores.should.deep.eq([parseEther('0.25'), parseEther('0.75')]);
      epoch1Rewards.withdrawnAmounts.should.deep.eq([parseEther('0'), parseEther('0')]);
    });

    it("should create epochs when updating scores #1", async function () {
      await advanceToEpochN(3);

      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('100') });
      await root.connect(owner).approveDlp(dlp1);
      await root.connect(owner).approveDlp(dlp2);

      await root.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(4);

      await root.connect(owner).updateScores([dlp1, dlp2], [parseEther('1'), parseEther('0')]);

      const epoch1 = await root.epochs(1);
      epoch1.dlpsListId.should.eq(0);

      const epoch2 = await root.epochs(2);
      epoch2.dlpsListId.should.eq(0);

      const epoch3 = await root.epochs(3);
      epoch3.dlpsListId.should.not.eq(0);
    });

    it("should create epochs when updating scores #2", async function () {
      await advanceToEpochN(3);

      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('100') });
      await root.connect(owner).approveDlp(dlp1);
      await root.connect(owner).approveDlp(dlp2);

      await root.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.5'), parseEther('0.5')]);

      await advanceToEpochN(4);

      await root.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.2'), parseEther('0.8')]);

      for (let i = 1; i <= 2; i++) {
        const epoch = await root.epochs(i);
        epoch.dlpsListId.should.eq(0);
      }

      const epoch3 = await root.epochs(3);
      epoch3.dlpsListId.should.not.eq(0);
    });

    it("Should reject claimUnsentReward when non dlp owner", async function () {
      await root.connect(dlp1Owner).claimUnsentReward(dlp1, 1).should.be.rejectedWith(`NotDlpOwner()`);
    });

    it("should claimUnsentReward", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('100') });
      await root.connect(owner).approveDlp(dlp1);
      await root.connect(owner).approveDlp(dlp2);

      await root.totalDlpsRewardAmount().should.eventually.eq(0);

      await root.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(2);

      await root.createEpochs();

      const dlp1Info = await root.dlps(dlp1);
      dlp1Info.score.should.eq(parseEther('0.25'));

      const dlp2Info = await root.dlps(dlp2);
      dlp2Info.score.should.eq(parseEther('0.75'));

      const epoch1Rewards = await root.epochRewards(1);
      epoch1Rewards.dlps.should.deep.eq([dlp1.address, dlp2.address]);
      epoch1Rewards.scores.should.deep.eq([parseEther('0.25'), parseEther('0.75')]);
      epoch1Rewards.withdrawnAmounts.should.deep.eq([parseEther('0'), parseEther('0')]);

      await root.addRewardForDlps({ value: parseEther('100') });

      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const dlp2OwnerInitialBalance = await ethers.provider.getBalance(dlp2Owner);

      const tx = await root.connect(dlp1Owner).claimUnsentReward(dlp1, 1);
      const receipt = await getReceipt(tx);

      await tx.should
        .emit(root, 'EpochRewardClaimed')
        .withArgs(dlp1, 1, (parseEther('0.25') * epochRewardAmount / parseEther('1')));

      const epoch1RewardsAfter = await root.epochRewards(1);
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
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('100') });
      await root.connect(owner).approveDlp(dlp1);
      await root.connect(owner).approveDlp(dlp2);

      await root.totalDlpsRewardAmount().should.eventually.eq(0);

      await root.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(2);

      await root.connect(owner).updateEpochRewardAmount(epochRewardAmount * 3n);

      await root.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.6'), parseEther('0.4')]);

      await advanceToEpochN(3);

      await root.createEpochs();

      const dlp1Info = await root.dlps(dlp1);
      dlp1Info.score.should.eq(parseEther('0.6'));

      const dlp2Info = await root.dlps(dlp2);
      dlp2Info.score.should.eq(parseEther('0.4'));

      const epoch1Rewards = await root.epochRewards(1);
      epoch1Rewards.dlps.should.deep.eq([dlp1.address, dlp2.address]);
      epoch1Rewards.scores.should.deep.eq([parseEther('0.25'), parseEther('0.75')]);
      epoch1Rewards.withdrawnAmounts.should.deep.eq([parseEther('0'), parseEther('0')]);

      const epoch2Rewards = await root.epochRewards(2);
      epoch2Rewards.dlps.should.deep.eq([dlp1.address, dlp2.address]);
      epoch2Rewards.scores.should.deep.eq([parseEther('0.6'), parseEther('0.4')]);
      epoch2Rewards.withdrawnAmounts.should.deep.eq([parseEther('0'), parseEther('0')]);

      await root.addRewardForDlps({ value: parseEther('100') });

      const dlp1OwnerInitialBalance = await ethers.provider.getBalance(dlp1Owner);
      const dlp2OwnerInitialBalance = await ethers.provider.getBalance(dlp2Owner);

      const tx1 = await root.connect(dlp1Owner).claimUnsentReward(dlp1, 1);
      const receipt1 = await tx1.wait();

      await tx1.should
        .emit(root, 'EpochRewardClaimed')
        .withArgs(dlp1, 1, (parseEther('0.25') * epochRewardAmount / parseEther('1')));

      const tx2 = await root.connect(dlp2Owner).claimUnsentReward(dlp2, 2);
      const receipt2 = await tx2.wait();

      await tx2.should
        .emit(root, 'EpochRewardClaimed')
        .withArgs(dlp2, 2, (parseEther('0.4') * epochRewardAmount * 3n / parseEther('1')));

      const epoch1RewardsAfter = await root.epochRewards(1);
      epoch1RewardsAfter.dlps.should.deep.eq([dlp1.address, dlp2.address]);
      epoch1RewardsAfter.scores.should.deep.eq([parseEther('0.25'), parseEther('0.75')]);
      epoch1RewardsAfter.withdrawnAmounts.should.deep.eq([
        (parseEther('0.25') * epochRewardAmount / parseEther('1')),
        0n
      ]);

      const epoch2RewardsAfter = await root.epochRewards(2);
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
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('100') });
      await root.connect(owner).approveDlp(dlp1);
      await root.connect(owner).approveDlp(dlp2);

      await root.totalDlpsRewardAmount().should.eventually.eq(0);

      await root.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(2);

      await root.createEpochs();

      await root.addRewardForDlps({ value: parseEther('100') });

      await root.connect(dlp1Owner).claimUnsentReward(dlp1, 1);

      await root.connect(dlp1Owner).claimUnsentReward(dlp1, 1).should.be.rejectedWith('NothingToClaim()');
    });

    it("should reject claimUnsentReward when already sent", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('100') });
      await root.connect(owner).approveDlp(dlp1);
      await root.connect(owner).approveDlp(dlp2);

      await root.totalDlpsRewardAmount().should.eventually.eq(0);

      await root.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(2);

      await root.addRewardForDlps({ value: parseEther('100') });

      await root.createEpochs();

      await root.connect(dlp1Owner).claimUnsentReward(dlp1, 1).should.be.rejectedWith('NothingToClaim()');
    });

    it("should reject claimUnsentReward when epoch not finalized", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('100') });
      await root.connect(owner).approveDlp(dlp1);
      await root.connect(owner).approveDlp(dlp2);

      await root.totalDlpsRewardAmount().should.eventually.eq(0);

      await root.connect(owner).updateScores([dlp1, dlp2], [parseEther('0.25'), parseEther('0.75')]);

      await advanceToEpochN(2);

      await root.createEpochs();

      await root.addRewardForDlps({ value: parseEther('100') });

      await root.connect(dlp1Owner).claimUnsentReward(dlp1, 2).should.be.rejectedWith('NothingToClaim()');
    });

    it("should reject claimUnsentReward when epoch not active validator", async function () {
      await root.connect(dlp1Owner).registerDlp(dlp1, dlp1Owner, false, { value: parseEther('100') });
      await root.connect(dlp2Owner).registerDlp(dlp2, dlp2Owner, false, { value: parseEther('100') });
      await root.connect(owner).approveDlp(dlp1);
      await root.connect(owner).approveDlp(dlp2);

      await root.connect(dlp1Owner).deregisterDlp(dlp1);

      await root.totalDlpsRewardAmount().should.eventually.eq(0);

      await root.connect(owner).updateScores([dlp2], [parseEther('1')]);

      await advanceToEpochN(2);

      await root.createEpochs();

      await root.addRewardForDlps({ value: parseEther('100') });

      await root.connect(dlp1Owner).claimUnsentReward(dlp1, 1).should.be.rejectedWith('NothingToClaim()');
    });
  });
});
