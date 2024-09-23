import { deployments, ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { verifyContract } from "./helpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const [deployer] = await ethers.getSigners();

  const depositProxyDeploy = await deployments.deploy("DepositImplementation", {
    from: deployer.address,
    args: [],
    log: true,
  });

  await verifyContract(depositProxyDeploy.address, []);

  return;
};

export default func;
func.tags = ["DepositProxyDeploy"];
