import chai, { should } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers, upgrades } from "hardhat";
import { BigNumberish, parseEther } from "ethers";
import { DAT, DataLiquidityPoolOldImplementation } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  advanceBlockNTimes,
  advanceNSeconds,
  advanceToBlockN,
  getCurrentBlockNumber,
  getCurrentBlockTimestamp,
} from "../utils/timeAndBlockManipulation";

chai.use(chaiAsPromised);
should();

xdescribe("DataLiquidityPoolOLd", () => {
  enum ValidatorStatus {
    None,
    Registered,
    Active,
    Deregistered,
  }

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

  let dlp: DataLiquidityPoolOldImplementation;
  let dat: DAT;

  const dlpName = "Test DLP";
  const dlpTokenName = "Test Data Autonomy Token";
  const dlpTokenSymbol = "TDAT";
  const maxNumberOfValidators = 9;
  const validatorScoreMinTrust = parseEther("0.1");
  const validatorScoreKappa = parseEther("0.5");
  const validatorScoreRho = parseEther("1");
  const validationPeriod = 120;
  const epochSize = 100;
  const minStakeAmount = parseEther("50");
  let startBlock: number;
  let epochRewardAmount = parseEther("2");
  let fileRewardFactor = parseEther("3");
  let fileRewardDelay = 3600 * 24 * 7;

  const dlpInitialBalance = parseEther("1000000");
  const v1OwnerInitialBalance = parseEther("1000000");
  const v2OwnerInitialBalance = parseEther("1000000");
  const v3OwnerInitialBalance = parseEther("1000000");
  const v4OwnerInitialBalance = parseEther("1000000");
  const v5OwnerInitialBalance = parseEther("1000000");
  const user1InitialBalance = parseEther("1000000");
  const ownerInitialBalance = parseEther("1000000");

  const deploy = async () => {
    [
      deployer,
      owner,
      v1,
      v1Owner,
      v2,
      v2Owner,
      v3,
      v3Owner,
      v4,
      v4Owner,
      v5,
      v5Owner,
      user1,
      user2,
      user3,
      user4,
      user5,
      user6,
      user7,
      user8,
      user9,
      user10,
      user11,
      user12,
      user13,
      user14,
      user15,
    ] = await ethers.getSigners();

    const datDeploy = await ethers.deployContract("DAT", [
      dlpTokenName,
      dlpTokenSymbol,
      owner,
    ]);
    dat = await ethers.getContractAt("DAT", datDeploy.target);

    startBlock = (await getCurrentBlockNumber()) + 1;

    const dlpDeploy = await upgrades.deployProxy(
      await ethers.getContractFactory("DataLiquidityPoolOldImplementation"),
      [
        [
          dlpName,
          owner.address,
          dat.target,
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
          fileRewardDelay,
        ],
      ],
      {
        kind: "uups",
      },
    );

    dlp = await ethers.getContractAt(
      "DataLiquidityPoolOldImplementation",
      dlpDeploy.target,
    );

    await dat.connect(owner).mint(dlp, dlpInitialBalance);
    await dat.connect(owner).mint(v1Owner, v1OwnerInitialBalance);
    await dat.connect(owner).mint(v2Owner, v2OwnerInitialBalance);
    await dat.connect(owner).mint(v3Owner, v3OwnerInitialBalance);
    await dat.connect(owner).mint(v4Owner, v4OwnerInitialBalance);
    await dat.connect(owner).mint(v5Owner, v5OwnerInitialBalance);
    await dat.connect(owner).mint(owner, ownerInitialBalance);
    await dat.connect(owner).mint(user1, user1InitialBalance);
  };

  async function advanceToEpochN(epochNumber: number) {
    const epochNStartBlock = startBlock + (epochNumber - 1) * epochSize;

    await advanceToBlockN(epochNStartBlock);
  }

  async function registerValidators() {
    await dat.connect(v1Owner).approve(dlp, parseEther("100"));
    await dat.connect(v2Owner).approve(dlp, parseEther("100"));
    await dat.connect(v3Owner).approve(dlp, parseEther("100"));
    await dat.connect(v4Owner).approve(dlp, parseEther("100"));
    await dat.connect(v5Owner).approve(dlp, parseEther("100"));
    await dlp
      .connect(v1Owner)
      .registerValidator(v1, v1Owner, parseEther("100"));
    await dlp
      .connect(v2Owner)
      .registerValidator(v2, v2Owner, parseEther("100"));
    await dlp
      .connect(v3Owner)
      .registerValidator(v3, v3Owner, parseEther("100"));
    await dlp
      .connect(v4Owner)
      .registerValidator(v4, v4Owner, parseEther("100"));
    await dlp
      .connect(v5Owner)
      .registerValidator(v5, v5Owner, parseEther("100"));

    await dlp.connect(owner).approveValidator(v1);
    await dlp.connect(owner).approveValidator(v2);
    await dlp.connect(owner).approveValidator(v3);
  }

  async function registerValidator1() {
    await dat.connect(v1Owner).approve(dlp, parseEther("100"));
    await dlp
      .connect(v1Owner)
      .registerValidator(v1, v1Owner, parseEther("100"));
    await dlp.connect(owner).approveValidator(v1);
  }

  describe("Setup", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should have correct params after deploy", async function () {
      (await dlp.name()).should.eq(dlpName);
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
      (await dlp.version()).should.eq(1);

      (await dlp.epochsCount()).should.eq(1);

      const epoch = await dlp.epochs(1);
      epoch.startBlock.should.eq(startBlock);
      epoch.endBlock.should.eq(startBlock + epochSize - 1);
      epoch.reward.should.eq(epochRewardAmount);
      epoch.validatorsListId.should.eq(0);
      (await dlp.validatorsCount()).should.eq(0);
      (await dlp.filesCount()).should.eq(0);
      (await dlp.activeValidatorsListsCount()).should.eq(0);
    });

    it("Should pause when owner", async function () {
      await dlp
        .connect(owner)
        .pause()
        .should.emit(dlp, "Paused")
        .withArgs(owner.address);
      (await dlp.paused()).should.be.equal(true);
    });

    it("Should reject pause when non-owner", async function () {
      await dlp
        .connect(v1)
        .pause()
        .should.be.rejectedWith(`OwnableUnauthorizedAccount("${v1.address}")`);
      (await dlp.paused()).should.be.equal(false);
    });

    it("Should unpause when owner", async function () {
      await dlp.connect(owner).pause();
      await dlp
        .connect(owner)
        .unpause()
        .should.emit(dlp, "Unpaused")
        .withArgs(owner.address);
      (await dlp.paused()).should.be.equal(false);
    });

    it("Should reject unpause when non-owner", async function () {
      await dlp.connect(owner).pause();
      await dlp
        .connect(v1Owner)
        .unpause()
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1Owner.address}")`,
        );
      (await dlp.paused()).should.be.equal(true);
    });

    it("Should updateMaxNumberOfValidators when owner", async function () {
      await dlp
        .connect(owner)
        .updateMaxNumberOfValidators(123)
        .should.emit(dlp, "MaxNumberOfValidatorsUpdated")
        .withArgs(123);

      (await dlp.maxNumberOfValidators()).should.eq(123);
    });

    it("Should reject updateMaxNumberOfValidators when non-owner", async function () {
      await dlp
        .connect(v1)
        .updateMaxNumberOfValidators(123)
        .should.be.rejectedWith(`OwnableUnauthorizedAccount("${v1.address}")`);

      (await dlp.maxNumberOfValidators()).should.eq(maxNumberOfValidators);
    });

    it("Should updateEpochSize when owner", async function () {
      await dlp
        .connect(owner)
        .updateEpochSize(123)
        .should.emit(dlp, "EpochSizeUpdated")
        .withArgs(123);

      (await dlp.epochSize()).should.eq(123);
    });

    it("Should reject updateEpochSize when non-owner", async function () {
      await dlp
        .connect(v1)
        .updateEpochSize(123)
        .should.be.rejectedWith(`OwnableUnauthorizedAccount("${v1.address}")`);

      (await dlp.epochSize()).should.eq(epochSize);
    });

    it("Should updateEpochRewardAmount when owner", async function () {
      (await dlp.epochs(1)).reward.should.eq(epochRewardAmount);

      await dlp
        .connect(owner)
        .updateEpochRewardAmount(123)
        .should.emit(dlp, "EpochRewardAmountUpdated")
        .withArgs(123);

      (await dlp.epochRewardAmount()).should.eq(123);

      (await dlp.epochs(1)).reward.should.eq(123);
    });

    it("Should updateEpochRewardAmount starting with the current epoch", async function () {
      await advanceToEpochN(3);
      (await dlp.epochs(1)).reward.should.eq(epochRewardAmount);

      await dlp
        .connect(owner)
        .updateEpochRewardAmount(123)
        .should.emit(dlp, "EpochRewardAmountUpdated")
        .withArgs(123);

      (await dlp.epochRewardAmount()).should.eq(123);

      await advanceToEpochN(5);
      await dlp.createEpochs();

      (await dlp.epochs(1)).reward.should.eq(epochRewardAmount);
      (await dlp.epochs(2)).reward.should.eq(epochRewardAmount);
      (await dlp.epochs(3)).reward.should.eq(123);
      (await dlp.epochs(4)).reward.should.eq(123);
      (await dlp.epochs(5)).reward.should.eq(123);
    });

    it("Should updateValidationPeriod when owner", async function () {
      await dlp
        .connect(owner)
        .updateValidationPeriod(123)
        .should.emit(dlp, "ValidationPeriodUpdated")
        .withArgs(123);

      (await dlp.validationPeriod()).should.eq(123);
    });

    it("Should reject updateEpochSize when non-owner", async function () {
      await dlp
        .connect(v1)
        .updateValidationPeriod(123)
        .should.be.rejectedWith(`OwnableUnauthorizedAccount("${v1.address}")`);

      (await dlp.validationPeriod()).should.eq(validationPeriod);
    });

    it("Should updateValidatorScoreMinTrust when owner", async function () {
      await dlp
        .connect(owner)
        .updateValidatorScoreMinTrust(parseEther("0.2"))
        .should.emit(dlp, "ValidatorScoreMinTrustUpdated")
        .withArgs(parseEther("0.2"));

      (await dlp.validatorScoreMinTrust()).should.eq(parseEther("0.2"));
    });

    it("Should reject updateValidatorScoreMinTrust when non-owner", async function () {
      await dlp
        .connect(v1)
        .updateValidatorScoreMinTrust(parseEther("0.2"))
        .should.be.rejectedWith(`OwnableUnauthorizedAccount("${v1.address}")`);

      (await dlp.validatorScoreMinTrust()).should.eq(validatorScoreMinTrust);
    });

    it("Should updateValidatorScoreKappa when owner", async function () {
      await dlp
        .connect(owner)
        .updateValidatorScoreKappa(parseEther("0.2"))
        .should.emit(dlp, "ValidatorScoreKappaUpdated")
        .withArgs(parseEther("0.2"));

      (await dlp.validatorScoreKappa()).should.eq(parseEther("0.2"));
    });

    it("Should reject updateValidatorScoreKappa when non-owner", async function () {
      await dlp
        .connect(v1)
        .updateValidatorScoreKappa(parseEther("0.2"))
        .should.be.rejectedWith(`OwnableUnauthorizedAccount("${v1.address}")`);

      (await dlp.validatorScoreKappa()).should.eq(validatorScoreKappa);
    });

    it("Should updateValidatorScoreRho when owner", async function () {
      await dlp
        .connect(owner)
        .updateValidatorScoreRho(parseEther("0.2"))
        .should.emit(dlp, "ValidatorScoreRhoUpdated")
        .withArgs(parseEther("0.2"));

      (await dlp.validatorScoreRho()).should.eq(parseEther("0.2"));
    });

    it("Should reject updateValidatorScoreRho when non-owner", async function () {
      await dlp
        .connect(v1)
        .updateValidatorScoreRho(parseEther("0.2"))
        .should.be.rejectedWith(`OwnableUnauthorizedAccount("${v1.address}")`);

      (await dlp.validatorScoreRho()).should.eq(validatorScoreRho);
    });

    it("Should updateMinStakeAmount when owner", async function () {
      await dlp
        .connect(owner)
        .updateMinStakeAmount(parseEther("0.2"))
        .should.emit(dlp, "MinStakeAmountUpdated")
        .withArgs(parseEther("0.2"));

      (await dlp.minStakeAmount()).should.eq(parseEther("0.2"));
    });

    it("Should reject updateMinStakeAmount when non-owner", async function () {
      await dlp
        .connect(v1)
        .updateMinStakeAmount(parseEther("0.2"))
        .should.be.rejectedWith(`OwnableUnauthorizedAccount("${v1.address}")`);

      (await dlp.minStakeAmount()).should.eq(minStakeAmount);
    });

    it("Should updateFileRewardFactor when owner", async function () {
      await dlp
        .connect(owner)
        .updateFileRewardFactor(fileRewardFactor + 1n)
        .should.emit(dlp, "FileRewardFactorUpdated")
        .withArgs(fileRewardFactor + 1n);

      (await dlp.fileRewardFactor()).should.eq(fileRewardFactor + 1n);
    });

    it("Should reject updateFileRewardFactor when non-owner", async function () {
      await dlp
        .connect(v1)
        .updateFileRewardFactor(fileRewardFactor + 1n)
        .should.be.rejectedWith(`OwnableUnauthorizedAccount("${v1.address}")`);

      (await dlp.fileRewardFactor()).should.eq(fileRewardFactor);
    });

    it("Should updateFileRewardDelay when owner", async function () {
      await dlp
        .connect(owner)
        .updateFileRewardDelay(fileRewardDelay + 1)
        .should.emit(dlp, "FileRewardDelayUpdated")
        .withArgs(fileRewardDelay + 1);

      (await dlp.fileRewardDelay()).should.eq(fileRewardDelay + 1);
    });

    it("Should reject updateFileRewardDelay when non-owner", async function () {
      await dlp
        .connect(v1)
        .updateFileRewardDelay(fileRewardDelay + 1)
        .should.be.rejectedWith(`OwnableUnauthorizedAccount("${v1.address}")`);

      (await dlp.fileRewardDelay()).should.eq(fileRewardDelay);
    });

    it("Should transferOwnership in 2 steps", async function () {
      await dlp
        .connect(owner)
        .transferOwnership(user2.address)
        .should.emit(dlp, "OwnershipTransferStarted")
        .withArgs(owner, user2);
      (await dlp.owner()).should.eq(owner);

      await dlp
        .connect(owner)
        .transferOwnership(user3.address)
        .should.emit(dlp, "OwnershipTransferStarted")
        .withArgs(owner, user3);
      (await dlp.owner()).should.eq(owner);

      await dlp
        .connect(user3)
        .acceptOwnership()
        .should.emit(dlp, "OwnershipTransferred");

      (await dlp.owner()).should.eq(user3);
    });

    it("Should reject transferOwnership when non-owner", async function () {
      await dlp
        .connect(v1Owner)
        .transferOwnership(user2)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1Owner.address}")`,
        );
    });

    it("Should upgradeTo when owner", async function () {
      await upgrades.upgradeProxy(
        dlp,
        await ethers.getContractFactory(
          "DataLiquidityPoolOldImplementationV2Mock",
          owner,
        ),
      );

      const newDlp = await ethers.getContractAt(
        "DataLiquidityPoolOldImplementationV2Mock",
        dlp,
      );

      (await newDlp.name()).should.eq(dlpName);
      (await newDlp.owner()).should.eq(owner);
      (await newDlp.maxNumberOfValidators()).should.eq(maxNumberOfValidators);
      (await newDlp.validatorScoreMinTrust()).should.eq(validatorScoreMinTrust);
      (await newDlp.validatorScoreKappa()).should.eq(validatorScoreKappa);
      (await newDlp.validatorScoreRho()).should.eq(validatorScoreRho);
      (await newDlp.validationPeriod()).should.eq(validationPeriod);
      (await newDlp.minStakeAmount()).should.eq(minStakeAmount);
      (await newDlp.epochSize()).should.eq(epochSize);
      (await newDlp.epochRewardAmount()).should.eq(epochRewardAmount);
      (await newDlp.paused()).should.eq(false);
      (await newDlp.fileRewardDelay()).should.eq(fileRewardDelay);
      (await newDlp.fileRewardFactor()).should.eq(fileRewardFactor);
      (await newDlp.epochsCount()).should.eq(1);
      (await newDlp.version()).should.eq(2);

      (await newDlp.test()).should.eq("test");
    });

    it("Should upgradeTo when owner and emit event", async function () {
      const newDlpImplementation = await ethers.deployContract(
        "DataLiquidityPoolOldImplementationV2Mock",
      );

      await dlp
        .connect(owner)
        .upgradeToAndCall(newDlpImplementation, "0x")
        .should.emit(dlp, "Upgraded")
        .withArgs(newDlpImplementation);

      const newDlp = await ethers.getContractAt(
        "DataLiquidityPoolOldImplementationV2Mock",
        dlp,
      );

      (await newDlp.name()).should.eq(dlpName);
      (await newDlp.owner()).should.eq(owner);
      (await newDlp.maxNumberOfValidators()).should.eq(maxNumberOfValidators);
      (await newDlp.validatorScoreMinTrust()).should.eq(validatorScoreMinTrust);
      (await newDlp.validatorScoreKappa()).should.eq(validatorScoreKappa);
      (await newDlp.validatorScoreRho()).should.eq(validatorScoreRho);
      (await newDlp.validationPeriod()).should.eq(validationPeriod);
      (await newDlp.minStakeAmount()).should.eq(minStakeAmount);
      (await newDlp.epochSize()).should.eq(epochSize);
      (await newDlp.epochRewardAmount()).should.eq(epochRewardAmount);
      (await newDlp.paused()).should.eq(false);
      (await newDlp.fileRewardDelay()).should.eq(fileRewardDelay);
      (await newDlp.fileRewardFactor()).should.eq(fileRewardFactor);
      (await newDlp.epochsCount()).should.eq(1);
      (await newDlp.version()).should.eq(2);

      (await newDlp.test()).should.eq("test");
    });

    it("Should reject upgradeTo when storage layout is incompatible", async function () {
      await upgrades
        .upgradeProxy(
          dlp,
          await ethers.getContractFactory(
            "DataLiquidityPoolOldImplementationV3Mock",
            owner,
          ),
        )
        .should.be.rejectedWith("New storage layout is incompatible");
    });

    it("Should reject upgradeTo when non owner", async function () {
      const newDlpImplementation = await ethers.deployContract(
        "DataLiquidityPoolOldImplementationV2Mock",
      );

      await dlp
        .connect(user1)
        .upgradeToAndCall(newDlpImplementation, "0x")
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

      await dlp
        .connect(owner)
        .createEpochs()
        .should.emit(dlp, "EpochCreated")
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
      await dlp
        .connect(owner)
        .createEpochs()
        .should.emit(dlp, "EpochCreated")
        .withArgs(2)
        .emit(dlp, "EpochCreated")
        .withArgs(3)
        .emit(dlp, "EpochCreated")
        .withArgs(4);

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
      await dlp
        .connect(owner)
        .createEpochsUntilBlockNumber(epoch4StartBlock)
        .should.emit(dlp, "EpochCreated")
        .withArgs(2)
        .emit(dlp, "EpochCreated")
        .withArgs(3)
        .emit(dlp, "EpochCreated")
        .withArgs(4);

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

    it("should createEpochs with no active validators", async function () {
      await advanceToEpochN(3);
      await dlp.connect(owner).createEpochs();

      for (let i = 1; i <= 2; i++) {
        (await dlp.epochs(i)).validatorsListId.should.eq(0);
      }
    });

    it("should createEpochs when updating weights #1", async function () {
      await advanceToEpochN(3);

      await dat.connect(v1Owner).approve(dlp, parseEther("100"));
      await dat.connect(v2Owner).approve(dlp, parseEther("100"));
      await dlp
        .connect(v1Owner)
        .registerValidator(v1, v1Owner, parseEther("100"));
      await dlp
        .connect(v2Owner)
        .registerValidator(v2, v2Owner, parseEther("100"));
      await dlp.connect(owner).approveValidator(v1);
      await dlp.connect(owner).approveValidator(v2);

      await dlp
        .connect(v1)
        .updateWeights([v1, v2], [parseEther("1"), parseEther("1")]);
      await dlp
        .connect(v2)
        .updateWeights([v1, v2], [parseEther("1"), parseEther("1")]);

      await advanceToEpochN(4);

      await dlp
        .connect(v1)
        .updateWeights([v1, v2], [parseEther("1"), parseEther("1")]);

      const epoch1 = await dlp.epochs(1);
      epoch1.validatorsListId.should.eq(0);

      const epoch2 = await dlp.epochs(2);
      epoch2.validatorsListId.should.eq(0);

      const epoch3 = await dlp.epochs(3);
      epoch3.validatorsListId.should.not.eq(0);
    });

    it("should createEpochs when updating weights #2", async function () {
      await advanceToEpochN(3);

      await dat.connect(v1Owner).approve(dlp, parseEther("100"));
      await dat.connect(v2Owner).approve(dlp, parseEther("100"));
      await dlp
        .connect(v1Owner)
        .registerValidator(v1, v1Owner, parseEther("100"));
      await dlp
        .connect(v2Owner)
        .registerValidator(v2, v2Owner, parseEther("100"));
      await dlp.connect(owner).approveValidator(v1);
      await dlp.connect(owner).approveValidator(v2);

      await dlp
        .connect(v1)
        .updateWeights([v1, v2], [parseEther("1"), parseEther("1")]);
      await dlp
        .connect(v2)
        .updateWeights([v1, v2], [parseEther("1"), parseEther("1")]);

      await advanceToEpochN(4);

      await dlp
        .connect(v1)
        .updateWeights([v1, v2], [parseEther("1"), parseEther("1")]);

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

      await dat.connect(v1Owner).approve(dlp, parseEther("100"));
      await dat.connect(v2Owner).approve(dlp, parseEther("100"));
      await dlp
        .connect(v1Owner)
        .registerValidator(v1, v1Owner, parseEther("100"));
      await dlp
        .connect(v2Owner)
        .registerValidator(v2, v2Owner, parseEther("100"));
      await dlp.connect(owner).approveValidator(v1);
      await dlp.connect(owner).approveValidator(v2);

      await dlp
        .connect(v1)
        .updateWeights([v1, v2], [parseEther("1"), parseEther("1")]);
      await dlp
        .connect(v2)
        .updateWeights([v1, v2], [parseEther("1"), parseEther("1")]);

      await advanceToEpochN(4);

      await dlp
        .connect(v1)
        .createEpochs()
        .should.emit(dlp, "EpochCreated")
        .withArgs(4);

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
    });

    it("should addFile when one validator", async function () {
      await registerValidator1();

      await dlp
        .connect(user1)
        .addFile("file1URL", "file1EncryptedAddress")
        .should.emit(dlp, "FileAdded")
        .withArgs(user1, 1);
      const timestamp = await getCurrentBlockTimestamp();

      (await dlp.filesCount()).should.eq(1);

      const file1 = await dlp.files(1);
      file1.ownerAddress.should.eq(user1);
      file1.url.should.eq("file1URL");
      file1.encryptedKey.should.eq("file1EncryptedAddress");
      file1.addedTimestamp.should.eq(timestamp);
      file1.reward.should.eq(0);
      file1.rewardWithdrawn.should.eq(0);
      file1.verificationsCount.should.eq(0);

      (await dlp.contributorFiles(user1, 1)).should.deep.eq(file1);

      (await dlp.contributorsCount()).should.eq(1);
      const contributor1 = await dlp.contributors(1);
      contributor1.contributorAddress.should.eq(user1);
      contributor1.fileIdsCount.should.eq(1);

      (await dlp.contributorInfo(user1)).should.deep.eq(contributor1);

      const validator = await dlp.validatorsInfo(v1);
      validator.lastVerifiedFile.should.eq(0);

      (await dlp.getNextFileToVerify(v1)).should.deep.eq(file1);
    });

    it("should addFile when no validator", async function () {
      await dlp
        .connect(user1)
        .addFile("file1URL", "file1EncryptedAddress")
        .should.emit(dlp, "FileAdded")
        .withArgs(user1, 1);
      const timestamp = await getCurrentBlockTimestamp();

      (await dlp.filesCount()).should.eq(1);

      const file1 = await dlp.files(1);
      file1.ownerAddress.should.eq(user1);
      file1.url.should.eq("file1URL");
      file1.encryptedKey.should.eq("file1EncryptedAddress");
      file1.addedTimestamp.should.eq(timestamp);
      file1.reward.should.eq(0);
      file1.rewardWithdrawn.should.eq(0);
      file1.verificationsCount.should.eq(0);

      (await dlp.contributorFiles(user1, 1)).should.deep.eq(file1);

      (await dlp.contributorsCount()).should.eq(1);
      const contributor1 = await dlp.contributors(1);
      contributor1.contributorAddress.should.eq(user1);
      contributor1.fileIdsCount.should.eq(1);

      (await dlp.contributorInfo(user1)).should.deep.eq(contributor1);

      const validator = await dlp.validatorsInfo(ethers.ZeroAddress);
      validator.lastVerifiedFile.should.eq(0);
    });

    it("should addFile multiple times by same user", async function () {
      await registerValidator1();

      const timestamp = await getCurrentBlockTimestamp();
      await dlp
        .connect(user1)
        .addFile("file1URL", "file1EncryptedAddress")
        .should.emit(dlp, "FileAdded")
        .withArgs(user1, 1);
      await dlp
        .connect(user1)
        .addFile("file2URL", "file2EncryptedAddress")
        .should.emit(dlp, "FileAdded")
        .withArgs(user1, 2);

      (await dlp.filesCount()).should.eq(2);

      const file1 = await dlp.files(1);
      file1.ownerAddress.should.eq(user1);
      file1.url.should.eq("file1URL");
      file1.encryptedKey.should.eq("file1EncryptedAddress");
      file1.addedTimestamp.should.eq(timestamp + 1);
      file1.reward.should.eq(0);
      file1.rewardWithdrawn.should.eq(0);
      file1.verificationsCount.should.eq(0);

      (await dlp.contributorFiles(user1, 1)).should.deep.eq(file1);

      const file2 = await dlp.files(2);
      file2.ownerAddress.should.eq(user1);
      file2.url.should.eq("file2URL");
      file2.encryptedKey.should.eq("file2EncryptedAddress");
      file2.addedTimestamp.should.eq(timestamp + 2);
      file2.reward.should.eq(0);
      file2.rewardWithdrawn.should.eq(0);
      file2.verificationsCount.should.eq(0);

      (await dlp.contributorFiles(user1, 2)).should.deep.eq(file2);

      (await dlp.contributorsCount()).should.eq(1);
      const contributor1 = await dlp.contributors(1);
      contributor1.contributorAddress.should.eq(user1);
      contributor1.fileIdsCount.should.eq(2);

      (await dlp.contributorInfo(user1)).should.deep.eq(contributor1);

      const validator = await dlp.validatorsInfo(v1);
      validator.lastVerifiedFile.should.eq(0);

      (await dlp.getNextFileToVerify(v1)).should.deep.eq(file1);
    });

    it("should addFile many users and many validators", async function () {
      await registerValidators();

      const timestamp = await getCurrentBlockTimestamp();
      await dlp
        .connect(user1)
        .addFile("file1URL", "file1EncryptedAddress")
        .should.emit(dlp, "FileAdded")
        .withArgs(user1.address, 1);
      await dlp
        .connect(user1)
        .addFile("file2URL", "file2EncryptedAddress")
        .should.emit(dlp, "FileAdded")
        .withArgs(user1.address, 2);
      await dlp
        .connect(user3)
        .addFile("file3URL", "file3EncryptedAddress")
        .should.emit(dlp, "FileAdded")
        .withArgs(user3.address, 3);
      await dlp
        .connect(user3)
        .addFile("file4URL", "file4EncryptedAddress")
        .should.emit(dlp, "FileAdded")
        .withArgs(user3.address, 4);
      await dlp
        .connect(user3)
        .addFile("file5URL", "file5EncryptedAddress")
        .should.emit(dlp, "FileAdded")
        .withArgs(user3.address, 5);
      await dlp
        .connect(user2)
        .addFile("file6URL", "file6EncryptedAddress")
        .should.emit(dlp, "FileAdded")
        .withArgs(user2.address, 6);

      (await dlp.filesCount()).should.eq(6);

      const file1 = await dlp.files(1);
      file1.ownerAddress.should.eq(user1);
      file1.url.should.eq("file1URL");
      file1.encryptedKey.should.eq("file1EncryptedAddress");
      file1.addedTimestamp.should.eq(timestamp + 1);
      (await dlp.contributorFiles(user1, 1)).should.deep.eq(file1);

      const file2 = await dlp.files(2);
      file2.ownerAddress.should.eq(user1);
      file2.url.should.eq("file2URL");
      file2.encryptedKey.should.eq("file2EncryptedAddress");
      file2.addedTimestamp.should.eq(timestamp + 2);
      (await dlp.contributorFiles(user1, 2)).should.deep.eq(file2);

      const file3 = await dlp.files(3);
      file3.ownerAddress.should.eq(user3);
      file3.url.should.eq("file3URL");
      file3.encryptedKey.should.eq("file3EncryptedAddress");
      file3.addedTimestamp.should.eq(timestamp + 3);
      (await dlp.contributorFiles(user3, 1)).should.deep.eq(file3);

      const file4 = await dlp.files(4);
      file4.ownerAddress.should.eq(user3);
      file4.url.should.eq("file4URL");
      file4.encryptedKey.should.eq("file4EncryptedAddress");
      file4.addedTimestamp.should.eq(timestamp + 4);
      (await dlp.contributorFiles(user3, 2)).should.deep.eq(file4);

      const file5 = await dlp.files(5);
      file5.ownerAddress.should.eq(user3);
      file5.url.should.eq("file5URL");
      file5.encryptedKey.should.eq("file5EncryptedAddress");
      file5.addedTimestamp.should.eq(timestamp + 5);
      (await dlp.contributorFiles(user3, 3)).should.deep.eq(file5);

      const file6 = await dlp.files(6);
      file6.ownerAddress.should.eq(user2);
      file6.url.should.eq("file6URL");
      file6.encryptedKey.should.eq("file6EncryptedAddress");
      file6.addedTimestamp.should.eq(timestamp + 6);
      (await dlp.contributorFiles(user2, 1)).should.deep.eq(file6);

      (await dlp.contributorsCount()).should.eq(3);

      const contributor1 = await dlp.contributors(1);
      contributor1.contributorAddress.should.eq(user1);
      contributor1.fileIdsCount.should.eq(2);
      (await dlp.contributorInfo(user1)).should.deep.eq(contributor1);

      const contributor2 = await dlp.contributors(2);
      contributor2.contributorAddress.should.eq(user3);
      contributor2.fileIdsCount.should.eq(3);
      (await dlp.contributorInfo(user3)).should.deep.eq(contributor2);

      const contributor3 = await dlp.contributors(3);
      contributor3.contributorAddress.should.eq(user2);
      contributor3.fileIdsCount.should.eq(1);
      (await dlp.contributorInfo(user2)).should.deep.eq(contributor3);

      const validator1 = await dlp.validatorsInfo(v1);
      validator1.lastVerifiedFile.should.eq(0);

      const validator2 = await dlp.validatorsInfo(v2);
      validator2.lastVerifiedFile.should.eq(0);

      const validator3 = await dlp.validatorsInfo(v3);
      validator3.lastVerifiedFile.should.eq(0);

      (await dlp.getNextFileToVerify(v1)).should.deep.eq(file1);
      (await dlp.getNextFileToVerify(v2)).should.deep.eq(file1);
      (await dlp.getNextFileToVerify(v3)).should.deep.eq(file1);
    });

    it("Should reject addFile when same url", async function () {
      await dlp.connect(user1).addFile("file1URL", "file1EncryptedAddress")
        .should.be.fulfilled;
      await dlp
        .connect(user1)
        .addFile("file1URL", "file2EncryptedAddress")
        .should.be.rejectedWith(`FileAlreadyAdded()`);
    });

    xit("should create epochs when adding files and no validators", async function () {
      await advanceToEpochN(4);
      await dlp
        .connect(user1)
        .addFile("file1URL", "file1EncryptedAddress")
        .should.emit(dlp, "FileAdded")
        .withArgs(user1, 1)
        .emit(dlp, "EpochCreated")
        .withArgs(2)
        .emit(dlp, "EpochCreated")
        .withArgs(3)
        .emit(dlp, "EpochCreated")
        .withArgs(4);

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

    xit("should create epochs when adding files", async function () {
      await registerValidators();

      await advanceToEpochN(4);
      await dlp
        .connect(user1)
        .addFile("file1URL", "file1EncryptedAddress")
        .should.emit(dlp, "FileAdded")
        .withArgs(user1, 1)
        .emit(dlp, "EpochCreated")
        .withArgs(2)
        .emit(dlp, "EpochCreated")
        .withArgs(3)
        .emit(dlp, "EpochCreated")
        .withArgs(4);

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
      await dat.connect(v1Owner).approve(dlp, parseEther("100"));
      await dlp
        .connect(v1Owner)
        .registerValidator(v1, v1Owner, parseEther("100"))
        .should.emit(dlp, "ValidatorRegistered")
        .withArgs(v1.address, v1Owner.address, parseEther("100"));

      (await dlp.validatorsCount()).should.eq(1);

      const validator1 = await dlp.validatorsInfo(v1);

      validator1.validatorAddress.should.eq(v1);
      validator1.ownerAddress.should.eq(v1Owner.address);
      validator1.stakeAmount.should.eq(parseEther("100"));
      validator1.status.should.eq(ValidatorStatus.Registered);
      validator1.lastVerifiedFile.should.eq(0);
      validator1.grantedAmount.should.eq(0);
      validator1.firstBlockNumber.should.eq(0);
      validator1.lastBlockNumber.should.eq(0);

      (await dlp.validatorsCount()).should.eq(1);
      (await dlp.validators(1)).should.deep.eq(validator1);

      (await dlp.activeValidatorsListsCount()).should.eq(0);

      (await dlp.totalStaked()).should.eq(parseEther("100"));

      (await dat.balanceOf(v1Owner)).should.eq(
        v1OwnerInitialBalance - parseEther("100"),
      );
      (await dat.balanceOf(dlp)).should.eq(
        dlpInitialBalance + parseEther("100"),
      );
    });

    it("should registerValidator as sponsor", async function () {
      await dat.connect(user1).approve(dlp, parseEther("100"));
      await dlp
        .connect(user1)
        .registerValidator(v1, v1Owner, parseEther("100"))
        .should.emit(dlp, "ValidatorRegistered")
        .withArgs(v1.address, v1Owner.address, parseEther("100"));

      (await dlp.validatorsCount()).should.eq(1);

      const validator1 = await dlp.validatorsInfo(v1);

      validator1.validatorAddress.should.eq(v1);
      validator1.ownerAddress.should.eq(v1Owner.address);
      validator1.stakeAmount.should.eq(parseEther("100"));
      validator1.status.should.eq(ValidatorStatus.Registered);
      validator1.lastVerifiedFile.should.eq(0);
      validator1.grantedAmount.should.eq(0);
      validator1.firstBlockNumber.should.eq(0);
      validator1.lastBlockNumber.should.eq(0);

      (await dlp.validatorsCount()).should.eq(1);
      (await dlp.validators(1)).should.deep.eq(validator1);

      (await dlp.activeValidatorsListsCount()).should.eq(0);

      (await dlp.totalStaked()).should.eq(parseEther("100"));

      (await dat.balanceOf(user1)).should.eq(
        v1OwnerInitialBalance - parseEther("100"),
      );
      (await dat.balanceOf(dlp)).should.eq(
        dlpInitialBalance + parseEther("100"),
      );
    });

    it("should registerValidator as DLP owner", async function () {
      await dat.connect(owner).approve(dlp, parseEther("100"));
      await dlp
        .connect(owner)
        .registerValidator(v1, v1Owner, parseEther("100"))
        .should.emit(dlp, "ValidatorRegistered")
        .withArgs(v1.address, v1Owner.address, parseEther("100"));

      (await dlp.validatorsCount()).should.eq(1);

      const validator1 = await dlp.validatorsInfo(v1);

      validator1.validatorAddress.should.eq(v1);
      validator1.ownerAddress.should.eq(v1Owner.address);
      validator1.stakeAmount.should.eq(parseEther("100"));
      validator1.status.should.eq(ValidatorStatus.Registered);
      validator1.lastVerifiedFile.should.eq(0);
      validator1.grantedAmount.should.eq(parseEther("100"));
      validator1.firstBlockNumber.should.eq(0);
      validator1.lastBlockNumber.should.eq(0);

      (await dlp.validatorsCount()).should.eq(1);
      (await dlp.validators(1)).should.deep.eq(validator1);

      (await dlp.activeValidatorsListsCount()).should.eq(0);

      (await dlp.totalStaked()).should.eq(parseEther("100"));

      (await dat.balanceOf(owner)).should.eq(
        v1OwnerInitialBalance - parseEther("100"),
      );
      (await dat.balanceOf(dlp)).should.eq(
        dlpInitialBalance + parseEther("100"),
      );
    });

    it("should registerValidator many times", async function () {
      await dat.connect(v1Owner).approve(dlp, parseEther("100"));
      await dat.connect(v2Owner).approve(dlp, parseEther("200"));
      await dat.connect(v3Owner).approve(dlp, parseEther("300"));
      await dlp
        .connect(v1Owner)
        .registerValidator(v1, v1Owner, parseEther("100"))
        .should.emit(dlp, "ValidatorRegistered")
        .withArgs(v1.address, v1Owner.address, parseEther("100"));
      await dlp
        .connect(v2Owner)
        .registerValidator(v2, v2Owner, parseEther("200"))
        .should.emit(dlp, "ValidatorRegistered")
        .withArgs(v2.address, v2Owner.address, parseEther("200"));
      await dlp
        .connect(v3Owner)
        .registerValidator(v3, v3Owner, parseEther("300"))
        .should.emit(dlp, "ValidatorRegistered")
        .withArgs(v3.address, v3Owner.address, parseEther("300"));

      (await dlp.validatorsCount()).should.eq(3);

      const validator1 = await dlp.validatorsInfo(v1);
      validator1.validatorAddress.should.eq(v1);
      validator1.ownerAddress.should.eq(v1Owner.address);
      validator1.stakeAmount.should.eq(parseEther("100"));
      validator1.status.should.eq(ValidatorStatus.Registered);
      validator1.lastVerifiedFile.should.eq(0);
      validator1.grantedAmount.should.eq(0);
      validator1.firstBlockNumber.should.eq(0);
      validator1.lastBlockNumber.should.eq(0);

      const validator2 = await dlp.validatorsInfo(v2);
      validator2.validatorAddress.should.eq(v2);
      validator2.ownerAddress.should.eq(v2Owner.address);
      validator2.stakeAmount.should.eq(parseEther("200"));
      validator2.status.should.eq(ValidatorStatus.Registered);
      validator2.lastVerifiedFile.should.eq(0);
      validator2.grantedAmount.should.eq(0);
      validator2.firstBlockNumber.should.eq(0);
      validator2.lastBlockNumber.should.eq(0);

      const validator3 = await dlp.validatorsInfo(v3);
      validator3.validatorAddress.should.eq(v3);
      validator3.ownerAddress.should.eq(v3Owner.address);
      validator3.stakeAmount.should.eq(parseEther("300"));
      validator3.status.should.eq(ValidatorStatus.Registered);
      validator3.lastVerifiedFile.should.eq(0);
      validator3.grantedAmount.should.eq(0);
      validator3.firstBlockNumber.should.eq(0);
      validator3.lastBlockNumber.should.eq(0);

      (await dlp.validatorsCount()).should.eq(3);
      (await dlp.validators(1)).should.deep.eq(validator1);
      (await dlp.validators(2)).should.deep.eq(validator2);
      (await dlp.validators(3)).should.deep.eq(validator3);

      (await dlp.activeValidatorsListsCount()).should.eq(0);

      (await dlp.totalStaked()).should.eq(
        parseEther("100") + parseEther("200") + parseEther("300"),
      );

      (await dat.balanceOf(v1Owner)).should.eq(
        v1OwnerInitialBalance - parseEther("100"),
      );
      (await dat.balanceOf(v2Owner)).should.eq(
        v2OwnerInitialBalance - parseEther("200"),
      );
      (await dat.balanceOf(v3Owner)).should.eq(
        v3OwnerInitialBalance - parseEther("300"),
      );
      (await dat.balanceOf(dlp)).should.eq(
        dlpInitialBalance +
          parseEther("100") +
          parseEther("200") +
          parseEther("300"),
      );
    });

    it("Should reject registerValidator when stake amount too small", async function () {
      await dat.connect(v1Owner).approve(dlp, parseEther("100"));
      await dlp
        .connect(v1Owner)
        .registerValidator(v1, v1Owner, parseEther("1"))
        .should.be.rejectedWith(`InvalidStakeAmount()`);
    });

    it("Should reject registerValidator when already registered", async function () {
      await dat.connect(v1Owner).approve(dlp, parseEther("100"));
      await dlp
        .connect(v1Owner)
        .registerValidator(v1, v1Owner, parseEther("100"));
      await dlp
        .connect(v1Owner)
        .registerValidator(v1, v1Owner, parseEther("100"))
        .should.be.rejectedWith(`InvalidValidatorStatus()`);
    });

    it("Should reject registerValidator when already approved", async function () {
      await registerValidator1();
      await dlp
        .connect(v1Owner)
        .registerValidator(v1, v1Owner, parseEther("100"))
        .should.be.rejectedWith(`InvalidValidatorStatus()`);
    });

    it("Should reject registerValidator when deregistered", async function () {
      await dat.connect(v1Owner).approve(dlp, parseEther("200"));
      await dlp
        .connect(v1Owner)
        .registerValidator(v1, v1Owner, parseEther("100"));
      await dlp.connect(owner).approveValidator(v1);
      await dlp.connect(v1Owner).deregisterValidator(v1);
      await dlp
        .connect(v1Owner)
        .registerValidator(v1, v1Owner, parseEther("100"))
        .should.be.rejectedWith(`InvalidValidatorStatus()`);
    });

    it("Should reject registerValidator when deregistered", async function () {
      await dat.connect(v1Owner).approve(dlp, parseEther("200"));
      await dlp
        .connect(v1Owner)
        .registerValidator(v1, v1Owner, parseEther("100"));
      await dlp.connect(owner).approveValidator(v1);
      await dlp.connect(v1Owner).deregisterValidator(v1);
      await dlp
        .connect(v1Owner)
        .registerValidator(v1, v1Owner, parseEther("100"))
        .should.be.rejectedWith(`InvalidValidatorStatus()`);
    });

    it("should approveValidator when owner", async function () {
      await dat.connect(v1Owner).approve(dlp, parseEther("100"));
      await dlp
        .connect(v1Owner)
        .registerValidator(v1, v1Owner, parseEther("100"));
      await dlp
        .connect(owner)
        .approveValidator(v1)
        .should.emit(dlp, "ValidatorApproved")
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
      await dat.connect(v1Owner).approve(dlp, parseEther("100"));
      await dat.connect(v2Owner).approve(dlp, parseEther("200"));
      await dat.connect(v3Owner).approve(dlp, parseEther("300"));
      await dat.connect(v4Owner).approve(dlp, parseEther("400"));
      await dat.connect(v5Owner).approve(dlp, parseEther("500"));
      await dlp
        .connect(v1Owner)
        .registerValidator(v1, v1Owner, parseEther("100"));
      await dlp
        .connect(v2Owner)
        .registerValidator(v2, v2Owner, parseEther("200"));
      await dlp
        .connect(v3Owner)
        .registerValidator(v3, v3Owner, parseEther("300"));
      await dlp
        .connect(v4Owner)
        .registerValidator(v4, v4Owner, parseEther("400"));
      await dlp
        .connect(v5Owner)
        .registerValidator(v5, v5Owner, parseEther("500"));

      const currentBlockNumber = await getCurrentBlockNumber();

      await dlp
        .connect(owner)
        .approveValidator(v1)
        .should.emit(dlp, "ValidatorApproved")
        .withArgs(v1.address);
      await dlp
        .connect(owner)
        .approveValidator(v2)
        .should.emit(dlp, "ValidatorApproved")
        .withArgs(v2.address);
      await dlp
        .connect(owner)
        .approveValidator(v3)
        .should.emit(dlp, "ValidatorApproved")
        .withArgs(v3.address);

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
      (await dlp.activeValidatorsLists(2)).should.deep.eq([
        v1.address,
        v2.address,
      ]);
      (await dlp.activeValidatorsLists(3)).should.deep.eq([
        v1.address,
        v2.address,
        v3.address,
      ]);

      (await dlp.epochs(1)).validatorsListId.should.eq(3);
    });

    it("Should reject approveValidator when non-owner", async function () {
      await dat.connect(v1Owner).approve(dlp, parseEther("100"));
      await dlp
        .connect(v1Owner)
        .registerValidator(v1, v1Owner, parseEther("100"));
      await dlp
        .connect(v1Owner)
        .approveValidator(v1)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1Owner.address}")`,
        );
    });

    it("Should reject approveValidator when already approved", async function () {
      await registerValidator1();
      await dlp
        .connect(owner)
        .approveValidator(v1)
        .should.be.rejectedWith(`InvalidValidatorStatus()`);
    });

    it("Should reject approveValidator when not registered", async function () {
      await dlp
        .connect(owner)
        .approveValidator(v1)
        .should.be.rejectedWith(`InvalidValidatorStatus()`);
    });

    it("Should reject approveValidator when deregistered", async function () {
      await registerValidator1();
      await dlp.connect(v1Owner).deregisterValidator(v1);
      await dlp
        .connect(owner)
        .approveValidator(v1)
        .should.be.rejectedWith(`InvalidValidatorStatus()`);
    });

    it("should createEpochs when approving validators", async function () {
      await advanceToEpochN(4);

      await dat.connect(v1Owner).approve(dlp, parseEther("100"));
      await dlp
        .connect(v1Owner)
        .registerValidator(v1, v1Owner, parseEther("100")).should.be.fulfilled;

      await dlp
        .connect(owner)
        .approveValidator(v1)
        .should.emit(dlp, "ValidatorApproved")
        .withArgs(v1.address)
        .emit(dlp, "EpochCreated")
        .withArgs(2)
        .emit(dlp, "EpochCreated")
        .withArgs(3)
        .emit(dlp, "EpochCreated")
        .withArgs(4);

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

      await dat.connect(v1Owner).approve(dlp, parseEther("100"));
      await dat.connect(v2Owner).approve(dlp, parseEther("200"));
      await dat.connect(v3Owner).approve(dlp, parseEther("300"));
      await dat.connect(v4Owner).approve(dlp, parseEther("400"));
      await dat.connect(v5Owner).approve(dlp, parseEther("500"));
      await dlp
        .connect(v1Owner)
        .registerValidator(v1, v1Owner, parseEther("100")).should.be.fulfilled;
      await dlp
        .connect(v2Owner)
        .registerValidator(v2, v2Owner, parseEther("200")).should.be.fulfilled;
      await dlp
        .connect(v3Owner)
        .registerValidator(v3, v3Owner, parseEther("300")).should.be.fulfilled;
      await dlp
        .connect(v4Owner)
        .registerValidator(v4, v4Owner, parseEther("400")).should.be.fulfilled;
      await dlp
        .connect(v5Owner)
        .registerValidator(v5, v5Owner, parseEther("500")).should.be.fulfilled;

      await dlp
        .connect(owner)
        .approveValidator(v1)
        .should.emit(dlp, "ValidatorApproved")
        .withArgs(v1.address)
        .emit(dlp, "EpochCreated")
        .withArgs(2);

      await dlp
        .connect(owner)
        .approveValidator(v2)
        .should.emit(dlp, "ValidatorApproved")
        .withArgs(v2.address);

      await advanceToEpochN(5);

      await dlp
        .connect(owner)
        .approveValidator(v3)
        .should.emit(dlp, "ValidatorApproved")
        .withArgs(v3.address)
        .emit(dlp, "EpochCreated")
        .withArgs(3)
        .emit(dlp, "EpochCreated")
        .withArgs(4)
        .emit(dlp, "EpochCreated")
        .withArgs(5);

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
      (await activeValidatorsList3).should.deep.eq([
        v1.address,
        v2.address,
        v3.address,
      ]);

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

    it("should deregisterValidator when validator owner", async function () {
      await registerValidator1();

      (await dlp.totalStaked()).should.eq(parseEther("100"));

      (await dat.balanceOf(v1Owner)).should.eq(
        v1OwnerInitialBalance - parseEther("100"),
      );
      (await dat.balanceOf(dlp)).should.eq(
        dlpInitialBalance + parseEther("100"),
      );

      await dlp
        .connect(v1Owner)
        .deregisterValidator(v1)
        .should.emit(dlp, "ValidatorDeregistered")
        .withArgs(v1.address)
        .emit(dat, "Transfer")
        .withArgs(dlp, v1Owner, parseEther("100"));

      const validator1 = await dlp.validatorsInfo(v1);
      validator1.status.should.eq(ValidatorStatus.Deregistered);
      validator1.lastBlockNumber.should.eq(await getCurrentBlockNumber());

      (await dlp.validatorsCount()).should.eq(1);
      (await dlp.validators(1)).should.deep.eq(validator1);

      (await dlp.activeValidatorsListsCount()).should.eq(2);

      const activeValidatorsList1 = await dlp.activeValidatorsLists(1);
      (await activeValidatorsList1).should.deep.eq([v1.address]);

      const activeValidatorsList2 = await dlp.activeValidatorsLists(2);
      (await activeValidatorsList2).should.deep.eq([]);

      (await dlp.totalStaked()).should.eq(0);

      (await dat.balanceOf(v1Owner)).should.eq(v1OwnerInitialBalance);
      (await dat.balanceOf(dlp)).should.eq(dlpInitialBalance);
    });

    it("should deregisterValidator when granted", async function () {
      await dat.connect(owner).approve(dlp, parseEther("100"));
      await dlp
        .connect(owner)
        .registerValidator(v1, v1Owner, parseEther("100"));
      await dlp.connect(owner).approveValidator(v1);

      (await dlp.totalStaked()).should.eq(parseEther("100"));

      (await dat.balanceOf(owner)).should.eq(
        ownerInitialBalance - parseEther("100"),
      );
      (await dat.balanceOf(v1Owner)).should.eq(v1OwnerInitialBalance);
      (await dat.balanceOf(dlp)).should.eq(
        dlpInitialBalance + parseEther("100"),
      );

      await dlp
        .connect(v1Owner)
        .deregisterValidator(v1)
        .should.emit(dlp, "ValidatorDeregistered")
        .withArgs(v1.address);

      const validator1 = await dlp.validatorsInfo(v1);
      validator1.status.should.eq(ValidatorStatus.Deregistered);
      validator1.lastBlockNumber.should.eq(await getCurrentBlockNumber());
      validator1.grantedAmount.should.eq(parseEther("100"));

      (await dlp.validatorsCount()).should.eq(1);
      (await dlp.validators(1)).should.deep.eq(validator1);

      (await dlp.activeValidatorsListsCount()).should.eq(2);

      const activeValidatorsList1 = await dlp.activeValidatorsLists(1);
      (await activeValidatorsList1).should.deep.eq([v1.address]);

      const activeValidatorsList2 = await dlp.activeValidatorsLists(2);
      (await activeValidatorsList2).should.deep.eq([]);

      (await dlp.totalStaked()).should.eq(parseEther("100"));

      (await dat.balanceOf(owner)).should.eq(
        ownerInitialBalance - parseEther("100"),
      );
      (await dat.balanceOf(v1Owner)).should.eq(v1OwnerInitialBalance);
      (await dat.balanceOf(dlp)).should.eq(
        dlpInitialBalance + parseEther("100"),
      );
    });

    it("Should reject deregisterValidator when non validator owner", async function () {
      await registerValidator1();

      await dlp
        .connect(owner)
        .deregisterValidator(v1)
        .should.be.rejectedWith("NotValidatorOwner");

      await dlp
        .connect(v1)
        .deregisterValidator(v1)
        .should.be.rejectedWith("NotValidatorOwner");

      await dlp
        .connect(user1)
        .deregisterValidator(v1)
        .should.be.rejectedWith("NotValidatorOwner");
    });

    it("Should reject deregisterValidator when deregistered", async function () {
      await registerValidator1();

      await dlp.connect(v1Owner).deregisterValidator(v1);

      await dlp
        .connect(v1Owner)
        .deregisterValidator(v1)
        .should.be.rejectedWith(`InvalidValidatorStatus()`);
    });

    it("should deregisterValidator #multiple validators 1", async function () {
      await registerValidators();

      (await dlp.totalStaked()).should.eq(5n * parseEther("100"));

      (await dat.balanceOf(v1Owner)).should.eq(
        v1OwnerInitialBalance - parseEther("100"),
      );
      (await dat.balanceOf(dlp)).should.eq(
        dlpInitialBalance + 5n * parseEther("100"),
      );

      const currentBlockNumber = await getCurrentBlockNumber();

      await dlp
        .connect(v1Owner)
        .deregisterValidator(v1)
        .should.emit(dlp, "ValidatorDeregistered")
        .withArgs(v1.address);

      const validator1 = await dlp.validatorsInfo(v1);
      validator1.status.should.eq(ValidatorStatus.Deregistered);
      validator1.lastBlockNumber.should.eq(currentBlockNumber + 1);

      const validator2 = await dlp.validatorsInfo(v2);
      validator2.status.should.eq(ValidatorStatus.Active);
      validator2.lastBlockNumber.should.eq(0);

      const validator3 = await dlp.validatorsInfo(v3);
      validator3.status.should.eq(ValidatorStatus.Active);
      validator3.lastBlockNumber.should.eq(0);

      const validator4 = await dlp.validatorsInfo(v4);
      validator4.status.should.eq(ValidatorStatus.Registered);

      const validator5 = await dlp.validatorsInfo(v5);
      validator5.status.should.eq(ValidatorStatus.Registered);

      (await dlp.validatorsCount()).should.eq(5);
      (await dlp.validators(1)).should.deep.eq(validator1);
      (await dlp.validators(2)).should.deep.eq(validator2);
      (await dlp.validators(3)).should.deep.eq(validator3);
      (await dlp.validators(4)).should.deep.eq(validator4);
      (await dlp.validators(5)).should.deep.eq(validator5);

      (await dlp.activeValidatorsListsCount()).should.eq(4);

      const activeValidatorsList1 = await dlp.activeValidatorsLists(1);
      (await activeValidatorsList1).should.deep.eq([v1.address]);

      const activeValidatorsList2 = await dlp.activeValidatorsLists(2);
      (await activeValidatorsList2).should.deep.eq([v1.address, v2.address]);

      const activeValidatorsList3 = await dlp.activeValidatorsLists(3);
      (await activeValidatorsList3).should.deep.eq([
        v1.address,
        v2.address,
        v3.address,
      ]);

      const activeValidatorsList4 = await dlp.activeValidatorsLists(4);
      (await activeValidatorsList4).should.deep.eq([v2.address, v3.address]);

      (await dlp.totalStaked()).should.eq(4n * parseEther("100"));

      (await dat.balanceOf(v1Owner)).should.eq(v1OwnerInitialBalance);
      (await dat.balanceOf(dlp)).should.eq(
        dlpInitialBalance + 4n * parseEther("100"),
      );
    });

    it("should deregisterValidator when validator owner #multiple validators 2", async function () {
      await registerValidators();

      const currentBlockNumber = await getCurrentBlockNumber();

      await dlp
        .connect(v2Owner)
        .deregisterValidator(v2)
        .should.emit(dlp, "ValidatorDeregistered")
        .withArgs(v2.address);

      const validator1 = await dlp.validatorsInfo(v1);
      validator1.status.should.eq(ValidatorStatus.Active);
      validator1.lastBlockNumber.should.eq(0);

      const validator2 = await dlp.validatorsInfo(v2);
      validator2.status.should.eq(ValidatorStatus.Deregistered);
      validator2.lastBlockNumber.should.eq(currentBlockNumber + 1);

      const validator3 = await dlp.validatorsInfo(v3);
      validator3.status.should.eq(ValidatorStatus.Active);
      validator3.lastBlockNumber.should.eq(0);

      const validator4 = await dlp.validatorsInfo(v4);
      validator4.status.should.eq(ValidatorStatus.Registered);

      const validator5 = await dlp.validatorsInfo(v5);
      validator5.status.should.eq(ValidatorStatus.Registered);

      (await dlp.validatorsCount()).should.eq(5);
      (await dlp.validators(1)).should.deep.eq(validator1);
      (await dlp.validators(2)).should.deep.eq(validator2);
      (await dlp.validators(3)).should.deep.eq(validator3);
      (await dlp.validators(4)).should.deep.eq(validator4);
      (await dlp.validators(5)).should.deep.eq(validator5);

      (await dlp.activeValidatorsListsCount()).should.eq(4);

      const activeValidatorsList1 = await dlp.activeValidatorsLists(1);
      (await activeValidatorsList1).should.deep.eq([v1.address]);

      const activeValidatorsList2 = await dlp.activeValidatorsLists(2);
      (await activeValidatorsList2).should.deep.eq([v1.address, v2.address]);

      const activeValidatorsList3 = await dlp.activeValidatorsLists(3);
      (await activeValidatorsList3).should.deep.eq([
        v1.address,
        v2.address,
        v3.address,
      ]);

      const activeValidatorsList4 = await dlp.activeValidatorsLists(4);
      (await activeValidatorsList4).should.deep.eq([v1.address, v3.address]);
    });

    it("should deregisterValidatorByOwner when dlp owner", async function () {
      await registerValidator1();

      (await dlp.totalStaked()).should.eq(parseEther("100"));

      (await dat.balanceOf(v1Owner)).should.eq(
        v1OwnerInitialBalance - parseEther("100"),
      );
      (await dat.balanceOf(dlp)).should.eq(
        dlpInitialBalance + parseEther("100"),
      );

      await dlp
        .connect(owner)
        .deregisterValidatorByOwner(v1, parseEther("100"))
        .should.emit(dlp, "ValidatorDeregistered")
        .withArgs(v1.address)
        .emit(dlp, "ValidatorDeregisteredByOwner")
        .withArgs(v1.address, parseEther("100"), parseEther("0"))
        .emit(dat, "Transfer")
        .withArgs(dlp, v1Owner, parseEther("100"));

      const validator1 = await dlp.validatorsInfo(v1);
      validator1.status.should.eq(ValidatorStatus.Deregistered);
      validator1.lastBlockNumber.should.eq(await getCurrentBlockNumber());

      (await dlp.validatorsCount()).should.eq(1);
      (await dlp.validators(1)).should.deep.eq(validator1);

      (await dlp.activeValidatorsListsCount()).should.eq(2);

      const activeValidatorsList1 = await dlp.activeValidatorsLists(1);
      (await activeValidatorsList1).should.deep.eq([v1.address]);

      const activeValidatorsList2 = await dlp.activeValidatorsLists(2);
      (await activeValidatorsList2).should.deep.eq([]);

      (await dlp.totalStaked()).should.eq(0);

      (await dat.balanceOf(v1Owner)).should.eq(v1OwnerInitialBalance);
      (await dat.balanceOf(dlp)).should.eq(dlpInitialBalance);
    });

    it("should deregisterValidatorByOwner when granted #full unstake amount", async function () {
      await dat.connect(owner).approve(dlp, parseEther("100"));
      await dlp
        .connect(owner)
        .registerValidator(v1, v1Owner, parseEther("100"));
      await dlp.connect(owner).approveValidator(v1);

      (await dlp.totalStaked()).should.eq(parseEther("100"));

      (await dat.balanceOf(owner)).should.eq(
        ownerInitialBalance - parseEther("100"),
      );
      (await dat.balanceOf(v1Owner)).should.eq(v1OwnerInitialBalance);
      (await dat.balanceOf(dlp)).should.eq(
        dlpInitialBalance + parseEther("100"),
      );

      await dlp
        .connect(owner)
        .deregisterValidatorByOwner(v1, parseEther("100"))
        .should.emit(dlp, "ValidatorDeregisteredByOwner")
        .withArgs(v1.address, parseEther("100"), parseEther("0"))
        .emit(dlp, "ValidatorDeregistered")
        .withArgs(v1.address);

      const validator1 = await dlp.validatorsInfo(v1);
      validator1.status.should.eq(ValidatorStatus.Deregistered);
      validator1.lastBlockNumber.should.eq(await getCurrentBlockNumber());
      validator1.grantedAmount.should.eq(parseEther("100"));

      (await dlp.validatorsCount()).should.eq(1);
      (await dlp.validators(1)).should.deep.eq(validator1);

      (await dlp.activeValidatorsListsCount()).should.eq(2);

      const activeValidatorsList1 = await dlp.activeValidatorsLists(1);
      (await activeValidatorsList1).should.deep.eq([v1.address]);

      const activeValidatorsList2 = await dlp.activeValidatorsLists(2);
      (await activeValidatorsList2).should.deep.eq([]);

      (await dlp.totalStaked()).should.eq(parseEther("0"));

      (await dat.balanceOf(owner)).should.eq(
        ownerInitialBalance - parseEther("100"),
      );
      (await dat.balanceOf(v1Owner)).should.eq(
        v1OwnerInitialBalance + parseEther("100"),
      );
      (await dat.balanceOf(dlp)).should.eq(dlpInitialBalance);
    });

    it("should deregisterValidatorByOwner when granted #partial unstake amount", async function () {
      await dat.connect(owner).approve(dlp, parseEther("100"));
      await dlp
        .connect(owner)
        .registerValidator(v1, v1Owner, parseEther("100"));
      await dlp.connect(owner).approveValidator(v1);

      (await dlp.totalStaked()).should.eq(parseEther("100"));

      (await dat.balanceOf(owner)).should.eq(
        ownerInitialBalance - parseEther("100"),
      );
      (await dat.balanceOf(v1Owner)).should.eq(v1OwnerInitialBalance);
      (await dat.balanceOf(dlp)).should.eq(
        dlpInitialBalance + parseEther("100"),
      );

      await dlp
        .connect(owner)
        .deregisterValidatorByOwner(v1, parseEther("40"))
        .should.emit(dlp, "ValidatorDeregisteredByOwner")
        .withArgs(v1.address, parseEther("40"), parseEther("60"))
        .emit(dlp, "ValidatorDeregistered")
        .withArgs(v1.address);

      const validator1 = await dlp.validatorsInfo(v1);
      validator1.status.should.eq(ValidatorStatus.Deregistered);
      validator1.lastBlockNumber.should.eq(await getCurrentBlockNumber());
      validator1.grantedAmount.should.eq(parseEther("100"));

      (await dlp.validatorsCount()).should.eq(1);
      (await dlp.validators(1)).should.deep.eq(validator1);

      (await dlp.activeValidatorsListsCount()).should.eq(2);

      const activeValidatorsList1 = await dlp.activeValidatorsLists(1);
      (await activeValidatorsList1).should.deep.eq([v1.address]);

      const activeValidatorsList2 = await dlp.activeValidatorsLists(2);
      (await activeValidatorsList2).should.deep.eq([]);

      (await dlp.totalStaked()).should.eq(parseEther("0"));

      (await dat.balanceOf(owner)).should.eq(
        ownerInitialBalance - parseEther("40"),
      );
      (await dat.balanceOf(v1Owner)).should.eq(
        v1OwnerInitialBalance + parseEther("40"),
      );
      (await dat.balanceOf(dlp)).should.eq(dlpInitialBalance);
    });

    it("should deregisterValidatorByOwner when granted #no unstake amount", async function () {
      await dat.connect(owner).approve(dlp, parseEther("100"));
      await dlp
        .connect(owner)
        .registerValidator(v1, v1Owner, parseEther("100"));
      await dlp.connect(owner).approveValidator(v1);

      (await dlp.totalStaked()).should.eq(parseEther("100"));

      (await dat.balanceOf(owner)).should.eq(
        ownerInitialBalance - parseEther("100"),
      );
      (await dat.balanceOf(v1Owner)).should.eq(v1OwnerInitialBalance);
      (await dat.balanceOf(dlp)).should.eq(
        dlpInitialBalance + parseEther("100"),
      );

      await dlp
        .connect(owner)
        .deregisterValidatorByOwner(v1, parseEther("0"))
        .should.emit(dlp, "ValidatorDeregisteredByOwner")
        .withArgs(v1.address, parseEther("0"), parseEther("100"))
        .emit(dlp, "ValidatorDeregistered")
        .withArgs(v1.address);

      const validator1 = await dlp.validatorsInfo(v1);
      validator1.status.should.eq(ValidatorStatus.Deregistered);
      validator1.lastBlockNumber.should.eq(await getCurrentBlockNumber());
      validator1.grantedAmount.should.eq(parseEther("100"));

      (await dlp.validatorsCount()).should.eq(1);
      (await dlp.validators(1)).should.deep.eq(validator1);

      (await dlp.activeValidatorsListsCount()).should.eq(2);

      const activeValidatorsList1 = await dlp.activeValidatorsLists(1);
      (await activeValidatorsList1).should.deep.eq([v1.address]);

      const activeValidatorsList2 = await dlp.activeValidatorsLists(2);
      (await activeValidatorsList2).should.deep.eq([]);

      (await dlp.totalStaked()).should.eq(parseEther("0"));

      (await dat.balanceOf(owner)).should.eq(ownerInitialBalance);
      (await dat.balanceOf(v1Owner)).should.eq(v1OwnerInitialBalance);
      (await dat.balanceOf(dlp)).should.eq(dlpInitialBalance);
    });

    it("should deregisterValidatorByOwner when granted and deregistered", async function () {
      await dat.connect(owner).approve(dlp, parseEther("100"));
      await dlp
        .connect(owner)
        .registerValidator(v1, v1Owner, parseEther("100"));
      await dlp.connect(owner).approveValidator(v1);

      (await dlp.totalStaked()).should.eq(parseEther("100"));

      (await dat.balanceOf(owner)).should.eq(
        ownerInitialBalance - parseEther("100"),
      );
      (await dat.balanceOf(v1Owner)).should.eq(v1OwnerInitialBalance);
      (await dat.balanceOf(dlp)).should.eq(
        dlpInitialBalance + parseEther("100"),
      );

      await dlp
        .connect(v1Owner)
        .deregisterValidator(v1)
        .should.emit(dlp, "ValidatorDeregistered")
        .withArgs(v1.address);

      await dlp
        .connect(owner)
        .deregisterValidatorByOwner(v1, parseEther("40"))
        .should.emit(dlp, "ValidatorDeregisteredByOwner")
        .withArgs(v1.address, parseEther("40"), parseEther("60"));

      const validator1 = await dlp.validatorsInfo(v1);
      validator1.status.should.eq(ValidatorStatus.Deregistered);
      validator1.lastBlockNumber.should.eq((await getCurrentBlockNumber()) - 1);
      validator1.grantedAmount.should.eq(parseEther("100"));

      (await dlp.validatorsCount()).should.eq(1);
      (await dlp.validators(1)).should.deep.eq(validator1);

      (await dlp.activeValidatorsListsCount()).should.eq(2);

      const activeValidatorsList1 = await dlp.activeValidatorsLists(1);
      (await activeValidatorsList1).should.deep.eq([v1.address]);

      const activeValidatorsList2 = await dlp.activeValidatorsLists(2);
      (await activeValidatorsList2).should.deep.eq([]);

      (await dlp.totalStaked()).should.eq(parseEther("0"));

      (await dat.balanceOf(owner)).should.eq(
        ownerInitialBalance - parseEther("40"),
      );
      (await dat.balanceOf(v1Owner)).should.eq(
        v1OwnerInitialBalance + parseEther("40"),
      );
      (await dat.balanceOf(dlp)).should.eq(dlpInitialBalance);
    });

    it("Should reject deregisterValidatorByOwner when non dlp owner", async function () {
      await registerValidator1();

      await dlp
        .connect(v1Owner)
        .deregisterValidatorByOwner(v1, parseEther("100"))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${v1Owner.address}")`,
        );

      await dlp
        .connect(v1)
        .deregisterValidatorByOwner(v1, parseEther("100"))
        .should.be.rejectedWith(`OwnableUnauthorizedAccount("${v1.address}")`);

      await dlp
        .connect(user1)
        .deregisterValidatorByOwner(v1, parseEther("100"))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("Should reject deregisterValidatorByOwner when stakeAmount = 0", async function () {
      await registerValidator1();

      await dlp.connect(v1Owner).deregisterValidator(v1);

      await dlp
        .connect(owner)
        .deregisterValidatorByOwner(v1, parseEther("100"))
        .should.be.rejectedWith(`InvalidStakeAmount()`);
    });

    it("should deregisterValidatorByOwner #multiple validators 1", async function () {
      await registerValidators();

      (await dlp.totalStaked()).should.eq(5n * parseEther("100"));

      (await dat.balanceOf(v1Owner)).should.eq(
        v1OwnerInitialBalance - parseEther("100"),
      );
      (await dat.balanceOf(dlp)).should.eq(
        dlpInitialBalance + 5n * parseEther("100"),
      );

      const currentBlockNumber = await getCurrentBlockNumber();

      await dlp
        .connect(owner)
        .deregisterValidatorByOwner(v1, parseEther("100"))
        .should.emit(dlp, "ValidatorDeregistered")
        .withArgs(v1.address);

      const validator1 = await dlp.validatorsInfo(v1);
      validator1.status.should.eq(ValidatorStatus.Deregistered);
      validator1.lastBlockNumber.should.eq(currentBlockNumber + 1);

      const validator2 = await dlp.validatorsInfo(v2);
      validator2.status.should.eq(ValidatorStatus.Active);
      validator2.lastBlockNumber.should.eq(0);

      const validator3 = await dlp.validatorsInfo(v3);
      validator3.status.should.eq(ValidatorStatus.Active);
      validator3.lastBlockNumber.should.eq(0);

      const validator4 = await dlp.validatorsInfo(v4);
      validator4.status.should.eq(ValidatorStatus.Registered);

      const validator5 = await dlp.validatorsInfo(v5);
      validator5.status.should.eq(ValidatorStatus.Registered);

      (await dlp.validatorsCount()).should.eq(5);
      (await dlp.validators(1)).should.deep.eq(validator1);
      (await dlp.validators(2)).should.deep.eq(validator2);
      (await dlp.validators(3)).should.deep.eq(validator3);
      (await dlp.validators(4)).should.deep.eq(validator4);
      (await dlp.validators(5)).should.deep.eq(validator5);

      (await dlp.activeValidatorsListsCount()).should.eq(4);

      const activeValidatorsList1 = await dlp.activeValidatorsLists(1);
      (await activeValidatorsList1).should.deep.eq([v1.address]);

      const activeValidatorsList2 = await dlp.activeValidatorsLists(2);
      (await activeValidatorsList2).should.deep.eq([v1.address, v2.address]);

      const activeValidatorsList3 = await dlp.activeValidatorsLists(3);
      (await activeValidatorsList3).should.deep.eq([
        v1.address,
        v2.address,
        v3.address,
      ]);

      const activeValidatorsList4 = await dlp.activeValidatorsLists(4);
      (await activeValidatorsList4).should.deep.eq([v2.address, v3.address]);

      (await dlp.totalStaked()).should.eq(4n * parseEther("100"));

      (await dat.balanceOf(v1Owner)).should.eq(v1OwnerInitialBalance);
      (await dat.balanceOf(dlp)).should.eq(
        dlpInitialBalance + 4n * parseEther("100"),
      );
    });

    it("should deregisterValidatorByOwner when validator owner #multiple validators 2", async function () {
      await registerValidators();

      const currentBlockNumber = await getCurrentBlockNumber();

      await dlp
        .connect(owner)
        .deregisterValidatorByOwner(v2, parseEther("100"))
        .should.emit(dlp, "ValidatorDeregistered")
        .withArgs(v2.address);

      const validator1 = await dlp.validatorsInfo(v1);
      validator1.status.should.eq(ValidatorStatus.Active);
      validator1.lastBlockNumber.should.eq(0);

      const validator2 = await dlp.validatorsInfo(v2);
      validator2.status.should.eq(ValidatorStatus.Deregistered);
      validator2.lastBlockNumber.should.eq(currentBlockNumber + 1);

      const validator3 = await dlp.validatorsInfo(v3);
      validator3.status.should.eq(ValidatorStatus.Active);
      validator3.lastBlockNumber.should.eq(0);

      const validator4 = await dlp.validatorsInfo(v4);
      validator4.status.should.eq(ValidatorStatus.Registered);

      const validator5 = await dlp.validatorsInfo(v5);
      validator5.status.should.eq(ValidatorStatus.Registered);

      (await dlp.validatorsCount()).should.eq(5);
      (await dlp.validators(1)).should.deep.eq(validator1);
      (await dlp.validators(2)).should.deep.eq(validator2);
      (await dlp.validators(3)).should.deep.eq(validator3);
      (await dlp.validators(4)).should.deep.eq(validator4);
      (await dlp.validators(5)).should.deep.eq(validator5);

      (await dlp.activeValidatorsListsCount()).should.eq(4);

      const activeValidatorsList1 = await dlp.activeValidatorsLists(1);
      (await activeValidatorsList1).should.deep.eq([v1.address]);

      const activeValidatorsList2 = await dlp.activeValidatorsLists(2);
      (await activeValidatorsList2).should.deep.eq([v1.address, v2.address]);

      const activeValidatorsList3 = await dlp.activeValidatorsLists(3);
      (await activeValidatorsList3).should.deep.eq([
        v1.address,
        v2.address,
        v3.address,
      ]);

      const activeValidatorsList4 = await dlp.activeValidatorsLists(4);
      (await activeValidatorsList4).should.deep.eq([v1.address, v3.address]);
    });
  });

  describe("Validators - verifyFile", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should verifyFile when validator", async function () {
      await registerValidator1();

      await dlp.connect(user1).addFile("file1URL", "file1EncryptedAddress");

      await dlp
        .connect(v1)
        .verifyFile(
          1,
          true,
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
        )
        .should.emit(dlp, "FileVerified")
        .withArgs(v1.address, 1, parseEther("0.6"));

      const file1 = await dlp.files(1);
      file1.verificationsCount.should.eq(1);
      file1.reward.should.eq(
        (parseEther("0.6") * fileRewardFactor) / parseEther("1"),
      );
      file1.valid.should.eq(true);
      file1.score.should.eq(parseEther("0.6"));
      file1.authenticity.should.eq(parseEther("0.6"));
      file1.ownership.should.eq(parseEther("0.6"));
      file1.quality.should.eq(parseEther("0.6"));
      file1.uniqueness.should.eq(parseEther("0.6"));

      const fileScore = await dlp.fileScores(1, v1);
      fileScore.valid.should.eq(true);
      fileScore.score.should.eq(parseEther("0.6"));
      fileScore.reportedAtBlock.should.eq(await getCurrentBlockNumber());
      fileScore.authenticity.should.eq(parseEther("0.6"));
      fileScore.ownership.should.eq(parseEther("0.6"));
      fileScore.quality.should.eq(parseEther("0.6"));
      fileScore.uniqueness.should.eq(parseEther("0.6"));
    });

    it("should get next unverified file for validator", async function () {
      await registerValidator1();

      // Add multiple files
      await dlp.connect(user1).addFile("file1URL", "file1EncryptedAddress");
      await dlp.connect(user1).addFile("file2URL", "file2EncryptedAddress");
      await dlp.connect(user1).addFile("file3URL", "file3EncryptedAddress");

      // Verify the first file
      await dlp
        .connect(v1)
        .verifyFile(
          1,
          true,
          parseEther("0.6"),
          parseEther("0.5"),
          parseEther("0.7"),
          parseEther("0.8"),
          parseEther("0.4"),
        );

      // Get next file to verify
      let nextFile = await dlp.getNextFileToVerify(v1.address);
      nextFile.fileId.should.eq(2);

      // Verify the second file
      await dlp
        .connect(v1)
        .verifyFile(
          2,
          true,
          parseEther("0.7"),
          parseEther("0.6"),
          parseEther("0.8"),
          parseEther("0.9"),
          parseEther("0.5"),
        );

      // Get next file to verify
      nextFile = await dlp.getNextFileToVerify(v1.address);
      nextFile.fileId.should.eq(3);

      // Verify the third file
      await dlp
        .connect(v1)
        .verifyFile(
          3,
          true,
          parseEther("0.8"),
          parseEther("0.7"),
          parseEther("0.9"),
          parseEther("1.0"),
          parseEther("0.6"),
        );

      // Get next file to verify when all files are verified
      nextFile = await dlp.getNextFileToVerify(v1.address);
      nextFile.fileId.should.eq(0); // Should return 0 when no more files to verify
    });

    it("should verifyFile by multiple validators", async function () {
      await registerValidators();

      await dlp.connect(user1).addFile("file1URL", "file1EncryptedAddress");

      const blockNumber = await getCurrentBlockNumber();
      await dlp
        .connect(v1)
        .verifyFile(
          1,
          true,
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
        )
        .should.emit(dlp, "FileVerified")
        .withArgs(v1.address, 1, parseEther("0.6"));

      await dlp
        .connect(v2)
        .verifyFile(
          1,
          false,
          parseEther("0.8"),
          parseEther("0.8"),
          parseEther("0.8"),
          parseEther("0.8"),
          parseEther("0.8"),
        )
        .should.emit(dlp, "FileVerified")
        .withArgs(v2.address, 1, parseEther("0.8"));

      const file1 = await dlp.files(1);
      file1.verificationsCount.should.eq(2);
      file1.reward.should.eq(
        (parseEther("0.7") * fileRewardFactor) / parseEther("1"),
      );
      file1.valid.should.eq(false);
      file1.score.should.eq(parseEther("0.7"));
      file1.authenticity.should.eq(parseEther("0.7"));
      file1.ownership.should.eq(parseEther("0.7"));
      file1.quality.should.eq(parseEther("0.7"));
      file1.uniqueness.should.eq(parseEther("0.7"));

      const fileScore1 = await dlp.fileScores(1, v1);
      fileScore1.valid.should.eq(true);
      fileScore1.score.should.eq(parseEther("0.6"));
      fileScore1.reportedAtBlock.should.eq(blockNumber + 1);
      fileScore1.authenticity.should.eq(parseEther("0.6"));
      fileScore1.ownership.should.eq(parseEther("0.6"));
      fileScore1.quality.should.eq(parseEther("0.6"));
      fileScore1.uniqueness.should.eq(parseEther("0.6"));

      const fileScore2 = await dlp.fileScores(1, v2);
      fileScore2.valid.should.eq(false);
      fileScore2.score.should.eq(parseEther("0.8"));
      fileScore2.reportedAtBlock.should.eq(blockNumber + 2);
      fileScore2.authenticity.should.eq(parseEther("0.8"));
      fileScore2.ownership.should.eq(parseEther("0.8"));
      fileScore2.quality.should.eq(parseEther("0.8"));
      fileScore2.uniqueness.should.eq(parseEther("0.8"));
    });

    it("should updateWeights when validator", async function () {
      await dat.connect(v1Owner).approve(dlp, parseEther("100"));
      await dat.connect(v2Owner).approve(dlp, parseEther("200"));
      await dat.connect(v3Owner).approve(dlp, parseEther("300"));
      await dlp
        .connect(v1Owner)
        .registerValidator(v1, v1Owner, parseEther("100"));
      await dlp
        .connect(v2Owner)
        .registerValidator(v2, v2Owner, parseEther("200"));
      await dlp
        .connect(v3Owner)
        .registerValidator(v3, v3Owner, parseEther("300"));

      await dlp.connect(owner).approveValidator(v1);
      await dlp.connect(owner).approveValidator(v2);
      await dlp.connect(owner).approveValidator(v3);

      await dlp
        .connect(v1)
        .updateWeights(
          [v1, v2, v3],
          [parseEther("1"), parseEther("1"), parseEther("0")],
        )
        .should.emit(dlp, "WeightsUpdated")
        .withArgs(
          v1.address,
          [v1.address, v2.address, v3.address],
          [parseEther("1"), parseEther("1"), parseEther("0")],
        );

      const validator1Weights = await dlp.validatorWeights(v1);
      validator1Weights.validators.should.deep.eq([
        v1.address,
        v2.address,
        v3.address,
      ]);
      validator1Weights.weights.should.deep.eq([
        parseEther("1"),
        parseEther("1"),
        parseEther("0"),
      ]);
    });

    it("should send rewards after the end of an epoch", async function () {
      await dat.connect(owner).approve(dlp, parseEther("100"));
      await dlp.connect(owner).addRewardForValidators(parseEther("100"));

      await dat.connect(v1Owner).approve(dlp, parseEther("100"));
      await dat.connect(v2Owner).approve(dlp, parseEther("100"));
      await dat.connect(v3Owner).approve(dlp, parseEther("200"));
      await dat.connect(v4Owner).approve(dlp, parseEther("200"));
      await dat.connect(v5Owner).approve(dlp, parseEther("200"));
      await dlp
        .connect(v1Owner)
        .registerValidator(v1, v1Owner, parseEther("100"));
      await dlp
        .connect(v2Owner)
        .registerValidator(v2, v2Owner, parseEther("100"));
      await dlp
        .connect(v3Owner)
        .registerValidator(v3, v3Owner, parseEther("200"));
      await dlp
        .connect(v4Owner)
        .registerValidator(v4, v4Owner, parseEther("200"));
      await dlp
        .connect(v5Owner)
        .registerValidator(v5, v5Owner, parseEther("200"));

      //3 validators accepted by DLP owner
      await dlp.connect(owner).approveValidator(v1);
      await dlp.connect(owner).approveValidator(v2);
      await dlp.connect(owner).approveValidator(v3);
      await dlp.connect(owner).approveValidator(v4);
      await dlp.connect(owner).approveValidator(v5);

      await dlp
        .connect(v1)
        .updateWeights([v1, v2, v3], [parseEther("1"), parseEther("1"), 0]);
      await dlp
        .connect(v2)
        .updateWeights([v1, v2, v3], [0, parseEther("1"), parseEther("1")]);
      await dlp
        .connect(v3)
        .updateWeights([v1, v2, v3], [parseEther("1"), 0, parseEther("1")]);

      const v1ExpectedEmissionScore = parseEther("0.440182806331138690");
      const v2ExpectedEmissionScore = parseEther("0.119634387337722619");
      const v3ExpectedEmissionScore = parseEther("0.440182806331138690");
      const v4ExpectedEmissionScore = parseEther("0");
      const v5ExpectedEmissionScore = parseEther("0");

      const emissionScore = await dlp.getEmissionScores(1);

      emissionScore.should.deep.eq([
        v1ExpectedEmissionScore,
        v2ExpectedEmissionScore,
        v3ExpectedEmissionScore,
        v4ExpectedEmissionScore,
        v5ExpectedEmissionScore,
      ]);

      const initialV1Balance = await dat.balanceOf(v1Owner);
      const initialV2Balance = await dat.balanceOf(v2Owner);
      const initialV3Balance = await dat.balanceOf(v3Owner);
      const initialV4Balance = await dat.balanceOf(v4Owner);
      const initialV5Balance = await dat.balanceOf(v5Owner);

      await advanceBlockNTimes(epochSize + 1);
      await dlp.connect(owner).createEpochs();

      const finaleV1Balance = await dat.balanceOf(v1Owner);
      const finaleV2Balance = await dat.balanceOf(v2Owner);
      const finaleV3Balance = await dat.balanceOf(v3Owner);
      const finaleV4Balance = await dat.balanceOf(v4Owner);
      const finaleV5Balance = await dat.balanceOf(v5Owner);

      const epoch1Rewards = await dlp.epochRewards(1);
      epoch1Rewards.validators.should.deep.eq([
        v1.address,
        v2.address,
        v3.address,
        v4.address,
        v5.address,
      ]);

      epoch1Rewards.scores.should.deep.eq([
        v1ExpectedEmissionScore,
        v2ExpectedEmissionScore,
        v3ExpectedEmissionScore,
        v4ExpectedEmissionScore,
        v5ExpectedEmissionScore,
      ]);
      epoch1Rewards.withdrawnAmounts.should.deep.eq([
        (epochRewardAmount * v1ExpectedEmissionScore) / parseEther("1"),
        (epochRewardAmount * v2ExpectedEmissionScore) / parseEther("1"),
        (epochRewardAmount * v3ExpectedEmissionScore) / parseEther("1"),
        (epochRewardAmount * v4ExpectedEmissionScore) / parseEther("1"),
        (epochRewardAmount * v5ExpectedEmissionScore) / parseEther("1"),
      ]);

      (finaleV1Balance - initialV1Balance).should.eq(
        (epochRewardAmount * v1ExpectedEmissionScore) / parseEther("1"),
      );
      (finaleV2Balance - initialV2Balance).should.eq(
        (epochRewardAmount * v2ExpectedEmissionScore) / parseEther("1"),
      );
      (finaleV3Balance - initialV3Balance).should.eq(
        (epochRewardAmount * v3ExpectedEmissionScore) / parseEther("1"),
      );
      (finaleV4Balance - initialV4Balance).should.eq(
        (epochRewardAmount * v4ExpectedEmissionScore) / parseEther("1"),
      );
      (finaleV5Balance - initialV5Balance).should.eq(
        (epochRewardAmount * v5ExpectedEmissionScore) / parseEther("1"),
      );
    });

    it("should get nextFileToVerify based on last finalized file", async function () {
      await registerValidators();

      await dlp.connect(user1).addFile("file1URL", "file1EncryptedAddress");
      await dlp.connect(user2).addFile("file2URL", "file2EncryptedAddress");
      await dlp.connect(user3).addFile("file3URL", "file3EncryptedAddress");
      await dlp.connect(user4).addFile("file4URL", "file4EncryptedAddress");
      await dlp.connect(user5).addFile("file5URL", "file5EncryptedAddress");

      await dlp
        .connect(v1)
        .verifyFile(
          1,
          true,
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
        );
      await dlp
        .connect(v2)
        .verifyFile(
          1,
          true,
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
        );

      await dlp
        .connect(v1)
        .verifyFile(
          2,
          true,
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
        );
      await dlp
        .connect(v3)
        .verifyFile(
          2,
          true,
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
        );

      await dlp
        .connect(v1)
        .verifyFile(
          3,
          true,
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
        );

      (await dlp.getNextFileToVerify(v1.address)).fileId.should.eq(4);
      (await dlp.getNextFileToVerify(v2.address)).fileId.should.eq(3);
      (await dlp.getNextFileToVerify(v3.address)).fileId.should.eq(3);
    });
  });

  describe("Contributors - claimReward", () => {
    beforeEach(async () => {
      await deploy();

      await dat.connect(owner).approve(dlp, parseEther("10000"));
      await dlp.connect(owner).addRewardsForContributors(parseEther("10000"));
    });

    it("Should reject claimContributionReward when non file owner #1", async function () {
      await registerValidator1();

      await dlp.connect(user1).addFile("file1URL", "file1EncryptedAddress");

      await dlp
        .connect(v1)
        .verifyFile(
          1,
          true,
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
        );

      await dlp
        .connect(user2)
        .claimContributionReward(1)
        .should.be.rejectedWith(`NotFileOwner()`);
    });

    it("Should reject claimContributionReward when not file owner #2", async function () {
      await registerValidator1();

      await dlp.connect(user1).addFile("file1URL", "file1EncryptedAddress");

      await dlp
        .connect(v1)
        .verifyFile(
          1,
          true,
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
        );

      await dlp
        .connect(user1)
        .claimContributionReward(2)
        .should.be.rejectedWith(`NotFileOwner()`);
    });

    it("Should reject claimContributionReward before claim delay", async function () {
      await registerValidator1();

      await dlp.connect(user1).addFile("file1URL", "file1EncryptedAddress");

      await dlp
        .connect(v1)
        .verifyFile(
          1,
          true,
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
        );

      await dlp
        .connect(user1)
        .claimContributionReward(1)
        .should.be.rejectedWith(`WithdrawNotAllowed()`);
    });

    it("should claimContributionReward when contributor", async function () {
      const expectedReward =
        (parseEther("0.6") * fileRewardFactor) / parseEther("1");
      await registerValidator1();

      await dlp.connect(user1).addFile("file1URL", "file1EncryptedAddress");

      await dlp
        .connect(v1)
        .verifyFile(
          1,
          true,
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
        );

      await advanceNSeconds(fileRewardDelay);

      const user1InitialBalance = await dat.balanceOf(user1.address);
      await dlp
        .connect(user1)
        .claimContributionReward(1)
        .should.emit(dlp, "ContributionRewardClaimed")
        .withArgs(user1.address, 1, expectedReward);
      const user1FinalBalance = await dat.balanceOf(user1.address);

      (user1FinalBalance - user1InitialBalance).should.eq(expectedReward);
    });

    it("Should reject claimContributionReward when already claimed", async function () {
      await registerValidator1();

      await dlp.connect(user1).addFile("file1URL", "file1EncryptedAddress");
      await dlp
        .connect(v1)
        .verifyFile(
          1,
          true,
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
        );

      await advanceNSeconds(fileRewardDelay);

      await dlp.connect(user1).claimContributionReward(1);
      await dlp
        .connect(user1)
        .claimContributionReward(1)
        .should.be.rejectedWith(`WithdrawNotAllowed()`);
    });

    it("Should reject claimContributionReward when not finalized", async function () {
      await registerValidators();

      await dlp.connect(user1).addFile("file1URL", "file1EncryptedAddress");
      await dlp
        .connect(v1)
        .verifyFile(
          1,
          true,
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
          parseEther("0.6"),
        );

      await advanceNSeconds(fileRewardDelay);

      await dlp
        .connect(user1)
        .claimContributionReward(1)
        .should.be.rejectedWith(`NotFinalized()`);
    });
  });

  describe("Emissions Scenarios", () => {
    beforeEach(async () => {
      await deploy();
    });

    const tolerance = parseEther("0.0001");

    async function advanceToEpochN(epochNumber: number) {
      const epochNStartBlock = startBlock + (epochNumber - 1) * epochSize;
      await advanceToBlockN(epochNStartBlock);
    }

    async function registerAndApproveValidator(
      validatorOwner: HardhatEthersSigner,
      validator: HardhatEthersSigner,
      stakeAmount: BigNumberish,
    ) {
      await dat.connect(validatorOwner).approve(dlp, stakeAmount);
      await dlp
        .connect(validatorOwner)
        .registerValidator(validator, v1Owner, stakeAmount);
      await dlp.connect(owner).approveValidator(validator);
    }

    async function setValidatorWeights(weights: BigNumberish[][]) {
      let validators = [v1, v2, v3];
      for (let i = 0; i < weights.length; i++) {
        await dlp.connect(validators[i]).updateWeights(validators, weights[i]);
      }
    }

    async function expectEmissionScores(
      epochNumber: number,
      expectedScores: BigNumberish[],
    ) {
      const emissionScores = await dlp.getEmissionScores(epochNumber);
      for (let i = 0; i < expectedScores.length; i++) {
        emissionScores[i].should.be.closeTo(expectedScores[i], tolerance);
      }
    }

    async function setupScenario(
      stakes: BigNumberish[],
      weights: BigNumberish[][],
    ) {
      for (let i = 0; i < stakes.length; i++) {
        await registerAndApproveValidator(
          eval(`v${i + 1}Owner`),
          eval(`v${i + 1}`),
          stakes[i],
        );
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
          [1, 1, 1],
        ],
        expectedScores: [0.3333, 0.3333, 0.3333],
      },
      {
        description: "Equal scores, unequal stakes",
        stakes: [100, 200, 300],
        weights: [
          [1, 1, 1],
          [1, 1, 1],
          [1, 1, 1],
        ],
        expectedScores: [0.3333, 0.3333, 0.3333],
      },
      {
        description: "Unequal scores, equal stakes",
        stakes: [100, 100, 100],
        weights: [
          [1, 1, 0],
          [1, 1, 1],
          [1, 1, 1],
        ],
        expectedScores: [0.3863, 0.3863, 0.2275],
      },
      {
        description: "Malicious minority",
        stakes: [100, 100, 100],
        weights: [
          [1, 0, 0],
          [0, 1, 1],
          [0, 1, 1],
        ],
        expectedScores: [0.0383, 0.4809, 0.4809],
      },
    ];

    function parseEtherArray(numbers: number[]): BigNumberish[] {
      const result = numbers.map((num) => parseEther(num.toString()));
      return result;
    }

    scenarios.forEach((scenario) => {
      it(scenario.description, async function () {
        await dat.connect(owner).approve(dlp, parseEther("1000"));
        await dlp.connect(owner).addRewardForValidators(parseEther("1000"));
        await setupScenario(
          parseEtherArray(scenario.stakes),
          scenario.weights.map((weightRow) => parseEtherArray(weightRow)),
        );
        await expectEmissionScores(1, parseEtherArray(scenario.expectedScores));
      });
    });
  });
});
