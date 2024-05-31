import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import '@openzeppelin/hardhat-upgrades';
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
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      // forking: {
      //   url: 'http://34.31.42.200:8545',
      //   chainId: 14801,
      //   blockNumber: 10,
      //   accounts:
      //     process.env.DEPLOYER_PRIVATE_KEY !== undefined ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      // }
      // forking: {
      //   url: 'https://base-sepolia.core.chainstack.com/c6956d7539bbd8e158e7d62c1e194821',
      //   accounts:
      //     process.env.DEPLOYER_PRIVATE_KEY !== undefined ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      // }
    },
    base: {
      url: process.env.BASE_URL || "",
      accounts:
        process.env.DEPLOYER_PRIVATE_KEY !== undefined ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_URL || "",
      accounts:
        process.env.DEPLOYER_PRIVATE_KEY !== undefined ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    vanaTestnet: {
      url: process.env.VANA_TESTNET_URL || "",
      // chainId: 19311041,
      accounts:
        process.env.DEPLOYER_PRIVATE_KEY !== undefined ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      base: process.env.BASESCAN_APY_KEY || '',
      baseSepolia: process.env.BASESCAN_APY_KEY || ''
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: process.env.BASE_API_URL || "",
          browserURL: process.env.BASE_BROWSER_URL || ""
        }
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: process.env.BASE_SEPOLIA_API_URL || "",
          browserURL: process.env.BASE_SEPOLIA_BROWSER_URL || ""
        }
      },
      {
        network: "vanaTestnet",
        urls: {
          apiURL: process.env.VANA_TESTNET_API_URL || "",
          browserURL: process.env.VANA_TESTNET_BROWSER_URL || ""
        }
      },
      {
        network: "satori",
        urls: {
          apiURL: process.env.SATORI_API_URL || "",
          browserURL: process.env.SATORI_BROWSER_URL || ""
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 40000
  },
  gasReporter: {
    enabled: true,
    excludeContracts: ["mocks", "tests"],
    include: ["../node_module/@openzeppelin/contracts-upgradeable"]
  },
  sourcify: {
    enabled: true
  }
}


export default config;
