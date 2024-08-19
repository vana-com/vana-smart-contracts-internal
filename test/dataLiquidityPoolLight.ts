import chai, { should } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers, upgrades } from "hardhat";
import { parseEther } from "ethers";
import {
  DAT,
  DataLiquidityPoolLightImplementation,
  DataRegistryImplementation,
} from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  advanceBlockNTimes,
  advanceNSeconds,
  advanceToBlockN,
  getCurrentBlockNumber,
  getCurrentBlockTimestamp,
} from "../utils/timeAndBlockManipulation";
import { deployDataRegistry, proofs } from "./dataRegistry";

chai.use(chaiAsPromised);
should();

describe("DataLiquidityPoolLight", () => {
  enum ValidatorStatus {
    None,
    Registered,
    Active,
    Deregistered,
  }

  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;
  let user4: HardhatEthersSigner;
  let user5: HardhatEthersSigner;
  let tee1: HardhatEthersSigner;

  let dlp: DataLiquidityPoolLightImplementation;
  let dat: DAT;
  let dataRegistry: DataRegistryImplementation;

  const dlpName = "Test DLP";
  const dlpTokenName = "Test Data Autonomy Token";
  const dlpTokenSymbol = "TDAT";
  const epochSize = 100;
  let startBlock: number;
  let epochRewardAmount = parseEther("2");
  let fileRewardFactor = parseEther("3");

  const dlpInitialBalance = parseEther("1000000");
  const user1InitialBalance = parseEther("1000000");
  const ownerInitialBalance = parseEther("1000000");

  const deploy = async () => {
    [deployer, owner, user1, user2, user3, user4, user5, tee1] =
      await ethers.getSigners();

    const datDeploy = await ethers.deployContract("DAT", [
      dlpTokenName,
      dlpTokenSymbol,
      owner,
    ]);
    dat = await ethers.getContractAt("DAT", datDeploy.target);

    startBlock = (await getCurrentBlockNumber()) + 1;

    dataRegistry = await deployDataRegistry(owner);

    const dlpDeploy = await upgrades.deployProxy(
      await ethers.getContractFactory("DataLiquidityPoolLightImplementation"),
      [
        {
          ownerAddress: owner.address,
          name: dlpName,
          dataRegistryAddress: dataRegistry.target,
          tokenAddress: dat.target,
          masterKey: "masterKeymasterKeymasterKey",
          fileRewardFactor: fileRewardFactor,
        },
      ],
      {
        kind: "uups",
      },
    );

    dlp = await ethers.getContractAt(
      "DataLiquidityPoolLightImplementation",
      dlpDeploy.target,
    );

    await dat.connect(owner).mint(dlp, dlpInitialBalance);
    await dat.connect(owner).mint(user1, user1InitialBalance);
    await dat.connect(owner).mint(owner, ownerInitialBalance);
  };

  describe("Setup", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should have correct params after deploy", async function () {
      (await dlp.name()).should.eq(dlpName);
      (await dlp.owner()).should.eq(owner);
      (await dlp.token()).should.eq(dat);
      (await dlp.dataRegistry()).should.eq(dataRegistry);
      (await dlp.masterKey()).should.eq("masterKeymasterKeymasterKey");
      (await dlp.paused()).should.eq(false);
      (await dlp.fileRewardFactor()).should.eq(fileRewardFactor);
      (await dlp.version()).should.eq(1);
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
        .connect(user1)
        .pause()
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
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
        .connect(user1)
        .unpause()
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
      (await dlp.paused()).should.be.equal(true);
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
        .connect(user1)
        .updateFileRewardFactor(fileRewardFactor + 1n)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );

      (await dlp.fileRewardFactor()).should.eq(fileRewardFactor);
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
        .connect(user1)
        .transferOwnership(user2)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("Should upgradeTo when owner", async function () {
      await upgrades.upgradeProxy(
        dlp,
        await ethers.getContractFactory(
          "DataLiquidityPoolLightImplementationV2Mock",
          owner,
        ),
      );

      const newDlp = await ethers.getContractAt(
        "DataLiquidityPoolLightImplementationV2Mock",
        dlp,
      );

      (await newDlp.name()).should.eq(dlpName);
      (await newDlp.owner()).should.eq(owner);
      (await newDlp.paused()).should.eq(false);
      (await newDlp.fileRewardFactor()).should.eq(fileRewardFactor);
      (await newDlp.version()).should.eq(2);

      (await newDlp.test()).should.eq("test");
    });

    it("Should upgradeTo when owner and emit event", async function () {
      const newDlpImplementation = await ethers.deployContract(
        "DataLiquidityPoolLightImplementationV2Mock",
      );

      await dlp
        .connect(owner)
        .upgradeToAndCall(newDlpImplementation, "0x")
        .should.emit(dlp, "Upgraded")
        .withArgs(newDlpImplementation);

      const newDlp = await ethers.getContractAt(
        "DataLiquidityPoolLightImplementationV2Mock",
        dlp,
      );

      (await newDlp.name()).should.eq(dlpName);
      (await newDlp.owner()).should.eq(owner);
      (await newDlp.paused()).should.eq(false);
      (await newDlp.fileRewardFactor()).should.eq(fileRewardFactor);
      (await newDlp.version()).should.eq(2);

      (await newDlp.test()).should.eq("test");
    });

    it("Should reject upgradeTo when storage layout is incompatible", async function () {
      await upgrades
        .upgradeProxy(
          dlp,
          await ethers.getContractFactory(
            "DataLiquidityPoolLightImplementationV3Mock",
            owner,
          ),
        )
        .should.be.rejectedWith("New storage layout is incompatible");
    });

    it("Should reject upgradeTo when non owner", async function () {
      const newDlpImplementation = await ethers.deployContract(
        "DataLiquidityPoolLightImplementationV2Mock",
      );

      await dlp
        .connect(user1)
        .upgradeToAndCall(newDlpImplementation, "0x")
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });
  });

  describe("Files", () => {
    beforeEach(async () => {
      await deploy();
    });

    it.only("should addFile", async function () {
      await dataRegistry.connect(user1).addFile("file1Url");
      await dataRegistry.connect(tee1).addProof(1, proofs[1]);

      await dlp
        .connect(user1)
        .addFile(1, 1)
        .should.emit(dlp, "FileAdded")
        .withArgs(user1, 1);

      (await dlp.filesCount()).should.eq(1);

      const file1 = await dlp.files(1);
      file1.registryId.should.eq(1);
      file1.proofIndex.should.eq(1);
      file1.rewardAmount.should.eq(
        (proofs[1].data.score * fileRewardFactor) / parseEther("1"),
      );
      file1.rewardWithdrawn.should.eq(0);

      (await dlp.contributorFiles(user1, 1)).should.deep.eq(file1);

      (await dlp.contributorsCount()).should.eq(1);
      const contributor1 = await dlp.contributors(1);
      contributor1.contributorAddress.should.eq(user1);
      contributor1.fileIdsCount.should.eq(1);

      (await dlp.contributorInfo(user1)).should.deep.eq(contributor1);
    });

    it.only("should addFile multiple times by same user", async function () {
      await dataRegistry.connect(user1).addFile("file1Url");
      await dataRegistry.connect(tee1).addProof(1, proofs[1]);

      await dataRegistry.connect(user1).addFile("file2Url");
      await dataRegistry.connect(tee1).addProof(2, proofs[2]);

      const timestamp = await getCurrentBlockTimestamp();
      await dlp
        .connect(user1)
        .addFile(1, 1)
        .should.emit(dlp, "FileAdded")
        .withArgs(user1, 1);
      await dlp
        .connect(user1)
        .addFile(2, 1)
        .should.emit(dlp, "FileAdded")
        .withArgs(user1, 2);

      (await dlp.filesCount()).should.eq(2);

      const file1 = await dlp.files(1);
      file1.registryId.should.eq(1);
      file1.proofIndex.should.eq(1);
      file1.rewardAmount.should.eq(
        (proofs[1].data.score * fileRewardFactor) / parseEther("1"),
      );
      file1.rewardWithdrawn.should.eq(0);
      (await dlp.contributorFiles(user1, 1)).should.deep.eq(file1);

      const file2 = await dlp.files(2);
      file2.registryId.should.eq(2);
      file2.proofIndex.should.eq(1);
      file2.rewardAmount.should.eq(
        (proofs[2].data.score * fileRewardFactor) / parseEther("1"),
      );
      file2.rewardWithdrawn.should.eq(0);
      (await dlp.contributorFiles(user1, 2)).should.deep.eq(file2);

      (await dlp.contributorsCount()).should.eq(1);
      const contributor1 = await dlp.contributors(1);
      contributor1.contributorAddress.should.eq(user1);
      contributor1.fileIdsCount.should.eq(2);

      (await dlp.contributorInfo(user1)).should.deep.eq(contributor1);
    });

    it("should addFile many users and many validators", async function () {
      await registerValidators();

      const timestamp = await getCurrentBlockTimestamp();
      await dlp
        .connect(user1)
        .addFile(1, 1)
        .should.emit(dlp, "FileAdded")
        .withArgs(user1.address, 1);
      await dlp
        .connect(user1)
        .addFile(2, 1)
        .should.emit(dlp, "FileAdded")
        .withArgs(user1.address, 2);
      await dlp
        .connect(user3)
        .addFile(3, 1)
        .should.emit(dlp, "FileAdded")
        .withArgs(user3.address, 3);
      await dlp
        .connect(user3)
        .addFile(4, 1)
        .should.emit(dlp, "FileAdded")
        .withArgs(user3.address, 4);
      await dlp
        .connect(user3)
        .addFile(5, 1)
        .should.emit(dlp, "FileAdded")
        .withArgs(user3.address, 5);
      await dlp
        .connect(user2)
        .addFile(6, 1)
        .should.emit(dlp, "FileAdded")
        .withArgs(user2.address, 6);

      (await dlp.filesCount()).should.eq(6);

      const file1 = await dlp.files(1);
      file1.ownerAddress.should.eq(user1);
      file1.url.should.eq(1);
      file1.encryptedKey.should.eq(1);
      file1.addedTimestamp.should.eq(timestamp + 1);
      (await dlp.contributorFiles(user1, 1)).should.deep.eq(file1);

      const file2 = await dlp.files(2);
      file2.ownerAddress.should.eq(user1);
      file2.url.should.eq(2);
      file2.encryptedKey.should.eq(1);
      file2.addedTimestamp.should.eq(timestamp + 2);
      (await dlp.contributorFiles(user1, 2)).should.deep.eq(file2);

      const file3 = await dlp.files(3);
      file3.ownerAddress.should.eq(user3);
      file3.url.should.eq(3);
      file3.encryptedKey.should.eq(1);
      file3.addedTimestamp.should.eq(timestamp + 3);
      (await dlp.contributorFiles(user3, 1)).should.deep.eq(file3);

      const file4 = await dlp.files(4);
      file4.ownerAddress.should.eq(user3);
      file4.url.should.eq(4);
      file4.encryptedKey.should.eq(1);
      file4.addedTimestamp.should.eq(timestamp + 4);
      (await dlp.contributorFiles(user3, 2)).should.deep.eq(file4);

      const file5 = await dlp.files(5);
      file5.ownerAddress.should.eq(user3);
      file5.url.should.eq(5);
      file5.encryptedKey.should.eq(1);
      file5.addedTimestamp.should.eq(timestamp + 5);
      (await dlp.contributorFiles(user3, 3)).should.deep.eq(file5);

      const file6 = await dlp.files(6);
      file6.ownerAddress.should.eq(user2);
      file6.url.should.eq(6);
      file6.encryptedKey.should.eq(1);
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

      const validator1 = await dlp.validatorsInfo(user1);
      validator1.lastVerifiedFile.should.eq(0);

      const validator2 = await dlp.validatorsInfo(v2);
      validator2.lastVerifiedFile.should.eq(0);

      const validator3 = await dlp.validatorsInfo(v3);
      validator3.lastVerifiedFile.should.eq(0);

      (await dlp.getNextFileToVerify(user1)).should.deep.eq(file1);
      (await dlp.getNextFileToVerify(v2)).should.deep.eq(file1);
      (await dlp.getNextFileToVerify(v3)).should.deep.eq(file1);
    });

    it("Should reject addFile when same url", async function () {
      await dlp.connect(user1).addFile(1, 1).should.be.fulfilled;
      await dlp
        .connect(user1)
        .addFile(1, 1)
        .should.be.rejectedWith(`FileAlreadyAdded()`);
    });

    xit("should create epochs when adding files and no validators", async function () {
      await advanceToEpochN(4);
      await dlp
        .connect(user1)
        .addFile(1, 1)
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
        .addFile(1, 1)
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
  describe("File validation", () => {
    beforeEach(async () => {
      await deploy();
    });

    it.only("should validateFile when owner", async function () {
      await dlp.connect(user1).addFile(1, 1);
      const file = await dlp.files(1);
      await dlp
        .connect(owner)
        .validateFile(1)
        .should.emit(dlp, "FileValidated")
        .withArgs(1);
    });
  });
});
