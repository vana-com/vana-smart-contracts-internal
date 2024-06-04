import chai, { should } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers, upgrades } from "hardhat";
import { BigNumberish, parseEther } from "ethers";
import { DataLiquidityPool } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { advanceBlockNTimes, advanceToBlockN, getCurrentBlockNumber, getCurrentBlockTimestamp } from "../utils/timeAndBlockManipulation";

chai.use(chaiAsPromised);
should();

describe("DataLiquidityPoolStaking", () => {
  enum ValidatorStatus {
    None,
    Registered,
    Active,
    Deregistered,
    Inactive,
    Blocked
  };

  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let v1Address: HardhatEthersSigner;
  let v1OwnerAddress: HardhatEthersSigner;
  let v2Address: HardhatEthersSigner;
  let v2OwnerAddress: HardhatEthersSigner;
  let v3Address: HardhatEthersSigner;
  let v3OwnerAddress: HardhatEthersSigner;
  let v4Address: HardhatEthersSigner;
  let v4OwnerAddress: HardhatEthersSigner;
  let v5Address: HardhatEthersSigner;
  let v5OwnerAddress: HardhatEthersSigner;
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

  const maxNumberOfValidators = 9;
  const validatorScoreMinTrust = parseEther('0.1');
  const validatorScoreKappa = parseEther('0.5');
  const validatorScoreRho = parseEther('1');
  const validationPeriod = 120;
  const epochSize = 100;
  const minStakeAmount = parseEther('50');
  let startBlock: number;
  let epochRewardAmount = parseEther('2');

  const deploy = async () => {
    [
      deployer, owner,
      v1Address, v1OwnerAddress, v2Address, v2OwnerAddress, v3Address, v3OwnerAddress, v4Address, v4OwnerAddress, v5Address, v5OwnerAddress,
      user1, user2, user3, user4, user5, user6, user7, user8, user9, user10, user11, user12, user13, user14, user15
    ] = await ethers.getSigners();

    startBlock = await getCurrentBlockNumber() + 1;

    const dlpDeploy = await upgrades.deployProxy(
      await ethers.getContractFactory("DataLiquidityPool"),
      [
        owner.address,
        maxNumberOfValidators,
        validatorScoreMinTrust,
        validatorScoreKappa,
        validatorScoreRho,
        validationPeriod,
        minStakeAmount,
        startBlock,
        epochSize,
        epochRewardAmount
      ],
      {
        kind: "uups"
      }
    );

    dlp = await ethers.getContractAt("DataLiquidityPool", dlpDeploy.target);
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
      (await dlp.addingFilePaused()).should.eq(true);

      (await dlp.epochsCount()).should.eq(1);

      const epoch = await dlp.epochs(1);
      epoch.startBlock.should.eq(startBlock);
      epoch.endBlock.should.eq(startBlock + epochSize - 1);
      epoch.reward.should.eq(epochRewardAmount);
      epoch.validatorsListId.should.eq(0);
    });

    it("Should pause if owner", async function () {
      await dlp.connect(owner).pause()
        .should.emit(dlp, 'Paused')
        .withArgs(owner.address);
      (await dlp.paused()).should.be.equal(true);
    });

    it("Should not pause if not owner", async function () {
      await dlp.connect(v1Address)
        .pause()
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1Address.address}")`
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
      await dlp.connect(v1OwnerAddress)
        .unpause()
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1OwnerAddress.address}")`
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
      await dlp.connect(v1Address).updateMaxNumberOfValidators(123)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1Address.address}")`
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
      await dlp.connect(v1Address).updateEpochSize(123)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1Address.address}")`
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
      await dlp.connect(v1Address).updateEpochRewardAmount(123)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1Address.address}")`
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
      await dlp.connect(v1Address).updateValidationPeriod(123)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1Address.address}")`
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
      await dlp.connect(v1Address).updateValidatorScoreMinTrust(parseEther('0.2'))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1Address.address}")`
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
      await dlp.connect(v1Address).updateValidatorScoreKappa(parseEther('0.2'))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1Address.address}")`
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
      await dlp.connect(v1Address).updateValidatorScoreRho(parseEther('0.2'))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1Address.address}")`
        );

      (await dlp.validatorScoreRho()).should.eq(validatorScoreRho);
    });
  });

  describe("Epochs", () => {
    beforeEach(async () => {
      await deploy();
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

      await dlp.connect(v1OwnerAddress).registerValidator(v1Address, v1OwnerAddress, { value: parseEther('100') });
      await dlp.connect(v2OwnerAddress).registerValidator(v2Address, v2OwnerAddress, { value: parseEther('100') });
      await dlp.connect(owner).approveValidator(v1Address);
      await dlp.connect(owner).approveValidator(v2Address);

      await dlp.connect(v1Address).updateWeights([v1Address, v2Address], [parseEther('1'), parseEther('1')]);
      await dlp.connect(v2Address).updateWeights([v1Address, v2Address], [parseEther('1'), parseEther('1')]);

      await advanceToEpochN(4);

      await dlp.connect(v1Address).updateWeights([v1Address, v2Address], [parseEther('1'), parseEther('1')]);

      const epoch1 = await dlp.epochs(1);
      epoch1.validatorsListId.should.eq(0);

      const epoch2 = await dlp.epochs(2);
      epoch2.validatorsListId.should.eq(0);

      const epoch3 = await dlp.epochs(3);
      epoch3.validatorsListId.should.not.eq(0);
    });

    it.only("should process multiple empty epochs and an epoch with validators", async function () {
      await advanceToEpochN(3);

      await dlp.connect(v1OwnerAddress).registerValidator(v1Address, v1OwnerAddress, { value: parseEther('100') });
      await dlp.connect(v2OwnerAddress).registerValidator(v2Address, v2OwnerAddress, { value: parseEther('100') });
      await dlp.connect(owner).approveValidator(v1Address);
      await dlp.connect(owner).approveValidator(v2Address);

      await dlp.connect(v1Address).updateWeights([v1Address, v2Address], [parseEther('1'), parseEther('1')]);
      await dlp.connect(v2Address).updateWeights([v1Address, v2Address], [parseEther('1'), parseEther('1')]);

      await advanceToEpochN(4);

      await dlp.connect(v1Address).updateWeights([v1Address, v2Address], [parseEther('1'), parseEther('1')]);

      for (let i = 1; i <= 2; i++) {
        const epoch = await dlp.epochs(i);
        epoch.validatorsListId.should.eq(0);
      }

      const epoch3 = await dlp.epochs(3);
      epoch3.validatorsListId.should.not.eq(0);
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
  });

  describe("Files", () => {
    beforeEach(async () => {
      await deploy();

      await dlp.connect(v1OwnerAddress).registerValidator(v1Address, v1OwnerAddress, { value: parseEther('100') });
      await dlp.connect(v1OwnerAddress).registerValidator(v2Address, v2OwnerAddress, { value: parseEther('100') });
      await dlp.connect(v1OwnerAddress).registerValidator(v3Address, v3OwnerAddress, { value: parseEther('100') });
      await dlp.connect(v1OwnerAddress).registerValidator(v4Address, v4OwnerAddress, { value: parseEther('100') });
      await dlp.connect(v1OwnerAddress).registerValidator(v5Address, v5OwnerAddress, { value: parseEther('100') });

      await dlp.connect(owner).approveValidator(v1Address);
      await dlp.connect(owner).approveValidator(v2Address);
      await dlp.connect(owner).approveValidator(v3Address);
    });

    it("should addFile", async function () {
      await dlp.connect(user1).addFile('file1URL', "file1EncryptedAddress")
        .should.emit(dlp, 'FileAdded')
        .withArgs(user1, 1);
      const timestamp = await getCurrentBlockTimestamp();

      (await dlp.filesCount()).should.eq(1)

      const file1 = await dlp.files(1);
      file1.ownerAddress.should.eq(user1);
      file1.url.should.eq('file1URL');
      file1.encryptedKey.should.eq('file1EncryptedAddress');
      file1.addedTimestamp.should.eq(timestamp);
      file1.verificationsCount.should.eq(0);
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
      file1.ownerAddress.should.eq(user1.address);
      file1.url.should.eq('file1URL');
      file1.encryptedKey.should.eq('file1EncryptedAddress');
      file1.addedTimestamp.should.eq(timestamp + 1);
      file1.verificationsCount.should.eq(0);

      const file2 = await dlp.files(2);
      file2.ownerAddress.should.eq(user1.address);
      file2.url.should.eq('file2URL');
      file2.encryptedKey.should.eq('file2EncryptedAddress');
      file1.addedTimestamp.should.eq(timestamp + 1);
      file2.verificationsCount.should.eq(0);

      const file3 = await dlp.files(3);
      file3.ownerAddress.should.eq(user1.address);
      file3.url.should.eq('file3URL');
      file3.encryptedKey.should.eq('file3EncryptedAddress');
      file1.addedTimestamp.should.eq(timestamp + 1);
      file3.verificationsCount.should.eq(0);
    });

    it("should not addFile with same url", async function () {
      await dlp.connect(user1).addFile('file1URL', "file1EncryptedAddress")
        .should.be.fulfilled;
      await dlp.connect(user1).addFile('file1URL', "file2EncryptedAddress")
        .should.be.rejectedWith(
          `FileAlreadyAdded()`
        );
    });
  });

  describe("Validators", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should registerValidator", async function () {
      await dlp.connect(v1OwnerAddress).registerValidator(v1Address, v1OwnerAddress, { value: parseEther('100') })
        .should.emit(dlp, 'ValidatorRegistered')
        .withArgs(v1Address.address, v1OwnerAddress.address, parseEther('100'));

      (await dlp.validatorsCount()).should.eq(1);


      const validator1 = await dlp.validatorInfo(v1Address);

      validator1.ownerAddress.should.eq(v1OwnerAddress.address);
      validator1.stakeAmount.should.eq(parseEther('100'));
      validator1.status.should.eq(ValidatorStatus.Registered);
      validator1.filesToVerifyIndex.should.eq(0);
      validator1.filesToVerifyCount.should.eq(0);
    });

    it("should registerValidator as external caller", async function () {
      await dlp.connect(user1).registerValidator(v1Address, v1OwnerAddress, { value: parseEther('100') })
        .should.emit(dlp, 'ValidatorRegistered')
        .withArgs(v1Address.address, v1OwnerAddress.address, parseEther('100'));

      (await dlp.validatorsCount()).should.eq(1);


      const validator1 = await dlp.validatorInfo(v1Address);

      validator1.ownerAddress.should.eq(v1OwnerAddress.address);
      validator1.stakeAmount.should.eq(parseEther('100'));
      validator1.status.should.eq(ValidatorStatus.Registered);
      validator1.filesToVerifyIndex.should.eq(0);
      validator1.filesToVerifyCount.should.eq(0);
    });

    it("should registerValidator many times", async function () {
      await dlp.connect(user1).registerValidator(v1Address, v1OwnerAddress, { value: parseEther('100') })
        .should.emit(dlp, 'ValidatorRegistered')
        .withArgs(v1Address.address, v1OwnerAddress.address, parseEther('100'));
      await dlp.connect(user1).registerValidator(v2Address, v2OwnerAddress, { value: parseEther('200') })
        .should.emit(dlp, 'ValidatorRegistered')
        .withArgs(v2Address.address, v2OwnerAddress.address, parseEther('200'));
      await dlp.connect(user1).registerValidator(v3Address, v3OwnerAddress, { value: parseEther('300') })
        .should.emit(dlp, 'ValidatorRegistered')
        .withArgs(v3Address.address, v3OwnerAddress.address, parseEther('300'));

      (await dlp.validatorsCount()).should.eq(3);


      const validator1 = await dlp.validatorInfo(v1Address);
      validator1.ownerAddress.should.eq(v1OwnerAddress.address);
      validator1.stakeAmount.should.eq(parseEther('100'));
      validator1.status.should.eq(ValidatorStatus.Registered);
      validator1.filesToVerifyIndex.should.eq(0);
      validator1.filesToVerifyCount.should.eq(0);

      const validator2 = await dlp.validatorInfo(v2Address);
      validator2.ownerAddress.should.eq(v2OwnerAddress.address);
      validator2.stakeAmount.should.eq(parseEther('200'));
      validator2.status.should.eq(ValidatorStatus.Registered);
      validator2.filesToVerifyIndex.should.eq(0);
      validator2.filesToVerifyCount.should.eq(0);

      const validator3 = await dlp.validatorInfo(v3Address);
      validator3.ownerAddress.should.eq(v3OwnerAddress.address);
      validator3.stakeAmount.should.eq(parseEther('300'));
      validator3.status.should.eq(ValidatorStatus.Registered);
      validator3.filesToVerifyIndex.should.eq(0);
      validator3.filesToVerifyCount.should.eq(0);
    });

    it("should not registerValidator if not enough stake", async function () {
      await dlp.connect(user1).registerValidator(v1Address, v1OwnerAddress, { value: parseEther('1') })
        .should.be.rejectedWith(
          `InvalidStakeAmount()`
        );
    });

    it("should not registerValidator if already registered", async function () {
      await dlp.connect(user1).registerValidator(v1Address, v1OwnerAddress, { value: parseEther('100') });
      await dlp.connect(user1).registerValidator(v1Address, v1OwnerAddress, { value: parseEther('100') })
        .should.be.rejectedWith(
          `ValidatorAlreadyRegistered()`
        );
    });

    it("should approveValidator if owner", async function () {
      await dlp.connect(user1).registerValidator(v1Address, v1OwnerAddress, { value: parseEther('100') });
      await dlp.connect(owner).approveValidator(v1Address)
        .should.emit(dlp, 'ValidatorApproved')
        .withArgs(v1Address.address);

      const validator1 = await dlp.validatorInfo(v1Address);
      validator1.status.should.eq(ValidatorStatus.Active);
    });

    it("should not approveValidator if not owner", async function () {
      await dlp.connect(user1).registerValidator(v1Address, v1OwnerAddress, { value: parseEther('100') });
      await dlp.connect(user1).approveValidator(v1Address)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`
        );
    });

    it("should not registerValidator if already approved", async function () {
      await dlp.connect(user1).registerValidator(v1Address, v1OwnerAddress, { value: parseEther('100') });
      await dlp.connect(owner).approveValidator(v1Address);
      await dlp.connect(user1).registerValidator(v1Address, v1OwnerAddress, { value: parseEther('100') })
        .should.be.rejectedWith(
          `ValidatorAlreadyRegistered()`
        );
    });

    it("should not approveValidator if already approved", async function () {
      await dlp.connect(user1).registerValidator(v1Address, v1OwnerAddress, { value: parseEther('100') });
      await dlp.connect(owner).approveValidator(v1Address);
      await dlp.connect(owner).approveValidator(v1Address)
        .should.be.rejectedWith(
          `ValidatorNotRegistered()`
        );
    });

    it("should not approveValidator if not registered", async function () {
      await dlp.connect(owner).approveValidator(v1Address)
        .should.be.rejectedWith(
          `ValidatorNotRegistered()`
        );
    });

    it("should verifyFile if validator", async function () {
      await dlp.connect(user1).registerValidator(v1Address, v1OwnerAddress, { value: parseEther('100') });
      await dlp.connect(owner).approveValidator(v1Address);

      await dlp.connect(user1).addFile('file1URL', "file1EncryptedAddress");

      const nextFile = await dlp.getNextFileToVerify(v1Address);

      await dlp.connect(v1Address).verifyFile(1, parseEther('0.6'), 'file metadata')
        .should.emit(dlp, 'FileVerified')
        .withArgs(v1Address.address, 1, parseEther('0.6'));

      (await dlp.files(1)).verificationsCount.should.eq(1);

      const fileVerification = await dlp.fileVerifications(1, 0);
      fileVerification.score.should.eq(parseEther('0.6'));
      fileVerification.metadata.should.eq('file metadata');
    });

    it("should updateWeights if validator", async function () {
      await dlp.connect(user1).registerValidator(v1Address, v1OwnerAddress, { value: parseEther('100') });
      await dlp.connect(user2).registerValidator(v2Address, v2OwnerAddress, { value: parseEther('200') });
      await dlp.connect(user3).registerValidator(v3Address, v3OwnerAddress, { value: parseEther('300') });

      await dlp.connect(owner).approveValidator(v1Address);
      await dlp.connect(owner).approveValidator(v2Address);
      await dlp.connect(owner).approveValidator(v3Address);

      await dlp.connect(v1Address).updateWeights([v1Address, v2Address, v3Address], [parseEther('1'), parseEther('1'), parseEther('0')])
        .should.emit(dlp, 'WeightsUpdated')
        .withArgs(v1Address.address, [v1Address.address, v2Address.address, v3Address.address], [parseEther('1'), parseEther('1'), parseEther('0')]);

      const validator1Weights = await dlp.validatorWeights(v1Address);
      validator1Weights.validators[0].should.eq(v1Address);
      validator1Weights.validators[1].should.eq(v2Address);
      validator1Weights.validators[2].should.eq(v3Address);
      validator1Weights.weights[0].should.eq(parseEther('1'));
      validator1Weights.weights[1].should.eq(parseEther('1'));
      validator1Weights.weights[2].should.eq(parseEther('0'));
    });

    it("should send rewards after the end of an epoch", async function () {
      await dlp.connect(owner).addRewards({ value: parseEther('100') });

      await dlp.connect(v1OwnerAddress).registerValidator(v1Address, v1OwnerAddress, { value: parseEther('100') });
      await dlp.connect(v2OwnerAddress).registerValidator(v2Address, v2OwnerAddress, { value: parseEther('100') });
      await dlp.connect(v3OwnerAddress).registerValidator(v3Address, v3OwnerAddress, { value: parseEther('200') });
      await dlp.connect(v4OwnerAddress).registerValidator(v4Address, v4OwnerAddress, { value: parseEther('200') });
      await dlp.connect(v5OwnerAddress).registerValidator(v5Address, v5OwnerAddress, { value: parseEther('200') });

      //3 validators accepted by DLP owner
      await dlp.connect(owner).approveValidator(v1Address);
      await dlp.connect(owner).approveValidator(v2Address);
      await dlp.connect(owner).approveValidator(v3Address);
      await dlp.connect(owner).approveValidator(v4Address);
      await dlp.connect(owner).approveValidator(v5Address);

      await dlp.connect(v1Address).updateWeights([v1Address, v2Address, v3Address], [parseEther('1'), parseEther('1'), 0]);
      await dlp.connect(v2Address).updateWeights([v1Address, v2Address, v3Address], [0, parseEther('1'), parseEther('1')]);
      await dlp.connect(v3Address).updateWeights([v1Address, v2Address, v3Address], [parseEther('1'), 0, parseEther('1')]);

      const v1ExpectedEmissionScore = parseEther('0.440182806331138690');
      const v2ExpectedEmissionScore = parseEther('0.119634387337722619');
      const v3ExpectedEmissionScore = parseEther('0.440182806331138690');
      const v4ExpectedEmissionScore = parseEther('0');
      const v5ExpectedEmissionScore = parseEther('0');

      const emissionScore = await dlp.getEmissionScores(1);
      emissionScore[0].should.eq(v1ExpectedEmissionScore);
      emissionScore[1].should.eq(v2ExpectedEmissionScore);
      emissionScore[2].should.eq(v3ExpectedEmissionScore);
      emissionScore[3].should.eq(v4ExpectedEmissionScore);
      emissionScore[4].should.eq(v5ExpectedEmissionScore);

      const initialV1Balance = await ethers.provider.getBalance(v1OwnerAddress);
      const initialV2Balance = await ethers.provider.getBalance(v2OwnerAddress);
      const initialV3Balance = await ethers.provider.getBalance(v3OwnerAddress);
      const initialV4Balance = await ethers.provider.getBalance(v4OwnerAddress);
      const initialV5Balance = await ethers.provider.getBalance(v5OwnerAddress);

      await advanceBlockNTimes(epochSize + 1);
      await dlp.connect(owner).createEpochs();

      const finaleV1Balance = await ethers.provider.getBalance(v1OwnerAddress);
      const finaleV2Balance = await ethers.provider.getBalance(v2OwnerAddress);
      const finaleV3Balance = await ethers.provider.getBalance(v3OwnerAddress);
      const finaleV4Balance = await ethers.provider.getBalance(v4OwnerAddress);
      const finaleV5Balance = await ethers.provider.getBalance(v5OwnerAddress);

      const epoch1Rewards = await dlp.epochRewards(1);
      epoch1Rewards.validators[0].should.eq(v1Address.address);
      epoch1Rewards.validators[1].should.eq(v2Address.address);
      epoch1Rewards.validators[2].should.eq(v3Address.address);
      epoch1Rewards.validators[3].should.eq(v4Address.address);
      epoch1Rewards.validators[4].should.eq(v5Address.address);
      epoch1Rewards.shares[0].should.eq(v1ExpectedEmissionScore);
      epoch1Rewards.shares[1].should.eq(v2ExpectedEmissionScore);
      epoch1Rewards.shares[2].should.eq(v3ExpectedEmissionScore);
      epoch1Rewards.shares[3].should.eq(v4ExpectedEmissionScore);
      epoch1Rewards.shares[4].should.eq(v5ExpectedEmissionScore);
      epoch1Rewards.validators[4].should.eq(v5Address.address);
      epoch1Rewards.withdrawnAmounts[0].should.eq(epochRewardAmount * v1ExpectedEmissionScore / parseEther('1'));
      epoch1Rewards.withdrawnAmounts[1].should.eq(epochRewardAmount * v2ExpectedEmissionScore / parseEther('1'));
      epoch1Rewards.withdrawnAmounts[2].should.eq(epochRewardAmount * v3ExpectedEmissionScore / parseEther('1'));
      epoch1Rewards.withdrawnAmounts[3].should.eq(epochRewardAmount * v4ExpectedEmissionScore / parseEther('1'));
      epoch1Rewards.withdrawnAmounts[4].should.eq(epochRewardAmount * v5ExpectedEmissionScore / parseEther('1'));

      (finaleV1Balance - initialV1Balance).should.eq(epochRewardAmount * v1ExpectedEmissionScore / parseEther('1'));
      (finaleV2Balance - initialV2Balance).should.eq(epochRewardAmount * v2ExpectedEmissionScore / parseEther('1'));
      (finaleV3Balance - initialV3Balance).should.eq(epochRewardAmount * v3ExpectedEmissionScore / parseEther('1'));
      (finaleV4Balance - initialV4Balance).should.eq(epochRewardAmount * v4ExpectedEmissionScore / parseEther('1'));
      (finaleV5Balance - initialV5Balance).should.eq(epochRewardAmount * v5ExpectedEmissionScore / parseEther('1'));
    });
  });

  describe("End to end examples", () => {
    beforeEach(async () => {
      await deploy();
    });

    xit("Example 1", async function () {
      await dlp.connect(owner).addRewards({ value: parseEther('100') });

      //4 validators regitered
      await dlp.connect(v1OwnerAddress).registerValidator(v1Address, v1OwnerAddress, { value: parseEther('100') });
      await dlp.connect(v2OwnerAddress).registerValidator(v2Address, v2OwnerAddress, { value: parseEther('100') });
      await dlp.connect(v3OwnerAddress).registerValidator(v3Address, v3OwnerAddress, { value: parseEther('200') });
      await dlp.connect(v4OwnerAddress).registerValidator(v4Address, v4OwnerAddress, { value: parseEther('200') });
      await dlp.connect(v5OwnerAddress).registerValidator(v5Address, v5OwnerAddress, { value: parseEther('200') });
      // await dlp.connect(validator10Owner).registerAsValidator(validator10, validator10Owner, { value: parseEther('200') });

      //3 validators accepted by DLP owner
      await dlp.connect(owner).approveValidator(v1Address);
      await dlp.connect(owner).approveValidator(v2Address);
      await dlp.connect(owner).approveValidator(v3Address);
      await dlp.connect(owner).approveValidator(v4Address);
      await dlp.connect(owner).approveValidator(v5Address);

      console.log('epoch:', await dlp.epochs(1));

      await dlp.connect(owner).addFile('file1URL', "file1EncryptedAddress");
      await dlp.connect(owner).addFile('file2URL', "file2EncryptedAddress");
      await dlp.connect(owner).addFile('file3URL', "file3EncryptedAddress");
      await dlp.connect(owner).addFile('file4URL', "file4EncryptedAddress");
      await dlp.connect(owner).addFile('file5URL', "file5EncryptedAddress");
      await dlp.connect(owner).addFile('file6URL', "file6EncryptedAddress");
      await dlp.connect(owner).addFile('file7URL', "file7EncryptedAddress");
      await dlp.connect(owner).addFile('file8URL', "file8EncryptedAddress");

      await dlp.connect(v1Address).updateWeights([v1Address, v2Address, v3Address], [parseEther('1'), parseEther('1'), 1]);
      await dlp.connect(v2Address).updateWeights([v1Address, v2Address, v3Address], [1, parseEther('1'), parseEther('1')]);
      await dlp.connect(v3Address).updateWeights([v1Address, v2Address, v3Address], [parseEther('1'), 1, parseEther('1')]);

      const initialBalance1 = await ethers.provider.getBalance(v1OwnerAddress);


      console.log('file1: ', await dlp.files(1));
      console.log('file2: ', await dlp.files(2));
      console.log('file3: ', await dlp.files(3));
      console.log('file4: ', await dlp.files(4));
      console.log('file5: ', await dlp.files(5));

      console.log('********************************************');
      console.log(await dlp.getNextFileToVerify(v1Address));
      console.log(await dlp.getNextFileToVerify(v2Address));
      console.log(await dlp.getNextFileToVerify(v3Address));

      await dlp.connect(v1Address).verifyFile(1, parseEther('0.6'), 'file metadata');

      console.log('file1: ', await dlp.files(1));
      console.log('file1Validation1: ', await dlp.fileVerifications(1, 0));

      console.log('********************************************');
      console.log(await dlp.getNextFileToVerify(v1Address));
      console.log(await dlp.getNextFileToVerify(v2Address));
      console.log(await dlp.getNextFileToVerify(v3Address));


      await dlp.connect(v1Address).updateWeights([v1Address, v2Address, v3Address], [parseEther('1'), parseEther('1'), 1]);
      await dlp.connect(v2Address).updateWeights([v1Address, v2Address, v3Address], [1, parseEther('1'), parseEther('1')]);
      await dlp.connect(v3Address).updateWeights([v1Address, v2Address, v3Address], [parseEther('1'), 1, parseEther('1')]);

      console.log('emissionScore: ', await dlp.getEmissionScores(1));


      console.log(await dlp.epochShares(1));

      const initialBalance = await ethers.provider.getBalance(v1OwnerAddress);
      console.log('initialBalance: ', initialBalance);
      await advanceBlockNTimes(epochSize + 1);
      await dlp.connect(owner).createEpochs();

      console.log(await dlp.epochShares(1));

      const finalBalance = await ethers.provider.getBalance(v1OwnerAddress);
      console.log('finalBalance: ', finalBalance);

      console.log('reward: ', finalBalance - initialBalance);
    });
  });
});
