import { ethers } from "hardhat";

async function main() {
  // Get the signer (wallet) from Hardhat, connected to the specified network
  const [signer] = await ethers.getSigners();

  // const depositAddress = "0x4242424242424242424242424242424242424242";
  const depositAddress = "0x68b4d6525ca86518dff604553b31be7b5b2c8ab4";
  // const depositAddress2 = "0xF1925473bA6aa147EeB2529197C2704454D66b43"; //custom proxy
  // const depositAddress2 = "0xf9215f0f774b6dBcd0209e24Df3aE182E9813fd7"; //custom impl

  const depositContract = await ethers.getContractAt(
    "DepositImplementation",
    depositAddress,
  );

  console.log(await ethers.provider.getBalance(depositAddress));
  console.log(await ethers.provider.getBlockNumber());

  console.log(await depositContract.get_deposit_count());

  // console.log("**********************");
  // console.log(await ethers.provider.getCode(depositAddress));
  // console.log("**********************");
  // console.log(await ethers.provider.getCode(depositAddress2));
  // console.log("**********************");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
