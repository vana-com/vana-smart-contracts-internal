import { deployments, ethers, upgrades } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { getUUPSImplementationAddress, verifyProxy } from "./helpers";

const implementationContractName = "DataLiquidityPoolsRootImplementation";
const proxyContractName = "DataLiquidityPoolsRootProxy";
const proxyContractPath =
  "contracts/root/DataLiquidityPoolsRootProxy.sol:DataLiquidityPoolsRootProxy";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  console.log(``);
  console.log(``);
  console.log(``);
  console.log(`**************************************************************`);
  console.log(`**************************************************************`);
  console.log(`**************************************************************`);
  console.log(`********** Upgrade ${proxyContractName} **********`);

  const root = await deployments.get(proxyContractName);

  await upgrades.upgradeProxy(
    root.address,
    await ethers.getContractFactory(implementationContractName),
  );

  await verifyProxy(
    root.address,
    await getUUPSImplementationAddress(root.address),
    "",
    proxyContractPath,
  );
};

export default func;
func.tags = ["DLPRootUpgrade"];
