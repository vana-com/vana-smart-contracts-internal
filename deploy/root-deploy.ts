import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "ethers";
import { getCurrentBlockNumber } from "../utils/timeAndBlockManipulation";
import { deployProxy, verifyProxy } from "./helpers";

const implementationContractName = "DataLiquidityPoolsRootImplementation";
const proxyContractName = "DataLiquidityPoolsRootProxy";
const proxyContractPath =
  "contracts/root/DataLiquidityPoolsRootProxy.sol:DataLiquidityPoolsRootProxy";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const [deployer] = await ethers.getSigners();

  const ownerAddress = process.env.OWNER_ADDRESS ?? deployer.address;

  const maxNumberOfDlps = 10;
  const epochSize = 1800;
  const minDlpStakeAmount = parseEther("0.0001");
  const startBlock: number = await getCurrentBlockNumber();
  const epochRewardAmount = parseEther("0.001");
  const addRewardToDlpAmount = parseEther("0.1");
  const ttfPercentage = parseEther("0.15");
  const tfcPercentage = parseEther("0.15");
  const vduPercentage = parseEther("0.50");
  const uwPercentage = parseEther("0.20");

  const initializeParams = [
    [
      deployer.address,
      maxNumberOfDlps,
      minDlpStakeAmount,
      startBlock,
      epochSize,
      epochRewardAmount,
      ttfPercentage,
      tfcPercentage,
      vduPercentage,
      uwPercentage,
    ],
  ];

  const proxyDeploy = await deployProxy(
    deployer,
    proxyContractName,
    implementationContractName,
    initializeParams,
  );

  console.log(``);
  console.log(``);
  console.log(``);
  console.log(`**************************************************************`);
  console.log(`**************************************************************`);
  console.log(`**************************************************************`);
  console.log(`********** Add reward and transfer ownership **********`);

  const proxy = await ethers.getContractAt(
    implementationContractName,
    proxyDeploy.proxyAddress,
  );

  await proxy.addRewardForDlps({ value: addRewardToDlpAmount });
  await proxy.transferOwnership(ownerAddress);

  await verifyProxy(
    proxyDeploy.proxyAddress,
    proxyDeploy.implementationAddress,
    proxyDeploy.initializeData,
    proxyContractPath,
  );

  return;
};

export default func;
func.tags = ["DLPRootDeploy"];
