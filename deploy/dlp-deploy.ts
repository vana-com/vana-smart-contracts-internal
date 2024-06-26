import { ethers, upgrades } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "ethers";
import { env } from "process";
import { getCurrentBlockNumber } from "../utils/timeAndBlockManipulation";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const [deployer] = await ethers.getSigners();

	const ownerAddress = process.env.OWNER_ADDRESS ?? deployer.address;

	const dlptDeploy = await ethers.deployContract("HDOG", [deployer.address]);
	const dlpt = await ethers.getContractAt("HDOG", dlptDeploy.target);


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
	const fileRewardDelay = 3600 * 24 * 3;

	const dlpDeploy = await upgrades.deployProxy(
		await ethers.getContractFactory("DataLiquidityPool"),
		[
			ownerAddress,
			dlptDeploy.target,
			maxNumberOfValidators,
			validatorScoreMinTrust,
			validatorScoreKappa,
			validatorScoreRho,
			validationPeriod,
			minStakeAmount,
			startBlock,
			rewardPeriodSize,
			rewardAmount,
			fileRewardFactor,
			fileRewardDelay
		],
		{
		  kind: "uups"
		}
	  );
	const dlp = await ethers.getContractAt("DataLiquidityPool", dlpDeploy.target);	

	console.log("DataLiquidityPool deployed at:", dlp.target);

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
