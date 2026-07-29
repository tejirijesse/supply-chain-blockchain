const { ethers, network } = require("hardhat");

const Role = {
  None: 0,
  Manufacturer: 1,
  Distributor: 2,
  Retailer: 3,
};

function readRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function readRole() {
  const raw = process.env.PARTICIPANT_ROLE || "Manufacturer";
  const normalized = raw.trim();

  if (Role[normalized] !== undefined) {
    return { label: normalized, value: Role[normalized] };
  }

  const numeric = Number(normalized);
  const match = Object.entries(Role).find(([, value]) => value === numeric);
  if (match && numeric !== Role.None) {
    return { label: match[0], value: numeric };
  }

  throw new Error(
    "PARTICIPANT_ROLE must be Manufacturer, Distributor, Retailer, 1, 2, or 3"
  );
}

async function main() {
  const contractAddress = readRequiredEnv("CONTRACT_ADDRESS");
  const participantAddress = readRequiredEnv("PARTICIPANT_ADDRESS");
  const role = readRole();

  const [admin] = await ethers.getSigners();
  const registry = await ethers.getContractAt(
    "SupplyChainRegistry",
    contractAddress
  );

  console.log("-----------------------------------------------------------");
  console.log("Interacting with SupplyChainRegistry");
  console.log("-----------------------------------------------------------");
  console.log("Network    :", network.name);
  console.log("Contract   :", contractAddress);
  console.log("Admin      :", admin.address);
  console.log("Participant:", participantAddress);
  console.log("Role       :", `${role.label} (${role.value})`);
  console.log("-----------------------------------------------------------");

  const tx = await registry.registerParticipant(participantAddress, role.value);
  console.log("Transaction sent:", tx.hash);

  const receipt = await tx.wait();
  console.log("Transaction mined in block:", receipt.blockNumber);
  console.log("Gas used:", receipt.gasUsed.toString());
  console.log("Recorded role:", (await registry.roles(participantAddress)).toString());
  console.log("-----------------------------------------------------------");

  if (network.name === "sepolia") {
    console.log("View transaction:");
    console.log(`  https://sepolia.etherscan.io/tx/${tx.hash}`);
    console.log("View contract:");
    console.log(`  https://sepolia.etherscan.io/address/${contractAddress}`);
    console.log("-----------------------------------------------------------");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
