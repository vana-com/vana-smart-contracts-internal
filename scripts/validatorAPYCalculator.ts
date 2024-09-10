async function main() {
  //network params
  const secondsPerSlot = 6;
  const slotsPerEpoch = 64;
  const effectiveBalanceMax = 35000e9;
  const effectiveBalanceIncrement = 1000e9;
  const baseRewardFactor = 227;

  //reality params
  const numberOfValidators = 50;
  const numberOfMintedBlocks = 12351;
  const minValidatorReward = (35366335984543 - effectiveBalanceMax) / 5.3333;
  const maxValidatorReward = (35382476019744 - effectiveBalanceMax) / 5.3333;

  const numberOfEpochsInYear =
    (3600 * 24 * 365) / (secondsPerSlot * slotsPerEpoch);

  const baseRewardPerEpoch = Math.floor(
    (baseRewardFactor * effectiveBalanceIncrement) /
      Math.sqrt(effectiveBalanceMax * numberOfValidators),
  );

  const maxRewardPerEpoch =
    (baseRewardPerEpoch * effectiveBalanceMax) / effectiveBalanceIncrement;

  const maxRewardPerYear = maxRewardPerEpoch * numberOfEpochsInYear;

  const maxAPY = (100 * maxRewardPerYear) / effectiveBalanceMax;

  const numberOfMintedEpochs = Math.floor(numberOfMintedBlocks / slotsPerEpoch);

  const estimatedMinRewardPerYear =
    (numberOfEpochsInYear * minValidatorReward) / numberOfMintedEpochs;

  const estimatedMaxRewardPerYear =
    (numberOfEpochsInYear * maxValidatorReward) / numberOfMintedEpochs;

  const realAPYMin = (100 * estimatedMinRewardPerYear) / effectiveBalanceMax;
  const realAPYMax = (100 * estimatedMaxRewardPerYear) / effectiveBalanceMax;

  console.log(
    `**************************** Network parameters ****************************`,
  );
  console.log(`Number of validators: ${numberOfValidators}`);
  console.log(`Max effective balance: ${effectiveBalanceMax / 1e9} Vana`);
  console.log(
    `Effective balance increment: ${effectiveBalanceIncrement / 1e9} Vana`,
  );
  console.log(`Base reward factor: ${baseRewardFactor}`);
  console.log(`Seconds per slot: ${secondsPerSlot}`);
  console.log(`Slots per epoch: ${slotsPerEpoch}`);

  console.log(
    `***************************** 1 validator stats ****************************`,
  );
  console.log(
    `Base reward per epoch: ${baseRewardPerEpoch / 1e9} Vana (${baseRewardPerEpoch} gWei)`,
  );
  console.log(
    `Max reward per epoch: ${maxRewardPerEpoch / 1e9} Vana (${maxRewardPerEpoch} gWei)`,
  );
  console.log(`Max reward per year: ${maxRewardPerYear / 1e9} Vana`);
  console.log(`APY (theoretical): ${maxAPY} %`);
  console.log(`Real min APY: ${realAPYMin} %`);
  console.log(`Real max APY: ${realAPYMax} %`);

  console.log(
    `**************************** All validators stats ***************************`,
  );
  console.log(
    `All (${numberOfValidators}) validators max reward per epoch: ${(maxRewardPerEpoch * numberOfValidators) / 1e9} Vana`,
  );
  console.log(
    `All (${numberOfValidators}) validators max reward per year: ${(maxRewardPerYear * numberOfValidators) / 1e9} Vana`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
