import { ethers, upgrades } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "ethers";
import { env } from "process";
import { getCurrentBlockNumber } from "../utils/timeAndBlockManipulation";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const [deployer] = await ethers.getSigners();

    const gasPrice = ethers.parseUnits("20", "gwei");
    const deployOptions = {
        gasLimit: 5000000,
        gasPrice: gasPrice
    };

    console.log(`Using gas price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);

    const dlpName = process.env.DLP_NAME ?? "Custom Data Liquidity Pool";
    const ownerAddress = process.env.OWNER_ADDRESS ?? deployer.address;

    const tokenName = process.env.DLP_TOKEN_NAME ?? "Custom Data Autonomy Token";
    const tokenSymbol = process.env.DLP_TOKEN_SYMBOL ?? "CUSTOMDAT";

    console.log("Deploying DLPT...");
    const dlptDeploy = await ethers.deployContract("DLPT", [tokenName, tokenSymbol, deployer], deployOptions);
    await dlptDeploy.waitForDeployment();
    const dlpt = await ethers.getContractAt("DLPT", await dlptDeploy.getAddress());

    console.log("DataLiquidityPoolToken deployed at:", await dlpt.getAddress());

    const maxNumberOfValidators = 3;
    const validatorScoreMinTrust = parseEther('0.1');
    const validatorScoreKappa = parseEther('0.5');
    const validatorScoreRho = parseEther('1');
    const validationPeriod = 120;
    const rewardPeriodSize = 1800;
    const minStakeAmount  = parseEther('7');
    const startBlock: number = await getCurrentBlockNumber();
    const rewardAmount = parseEther('10');
    const fileRewardFactor = parseEther('5');
    const fileRewardDelay = 3600 * 24 * 3;

    console.log("Deploying DataLiquidityPool...");
    const dlpDeploy = await upgrades.deployProxy(
        await ethers.getContractFactory("DataLiquidityPool"),
        [{
            name: dlpName,
            ownerAddress: deployer.address,
            tokenAddress: await dlpt.getAddress(),
            newMaxNumberOfValidators: maxNumberOfValidators,
            newValidatorScoreMinTrust: validatorScoreMinTrust,
            newValidatorScoreKappa: validatorScoreKappa,
            newValidatorScoreRho: validatorScoreRho,
            newValidationPeriod: validationPeriod,
            newMinStakeAmount: minStakeAmount,
            startBlock: startBlock,
            newEpochSize: rewardPeriodSize,
            newEpochRewardAmount: rewardAmount,
            newFileRewardFactor: fileRewardFactor,
            newFileRewardDelay: fileRewardDelay
        }],
        {
            kind: "uups",
            ...deployOptions
        }
    );
    await dlpDeploy.waitForDeployment();
    const dlp = await ethers.getContractAt("DataLiquidityPool", await dlpDeploy.getAddress());

    console.log(`DataLiquidityPool "${dlpName}" deployed at:`, await dlp.getAddress());

    console.log("Waiting for 10 seconds before continuing...");
    await new Promise((resolve) => setTimeout(resolve, 10000));

    console.log("Minting tokens...");
    const mintTx = await dlpt.connect(deployer).mint(deployer.address, parseEther('10000000'), deployOptions);
    await mintTx.wait();

    console.log("Approving tokens...");
    const approveTx = await dlpt.connect(deployer).approve(await dlp.getAddress(), parseEther('3000000'), deployOptions);
    await approveTx.wait();

	console.log("Updating file reward delay...");
	const updateFileRewardDelayTx = await dlp.connect(deployer).updateFileRewardDelay(0, deployOptions);
	await updateFileRewardDelayTx.wait();


    console.log("Adding rewards for validators...");
    const addValidatorRewardTx = await dlp.connect(deployer).addRewardForValidators(parseEther('2000000'), deployOptions);
    await addValidatorRewardTx.wait();

    console.log("Adding rewards for contributors...");
    const addContributorRewardTx = await dlp.connect(deployer).addRewardsForContributors(parseEther('1000000'), deployOptions);
    await addContributorRewardTx.wait();

	console.log("Transferring tokens to owner...");
    const transferTx = await dlpt.connect(deployer).transfer(ownerAddress, parseEther('7000000'), deployOptions);
    await transferTx.wait();

    console.log("Transferring DLPT ownership...");
    const transferDlptOwnershipTx = await dlpt.transferOwnership(ownerAddress, deployOptions);
    await transferDlptOwnershipTx.wait();

    console.log("Transferring DLP ownership...");
    const transferDlpOwnershipTx = await dlp.transferOwnership(ownerAddress, deployOptions);
    await transferDlpOwnershipTx.wait();

    console.log("Deployment and setup completed successfully!");
};

export default func;
func.tags = ["DLPDeploy"];
