import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployProxy, verifyProxy } from "./helpers";
import { parseEther } from "../utils/helpers";

const implementationContractName = "DepositImplementation";
const proxyContractName = "DepositProxy";
const proxyContractPath = "contracts/l1Deposit/DepositProxy.sol:DepositProxy";

const minDepositAmount = parseEther(35000);
const maxDepositAmount = parseEther(35000);
const allowedValidators: string[] = [];

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const [deployer] = await ethers.getSigners();

  if ((await ethers.provider.getBlockNumber()) == 0) {
    throw new Error("Network is not active yet");
  }

  const ownerAddress = process.env.OWNER_ADDRESS ?? deployer.address;

  const initializeParams = [
    ownerAddress,
    minDepositAmount,
    maxDepositAmount,
    allowedValidators,
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
func.tags = ["DepositDeploy"];
