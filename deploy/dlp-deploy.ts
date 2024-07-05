import { ethers, upgrades } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "ethers";
import { env } from "process";
import { getCurrentBlockNumber } from "../utils/timeAndBlockManipulation";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const [deployer] = await ethers.getSigners();

	const dlpName = process.env.DLP_NAME ?? "Custom Data Liquidity Pool";
	const ownerAddress = process.env.OWNER_ADDRESS ?? deployer.address;

	const tokenName = process.env.DLP_TOKEN_NAME ?? "Custom Data Autonomy Token";
	const tokenSymbol = process.env.DLP_TOKEN_SYMBOL ?? "CUSTOMDAT";

	const dlptDeploy = await ethers.deployContract("DLPT", [tokenName, tokenSymbol, ownerAddress]);
	const dlpt = await ethers.getContractAt("DLPT", dlptDeploy.target);

	console.log("DataLiquidityPoolToken deployed at:", dlptDeploy.target);

	const maxNumberOfValidators = 3;
	const validatorScoreMinTrust = parseEther('0.1');
	const validatorScoreKappa = parseEther('0.5');
	const validatorScoreRho = parseEther('1');
	const validationPeriod = 120;
	const rewardPeriodSize = 1800;
	const minStakeAmount  = parseEther('7');
	const startBlock: number = await getCurrentBlockNumber();
	const rewardAmount = parseEther('10');
	const fileRewardFactor = parseEther('5');
	const fileRewardDelay = 0; //3600 * 24 * 3;

	const dlpDeploy = await upgrades.deployProxy(
		await ethers.getContractFactory("DataLiquidityPool"),
		[{
			name: dlpName,
			ownerAddress,
			tokenAddress: dlptDeploy.target,
			newMaxNumberOfValidators: maxNumberOfValidators,
			newValidatorScoreMinTrust: validatorScoreMinTrust,
			newValidatorScoreKappa: validatorScoreKappa,
			newValidatorScoreRho: validatorScoreRho,
			newValidationPeriod: validationPeriod,
			newMinStakeAmount: minStakeAmount,
			startBlock,
			newEpochSize: rewardPeriodSize,
			newEpochRewardAmount: rewardAmount,
			newFileRewardFactor: fileRewardFactor,
			newFileRewardDelay: fileRewardDelay
		}],
		{
			kind: "uups"
		}
	);
	const dlp = await ethers.getContractAt("DataLiquidityPool", dlpDeploy.target);

	console.log(`DataLiquidityPool "${dlpName}" deployed at:`, dlp.target);

	await new Promise((resolve) => setTimeout(resolve, 10000));

	await dlpt.connect(deployer).mint(deployer.address, parseEther('10000000'));

	await dlpt.connect(deployer).approve(dlp, parseEther('3000000'));
	await dlp.connect(deployer).addRewardForValidators(parseEther('2000000'));
	await dlp.connect(deployer).addRewardsForContributors(parseEther('1000000'));
	await dlpt.connect(deployer).transfer(ownerAddress, parseEther('7000000'));

	await dlpt.transferOwnership(ownerAddress);
	await dlp.transferOwnership(ownerAddress);
};

export default func;
func.tags = ["DLPDeploy"];
