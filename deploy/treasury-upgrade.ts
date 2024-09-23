import { deployments, ethers, upgrades } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { getUUPSImplementationAddress, verifyProxy } from "./helpers";

const implementationContractName = "TreasuryImplementation";
const proxyContractName = "TreasuryProxy";
const proxyContractPath = "contracts/treasury/TreasuryProxy.sol:TreasuryProxy";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  console.log(``);
  console.log(``);
  console.log(``);
  console.log(`**************************************************************`);
  console.log(`**************************************************************`);
  console.log(`**************************************************************`);

  const root = await deployments.get(proxyContractName);

  console.log(`********** Upgrade ${proxyContractName} **********`);

  await upgrades.upgradeProxy(
    root.address,
    await ethers.getContractFactory(implementationContractName),
  );

  console.log(`${proxyContractName} upgraded`);

  await verifyProxy(
    root.address,
    await getUUPSImplementationAddress(root.address),
    "",
    proxyContractPath,
  );
};

export default func;
func.tags = ["DLPTreasuryUpgrade"];
