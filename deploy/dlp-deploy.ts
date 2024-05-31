import { ethers, upgrades } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "ethers";
import { env } from "process";
import { getCurrentBlockNumber } from "../utils/timeAndBlockManipulation";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {

	const maxNumberOfValidators = 3;
	const validatorScoreMinTrust = parseEther('0.1');
	const validatorScoreKappa = parseEther('0.5');
	const validatorScoreRho = parseEther('1');
	const validationPeriod = 120;
	const rewardPeriodSize = 14400;
	const minStakeAmount  = parseEther('0');
	let rewardAmount = parseEther('0.000000001');

	const dlpDeploy = await upgrades.deployProxy(
		await ethers.getContractFactory("DataLiquidityPool"),
		[
			process.env.OWNER_ADDRESS,
			maxNumberOfValidators,
			validatorScoreMinTrust,
			validatorScoreKappa,
			validatorScoreRho,
			validationPeriod,
			minStakeAmount,
			await getCurrentBlockNumber(),
			rewardPeriodSize,
			rewardAmount
		],
		{
		  kind: "uups"
		}
	  );


	console.log("DataLiquidityPool deployed at:", dlpDeploy.target);
};

export default func;
func.tags = ["DLPDeploy"];
