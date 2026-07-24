require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Environment variables loaded from .env (see .env.example for the template).
// Values default to safe placeholders so `hardhat compile` works without a .env file.
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      // The optimizer reduces gas cost of deployed bytecode.
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Local in-process network used for fast automated testing.
    hardhat: {
      chainId: 31337,
    },
    // Ethereum Sepolia public testnet.
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  // Used by `hardhat verify` to publish source code to Etherscan.
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
    },
  },
};
