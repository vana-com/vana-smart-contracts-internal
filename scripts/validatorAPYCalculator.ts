async function main() {
  //network params
  const secondsPerSlot = 8;
  const slotsPerEpoch = 8;
  const effectiveBalanceMax = 35000e9;
  const effectiveBalanceIncrement = 1000e9;
  const baseRewardFactor = 55;

  //reality params
  const numberOfValidators = 21;
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

  // console.log(
  //   `All (${numberOfValidators}) validators max reward per epoch: ${(maxRewardPerEpoch * numberOfValidators) / 1e9} Vana`,
  // );

  console.log(
    // `All (${numberOfValidators}) validators max reward per year: ${(maxRewardPerYear * numberOfValidators) / 1e9} Vana`,
    `All (${numberOfValidators}) validators max reward after 48 months: ${(3 * (maxRewardPerYear * numberOfValidators)) / 1e9} Vana`,
  );

  const APY0 = 99.64;
  const APY6 = 70.46;
  const APY12 = 49.82;
  const APY18 = 35.23;
  const APY24 = 24.91;
  const APY30 = 17.61;
  const APY36 = 12.45;
  const APY42 = 8.8;

  const set1Reward =
    (effectiveBalanceMax *
      (APY0 + APY6 + APY12 + APY18 + APY24 + APY30 + APY36 + APY42)) /
    200;
  const set2Reward =
    (effectiveBalanceMax *
      (APY6 + APY12 + APY18 + APY24 + APY30 + APY36 + APY42)) /
    200;
  const set3Reward =
    (effectiveBalanceMax * (APY12 + APY18 + APY24 + APY30 + APY36 + APY42)) /
    200;
  const set4Reward =
    (effectiveBalanceMax * (APY18 + APY24 + APY30 + APY36 + APY42)) / 200;
  const set5Reward =
    (effectiveBalanceMax * (APY24 + APY30 + APY36 + APY42)) / 200;
  const set6Reward = (effectiveBalanceMax * (APY30 + APY36 + APY42)) / 200;
  const set7Reward = (effectiveBalanceMax * (APY36 + APY42)) / 200;
  const set8Reward = (effectiveBalanceMax * APY42) / 200;

  console.log(
    `Set1 - number of moths being validator: 48, total max reward: ${set1Reward / 1e9} VANA, max APY: ${(APY0 + APY6 + APY12 + APY18 + APY24 + APY30 + APY36 + APY42) / 8}`,
  );
  console.log(
    `Set2 - number of moths being validator: 42, total max reward: ${set2Reward / 1e9} VANA, max APY: ${(APY6 + APY12 + APY18 + APY24 + APY30 + APY36 + APY42) / 7}`,
  );
  console.log(
    `Set3 - number of moths being validator: 36, total max reward: ${set3Reward / 1e9} VANA, max APY: ${(APY12 + APY18 + APY24 + APY30 + APY36 + APY42) / 6}`,
  );
  console.log(
    `Set4 - number of moths being validator: 30, total max reward: ${set4Reward / 1e9} VANA, max APY: ${(APY18 + APY24 + APY30 + APY36 + APY42) / 5}`,
  );
  console.log(
    `Set5 - number of moths being validator: 24, total max reward: ${set5Reward / 1e9} VANA, max APY: ${(APY24 + APY30 + APY36 + APY42) / 4}`,
  );
  console.log(
    `Set6 - number of moths being validator: 18, total max reward: ${set6Reward / 1e9} VANA, max APY: ${(APY30 + APY36 + APY42) / 3}`,
  );
  console.log(
    `Set7 - number of moths being validator: 12, total max reward: ${set7Reward / 1e9} VANA, max APY: ${(APY36 + APY42) / 2}`,
  );
  console.log(
    `Set8 - number of moths being validator: 6, total max reward: ${set8Reward / 1e9} VANA, max APY: ${APY42}`,
  );

  console.log(
    `Sum of validator max rewards: ${(10 * set1Reward + 10 * set2Reward + 20 * set3Reward + 40 * set4Reward + 80 * set5Reward + 160 * set6Reward + 320 * set7Reward + 640 * set8Reward) / 1e9}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

/**
 *
 *
 *
 *
 *
 *
 *
 *
 *
 */
