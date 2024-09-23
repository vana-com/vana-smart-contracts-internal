import { ethers } from "hardhat";
import { parseEther } from "../utils/helpers";

async function main() {
  if ((await ethers.provider.getBlockNumber()) == 0) {
    throw new Error("Network is not active yet");
  }

  // Get the signer (wallet) from Hardhat, connected to the specified network
  const [signer] = await ethers.getSigners();

  const depositAddress = "0x0cB08b8CBa18E6a23D24E39A5a2f20B327CA5f14";

  // 0x6611148aA3cDe5304051bE1DC5A18116Ad6202B5
  // Proxy deployed at address: 0x0cB08b8CBa18E6a23D24E39A5a2f20B327CA5f14

  const depositContract = await ethers.getContractAt(
    "DepositImplementation",
    depositAddress,
  );

  console.log(await ethers.provider.getCode(depositAddress));
  // console.log(await depositContract.owner());
  return;

  const depositProxy = await ethers.getContractAt(
    "DepositProxy",
    depositAddress,
  );

  console.log(
    await depositContract.upgradeToAndCall(
      "0x459ab2Dd78995EdBE74fAe585D316Ec86596aCbB",
      "0x",
    ),
  );

  console.log(
    `Deposit contract initial balance: ${(await ethers.provider.getBalance(depositAddress)) / parseEther(1)} VANA`,
  );

  // ****************** contract initialization start ******************
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

  // console.log(
  //   await depositContract.deposit(
  //     "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001",
  //     "0x0100000000000000000000000000000000000000000000000000000000000001",
  //     "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001",
  //     "0xddc3f739e834cac39f2f81fa81c446ce6335c4baec5b00feb85d6c3ecde5a76e",
  //     { value: parseEther(35000) },
  //   ),
  // );

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
