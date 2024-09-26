import { deployments, ethers, upgrades } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { getUUPSImplementationAddress, verifyProxy } from "./helpers";
import { validateProxyImpl } from "@openzeppelin/hardhat-upgrades/src/utils/validate-impl";

const implementationContractName = "DataLiquidityPoolsRootImplementation";
const previousImplementationContractName =
  "DataLiquidityPoolsRootImplementationV1";
const proxyContractName = "DataLiquidityPoolsRootProxy";
const proxyContractPath =
  "contracts/root/DataLiquidityPoolsRootProxy.sol:DataLiquidityPoolsRootProxy";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const [deployer] = await ethers.getSigners();

  console.log(``);
  console.log(``);
  console.log(``);
  console.log(`**************************************************************`);
  console.log(`**************************************************************`);
  console.log(`**************************************************************`);
  console.log(`********** Upgrade ${proxyContractName} **********`);

  await upgrades.validateUpgrade(
    await ethers.getContractFactory(previousImplementationContractName),
    await ethers.getContractFactory(implementationContractName),
  );

  const implementationDeploy = await deployments.deploy(
    implementationContractName,
    {
      from: deployer.address,
      args: [],
      log: true,
    },
  );

  const proxyContract = await ethers.getContractAt(
    implementationContractName,
    (await deployments.get(proxyContractName)).address,
  );

  await proxyContract
    .connect(deployer)
    .upgradeToAndCall(implementationDeploy.address, "0x");

  await verifyProxy(
    await proxyContract.getAddress(),
    implementationDeploy.address,
    "",
    proxyContractPath,
  );
};

export default func;
func.tags = ["DLPRootUpgrade"];
