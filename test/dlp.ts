import chai, { should } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers, upgrades } from "hardhat";
import {
  DAT,
  DataLiquidityPoolImplementation,
  DataRegistryImplementation,
  TeePoolImplementation,
} from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deployDataRegistry, Proof, proofs, signProof } from "./dataRegistry";
import { parseEther } from "../utils/helpers";

chai.use(chaiAsPromised);
should();

describe("DataLiquidityPool", () => {
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

  let dlp: DataLiquidityPoolImplementation;
  let dat: DAT;
  let dataRegistry: DataRegistryImplementation;
  let teePool: TeePoolImplementation;

  const dlpName = "Test DLP";
  const dlpTokenName = "Test Data Autonomy Token";
  const dlpTokenSymbol = "TDAT";
  let fileRewardFactor = parseEther("3");
  let teePoolCancelDelay = 100;

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

    dataRegistry = await deployDataRegistry(owner);

    const teePoolDeploy = await upgrades.deployProxy(
      await ethers.getContractFactory("TeePoolImplementation"),
      [owner.address, dataRegistry.target, teePoolCancelDelay],
      {
        kind: "uups",
      },
    );

    teePool = await ethers.getContractAt(
      "TeePoolImplementation",
      teePoolDeploy.target,
    );

    await teePool.connect(owner).addTee(tee1.address, "tee1Url");

    const dlpDeploy = await upgrades.deployProxy(
      await ethers.getContractFactory("DataLiquidityPoolImplementation"),
      [
        {
          ownerAddress: owner.address,
          tokenAddress: dat.target,
          dataRegistryAddress: dataRegistry.target,
          teePoolAddress: teePool.target,
          name: dlpName,
          masterKey: "masterKey",
          fileRewardFactor: fileRewardFactor,
        },
      ],
      {
        kind: "uups",
      },
    );

    dlp = await ethers.getContractAt(
      "DataLiquidityPoolImplementation",
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
      (await dlp.teePool()).should.eq(teePool);
      (await dlp.dataRegistry()).should.eq(dataRegistry);
      (await dlp.masterKey()).should.eq("masterKey");
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

    it("Should updateTeePool when owner", async function () {
      await dlp.connect(owner).updateTeePool(user1).should.be.fulfilled;

      (await dlp.teePool()).should.eq(user1);
    });

    it("Should reject updateFileRewardFactor when non-owner", async function () {
      await dlp
        .connect(user1)
        .updateTeePool(user1)
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
          "DataLiquidityPoolImplementationV2Mock",
          owner,
        ),
      );

      const newDlp = await ethers.getContractAt(
        "DataLiquidityPoolImplementationV2Mock",
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
        "DataLiquidityPoolImplementationV2Mock",
      );

      await dlp
        .connect(owner)
        .upgradeToAndCall(newDlpImplementation, "0x")
        .should.emit(dlp, "Upgraded")
        .withArgs(newDlpImplementation);

      const newDlp = await ethers.getContractAt(
        "DataLiquidityPoolImplementationV2Mock",
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
            "DataLiquidityPoolImplementationV3Mock",
            owner,
          ),
        )
        .should.be.rejectedWith("New storage layout is incompatible");
    });

    it("Should reject upgradeTo when non owner", async function () {
      const newDlpImplementation = await ethers.deployContract(
        "DataLiquidityPoolImplementationV2Mock",
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

    it("should addFile", async function () {
      await dataRegistry.connect(user1).addFile("file1Url");

      const proof1: Proof = {
        signature: await signProof(tee1, "file1Url", proofs[1].data),
        data: proofs[1].data,
      };

      await dataRegistry.connect(tee1).addProof(1, proof1);

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

    it("should addFile multiple times by same user", async function () {
      await dataRegistry.connect(user1).addFile("file1Url");

      const proof1: Proof = {
        signature: await signProof(tee1, "file1Url", proofs[1].data),
        data: proofs[1].data,
      };
      await dataRegistry.connect(user1).addProof(1, proof1);

      await dataRegistry.connect(user1).addFile("file2Url");

      const proof2: Proof = {
        signature: await signProof(tee1, "file2Url", proofs[2].data),
        data: proofs[2].data,
      };
      await dataRegistry.connect(tee1).addProof(2, proof2);

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
  });
  describe("File validation", () => {
    beforeEach(async () => {
      await deploy();

      await dat.connect(owner).approve(dlp.target, parseEther(1000));
      await dlp.connect(owner).addRewardsForContributors(parseEther(1000));
    });

    it("should validateFile when owner", async function () {
      await dataRegistry.connect(user1).addFile("file1Url");

      const proof1: Proof = {
        signature: await signProof(tee1, "file1Url", proofs[1].data),
        data: proofs[1].data,
      };

      await dataRegistry.connect(user1).addProof(1, proof1);

      await dlp.connect(user1).addFile(1, 1);
      await dlp
        .connect(owner)
        .validateFile(1)
        .should.emit(dlp, "FileValidated")
        .withArgs(1);
    });
  });
});
