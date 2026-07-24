// -----------------------------------------------------------------------------
// Deployment script for the SupplyChainRegistry contract.
//
// Usage:
//   Local  : npx hardhat run scripts/deploy.js --network hardhat
//   Sepolia: npx hardhat run scripts/deploy.js --network sepolia
//
// (Convenience npm scripts are defined in package.json: deploy:local / deploy:sepolia.)
//
// The script:
//   1. Reads the deploying account from the configured network.
//   2. Deploys the SupplyChainRegistry contract (the deployer becomes admin).
//   3. Waits for the deployment transaction to be mined.
//   4. Prints the deployed address and a ready-to-run Etherscan verify command.
// -----------------------------------------------------------------------------

const { ethers, network } = require("hardhat");

async function main() {
  // The first signer is the account derived from PRIVATE_KEY (on Sepolia) or a
  // built-in test account (on the local Hardhat network). This account pays gas
  // and, per the constructor, becomes the contract's admin.
  const [deployer] = await ethers.getSigners();

  console.log("-----------------------------------------------------------");
  console.log("Deploying SupplyChainRegistry");
  console.log("-----------------------------------------------------------");
  console.log("Network :", network.name);
  console.log("Deployer:", deployer.address);

  // Report the deployer's balance so it is obvious before a real (Sepolia) run
  // whether the wallet holds enough test ETH to cover gas.
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance :", ethers.formatEther(balance), "ETH");
  console.log("-----------------------------------------------------------");

  // Compile-and-deploy. getContractFactory loads the compiled artifact.
  const Factory = await ethers.getContractFactory("SupplyChainRegistry");
  const registry = await Factory.deploy();

  // Wait until the contract is actually mined and has a permanent address.
  await registry.waitForDeployment();

  const address = await registry.getAddress();

  console.log("SupplyChainRegistry deployed to:", address);
  console.log("Admin (deployer)               :", deployer.address);
  console.log("-----------------------------------------------------------");

  // For public testnets, print the exact command to verify the source on
  // Etherscan. The constructor takes no arguments, so none are needed here.
  if (network.name === "sepolia") {
    console.log("Next step — verify the source on Etherscan:");
    console.log(`  npx hardhat verify --network sepolia ${address}`);
    console.log("View on Etherscan:");
    console.log(`  https://sepolia.etherscan.io/address/${address}`);
    console.log("-----------------------------------------------------------");
  }
}

// Recommended Hardhat pattern: run main() and surface any error with a non-zero
// exit code so CI / the shell knows the deployment failed.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
