import { ethers, upgrades } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "ethers";
import { getCurrentBlockNumber } from "../utils/timeAndBlockManipulation";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const [deployer] = await ethers.getSigners();

	const ownerAddress = process.env.OWNER_ADDRESS ?? deployer.address;

	const maxNumberOfDlps = 10;
	const rewardPeriodSize = 1800;
	const minStakeAmount  = parseEther('0.1');
	const startBlock: number = await getCurrentBlockNumber();
	const rewardAmount = parseEther('1');

	const dlpRootDeploy = await upgrades.deployProxy(
		await ethers.getContractFactory("DataLiquidityPoolsRoot"),
		[[
			deployer.address,
			maxNumberOfDlps,
			minStakeAmount,
			startBlock,
			rewardPeriodSize,
			rewardAmount
		]],
		{
		  kind: "uups"
		}
	  );
	const dlp = await ethers.getContractAt("DataLiquidityPoolsRoot", dlpRootDeploy.target);	

	console.log("DataLiquidityPoolsRoot deployed at:", dlp.target);

	await new Promise((resolve) => setTimeout(resolve, 10000));

	await dlp.addRewardForDlps({value: parseEther('100')});

	await dlp.transferOwnership(ownerAddress);
};

export default func;
func.tags = ["DLPRootDeploy"];
