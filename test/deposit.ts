import chai, { should } from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers, upgrades } from "hardhat";
import { DAT, DepositImplementation } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { parseEther } from "../utils/helpers";

chai.use(chaiAsPromised);
should();

describe("Deposit", () => {
  let deployer: HardhatEthersSigner;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;

  const minDepositAmount = parseEther("35");
  const maxDepositAmount = parseEther("36");

  const validators = [
    {
      pubkey:
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      withdrawal_credentials:
        "0x0100000000000000000000000000000000000000000000000000000000000000",
      signature:
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      deposit_data_root:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
    },
    {
      pubkey:
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001",
      withdrawal_credentials:
        "0x0100000000000000000000000000000000000000000000000000000000000001",
      signature:
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001",
      deposit_data_root:
        "0x904a5d017723cea1053da1218cca64b2706195767904ab20ba5c1391e282bda1",
    },
    {
      pubkey:
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002",
      withdrawal_credentials:
        "0x0100000000000000000000000000000000000000000000000000000000000002",
      signature:
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002",
      deposit_data_root:
        "0x64487ffc2d79fffb9817ccc84772aa46a326e5eb36cb28db62da1d135691b74c",
    },
    {
      pubkey:
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003",
      withdrawal_credentials:
        "0x0100000000000000000000000000000000000000000000000000000000000003",
      signature:
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003",
      deposit_data_root:
        "0x14db6a3ec3e63007a7c602faf536ee22efe8e989202be879b4bbd81a0eace7bc",
    },
    {
      pubkey:
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004",
      withdrawal_credentials:
        "0x0100000000000000000000000000000000000000000000000000000000000004",
      signature:
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004",
      deposit_data_root:
        "0x037212655bd85196b7f25f85afc8ddee31cb33bfc68b3462f09c7324eea035db",
    },
    {
      pubkey:
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005",
      withdrawal_credentials:
        "0x0100000000000000000000000000000000000000000000000000000000000005",
      signature:
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005",
      deposit_data_root:
        "0x97217d073b484e0bda7bcbf6f968171d28684e5b097d62fec000549ca017219d",
    },
    {
      pubkey:
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006",
      withdrawal_credentials:
        "0x0100000000000000000000000000000000000000000000000000000000000006",
      signature:
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006",
      deposit_data_root:
        "0x84f7dd90263c7da2e7ea3c90a32d7bfc1f282ea41f8a6198c46e24a4419a204c",
    },
    {
      pubkey:
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007",
      withdrawal_credentials:
        "0x0100000000000000000000000000000000000000000000000000000000000007",
      signature:
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007",
      deposit_data_root:
        "0x96217b9b09d02e91e9d7e2eb1a071409d819e61a71dc3c4b3dbd2c0c6bbbb858",
    },
    {
      pubkey:
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008",
      withdrawal_credentials:
        "0x0100000000000000000000000000000000000000000000000000000000000008",
      signature:
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008",
      deposit_data_root:
        "0x0db9b334a06f410495676c9c7ac1bcccad530e4b28a1b13281e0c4b6ad5d3d71",
    },
    {
      pubkey:
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000009",
      withdrawal_credentials:
        "0x0100000000000000000000000000000000000000000000000000000000000009",
      signature:
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000009",
      deposit_data_root:
        "0x3edf155ff9f8ed711175484a915951dc901dbc2df5dea380135f8c24fff7e8ad",
    },
  ];

  let deposit: DepositImplementation;

  const deploy = async () => {
    [deployer, owner, user1, user2, user3] = await ethers.getSigners();

    const depositDeploy = await upgrades.deployProxy(
      await ethers.getContractFactory("DepositImplementation"),
      [
        owner.address,
        minDepositAmount,
        maxDepositAmount,
        [validators[1].pubkey, validators[2].pubkey, validators[3].pubkey],
      ],
      {
        kind: "uups",
      },
    );

    deposit = await ethers.getContractAt(
      "DepositImplementation",
      depositDeploy.target,
    );
  };

  describe("Setup", () => {
    beforeEach(async () => {
      await deploy();
    });

    it("should have correct params after deploy", async function () {
      (await deposit.owner()).should.eq(owner);
      (await deposit.minDepositAmount()).should.eq(minDepositAmount);
      (await deposit.maxDepositAmount()).should.eq(maxDepositAmount);
      (await deposit.restricted()).should.eq(false);

      const validator1 = await deposit.validators(validators[1].pubkey);
      validator1.isAllowed.should.eq(true);
      validator1.hasDeposit.should.eq(false);
      const validator2 = await deposit.validators(validators[2].pubkey);
      validator2.isAllowed.should.eq(true);
      validator2.hasDeposit.should.eq(false);
      const validator3 = await deposit.validators(validators[3].pubkey);
      validator3.isAllowed.should.eq(true);
      validator3.hasDeposit.should.eq(false);
      const validator4 = await deposit.validators(validators[4].pubkey);
      validator4.isAllowed.should.eq(false);
      validator4.hasDeposit.should.eq(false);
    });

    it("should updateMinDepositAmount when owner", async function () {
      await deposit.connect(owner).updateMinDepositAmount(parseEther("10"))
        .should.be.fulfilled;

      (await deposit.minDepositAmount()).should.eq(parseEther("10"));
    });

    it("should reject updateMinDepositAmount when non-owner", async function () {
      await deposit
        .connect(user1)
        .updateMinDepositAmount(parseEther("10"))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("should updateMaxDepositAmount when owner", async function () {
      await deposit.connect(owner).updateMaxDepositAmount(parseEther("100"))
        .should.be.fulfilled;

      (await deposit.maxDepositAmount()).should.eq(parseEther("100"));
    });

    it("should reject updateMaxDepositAmount when non-owner", async function () {
      await deposit
        .connect(user1)
        .updateMaxDepositAmount(parseEther("100"))
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("should updateRestricted when owner", async function () {
      await deposit.connect(owner).updateRestricted(false).should.be.fulfilled;

      (await deposit.restricted()).should.eq(false);

      await deposit.connect(owner).updateRestricted(false).should.be.fulfilled;

      (await deposit.restricted()).should.eq(false);

      await deposit.connect(owner).updateRestricted(true).should.be.fulfilled;

      (await deposit.restricted()).should.eq(true);
    });

    it("should reject updateRestricted when non-owner", async function () {
      await deposit
        .connect(user1)
        .updateRestricted(false)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("Should transferOwnership in 2 steps", async function () {
      await deposit
        .connect(owner)
        .transferOwnership(user2.address)
        .should.emit(deposit, "OwnershipTransferStarted")
        .withArgs(owner, user2);
      (await deposit.owner()).should.eq(owner);

      await deposit
        .connect(owner)
        .transferOwnership(user3.address)
        .should.emit(deposit, "OwnershipTransferStarted")
        .withArgs(owner, user3);
      (await deposit.owner()).should.eq(owner);

      await deposit
        .connect(user3)
        .acceptOwnership()
        .should.emit(deposit, "OwnershipTransferred");

      (await deposit.owner()).should.eq(user3);
    });

    it("Should reject transferOwnership when non-owner", async function () {
      await deposit
        .connect(user1)
        .transferOwnership(user2)
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("Should reject acceptOwnership when non-newOwner", async function () {
      await deposit
        .connect(owner)
        .transferOwnership(user2.address)
        .should.emit(deposit, "OwnershipTransferStarted")
        .withArgs(owner, user2);
      (await deposit.owner()).should.eq(owner);

      await deposit
        .connect(user3)
        .acceptOwnership()
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user3.address}")`,
        );
    });

    it("Should upgradeTo when owner", async function () {
      await upgrades.upgradeProxy(
        deposit,
        await ethers.getContractFactory("DepositImplementationV2Mock", owner),
      );

      const newRoot = await ethers.getContractAt(
        "DepositImplementationV2Mock",
        deposit,
      );
      (await newRoot.owner()).should.eq(owner);

      (await newRoot.test()).should.eq("test");
    });

    it("Should upgradeTo when owner and emit event", async function () {
      const newRootImplementation = await ethers.deployContract(
        "DepositImplementationV2Mock",
      );

      await deposit
        .connect(owner)
        .upgradeToAndCall(newRootImplementation, "0x")
        .should.emit(deposit, "Upgraded")
        .withArgs(newRootImplementation);

      const newRoot = await ethers.getContractAt(
        "DepositImplementationV2Mock",
        deposit,
      );

      (await newRoot.owner()).should.eq(owner);

      (await newRoot.test()).should.eq("test");
    });

    it("Should reject upgradeTo when storage layout is incompatible", async function () {
      await upgrades
        .upgradeProxy(
          deposit,
          await ethers.getContractFactory("DepositImplementationV3Mock", owner),
        )
        .should.be.rejectedWith("New storage layout is incompatible");
    });

    it("Should reject upgradeTo when non owner", async function () {
      const newRootImplementation = await ethers.deployContract(
        "DepositImplementationV2Mock",
      );

      await deposit
        .connect(user1)
        .upgradeToAndCall(newRootImplementation, "0x")
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });
  });

  describe("Validators", () => {
    before(async function () {});

    beforeEach(async () => {
      await deploy();
    });

    it("should addAllowedValidators when owner", async function () {
      await deposit.connect(owner).addAllowedValidators([validators[4].pubkey])
        .should.be.fulfilled;

      const validator4 = await deposit.validators(validators[4].pubkey);
      validator4.isAllowed.should.eq(true);
      validator4.hasDeposit.should.eq(false);
    });

    it("should reject addAllowedValidators when non-owner", async function () {
      await deposit
        .connect(user1)
        .addAllowedValidators([validators[4].pubkey])
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });

    it("should addAllowedValidators when owner", async function () {
      await deposit
        .connect(owner)
        .addAllowedValidators([validators[4].pubkey, validators[5].pubkey])
        .should.be.fulfilled;

      const validator4 = await deposit.validators(validators[4].pubkey);
      validator4.isAllowed.should.eq(true);
      validator4.hasDeposit.should.eq(false);

      const validator5 = await deposit.validators(validators[5].pubkey);
      validator5.isAllowed.should.eq(true);
      validator5.hasDeposit.should.eq(false);
    });

    it("should removeAllowedValidators when owner", async function () {
      await deposit
        .connect(owner)
        .addAllowedValidators([validators[4].pubkey, validators[5].pubkey])
        .should.be.fulfilled;

      const validator4 = await deposit.validators(validators[4].pubkey);
      validator4.isAllowed.should.eq(true);
      validator4.hasDeposit.should.eq(false);

      const validator5 = await deposit.validators(validators[5].pubkey);
      validator5.isAllowed.should.eq(true);
      validator5.hasDeposit.should.eq(false);

      await deposit
        .connect(owner)
        .removeAllowedValidators([validators[4].pubkey]).should.be.fulfilled;

      const validator4After = await deposit.validators(validators[4].pubkey);
      validator4After.isAllowed.should.eq(false);
      validator4After.hasDeposit.should.eq(false);

      const validator5After = await deposit.validators(validators[5].pubkey);
      validator5After.isAllowed.should.eq(true);
      validator5After.hasDeposit.should.eq(false);
    });

    it("should reject removeAllowedValidators when non-owner", async function () {
      await deposit
        .connect(owner)
        .addAllowedValidators([validators[4].pubkey, validators[5].pubkey])
        .should.be.fulfilled;

      const validator4 = await deposit.validators(validators[4].pubkey);
      validator4.isAllowed.should.eq(true);
      validator4.hasDeposit.should.eq(false);

      const validator5 = await deposit.validators(validators[5].pubkey);
      validator5.isAllowed.should.eq(true);
      validator5.hasDeposit.should.eq(false);

      await deposit
        .connect(user1)
        .removeAllowedValidators([validators[4].pubkey])
        .should.be.rejectedWith(
          `OwnableUnauthorizedAccount("${user1.address}")`,
        );
    });
  });

  describe("Deposit", () => {
    before(async function () {});

    beforeEach(async () => {
      await deploy();
    });

    it("should deposit when allowed validator #1", async function () {
      await deposit
        .connect(user1)
        .deposit(
          validators[1].pubkey,
          validators[1].withdrawal_credentials,
          validators[1].signature,
          validators[1].deposit_data_root,
          {
            value: minDepositAmount,
          },
        )
        .should.emit(deposit, "DepositEvent");

      (await deposit.validators(validators[1].pubkey)).hasDeposit.should.eq(
        true,
      );
    });

    it("should deposit when allowed validator #2", async function () {
      await deposit
        .connect(owner)
        .addAllowedValidators([validators[4].pubkey, validators[5].pubkey])
        .should.be.fulfilled;

      await deposit
        .connect(user1)
        .deposit(
          validators[4].pubkey,
          validators[4].withdrawal_credentials,
          validators[4].signature,
          validators[4].deposit_data_root,
          {
            value: minDepositAmount,
          },
        )
        .should.emit(deposit, "DepositEvent");

      (await deposit.validators(validators[4].pubkey)).hasDeposit.should.eq(
        true,
      );
    });

    it("should reject deposit when non-allowed validator", async function () {
      await deposit.connect(owner).updateRestricted(true);
      await deposit
        .connect(user1)
        .deposit(
          validators[4].pubkey,
          validators[4].withdrawal_credentials,
          validators[4].signature,
          validators[4].deposit_data_root,
          {
            value: minDepositAmount,
          },
        )
        .should.be.rejectedWith("DepositContract: publicKey not allowed");
    });

    it("should reject deposit when permission was removed", async function () {
      await deposit.connect(owner).updateRestricted(true);
      await deposit
        .connect(owner)
        .removeAllowedValidators([validators[1].pubkey]).should.be.fulfilled;

      await deposit
        .connect(user1)
        .deposit(
          validators[1].pubkey,
          validators[1].withdrawal_credentials,
          validators[1].signature,
          validators[1].deposit_data_root,
          {
            value: minDepositAmount,
          },
        )
        .should.be.rejectedWith("DepositContract: publicKey not allowed");
    });

    it("should reject deposit when already deposited", async function () {
      await deposit.connect(owner).updateRestricted(true);
      await deposit
        .connect(user1)
        .deposit(
          validators[1].pubkey,
          validators[1].withdrawal_credentials,
          validators[1].signature,
          validators[1].deposit_data_root,
          {
            value: minDepositAmount,
          },
        )
        .should.emit(deposit, "DepositEvent");

      (await deposit.validators(validators[1].pubkey)).hasDeposit.should.eq(
        true,
      );

      await deposit
        .connect(user1)
        .deposit(
          validators[1].pubkey,
          validators[1].withdrawal_credentials,
          validators[1].signature,
          validators[1].deposit_data_root,
          {
            value: minDepositAmount,
          },
        )
        .should.be.rejectedWith("DepositContract: publickey already used");
    });

    it("should deposit when restricted = false", async function () {
      await deposit.connect(owner).updateRestricted(false);

      await deposit
        .connect(user1)
        .deposit(
          validators[4].pubkey,
          validators[4].withdrawal_credentials,
          validators[4].signature,
          validators[4].deposit_data_root,
          {
            value: minDepositAmount,
          },
        )
        .should.emit(deposit, "DepositEvent");
    });
  });
});
