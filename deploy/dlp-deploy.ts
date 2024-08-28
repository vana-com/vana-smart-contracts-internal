import { deployments, ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployProxy, verifyProxy } from "./helpers";
import { parseEther } from "../utils/helpers";

const implementationContractName = "DataLiquidityPoolImplementation";
const proxyContractName = "DataLiquidityPoolProxy";
const proxyContractPath =
  "contracts/dlpLight/DataLiquidityPoolProxy.sol:DataLiquidityPoolProxy";

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
  console.log(`********** Deploying DAT **********`);

  const tokenDeploy = await deployments.deploy(tokenContractName, {
    from: deployer.address,
    args: [tokenName, tokenSymbol, deployer.address],
    log: true,
  });

  const token = await ethers.getContractAt("DAT", tokenDeploy.address);
  const dataRegistry = await ethers.getContractAt(
    "DataRegistryImplementation",
    (await deployments.get("DataRegistryProxy")).address,
  );

  const params = {
    ownerAddress: ownerAddress,
    name: "DLP Name",
    dataRegistryAddress: dataRegistry.target,
    tokenAddress: token.target,
    masterKey: "masterKey",
    fileRewardFactor: parseEther(10),
  };

  const initializeParams = [
    params.ownerAddress,
    params.name,
    params.dataRegistryAddress,
    params.tokenAddress,
    params.masterKey,
    params.fileRewardFactor,
  ];

  const proxyDeploy = await deployProxy(
    deployer,
    proxyContractName,
    implementationContractName,
    [initializeParams],
  );

  const dlpLight = await ethers.getContractAt(
    implementationContractName,
    proxyDeploy.proxyAddress,
  );

  await token.connect(deployer).mint(deployer, parseEther(100000000));
  await token.connect(deployer).approve(dlpLight, parseEther(1000000));
  await dlpLight
    .connect(deployer)
    .addRewardsForContributors(parseEther(1000000));

  await verifyProxy(
    proxyDeploy.proxyAddress,
    proxyDeploy.implementationAddress,
    proxyDeploy.initializeData,
    proxyContractPath,
  );

  return;
};

export default func;
func.tags = ["DLPLightDeploy"];
