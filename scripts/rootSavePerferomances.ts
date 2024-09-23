import { deployments, ethers } from "hardhat";

async function main() {
  // Get the signer (wallet) from Hardhat, connected to the specified network
  const [signer] = await ethers.getSigners();

  console.log(signer.address);

  console.log(`Using account: ${await signer.getAddress()}`);

  const root = await ethers.getContractAt(
    "DataLiquidityPoolsRootImplementation",
    (await deployments.get("DataLiquidityPoolsRootProxy")).address,
    signer,
  );

  console.log(`Connected to contract at address: ${root.target}`);

  // Execute the savePerformance transaction
  const tx = await root.saveEpochPerformances(1, [], true);

  console.log("Transaction hash:", tx.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
