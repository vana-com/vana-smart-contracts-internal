import { ethers, upgrades } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const dlpDeploy = await upgrades.upgradeProxy(
		'<proxyAddress>',
		await ethers.getContractFactory("DataLiquidityPoolLegacy"),
	);

	console.log("DataLiquidityPoolLegacy upgraded");
};

export default func;
func.tags = ["DLPLegacyUpgrade"];
