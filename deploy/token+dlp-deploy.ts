import { deployments, ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "ethers";
import { getCurrentBlockNumber } from "../utils/timeAndBlockManipulation";
import { deployProxy, verifyContract, verifyProxy } from "./helpers";

const implementationContractName = "DataLiquidityPoolImplementation";
const proxyContractName = "DataLiquidityPoolProxy";
const proxyContractPath =
  "contracts/dlp/DataLiquidityPoolProxy.sol:DataLiquidityPoolProxy";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const [deployer] = await ethers.getSigners();

  const ownerAddress = process.env.OWNER_ADDRESS ?? deployer.address;

  const tokenContractName = "DAT";
  const tokenName = process.env.DLP_TOKEN_NAME ?? "Custom Data Autonomy Token";
  const tokenSymbol = process.env.DLP_TOKEN_SYMBOL ?? "CUSTOMDAT";

  console.log(``);
  console.log(``);
  console.log(``);
  console.log(`**************************************************************`);
  console.log(`**************************************************************`);
  console.log(`**************************************************************`);
  console.log(`********** Deploying ${tokenContractName} **********`);

  const tokenDeploy = await deployments.deploy(tokenContractName, {
    from: deployer.address,
    args: [tokenName, tokenSymbol, deployer.address],
    log: true,
  });

  await verifyContract(tokenDeploy.address, [
    tokenName,
    tokenSymbol,
    deployer.address,
  ]);

  const initializeParams = [
    {
      name: process.env.DLP_NAME ?? "Custom Data Liquidity Pool",
      ownerAddress: deployer.address,
      tokenAddress: tokenDeploy.address,
      newMaxNumberOfValidators: 3,
      newValidatorScoreMinTrust: parseEther("0.1"),
      newValidatorScoreKappa: parseEther("0.5"),
      newValidatorScoreRho: parseEther("1"),
      newValidationPeriod: 120,
      newMinStakeAmount: parseEther("7"),
      startBlock: await getCurrentBlockNumber(),
      newEpochSize: 1800,
      newEpochRewardAmount: parseEther("10"),
      newFileRewardFactor: parseEther("5"),
      newFileRewardDelay: 0,
    },
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

  const token = await ethers.getContractAt(
    tokenContractName,
    tokenDeploy.address,
  );

  await new Promise((resolve) => setTimeout(resolve, 10000));

  await token.connect(deployer).mint(deployer.address, parseEther("10000000"));

  await token.connect(deployer).approve(proxy, parseEther("3000000"));
  await proxy.connect(deployer).addRewardForValidators(parseEther("2000000"));
  await proxy
    .connect(deployer)
    .addRewardsForContributors(parseEther("1000000"));
  await token.connect(deployer).transfer(ownerAddress, parseEther("7000000"));

  await token.transferOwnership(ownerAddress);
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
func.tags = ["DLPDeploy"];
