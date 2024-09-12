import { ethers } from "hardhat";
import { getReceipt, parseEther } from "../utils/helpers";

async function main() {
  // Get the signer (wallet) from Hardhat, connected to the specified network
  const [signer] = await ethers.getSigners();

  const depositAddress = "0x4242424242424242424242424242424242424242";
  const depositImplementationAddress =
    "0x1111111111111111111111111111111111111111";
  const depositImplementationAddress2 =
    "0xee4e3Fd107BE4097718B8aACFA3a8d2d9349C9a5";

  const depositContract = await ethers.getContractAt(
    "DepositImplementation",
    depositAddress,
  );

  const depositProxy = await ethers.getContractAt(
    "DepositProxy",
    depositAddress,
  );

  const tx = await ethers.provider.getTransaction(
    "0xf4c9340ced5c2b5197c9e553c58aa2781a016be9a8c0654f49bc6bc0ea8203cc",
  );

  const receipt = await getReceipt(tx);

  // console.log(receipt.status);
  // console.log(receipt);

  return;

  console.log(
    await depositContract.upgradeToAndCall(
      depositImplementationAddress2,
      "0x",
      {
        gasLimit: 1000000, // Increase this as needed
      },
    ),
  );

  return;

  if ((await ethers.provider.getBlockNumber()) == 0) {
    throw new Error("Network is not active yet");
  }

  console.log(
    `Deposit contract initial balance: ${(await ethers.provider.getBalance(depositAddress)) / parseEther(1)} VANA`,
  );

  // ****************** contract initialization start ******************
  console.log(
    "Set implementation transaction: ",
    await depositProxy.setImplementation(depositImplementationAddress, "0x"),
  );

  await new Promise((resolve) => setTimeout(resolve, 20000));
  console.log(
    "Initialize transaction: ",
    await depositContract.initialize(
      signer.address,
      parseEther(35000),
      parseEther(35000),
      [],
    ),
  );

  // ****************** contract initialization end ******************

  await new Promise((resolve) => setTimeout(resolve, 20000));

  console.log(
    "Deposit root before: ",
    await depositContract.get_deposit_root(),
  );
  console.log(
    "Deposit count before: ",
    await depositContract.get_deposit_count(),
  );

  console.log(
    await depositContract.deposit(
      "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001",
      "0x0100000000000000000000000000000000000000000000000000000000000001",
      "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001",
      "0xddc3f739e834cac39f2f81fa81c446ce6335c4baec5b00feb85d6c3ecde5a76e",
      { value: parseEther(35000) },
    ),
  );

  await new Promise((resolve) => setTimeout(resolve, 20000));

  console.log("Deposit root after: ", await depositContract.get_deposit_root());
  console.log(
    "Deposit count after: ",
    await depositContract.get_deposit_count(),
  );

  console.log(
    `Deposit contract final balance: ${(await ethers.provider.getBalance(depositAddress)) / parseEther(1)} VANA`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
