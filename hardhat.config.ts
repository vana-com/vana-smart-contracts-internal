import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-deploy";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.24",
};

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    islander: {
      url: process.env.ISLANDER_RPC_URL || "",
      accounts:
        process.env.DEPLOYER_PRIVATE_KEY !== undefined
          ? [process.env.DEPLOYER_PRIVATE_KEY]
          : [],
    },
    moksha: {
      url: process.env.MOKSHA_RPC_URL || "",
      chainId: 14800,
      accounts:
        process.env.DEPLOYER_PRIVATE_KEY !== undefined
          ? [process.env.DEPLOYER_PRIVATE_KEY]
          : [],
    },
    satori: {
      gasPrice: 1000000000, // Adjust the gas price (in wei)
      gas: 5000000, // Optionally adjust the gas limit
      url: process.env.SATORI_RPC_URL || "",
      accounts:
        process.env.DEPLOYER_PRIVATE_KEY !== undefined
          ? [process.env.DEPLOYER_PRIVATE_KEY]
          : [],
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "",
      accounts:
        process.env.DEPLOYER_PRIVATE_KEY !== undefined
          ? [process.env.DEPLOYER_PRIVATE_KEY]
          : [],
    },
  },
  etherscan: {
    apiKey: {
      // Is not required by blockscout. Can be any non-empty string
      islander: "abc",
      satori: "abc",
      moksha: "abc",
    },
    customChains: [
      {
        network: "islander",
        chainId: 1480,
        urls: {
          apiURL: process.env.ISLANDER_API_URL || "",
          browserURL: process.env.ISLANDER_BROWSER_URL || "",
        },
      },
      {
        network: "moksha",
        chainId: 14800,
        urls: {
          apiURL: "https://api.moksha.vanascan.io/api/",
          browserURL: "https://moksha.vanascan.io",
        },
      },
      {
        network: "satori",
        chainId: 14801,
        urls: {
          apiURL: process.env.SATORI_API_URL || "",
          browserURL: process.env.SATORI_BROWSER_URL || "",
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 40000,
  },
  gasReporter: {
    enabled: true,
    excludeContracts: ["mocks", "tests"],
    include: ["../node_module/@openzeppelin/contracts-upgradeable"],
  },
};
export default config;
