import { ethers, upgrades } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const dlpDeploy = await upgrades.upgradeProxy(
		process.env.DLP_CONTRACT_ADDRESS,
		await ethers.getContractFactory("DataLiquidityPool"),
	);

	console.log("DataLiquidityPool upgraded");
};

export default func;
func.tags = ["DLPUpgrade"];
