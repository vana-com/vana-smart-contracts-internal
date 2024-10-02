import { ethers } from "hardhat";

async function main() {
  // Get the signer (wallet) from Hardhat, connected to the specified network
  const [signer] = await ethers.getSigners();

  console.log(
    await ethers.provider.getBalance(
      "0x017062a1dE2FE6b99BE3d9d37841FeD19F573804",
    ),
  );
  console.log(
    await ethers.provider.getCode("0x017062a1dE2FE6b99BE3d9d37841FeD19F573804"),
  );

  console.log(await ethers.provider.getBlockNumber());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
