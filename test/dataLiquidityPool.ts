import chai, { should } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers, upgrades } from "hardhat";
import { BigNumberish, parseEther } from "ethers";
import { HDOG, DataLiquidityPool } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { advanceBlockNTimes, advanceNSeconds, advanceTimeAndBlock, advanceToBlockN, getCurrentBlockNumber, getCurrentBlockTimestamp } from "../utils/timeAndBlockManipulation";

chai.use(chaiAsPromised);
should();

async function advanceTime(seconds) {
  await ethers.provider.send('evm_increaseTime', [seconds]);
  await ethers.provider.send('evm_mine');
}

describe("DataLiquidityPoolStaking", () => {
  enum ValidatorStatus {
    None,
    Registered,
    Active,
    Inactive,
    Deregistered,
  };

  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let v1: HardhatEthersSigner;
  let v1Owner: HardhatEthersSigner;
  let v2: HardhatEthersSigner;
  let v2Owner: HardhatEthersSigner;
  let v3: HardhatEthersSigner;
  let v3Owner: HardhatEthersSigner;
  let v4: HardhatEthersSigner;
  let v4Owner: HardhatEthersSigner;
  let v5: HardhatEthersSigner;
  let v5Owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;
  let user4: HardhatEthersSigner;
  let user5: HardhatEthersSigner;
  let user6: HardhatEthersSigner;
  let user7: HardhatEthersSigner;
  let user8: HardhatEthersSigner;
  let user9: HardhatEthersSigner;
  let user10: HardhatEthersSigner;
  let user11: HardhatEthersSigner;
  let user12: HardhatEthersSigner;
  let user13: HardhatEthersSigner;
  let user14: HardhatEthersSigner;
  let user15: HardhatEthersSigner;

  let dlp: DataLiquidityPool;
  let dlpt: HDOG;

  const maxNumberOfValidators = 9;
  const validatorScoreMinTrust = parseEther('0.1');
  const validatorScoreKappa = parseEther('0.5');
  const validatorScoreRho = parseEther('1');
  const validationPeriod = 120;
  const epochSize = 100;
  const minStakeAmount = parseEther('50');
  let startBlock: number;
  let epochRewardAmount = parseEther('2');
  let fileRewardFactor = parseEther('3');
  let fileRewardDelay = 3600 * 24 * 7;

  const deploy = async () => {
    [
      deployer, owner,
      v1, v1Owner, v2, v2Owner, v3, v3Owner, v4, v4Owner, v5, v5Owner,
      user1, user2, user3, user4, user5, user6, user7, user8, user9, user10, user11, user12, user13, user14, user15
    ] = await ethers.getSigners();

    const dlptDeploy = await ethers.deployContract("HDOG", [owner]);
    dlpt = await ethers.getContractAt("HDOG", dlptDeploy.target);

    startBlock = await getCurrentBlockNumber() + 1;

    const dlpDeploy = await upgrades.deployProxy(
      await ethers.getContractFactory("DataLiquidityPool"),
      [
        owner.address,
        dlpt.target,
        maxNumberOfValidators,
        validatorScoreMinTrust,
        validatorScoreKappa,
        validatorScoreRho,
        validationPeriod,
        minStakeAmount,
        startBlock,
        epochSize,
        epochRewardAmount,
        fileRewardFactor,
        fileRewardDelay
      ],
      {
        kind: "uups"
      }
    );

    dlp = await ethers.getContractAt("DataLiquidityPool", dlpDeploy.target);

    await dlpt.connect(owner).mint(v1Owner, parseEther('1000000'));
    await dlpt.connect(owner).mint(v2Owner, parseEther('1000000'));
    await dlpt.connect(owner).mint(v3Owner, parseEther('1000000'));
    await dlpt.connect(owner).mint(v4Owner, parseEther('1000000'));
    await dlpt.connect(owner).mint(v5Owner, parseEther('1000000'));
    await dlpt.connect(owner).mint(owner, parseEther('1000000'));
    await dlpt.connect(owner).mint(user1, parseEther('1000000'));
  }

  async function advanceToEpochN(epochNumber: number) {
    const epochNStartBlock =
      startBlock + (epochNumber - 1) * epochSize;

    await advanceToBlockN(epochNStartBlock);
  }

  describe("Setup", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should have correct params after deploy", async function () {
      (await dlp.owner()).should.eq(owner);
      (await dlp.maxNumberOfValidators()).should.eq(maxNumberOfValidators);
      (await dlp.validatorScoreMinTrust()).should.eq(validatorScoreMinTrust);
      (await dlp.validatorScoreKappa()).should.eq(validatorScoreKappa);
      (await dlp.validatorScoreRho()).should.eq(validatorScoreRho);
      (await dlp.validationPeriod()).should.eq(validationPeriod);
      (await dlp.minStakeAmount()).should.eq(minStakeAmount);
      (await dlp.epochSize()).should.eq(epochSize);
      (await dlp.epochRewardAmount()).should.eq(epochRewardAmount);
      (await dlp.paused()).should.eq(false);
      (await dlp.fileRewardDelay()).should.eq(fileRewardDelay);
      (await dlp.fileRewardFactor()).should.eq(fileRewardFactor);

      (await dlp.epochsCount()).should.eq(1);

      const epoch = await dlp.epochs(1);
      epoch.startBlock.should.eq(startBlock);
      epoch.endBlock.should.eq(startBlock + epochSize - 1);
      epoch.reward.should.eq(epochRewardAmount);
      epoch.validatorsListId.should.eq(0);
      (await dlp.validatorsCount()).should.eq(0);
      (await dlp.filesCount()).should.eq(0);
      (await dlp.activeValidatorsListsCount()).should.eq(0);
      (await dlp.validatorsWithFilesToVerify()).should.deep.eq([ethers.ZeroAddress]);
    });

    it("Should pause if owner", async function () {
      await dlp.connect(owner).pause()
        .should.emit(dlp, 'Paused')
        .withArgs(owner.address);
      (await dlp.paused()).should.be.equal(true);
    });

    it("Should not pause if not owner", async function () {
      await dlp.connect(v1)
        .pause()
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1.address}")`
        );
      (await dlp.paused()).should.be.equal(false);
    });

    it("Should unpause if owner", async function () {
      await dlp.connect(owner).pause();
      await dlp.connect(owner).unpause()
        .should.emit(dlp, 'Unpaused')
        .withArgs(owner.address);
      (await dlp.paused()).should.be.equal(false);
    });

    it("Should not unpause if not owner", async function () {
      await dlp.connect(owner).pause();
      await dlp.connect(v1Owner)
        .unpause()
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1Owner.address}")`
        );
      (await dlp.paused()).should.be.equal(true);
    });

    it("Should updateMaxNumberOfValidators if owner", async function () {
      await dlp.connect(owner).updateMaxNumberOfValidators(123)
        .should.emit(dlp, 'MaxNumberOfValidatorsUpdated')
        .withArgs(123);

      (await dlp.maxNumberOfValidators()).should.eq(123);
    });

    it("Should not updateMaxNumberOfValidators if not owner", async function () {
      await dlp.connect(v1).updateMaxNumberOfValidators(123)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1.address}")`
        );

      (await dlp.maxNumberOfValidators()).should.eq(maxNumberOfValidators);
    });

    it("Should updateEpochSize if owner", async function () {
      await dlp.connect(owner).updateEpochSize(123)
        .should.emit(dlp, 'EpochSizeUpdated')
        .withArgs(123);

      (await dlp.epochSize()).should.eq(123);
    });

    it("Should not updateEpochSize if not owner", async function () {
      await dlp.connect(v1).updateEpochSize(123)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1.address}")`
        );

      (await dlp.epochSize()).should.eq(epochSize);
    });

    it("Should updateEpochRewardAmount if owner", async function () {
      await dlp.connect(owner).updateEpochRewardAmount(123)
        .should.emit(dlp, 'EpochRewardAmountUpdated')
        .withArgs(123);

      (await dlp.epochRewardAmount()).should.eq(123);
    });

    it("Should not updateEpochSize if not owner", async function () {
      await dlp.connect(v1).updateEpochRewardAmount(123)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1.address}")`
        );

      (await dlp.epochRewardAmount()).should.eq(epochRewardAmount);
    });

    it("Should updateValidationPeriod if owner", async function () {
      await dlp.connect(owner).updateValidationPeriod(123)
        .should.emit(dlp, 'ValidationPeriodUpdated')
        .withArgs(123);

      (await dlp.validationPeriod()).should.eq(123);
    });

    it("Should not updateEpochSize if not owner", async function () {
      await dlp.connect(v1).updateValidationPeriod(123)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1.address}")`
        );

      (await dlp.validationPeriod()).should.eq(validationPeriod);
    });

    it("Should updateValidatorScoreMinTrust if owner", async function () {
      await dlp.connect(owner).updateValidatorScoreMinTrust(parseEther('0.2'))
        .should.emit(dlp, 'ValidatorScoreMinTrustUpdated')
        .withArgs(parseEther('0.2'));

      (await dlp.validatorScoreMinTrust()).should.eq(parseEther('0.2'));
    });

    it("Should not updateValidatorScoreMinTrust if not owner", async function () {
      await dlp.connect(v1).updateValidatorScoreMinTrust(parseEther('0.2'))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1.address}")`
        );

      (await dlp.validatorScoreMinTrust()).should.eq(validatorScoreMinTrust);
    });

    it("Should updateValidatorScoreKappa if owner", async function () {
      await dlp.connect(owner).updateValidatorScoreKappa(parseEther('0.2'))
        .should.emit(dlp, 'ValidatorScoreKappaUpdated')
        .withArgs(parseEther('0.2'));

      (await dlp.validatorScoreKappa()).should.eq(parseEther('0.2'));
    });

    it("Should not updateValidatorScoreKappa if not owner", async function () {
      await dlp.connect(v1).updateValidatorScoreKappa(parseEther('0.2'))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1.address}")`
        );

      (await dlp.validatorScoreKappa()).should.eq(validatorScoreKappa);
    });

    it("Should updateValidatorScoreRho if owner", async function () {
      await dlp.connect(owner).updateValidatorScoreRho(parseEther('0.2'))
        .should.emit(dlp, 'ValidatorScoreRhoUpdated')
        .withArgs(parseEther('0.2'));

      (await dlp.validatorScoreRho()).should.eq(parseEther('0.2'));
    });

    it("Should not updateValidatorScoreRho if not owner", async function () {
      await dlp.connect(v1).updateValidatorScoreRho(parseEther('0.2'))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1.address}")`
        );

      (await dlp.validatorScoreRho()).should.eq(validatorScoreRho);
    });

    it("Should updateMinStakeAmount if owner", async function () {
      await dlp.connect(owner).updateMinStakeAmount(parseEther('0.2'))
        .should.emit(dlp, 'MinStakeAmountUpdated')
        .withArgs(parseEther('0.2'));

      (await dlp.minStakeAmount()).should.eq(parseEther('0.2'));
    });

    it("Should not updateMinStakeAmount if not owner", async function () {
      await dlp.connect(v1).updateMinStakeAmount(parseEther('0.2'))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1.address}")`
        );

      (await dlp.minStakeAmount()).should.eq(minStakeAmount);
    });

    it("Should updateFileRewardFactor if owner", async function () {
      await dlp.connect(owner).updateFileRewardFactor(fileRewardFactor + 1n)
        .should.emit(dlp, 'FileRewardFactorUpdated')
        .withArgs(fileRewardFactor + 1n);

      (await dlp.fileRewardFactor()).should.eq(fileRewardFactor + 1n);
    });

    it("Should not updateFileRewardFactor if not owner", async function () {
      await dlp.connect(v1).updateFileRewardFactor(fileRewardFactor + 1n)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1.address}")`
        );

      (await dlp.fileRewardFactor()).should.eq(fileRewardFactor);
    });

    it("Should updateFileRewardDelay if owner", async function () {
      await dlp.connect(owner).updateFileRewardDelay(fileRewardDelay + 1)
        .should.emit(dlp, 'FileRewardDelayUpdated')
        .withArgs(fileRewardDelay + 1);

      (await dlp.fileRewardDelay()).should.eq(fileRewardDelay + 1);
    });

    it("Should not updateFileRewardDelay if not owner", async function () {
      await dlp.connect(v1).updateFileRewardDelay(fileRewardDelay + 1)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1.address}")`
        );

      (await dlp.fileRewardDelay()).should.eq(fileRewardDelay);
    });
  });

  describe("Epochs", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should createEpochs after the end of the previous one", async function () {
      await advanceToEpochN(2);

      const epoch1 = await dlp.epochs(1);
      epoch1.startBlock.should.eq(startBlock);
      epoch1.endBlock.should.eq(startBlock + epochSize - 1);
      epoch1.reward.should.eq(epochRewardAmount);
      epoch1.validatorsListId.should.eq(0);

      let epoch2 = await dlp.epochs(2);
      epoch2.startBlock.should.eq(0);
      epoch2.endBlock.should.eq(0);
      epoch2.reward.should.eq(0);
      epoch2.validatorsListId.should.eq(0);

      await dlp.connect(owner).createEpochs()
        .should.emit(dlp, 'EpochCreated')
        .withArgs(2);

      (await dlp.epochsCount()).should.eq(2);

      epoch2 = await dlp.epochs(2);
      epoch2.startBlock.should.eq(startBlock + epochSize);
      epoch2.endBlock.should.eq(startBlock + 2 * epochSize - 1);
      epoch2.reward.should.eq(epochRewardAmount);
      epoch2.validatorsListId.should.eq(0);
    });

    it("should createEpochs after long time", async function () {
      await advanceToEpochN(4);
      await dlp.connect(owner).createEpochs().should
        .emit(dlp, 'EpochCreated').withArgs(2)
        .emit(dlp, 'EpochCreated').withArgs(3)
        .emit(dlp, 'EpochCreated').withArgs(4);

      (await dlp.epochsCount()).should.eq(4);

      const epoch2 = await dlp.epochs(2);
      epoch2.startBlock.should.eq(startBlock + epochSize);
      epoch2.endBlock.should.eq(startBlock + 2 * epochSize - 1);
      epoch2.reward.should.eq(epochRewardAmount);
      epoch2.validatorsListId.should.eq(0);

      const epoch3 = await dlp.epochs(3);
      epoch3.startBlock.should.eq(startBlock + 2 * epochSize);
      epoch3.endBlock.should.eq(startBlock + 3 * epochSize - 1);
      epoch3.reward.should.eq(epochRewardAmount);
      epoch3.validatorsListId.should.eq(0);

      const epoch4 = await dlp.epochs(4);
      epoch4.startBlock.should.eq(startBlock + 3 * epochSize);
      epoch4.endBlock.should.eq(startBlock + 4 * epochSize - 1);
      epoch4.reward.should.eq(epochRewardAmount);
      epoch4.validatorsListId.should.eq(0);
    });

    it("should createEpochsUntilBlockNumber after long time", async function () {
      await advanceToEpochN(7);

      const epoch4StartBlock = startBlock + 3 * epochSize;
      await dlp.connect(owner).createEpochsUntilBlockNumber(epoch4StartBlock).should
        .emit(dlp, 'EpochCreated').withArgs(2)
        .emit(dlp, 'EpochCreated').withArgs(3)
        .emit(dlp, 'EpochCreated').withArgs(4);

      (await dlp.epochsCount()).should.eq(4);

      const epoch2 = await dlp.epochs(2);
      epoch2.startBlock.should.eq(startBlock + epochSize);
      epoch2.endBlock.should.eq(startBlock + 2 * epochSize - 1);
      epoch2.reward.should.eq(epochRewardAmount);
      epoch2.validatorsListId.should.eq(0);

      const epoch3 = await dlp.epochs(3);
      epoch3.startBlock.should.eq(startBlock + 2 * epochSize);
      epoch3.endBlock.should.eq(startBlock + 3 * epochSize - 1);
      epoch3.reward.should.eq(epochRewardAmount);
      epoch3.validatorsListId.should.eq(0);

      const epoch4 = await dlp.epochs(4);
      epoch4.startBlock.should.eq(startBlock + 3 * epochSize);
      epoch4.endBlock.should.eq(startBlock + 4 * epochSize - 1);
      epoch4.reward.should.eq(epochRewardAmount);
      epoch4.validatorsListId.should.eq(0);
    });

    it("should process epochs with no active validators without errors", async function () {
      await advanceToEpochN(3);
      await dlp.connect(owner).createEpochs();

      for (let i = 1; i <= 2; i++) {
        (await dlp.epochs(i)).validatorsListId.should.eq(0);
      }
    });

    it("should process an empty epoch and an epoch with validators", async function () {
      await advanceToEpochN(3);

      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlpt.connect(v2Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(v2Owner).registerValidator(v2, v2Owner, parseEther('100'));
      await dlp.connect(owner).approveValidator(v1);
      await dlp.connect(owner).approveValidator(v2);

      await dlp.connect(v1).updateWeights([v1, v2], [parseEther('1'), parseEther('1')]);
      await dlp.connect(v2).updateWeights([v1, v2], [parseEther('1'), parseEther('1')]);

      await advanceToEpochN(4);

      await dlp.connect(v1).updateWeights([v1, v2], [parseEther('1'), parseEther('1')]);

      const epoch1 = await dlp.epochs(1);
      epoch1.validatorsListId.should.eq(0);

      const epoch2 = await dlp.epochs(2);
      epoch2.validatorsListId.should.eq(0);

      const epoch3 = await dlp.epochs(3);
      epoch3.validatorsListId.should.not.eq(0);
    });

    it("should process multiple empty epochs and an epoch with validators", async function () {
      await advanceToEpochN(3);

      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlpt.connect(v2Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(v2Owner).registerValidator(v2, v2Owner, parseEther('100'));
      await dlp.connect(owner).approveValidator(v1);
      await dlp.connect(owner).approveValidator(v2);

      await dlp.connect(v1).updateWeights([v1, v2], [parseEther('1'), parseEther('1')]);
      await dlp.connect(v2).updateWeights([v1, v2], [parseEther('1'), parseEther('1')]);

      await advanceToEpochN(4);

      await dlp.connect(v1).updateWeights([v1, v2], [parseEther('1'), parseEther('1')]);

      for (let i = 1; i <= 2; i++) {
        const epoch = await dlp.epochs(i);
        epoch.validatorsListId.should.eq(0);
      }

      const epoch3 = await dlp.epochs(3);
      epoch3.validatorsListId.should.not.eq(0);
    });

    it("should createRewardPeriods without staking", async function () {
      await advanceToEpochN(3);

      await dlp.connect(owner).updateMinStakeAmount(0);

      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlpt.connect(v2Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(v2Owner).registerValidator(v2, v2Owner, parseEther('100'));
      await dlp.connect(owner).approveValidator(v1);
      await dlp.connect(owner).approveValidator(v2);

      await dlp.connect(v1).updateWeights([v1, v2], [parseEther('1'), parseEther('1')]);
      await dlp.connect(v2).updateWeights([v1, v2], [parseEther('1'), parseEther('1')]);

      await advanceToEpochN(4);

      await dlp.connect(v1)
        .createEpochs()
        .should.emit(dlp, 'EpochCreated').withArgs(4)

      const epoch4 = await dlp.epochs(4);
      epoch4.startBlock.should.eq(startBlock + 3 * epochSize);
      epoch4.endBlock.should.eq(startBlock + 4 * epochSize - 1);
      epoch4.reward.should.eq(epochRewardAmount);
      epoch4.validatorsListId.should.eq(2);
    });
  });

  describe("Files", () => {
    beforeEach(async () => {
      await deploy();

      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlpt.connect(v2Owner).approve(dlp, parseEther('100'));
      await dlpt.connect(v3Owner).approve(dlp, parseEther('100'));
      await dlpt.connect(v4Owner).approve(dlp, parseEther('100'));
      await dlpt.connect(v5Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(v2Owner).registerValidator(v2, v2Owner, parseEther('100'));
      await dlp.connect(v3Owner).registerValidator(v3, v3Owner, parseEther('100'));
      await dlp.connect(v4Owner).registerValidator(v4, v4Owner, parseEther('100'));
      await dlp.connect(v5Owner).registerValidator(v5, v5Owner, parseEther('100'));

      await dlp.connect(owner).approveValidator(v1);
      await dlp.connect(owner).approveValidator(v2);
      await dlp.connect(owner).approveValidator(v3);

      await dlp.connect(v1).updateWeights([v1, v2, v3], [parseEther('1'), parseEther('1'), parseEther('1')]);
    });

    it("should addFile", async function () {
      await dlp.connect(user1).addFile('file1URL', "file1EncryptedAddress")
        .should.emit(dlp, 'FileAdded')
        .withArgs(user1, 1);
      const timestamp = await getCurrentBlockTimestamp();

      (await dlp.filesCount()).should.eq(1)

      const file1 = await dlp.files(1);
      file1.contributorAddress.should.eq(user1);
      file1.url.should.eq('file1URL');
      file1.encryptedKey.should.eq('file1EncryptedAddress');
      file1.addedAt.should.eq(timestamp);
      file1.reward.should.eq(0);
      file1.rewardWithdrawn.should.eq(0);
      file1.verificationsCount.should.eq(0);
      file1.isVerified.should.eq(false);
    });

    it("should addFile multiple times", async function () {
      const timestamp = await getCurrentBlockTimestamp();
      await dlp.connect(user1).addFile('file1URL', "file1EncryptedAddress")
        .should.emit(dlp, 'FileAdded')
        .withArgs(user1.address, 1);
      await dlp.connect(user1).addFile('file2URL', "file2EncryptedAddress")
        .should.emit(dlp, 'FileAdded')
        .withArgs(user1.address, 2);
      await dlp.connect(user1).addFile('file3URL', "file3EncryptedAddress")
        .should.emit(dlp, 'FileAdded')
        .withArgs(user1.address, 3);

      (await dlp.filesCount()).should.eq(3)

      const file1 = await dlp.files(1);
      file1.contributorAddress.should.eq(user1.address);
      file1.url.should.eq('file1URL');
      file1.encryptedKey.should.eq('file1EncryptedAddress');
      file1.addedAt.should.eq(timestamp + 1);
      file1.verificationsCount.should.eq(0);

      const file2 = await dlp.files(2);
      file2.contributorAddress.should.eq(user1.address);
      file2.url.should.eq('file2URL');
      file2.encryptedKey.should.eq('file2EncryptedAddress');
      file1.addedAt.should.eq(timestamp + 1);
      file2.verificationsCount.should.eq(0);

      const file3 = await dlp.files(3);
      file3.contributorAddress.should.eq(user1.address);
      file3.url.should.eq('file3URL');
      file3.encryptedKey.should.eq('file3EncryptedAddress');
      file1.addedAt.should.eq(timestamp + 1);
      file3.verificationsCount.should.eq(0);
    });

    it("should not addFile with same url", async function () {
      await dlp.connect(user1).addFile('file1URL', "file1EncryptedAddress")
        .should.be.fulfilled;
      await dlp.connect(user1).addFile('file1URL', "file2EncryptedAddress")
        .should.be.rejectedWith('FileAlreadyAdded');
    });

    it("should create epochs when adding files", async function () {
      await advanceToEpochN(4);
      await dlp.connect(user1).addFile('file1URL', "file1EncryptedAddress").should
        .emit(dlp, 'FileAdded').withArgs(user1, 1)
        .emit(dlp, 'EpochCreated').withArgs(2)
        .emit(dlp, 'EpochCreated').withArgs(3)
        .emit(dlp, 'EpochCreated').withArgs(4);

      (await dlp.epochsCount()).should.eq(4);

      const epoch2 = await dlp.epochs(2);
      epoch2.startBlock.should.eq(startBlock + epochSize);
      epoch2.endBlock.should.eq(startBlock + 2 * epochSize - 1);
      epoch2.reward.should.eq(epochRewardAmount);
      epoch2.validatorsListId.should.eq(3);

      const epoch3 = await dlp.epochs(3);
      epoch3.startBlock.should.eq(startBlock + 2 * epochSize);
      epoch3.endBlock.should.eq(startBlock + 3 * epochSize - 1);
      epoch3.reward.should.eq(epochRewardAmount);
      epoch3.validatorsListId.should.eq(3);

      const epoch4 = await dlp.epochs(4);
      epoch4.startBlock.should.eq(startBlock + 3 * epochSize);
      epoch4.endBlock.should.eq(startBlock + 4 * epochSize - 1);
      epoch4.reward.should.eq(epochRewardAmount);
      epoch4.validatorsListId.should.eq(3);
    });
  });

  describe("Validators - registration", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should registerValidator", async function () {
      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'))
        .should.emit(dlp, 'ValidatorRegistered')
        .withArgs(v1.address, v1Owner.address, parseEther('100'));

      (await dlp.validatorsCount()).should.eq(1);


      const validator1 = await dlp.validatorsInfo(v1);

      validator1.validatorAddress.should.eq(v1);
      validator1.ownerAddress.should.eq(v1Owner.address);
      validator1.stakeAmount.should.eq(parseEther('100'));
      validator1.status.should.eq(ValidatorStatus.Registered);
      validator1.filesToVerifyIndex.should.eq(0);
      validator1.filesToVerifyCount.should.eq(0);
      validator1.grantedAmount.should.eq(0);
      validator1.firstBlockNumber.should.eq(0);
      validator1.lastBlockNumber.should.eq(0);

      (await dlp.validatorsCount()).should.eq(1);
      (await dlp.validators(1)).should.deep.eq(validator1);

      (await dlp.activeValidatorsListsCount()).should.eq(0);
    });

    it("should registerValidator as sponsor", async function () {
      await dlpt.connect(v2Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v2Owner).registerValidator(v1, v1Owner, parseEther('100'))
        .should.emit(dlp, 'ValidatorRegistered')
        .withArgs(v1.address, v1Owner.address, parseEther('100'));

      (await dlp.validatorsCount()).should.eq(1);


      const validator1 = await dlp.validatorsInfo(v1);

      validator1.validatorAddress.should.eq(v1);
      validator1.ownerAddress.should.eq(v1Owner.address);
      validator1.stakeAmount.should.eq(parseEther('100'));
      validator1.status.should.eq(ValidatorStatus.Registered);
      validator1.filesToVerifyIndex.should.eq(0);
      validator1.filesToVerifyCount.should.eq(0);
      validator1.grantedAmount.should.eq(0);
      validator1.firstBlockNumber.should.eq(0);
      validator1.lastBlockNumber.should.eq(0);

      (await dlp.validatorsCount()).should.eq(1);
      (await dlp.validators(1)).should.deep.eq(validator1);

      (await dlp.activeValidatorsListsCount()).should.eq(0);
    });


    it("should registerValidator as DLP owner", async function () {
      await dlpt.connect(owner).approve(dlp, parseEther('100'));
      await dlp.connect(owner).registerValidator(v1, v1Owner, parseEther('100'))
        .should.emit(dlp, 'ValidatorRegistered')
        .withArgs(v1.address, v1Owner.address, parseEther('100'));

      (await dlp.validatorsCount()).should.eq(1);


      const validator1 = await dlp.validatorsInfo(v1);

      validator1.validatorAddress.should.eq(v1);
      validator1.ownerAddress.should.eq(v1Owner.address);
      validator1.stakeAmount.should.eq(parseEther('100'));
      validator1.status.should.eq(ValidatorStatus.Registered);
      validator1.filesToVerifyIndex.should.eq(0);
      validator1.filesToVerifyCount.should.eq(0);
      validator1.grantedAmount.should.eq(parseEther('100'));
      validator1.firstBlockNumber.should.eq(0);
      validator1.lastBlockNumber.should.eq(0);

      (await dlp.validatorsCount()).should.eq(1);
      (await dlp.validators(1)).should.deep.eq(validator1);

      (await dlp.activeValidatorsListsCount()).should.eq(0);
    });

    it("should registerValidator many times", async function () {
      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlpt.connect(v2Owner).approve(dlp, parseEther('200'));
      await dlpt.connect(v3Owner).approve(dlp, parseEther('300'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'))
        .should.emit(dlp, 'ValidatorRegistered')
        .withArgs(v1.address, v1Owner.address, parseEther('100'));
      await dlp.connect(v2Owner).registerValidator(v2, v2Owner, parseEther('200'))
        .should.emit(dlp, 'ValidatorRegistered')
        .withArgs(v2.address, v2Owner.address, parseEther('200'));
      await dlp.connect(v3Owner).registerValidator(v3, v3Owner, parseEther('300'))
        .should.emit(dlp, 'ValidatorRegistered')
        .withArgs(v3.address, v3Owner.address, parseEther('300'));

      (await dlp.validatorsCount()).should.eq(3);


      const validator1 = await dlp.validatorsInfo(v1);
      validator1.validatorAddress.should.eq(v1);
      validator1.ownerAddress.should.eq(v1Owner.address);
      validator1.stakeAmount.should.eq(parseEther('100'));
      validator1.status.should.eq(ValidatorStatus.Registered);
      validator1.filesToVerifyIndex.should.eq(0);
      validator1.filesToVerifyCount.should.eq(0);
      validator1.grantedAmount.should.eq(0);
      validator1.firstBlockNumber.should.eq(0);
      validator1.lastBlockNumber.should.eq(0);

      const validator2 = await dlp.validatorsInfo(v2);
      validator2.validatorAddress.should.eq(v2);
      validator2.ownerAddress.should.eq(v2Owner.address);
      validator2.stakeAmount.should.eq(parseEther('200'));
      validator2.status.should.eq(ValidatorStatus.Registered);
      validator2.filesToVerifyIndex.should.eq(0);
      validator2.filesToVerifyCount.should.eq(0);
      validator2.grantedAmount.should.eq(0);
      validator2.firstBlockNumber.should.eq(0);
      validator2.lastBlockNumber.should.eq(0);

      const validator3 = await dlp.validatorsInfo(v3);
      validator3.validatorAddress.should.eq(v3);
      validator3.ownerAddress.should.eq(v3Owner.address);
      validator3.stakeAmount.should.eq(parseEther('300'));
      validator3.status.should.eq(ValidatorStatus.Registered);
      validator3.filesToVerifyIndex.should.eq(0);
      validator3.filesToVerifyCount.should.eq(0);
      validator3.grantedAmount.should.eq(0);
      validator3.firstBlockNumber.should.eq(0);
      validator3.lastBlockNumber.should.eq(0);

      (await dlp.validatorsCount()).should.eq(3);
      (await dlp.validators(1)).should.deep.eq(validator1);
      (await dlp.validators(2)).should.deep.eq(validator2);
      (await dlp.validators(3)).should.deep.eq(validator3);

      (await dlp.activeValidatorsListsCount()).should.eq(0);
    });

    it("should not registerValidator if not enough stake", async function () {
      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('1'))
        .should.be.rejectedWith(
          `InvalidStakeAmount()`
        );
    });

    it("should not registerValidator if already registered", async function () {
      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'))
        .should.be.rejectedWith(
          `InvalidValidatorStatus(${ValidatorStatus.None}, ${ValidatorStatus.Registered})`
        );
    });

    it("should not registerValidator if already approved", async function () {
      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(owner).approveValidator(v1);
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'))
        .should.be.rejectedWith(
          `InvalidValidatorStatus(${ValidatorStatus.None}, ${ValidatorStatus.Active})`
        );
    });

    it("should not registerValidator if inactivated", async function () {
      await dlpt.connect(v1Owner).approve(dlp, parseEther('200'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(owner).approveValidator(v1);
      await dlp.connect(v1Owner).inactivateValidator(v1);
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'))
        .should.be.rejectedWith(
          `InvalidValidatorStatus(${ValidatorStatus.None}, ${ValidatorStatus.Inactive})`
        );
    });

    it("should not registerValidator if deregistered", async function () {
      await dlpt.connect(v1Owner).approve(dlp, parseEther('200'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(owner).approveValidator(v1);
      await dlp.connect(v1Owner).deregisterValidator(v1);
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'))
        .should.be.rejectedWith(
          `InvalidValidatorStatus(${ValidatorStatus.None}, ${ValidatorStatus.Deregistered})`
        );
    });

    it("should approveValidator if owner", async function () {
      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(owner).approveValidator(v1)
        .should.emit(dlp, 'ValidatorApproved')
        .withArgs(v1.address);

      const validator1 = await dlp.validatorsInfo(v1);
      validator1.validatorAddress.should.eq(v1);
      validator1.status.should.eq(ValidatorStatus.Active);
      validator1.firstBlockNumber.should.eq(await getCurrentBlockNumber());
      validator1.lastBlockNumber.should.eq(0);

      (await dlp.validatorsCount()).should.eq(1);
      (await dlp.validators(1)).should.deep.eq(validator1);

      (await dlp.activeValidatorsListsCount()).should.eq(1);
      (await await dlp.activeValidatorsLists(1)).should.deep.eq([v1.address]);

      (await dlp.epochs(1)).validatorsListId.should.eq(1);
    });

    it("should approve many validators", async function () {
      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlpt.connect(v2Owner).approve(dlp, parseEther('200'));
      await dlpt.connect(v3Owner).approve(dlp, parseEther('300'));
      await dlpt.connect(v4Owner).approve(dlp, parseEther('400'));
      await dlpt.connect(v5Owner).approve(dlp, parseEther('500'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(v2Owner).registerValidator(v2, v2Owner, parseEther('200'));
      await dlp.connect(v3Owner).registerValidator(v3, v3Owner, parseEther('300'));
      await dlp.connect(v4Owner).registerValidator(v4, v4Owner, parseEther('400'));
      await dlp.connect(v5Owner).registerValidator(v5, v5Owner, parseEther('500'));

      const currentBlockNumber = await getCurrentBlockNumber();

      await dlp.connect(owner).approveValidator(v1);
      await dlp.connect(owner).approveValidator(v2);
      await dlp.connect(owner).approveValidator(v3);

      const validator1 = await dlp.validatorsInfo(v1);
      validator1.validatorAddress.should.eq(v1);
      validator1.status.should.eq(ValidatorStatus.Active);
      validator1.firstBlockNumber.should.eq(currentBlockNumber + 1);
      validator1.lastBlockNumber.should.eq(0);

      const validator2 = await dlp.validatorsInfo(v2);
      validator2.validatorAddress.should.eq(v2);
      validator2.status.should.eq(ValidatorStatus.Active);
      validator2.firstBlockNumber.should.eq(currentBlockNumber + 2);
      validator2.lastBlockNumber.should.eq(0);

      const validator3 = await dlp.validatorsInfo(v3);
      validator3.validatorAddress.should.eq(v3);
      validator3.status.should.eq(ValidatorStatus.Active);
      validator3.firstBlockNumber.should.eq(currentBlockNumber + 3);
      validator3.lastBlockNumber.should.eq(0);

      const validator4 = await dlp.validatorsInfo(v4);
      validator4.validatorAddress.should.eq(v4);
      validator4.status.should.eq(ValidatorStatus.Registered);
      validator4.firstBlockNumber.should.eq(0);
      validator4.lastBlockNumber.should.eq(0);

      const validator5 = await dlp.validatorsInfo(v5);
      validator5.validatorAddress.should.eq(v5);
      validator5.status.should.eq(ValidatorStatus.Registered);
      validator5.firstBlockNumber.should.eq(0);

      (await dlp.validatorsCount()).should.eq(5);
      (await dlp.validators(1)).should.deep.eq(validator1);
      (await dlp.validators(2)).should.deep.eq(validator2);
      (await dlp.validators(3)).should.deep.eq(validator3);
      (await dlp.validators(4)).should.deep.eq(validator4);
      (await dlp.validators(5)).should.deep.eq(validator5);

      (await dlp.activeValidatorsListsCount()).should.eq(3);
      (await dlp.activeValidatorsLists(1)).should.deep.eq([v1.address]);
      (await dlp.activeValidatorsLists(2)).should.deep.eq([v1.address, v2.address]);
      (await dlp.activeValidatorsLists(3)).should.deep.eq([v1.address, v2.address, v3.address]);

      (await dlp.epochs(1)).validatorsListId.should.eq(3);
    });

    it("should not approveValidator if not owner", async function () {
      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(v1Owner).approveValidator(v1)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1Owner.address}")`
        );
    });

    it("should not approveValidator if already approved", async function () {
      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(owner).approveValidator(v1);
      await dlp.connect(owner).approveValidator(v1)
        .should.be.rejectedWith(
          `InvalidValidatorStatus(${ValidatorStatus.Registered}, ${ValidatorStatus.Active})`
        );
    });

    it("should not approveValidator if not registered", async function () {
      await dlp.connect(owner).approveValidator(v1)
        .should.be.rejectedWith(
          `InvalidValidatorStatus(${ValidatorStatus.Registered}, ${ValidatorStatus.None})`
        );
    });

    it("should not approveValidator if inactive", async function () {
      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(owner).approveValidator(v1);
      await dlp.connect(v1Owner).inactivateValidator(v1);
      await dlp.connect(owner).approveValidator(v1)
        .should.be.rejectedWith(
          `InvalidValidatorStatus(${ValidatorStatus.Registered}, ${ValidatorStatus.Inactive})`
        );
    });

    it("should not approveValidator if deregistered", async function () {
      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(owner).approveValidator(v1);
      await dlp.connect(v1Owner).deregisterValidator(v1);
      await dlp.connect(owner).approveValidator(v1)
        .should.be.rejectedWith(
          `InvalidValidatorStatus(${ValidatorStatus.Registered}, ${ValidatorStatus.Deregistered})`
        );
    });

    it("should createEpochs when approving validators", async function () {
      await advanceToEpochN(4);

      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100')).should.be.fulfilled

      await dlp.connect(owner).approveValidator(v1).should
        .emit(dlp, 'ValidatorApproved').withArgs(v1.address)
        .emit(dlp, 'EpochCreated').withArgs(2)
        .emit(dlp, 'EpochCreated').withArgs(3)
        .emit(dlp, 'EpochCreated').withArgs(4);

      (await dlp.epochsCount()).should.eq(4);

      const epoch2 = await dlp.epochs(2);
      epoch2.startBlock.should.eq(startBlock + epochSize);
      epoch2.endBlock.should.eq(startBlock + 2 * epochSize - 1);
      epoch2.reward.should.eq(epochRewardAmount);
      epoch2.validatorsListId.should.eq(0);

      const epoch3 = await dlp.epochs(3);
      epoch3.startBlock.should.eq(startBlock + 2 * epochSize);
      epoch3.endBlock.should.eq(startBlock + 3 * epochSize - 1);
      epoch3.reward.should.eq(epochRewardAmount);
      epoch3.validatorsListId.should.eq(0);

      const epoch4 = await dlp.epochs(4);
      epoch4.startBlock.should.eq(startBlock + 3 * epochSize);
      epoch4.endBlock.should.eq(startBlock + 4 * epochSize - 1);
      epoch4.reward.should.eq(epochRewardAmount);
      epoch4.validatorsListId.should.eq(1);
    });

    it("should approve validators in separate epochs", async function () {
      await advanceToEpochN(2);

      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlpt.connect(v2Owner).approve(dlp, parseEther('200'));
      await dlpt.connect(v3Owner).approve(dlp, parseEther('300'));
      await dlpt.connect(v4Owner).approve(dlp, parseEther('400'));
      await dlpt.connect(v5Owner).approve(dlp, parseEther('500'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100')).should.be.fulfilled
      await dlp.connect(v2Owner).registerValidator(v2, v2Owner, parseEther('200')).should.be.fulfilled
      await dlp.connect(v3Owner).registerValidator(v3, v3Owner, parseEther('300')).should.be.fulfilled
      await dlp.connect(v4Owner).registerValidator(v4, v4Owner, parseEther('400')).should.be.fulfilled
      await dlp.connect(v5Owner).registerValidator(v5, v5Owner, parseEther('500')).should.be.fulfilled

      await dlp.connect(owner).approveValidator(v1).should
        .emit(dlp, 'ValidatorApproved').withArgs(v1.address)
        .emit(dlp, 'EpochCreated').withArgs(2);

      await dlp.connect(owner).approveValidator(v2).should
        .emit(dlp, 'ValidatorApproved').withArgs(v2.address);;

      await advanceToEpochN(5);

      await dlp.connect(owner).approveValidator(v3).should
        .emit(dlp, 'ValidatorApproved').withArgs(v3.address)
        .emit(dlp, 'EpochCreated').withArgs(3)
        .emit(dlp, 'EpochCreated').withArgs(4)
        .emit(dlp, 'EpochCreated').withArgs(5);

      const validator1 = await dlp.validatorsInfo(v1);
      validator1.validatorAddress.should.eq(v1);
      validator1.status.should.eq(ValidatorStatus.Active);

      const validator2 = await dlp.validatorsInfo(v2);
      validator2.validatorAddress.should.eq(v2);
      validator2.status.should.eq(ValidatorStatus.Active);

      const validator3 = await dlp.validatorsInfo(v3);
      validator3.validatorAddress.should.eq(v3);
      validator3.status.should.eq(ValidatorStatus.Active);

      const validator4 = await dlp.validatorsInfo(v4);
      validator4.validatorAddress.should.eq(v4);
      validator4.status.should.eq(ValidatorStatus.Registered);
      validator4.firstBlockNumber.should.eq(0);
      validator4.lastBlockNumber.should.eq(0);

      const validator5 = await dlp.validatorsInfo(v5);
      validator5.validatorAddress.should.eq(v5);
      validator5.status.should.eq(ValidatorStatus.Registered);
      validator5.firstBlockNumber.should.eq(0);

      (await dlp.validatorsCount()).should.eq(5);
      (await dlp.validators(1)).should.deep.eq(validator1);
      (await dlp.validators(2)).should.deep.eq(validator2);
      (await dlp.validators(3)).should.deep.eq(validator3);
      (await dlp.validators(4)).should.deep.eq(validator4);
      (await dlp.validators(5)).should.deep.eq(validator5);

      (await dlp.activeValidatorsListsCount()).should.eq(3);
      const activeValidatorsList1 = await dlp.activeValidatorsLists(1);
      (await activeValidatorsList1).should.deep.eq([v1.address]);

      const activeValidatorsList2 = await dlp.activeValidatorsLists(2);
      (await activeValidatorsList2).should.deep.eq([v1.address, v2.address]);

      const activeValidatorsList3 = await dlp.activeValidatorsLists(3);
      (await activeValidatorsList3).should.deep.eq([v1.address, v2.address, v3.address]);

      (await dlp.epochsCount()).should.eq(5);
      const epoch1 = await dlp.epochs(1);
      epoch1.validatorsListId.should.eq(0);

      const epoch2 = await dlp.epochs(2);
      epoch2.validatorsListId.should.eq(2);

      const epoch3 = await dlp.epochs(3);
      epoch3.validatorsListId.should.eq(2);

      const epoch4 = await dlp.epochs(4);
      epoch4.validatorsListId.should.eq(2);

      const epoch5 = await dlp.epochs(5);
      epoch5.validatorsListId.should.eq(3);
    });

    it("should inactivateValidator if validator owner", async function () {
      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(owner).approveValidator(v1);
      await dlp.connect(v1Owner).inactivateValidator(v1)
        .should.emit(dlp, 'ValidatorInactivated')
        .withArgs(v1.address);

      const validator1 = await dlp.validatorsInfo(v1);
      validator1.status.should.eq(ValidatorStatus.Inactive);
      validator1.lastBlockNumber.should.eq(await getCurrentBlockNumber());

      (await dlp.validatorsCount()).should.eq(1);
      (await dlp.validators(1)).should.deep.eq(validator1);

      (await dlp.activeValidatorsListsCount()).should.eq(2);

      const activeValidatorsList1 = await dlp.activeValidatorsLists(1);
      (await activeValidatorsList1).should.deep.eq([v1.address]);

      const activeValidatorsList2 = await dlp.activeValidatorsLists(2);
      (await activeValidatorsList2).should.deep.eq([]);
    });
  });

  describe("Validators - verifyFile", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should verifyFile if validator", async function () {
      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(owner).approveValidator(v1);

      await dlp.connect(user1).addFile('file1URL', "file1EncryptedAddress");

      await advanceTime(validationPeriod);

      await dlp.connect(v1).verifyFile(1, parseEther('0.6'), parseEther('0.5'), parseEther('0.7'), parseEther('0.8'), parseEther('0.4'), 'file metadata')
        .should.emit(dlp, 'FileVerified')
        .withArgs(v1.address, 1, parseEther('0.6'));

      const file1 = await dlp.files(1);
      file1.verificationsCount.should.eq(1);
      const expectedReward = parseEther('0.6') * fileRewardFactor / (parseEther('1'));
      console.log('Expected reward:', expectedReward.toString());
      console.log('Actual reward:', file1.reward.toString());
      file1.reward.should.eq(expectedReward);
      file1.isVerified.should.eq(true);

      const fileVerification = await dlp.fileVerifications(1, v1.address);
      fileVerification.score.should.eq(parseEther('0.6'));
      fileVerification.metadata.should.eq('file metadata');
      fileVerification.reportedAt.should.be.gt(0);
    });

    it("should updateWeights if validator", async function () {
      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlpt.connect(v2Owner).approve(dlp, parseEther('200'));
      await dlpt.connect(v3Owner).approve(dlp, parseEther('300'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(v2Owner).registerValidator(v2, v2Owner, parseEther('200'));
      await dlp.connect(v3Owner).registerValidator(v3, v3Owner, parseEther('300'));

      await dlp.connect(owner).approveValidator(v1);
      await dlp.connect(owner).approveValidator(v2);
      await dlp.connect(owner).approveValidator(v3);

      await dlp.connect(v1).updateWeights([v1, v2, v3], [parseEther('1'), parseEther('1'), parseEther('0')])
        .should.emit(dlp, 'WeightsUpdated')
        .withArgs(v1.address, [v1.address, v2.address, v3.address], [parseEther('1'), parseEther('1'), parseEther('0')]);

      const validator1Weights = await dlp.validatorWeights(v1);
      validator1Weights.validators.should.deep.eq([v1.address, v2.address, v3.address]);
      validator1Weights.weights.should.deep.eq([parseEther('1'), parseEther('1'), parseEther('0')]);
    });

    it("should send rewards after the end of an epoch", async function () {
      await dlpt.connect(owner).approve(dlp, parseEther('100'));
      await dlp.connect(owner).addRewardForValidators(parseEther('100'));

      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlpt.connect(v2Owner).approve(dlp, parseEther('100'));
      await dlpt.connect(v3Owner).approve(dlp, parseEther('200'));
      await dlpt.connect(v4Owner).approve(dlp, parseEther('200'));
      await dlpt.connect(v5Owner).approve(dlp, parseEther('200'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(v2Owner).registerValidator(v2, v2Owner, parseEther('100'));
      await dlp.connect(v3Owner).registerValidator(v3, v3Owner, parseEther('200'));
      await dlp.connect(v4Owner).registerValidator(v4, v4Owner, parseEther('200'));
      await dlp.connect(v5Owner).registerValidator(v5, v5Owner, parseEther('200'));

      //3 validators accepted by DLP owner
      await dlp.connect(owner).approveValidator(v1);
      await dlp.connect(owner).approveValidator(v2);
      await dlp.connect(owner).approveValidator(v3);
      await dlp.connect(owner).approveValidator(v4);
      await dlp.connect(owner).approveValidator(v5);

      await dlp.connect(v1).updateWeights([v1, v2, v3], [parseEther('1'), parseEther('1'), 0]);
      await dlp.connect(v2).updateWeights([v1, v2, v3], [0, parseEther('1'), parseEther('1')]);
      await dlp.connect(v3).updateWeights([v1, v2, v3], [parseEther('1'), 0, parseEther('1')]);

      const v1ExpectedEmissionScore = parseEther('0.440182806331138690');
      const v2ExpectedEmissionScore = parseEther('0.119634387337722619');
      const v3ExpectedEmissionScore = parseEther('0.440182806331138690');
      const v4ExpectedEmissionScore = parseEther('0');
      const v5ExpectedEmissionScore = parseEther('0');

      const emissionScore = await dlp.getEmissionScores(1);

      emissionScore.should.deep.eq([v1ExpectedEmissionScore, v2ExpectedEmissionScore, v3ExpectedEmissionScore, v4ExpectedEmissionScore, v5ExpectedEmissionScore]);

      const initialV1Balance = await dlpt.balanceOf(v1Owner);
      const initialV2Balance = await dlpt.balanceOf(v2Owner);
      const initialV3Balance = await dlpt.balanceOf(v3Owner);
      const initialV4Balance = await dlpt.balanceOf(v4Owner);
      const initialV5Balance = await dlpt.balanceOf(v5Owner);

      await advanceBlockNTimes(epochSize + 1);
      await dlp.connect(owner).createEpochs();

      const finaleV1Balance = await dlpt.balanceOf(v1Owner);
      const finaleV2Balance = await dlpt.balanceOf(v2Owner);
      const finaleV3Balance = await dlpt.balanceOf(v3Owner);
      const finaleV4Balance = await dlpt.balanceOf(v4Owner);
      const finaleV5Balance = await dlpt.balanceOf(v5Owner);

      const epoch1Rewards = await dlp.epochRewards(1);
      epoch1Rewards.validators.should.deep.eq([v1.address, v2.address, v3.address, v4.address, v5.address]);

      epoch1Rewards.shares.should.deep.eq([v1ExpectedEmissionScore, v2ExpectedEmissionScore, v3ExpectedEmissionScore, v4ExpectedEmissionScore, v5ExpectedEmissionScore]);
      epoch1Rewards.withdrawnAmounts.should.deep.eq([
        epochRewardAmount * v1ExpectedEmissionScore / parseEther('1'),
        epochRewardAmount * v2ExpectedEmissionScore / parseEther('1'),
        epochRewardAmount * v3ExpectedEmissionScore / parseEther('1'),
        epochRewardAmount * v4ExpectedEmissionScore / parseEther('1'),
        epochRewardAmount * v5ExpectedEmissionScore / parseEther('1')
      ]);

      (finaleV1Balance - initialV1Balance).should.eq(epochRewardAmount * v1ExpectedEmissionScore / parseEther('1'));
      (finaleV2Balance - initialV2Balance).should.eq(epochRewardAmount * v2ExpectedEmissionScore / parseEther('1'));
      (finaleV3Balance - initialV3Balance).should.eq(epochRewardAmount * v3ExpectedEmissionScore / parseEther('1'));
      (finaleV4Balance - initialV4Balance).should.eq(epochRewardAmount * v4ExpectedEmissionScore / parseEther('1'));
      (finaleV5Balance - initialV5Balance).should.eq(epochRewardAmount * v5ExpectedEmissionScore / parseEther('1'));
    });
  });

  describe("Contributors - claimReward", () => {
    beforeEach(async () => {
      await deploy();

      await dlpt.connect(owner).approve(dlp, parseEther('10000'));
      await dlp.connect(owner).addRewardsForContributors(parseEther('10000'));
    });

    it("should not claimContributionReward if not file owner #1", async function () {
      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(owner).approveValidator(v1);

      await dlp.connect(user1).addFile('file1URL', "file1EncryptedAddress");

      await advanceTime(validationPeriod);

      await dlp.connect(v1).verifyFile(1, parseEther('0.6'), parseEther('0.5'), parseEther('0.7'), parseEther('0.8'), parseEther('0.4'), 'file metadata');

      await advanceTime(fileRewardDelay);

      await dlp.connect(user2).claimContributionReward(1).should.be.rejectedWith(`NotFileOwner()`);
    });

    it("should not claimContributionReward if not file owner #2", async function () {
      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(owner).approveValidator(v1);

      await dlp.connect(user1).addFile('file1URL', "file1EncryptedAddress");

      await advanceTime(validationPeriod);

      await dlp.connect(v1).verifyFile(1, parseEther('0.6'), parseEther('0.5'), parseEther('0.7'), parseEther('0.8'), parseEther('0.4'), 'file metadata');

      await advanceTime(fileRewardDelay);

      await dlp.connect(user1).claimContributionReward(2).should.be.rejectedWith(`NotFileOwner()`);
    });

    it("should not claimContributionReward too early", async function () {
      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(owner).approveValidator(v1);

      await dlp.connect(user1).addFile('file1URL', "file1EncryptedAddress");

      await advanceTime(validationPeriod);
      await dlp.connect(v1).verifyFile(1, parseEther('0.6'), parseEther('0.5'), parseEther('0.7'), parseEther('0.8'), parseEther('0.4'), 'file metadata');

      await advanceTime(fileRewardDelay / 2); // Advance time, but only halfway through the delay

      const file = await dlp.files(1);
      const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
      console.log('File added at:', file.addedAt.toString());
      console.log('Current time:', currentTime);
      console.log('File reward delay:', fileRewardDelay.toString());

      await dlp.connect(user1).claimContributionReward(1).should.be.rejectedWith(`WithdrawNotAllowed()`);
    });

    it("should claimContributionReward if contributor", async function () {
      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(owner).approveValidator(v1);

      await dlp.connect(user1).addFile('file1URL', "file1EncryptedAddress");

      await advanceTime(validationPeriod);

      await dlp.connect(v1).verifyFile(1, parseEther('0.6'), parseEther('0.5'), parseEther('0.7'), parseEther('0.8'), parseEther('0.4'), 'file metadata');

      await advanceTime(fileRewardDelay);

      const user1InitialBalance = await dlpt.balanceOf(user1.address);
      await dlp.connect(user1).claimContributionReward(1)
        .should.emit(dlp, 'ContributionRewardClaimed');
      const user1FinalBalance = await dlpt.balanceOf(user1.address);

      // (user1FinalBalance - user1InitialBalance).should.eq(expectedReward);
    });

    it("should not claimContributionReward if already claimed", async function () {
      const expectedReward = parseEther('0.6') * fileRewardFactor / parseEther('1');
      await dlpt.connect(v1Owner).approve(dlp, parseEther('100'));
      await dlp.connect(v1Owner).registerValidator(v1, v1Owner, parseEther('100'));
      await dlp.connect(owner).approveValidator(v1);

      await dlp.connect(user1).addFile('file1URL', "file1EncryptedAddress");

      await advanceTime(validationPeriod);
      await dlp.connect(v1).verifyFile(1, parseEther('0.6'), parseEther('0.5'), parseEther('0.7'), parseEther('0.8'), parseEther('0.4'), 'file metadata');

      await advanceTime(fileRewardDelay);

      await dlp.connect(user1).claimContributionReward(1);

      const file = await dlp.files(1);
      console.log('File reward:', file.reward.toString());
      console.log('File reward withdrawn:', file.rewardWithdrawn.toString());

      await dlp.connect(user1).claimContributionReward(1).should.be.rejectedWith(`WithdrawNotAllowed()`);
    });
  });

  xdescribe("End to end examples", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should work with multiple epochs", async function () {

      const dlp2 = await ethers.getContractAt('DataLiquidityPool', '0x0b3BbeC20a6C9B469064D0F7B0d05BDB2C0A995C');

      const v1 = '0x31d9ffcbee8ff1177d0c984951cf6c84d9226748';
      const v1Owner = '0xa8a7682c616482d0bbdaf6c441e8f8a20d846903';
      console.log(await dlpt.balanceOf(v1Owner))
    });
  });

  describe("Emissions Scenarios", () => {
    beforeEach(async () => {
      await deploy();
    });

    const tolerance = parseEther('0.0001');

    async function advanceToEpochN(epochNumber: number) {
      const epochNStartBlock = startBlock + (epochNumber - 1) * epochSize;
      await advanceToBlockN(epochNStartBlock);
    }

    async function registerAndApproveValidator(validatorOwner: HardhatEthersSigner, validator: HardhatEthersSigner, stakeAmount: BigNumberish) {
      await dlpt.connect(validatorOwner).approve(dlp, stakeAmount);
      await dlp.connect(validatorOwner).registerValidator(validator, v1Owner, stakeAmount);
      await dlp.connect(owner).approveValidator(validator);
    }

    async function setValidatorWeights(weights: BigNumberish[][]) {
      let validators = [v1, v2, v3];
      for (let i = 0; i < weights.length; i++) {
        await dlp.connect(validators[i]).updateWeights(validators, weights[i]);
      }
    }

    async function expectEmissionScores(epochNumber: number, expectedScores: BigNumberish[]) {
      const emissionScores = await dlp.getEmissionScores(epochNumber);
      for (let i = 0; i < expectedScores.length; i++) {
        emissionScores[i].should.be.closeTo(expectedScores[i], tolerance);
      }
    }

    async function setupScenario(stakes: BigNumberish[], weights: BigNumberish[][]) {
      for (let i = 0; i < stakes.length; i++) {
        await registerAndApproveValidator(eval(`v${i + 1}Owner`), eval(`v${i + 1}`), stakes[i]);
      }
      await setValidatorWeights(weights);
    }

    const scenarios = [
      {
        description: "Equal scores, equal stakes",
        stakes: [100, 100, 100],
        weights: [
          [1, 1, 1],
          [1, 1, 1],
          [1, 1, 1]
        ],
        expectedScores: [0.3333, 0.3333, 0.3333]
      },
      {
        description: "Equal scores, unequal stakes",
        stakes: [100, 200, 300],
        weights: [
          [1, 1, 1],
          [1, 1, 1],
          [1, 1, 1]
        ],
        expectedScores: [0.3333, 0.3333, 0.3333]
      },
      {
        description: "Unequal scores, equal stakes",
        stakes: [100, 100, 100],
        weights: [
          [1, 1, 0],
          [1, 1, 1],
          [1, 1, 1]
        ],
        expectedScores: [0.3863, 0.3863, 0.2275]
      },
      {
        description: "Malicious minority",
        stakes: [100, 100, 100],
        weights: [
          [1, 0, 0],
          [0, 1, 1],
          [0, 1, 1]
        ],
        expectedScores: [0.0383, 0.4809, 0.4809]
      }
    ];

    function parseEtherArray(numbers: number[]): BigNumberish[] {
      const result = numbers.map(num => parseEther(num.toString()));
      return result
    }

    scenarios.forEach(scenario => {
      it(scenario.description, async function () {
        await dlpt.connect(owner).approve(dlp, parseEther('1000'));
        await dlp.connect(owner).addRewardForValidators(parseEther('1000'));
        await setupScenario(parseEtherArray(scenario.stakes), scenario.weights.map(weightRow => parseEtherArray(weightRow)));
        await expectEmissionScores(1, parseEtherArray(scenario.expectedScores));
      });
    });
  })
});
