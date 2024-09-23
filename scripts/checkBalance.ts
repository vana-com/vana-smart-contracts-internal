import { ethers } from "hardhat";

async function main() {
  // Get the signer (wallet) from Hardhat, connected to the specified network
  const [signer] = await ethers.getSigners();

  console.log(
    await ethers.provider.getBalance(
      "0x4242424242424242424242424242424242424242",
    ),
  );
  console.log(await ethers.provider.getBlockNumber());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
