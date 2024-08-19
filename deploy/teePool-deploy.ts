import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployProxy, verifyProxy } from "./helpers";

const implementationContractName = "TeePoolImplementation";
const proxyContractName = "TeePoolProxy";
const proxyContractPath = "contracts/teePool/TeePoolProxy.sol:TeePoolProxy";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const [deployer] = await ethers.getSigners();

  const ownerAddress = process.env.OWNER_ADDRESS ?? deployer.address;

  const initializeParams = [
    ownerAddress,
    "0xDAAD102189FE8D0FE43c1926b109E94D06bD8a97",
  ];

  const proxyDeploy = await deployProxy(
    deployer,
    proxyContractName,
    implementationContractName,
    initializeParams,
  );

  await verifyProxy(
    proxyDeploy.proxyAddress,
    proxyDeploy.implementationAddress,
    proxyDeploy.initializeData,
    proxyContractPath,
  );

  return;
};

export default func;
func.tags = ["TeePoolDeploy"];
