import { deployments, ethers } from "hardhat";
import { Wallet } from "ethers";

async function main() {
  console.log(`**************************************************************`);
  console.log(`**************************************************************`);
  console.log(`**************************************************************`);
  console.log(`rootSavePerferomance:: ${new Date()}`);
  if (process.env.OWNER_PRIVATE_KEY === undefined) {
    throw new Error("OWNER_ADDRESS is not set");
  }

  const owner = new Wallet(process.env.OWNER_PRIVATE_KEY, ethers.provider);

  if (process.env.OWNER_ADDRESS != owner.address) {
    throw new Error("OWNER_ADDRESS does not match OWNER_PRIVATE_KEY");
  }

  console.log(`Using account: ${owner.address}`);

  const root = await ethers.getContractAt(
    "DataLiquidityPoolsRootImplementation",
    (await deployments.get("DataLiquidityPoolsRootProxy")).address,
    owner,
  );

  console.log(`Connected to contract at address: ${root.target}`);

  const currentBlock = await ethers.provider.getBlockNumber();
  const epochsCount = await root.epochsCount();

  if ((await root.epochs(epochsCount)).endBlock < currentBlock) {
    console.log(`Creating new epoch`);
    const tx = await root.createEpochs();

    console.log(`Creating new epoch transaction hash: ${tx.hash}`);
    await new Promise((resolve) => setTimeout(resolve, 9000));
  }

  console.log(`Epochs count: ${epochsCount}`);

  let epochId = Number(epochsCount) - 3;
  while (!(await root.epochs(epochId)).isFinalised) {
    epochId -= 3;
  }

  for (epochId; epochId <= epochsCount; epochId++) {
    const epoch = await root.epochs(epochId);

    const isEnded = epoch.endBlock < currentBlock;

    const endDate = new Date();
    if (!isEnded) {
      endDate.setSeconds(
        endDate.getSeconds() +
          (Number(epoch.endBlock) - currentBlock) * (await getBlockDuration()),
      );
    }
    console.log(
      `Epoch ${epochId}: ended: ${epoch.endBlock < currentBlock}, finalized: ${epoch.isFinalised}, ${epoch.endBlock < currentBlock ? "" : "end time: " + endDate}`,
    );

    if (epoch.endBlock < currentBlock && !epoch.isFinalised) {
      console.log(`Finalizing epoch ${epochId}`);
      const dlpIds = [...epoch.dlpIds].sort((a, b) => (a > b ? 1 : -1));

      const epochDlpPerformances = [];
      for (let dlpId of dlpIds) {
        const dlpEpoch = await root.dlpEpochs(dlpId, epochId);

        epochDlpPerformances.push({
          dlpId: dlpId,
          ttf: dlpEpoch.stakeAmount * 2n,
          tfc: dlpEpoch.stakeAmount * 2n,
          vdu: dlpEpoch.stakeAmount * 2n,
          uw: dlpEpoch.stakeAmount * 2n,
        });
      }

      const tx = await root.saveEpochPerformances(
        epochId,
        epochDlpPerformances,
        true,
      );
      console.log(`Transaction hash: ${tx.hash}`);
    }
  }
}

async function getEtherTransfers(transactionHash: string) {
  // Connect to the Ethereum network

  // Get the transaction receipt
  const txReceipt =
    await ethers.provider.getTransactionReceipt(transactionHash);

  // Fetch the transaction details
  const transaction = await ethers.provider.getTransaction(transactionHash);

  console.log(transaction);
  console.log(txReceipt);
  if (transaction === null || txReceipt === null) {
    console.log("Transaction not found");
    return;
  }

  // Check if the transaction transferred Ether
  if (transaction.value > 0n) {
    console.log(
      `Ether transfer of ${ethers.formatEther(transaction.value)} ETH`,
    );
    console.log(`From: ${transaction.from}`);
    console.log(`To: ${transaction.to}`);
  }

  // Analyze logs for potential internal transactions if they exist
  const logs = txReceipt.logs;
  if (logs.length === 0) {
    console.log("No other transfers found in this transaction.");
  } else {
    logs.forEach((log) => {
      console.log(`Log Address: ${log.address}`);
      console.log(`Log Data: ${log.data}`);
      // You can parse these logs further if needed
    });
  }
}

async function getBlockDuration() {
  const latestBlockNumber = await ethers.provider.getBlockNumber();

  const latestBlock = await ethers.provider.getBlock(latestBlockNumber);
  const previousBlock = await ethers.provider.getBlock(latestBlockNumber - 1);

  if (latestBlock === null || previousBlock === null) {
    throw new Error("Could not fetch blocks");
  }

  return latestBlock.timestamp - previousBlock.timestamp;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
