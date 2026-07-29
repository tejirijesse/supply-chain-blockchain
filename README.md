# SupplyChainRegistry

**A blockchain-based supply-chain provenance and traceability solution for
Transparency & Trust.**

`SupplyChainRegistry` records product creation, custody transfers, and
authenticity data on Ethereum. The goal is simple: replace unverifiable
"trust me" supply-chain claims with a tamper-evident record that buyers,
auditors, retailers, and regulators can independently inspect.

## Why this matters

Counterfeit products and opaque supply chains create financial loss, safety
risk, and broken trust. Traditional records are usually spread across private
databases controlled by different organizations, which makes history difficult
to verify and easy to dispute.

This project uses a smart contract to provide:

- **Transparent provenance:** anyone can read a product's current state and full
  custody history.
- **Tamper-evident history:** custody records are append-only and lifecycle
  stages can only move forward.
- **Role accountability:** manufacturers, distributors, and retailers can only
  perform actions appropriate to their role.
- **Authenticity checks:** anyone can verify whether an address is the original
  manufacturer of a product.

## Core workflow

```text
Created -> Manufactured -> InTransit -> Delivered -> Sold
```

1. The deploying account becomes `admin`.
2. The admin registers trusted participants:
   `Manufacturer`, `Distributor`, and `Retailer`.
3. A registered manufacturer creates a product.
4. Custody advances one stage at a time:
   manufacturer finishes production, distributor handles transit, retailer
   receives the product and marks it sold.
5. Anyone calls `getProduct`, `getHistory`, or `verifyAuthenticity` to audit the
   result.

## Contract highlights

- Solidity `0.8.24`
- Immutable admin trust anchor
- Role-based access control
- Strict forward-only lifecycle
- Stage-to-role custody validation
- Clear revert messages for invalid actions
- Events for participant registration, product registration, and custody
  transfers
- Full local test suite and deterministic demo script

## Repository structure

| Path | Purpose |
|------|---------|
| `contracts/SupplyChainRegistry.sol` | Main Solidity smart contract |
| `test/SupplyChainRegistry.test.js` | Automated Hardhat test suite |
| `scripts/deploy.js` | Local/Sepolia deployment script |
| `scripts/demo.js` | End-to-end local demo workflow |
| `docs/PROJECT_REPORT.md` | Full project report |
| `docs/DEPLOYMENT_GUIDE.md` | Setup, testnet deployment, verification guide |
| `docs/TEST_CASES.md` | Expected-vs-actual test case table |
| `docs/PRESENTATION.md` | Slide-by-slide presentation outline |

## Quick start

Use Node.js 22 LTS for the cleanest Hardhat experience:

```bash
nvm use
npm install
npm run compile
npm test
npm run demo:local
```

Expected test result: all tests pass.

## Deployment

For Sepolia deployment, copy `.env.example` to `.env` and provide:

- `SEPOLIA_RPC_URL`
- `PRIVATE_KEY` for a throwaway funded test wallet
- `ETHERSCAN_API_KEY`

Then run:

```bash
npm run deploy:sepolia
npm run verify -- <DEPLOYED_CONTRACT_ADDRESS>
```

See `docs/DEPLOYMENT_GUIDE.md` for the full step-by-step process.

## Assessment checklist

- Application area identified: **Supply Chain Management**
- Personal mission connected: **Transparency & Trust**
- Blockchain suitability explained: immutability, transparency,
  decentralized trust, programmable rules
- Smart contract implemented in Solidity
- Access control, input validation, lifecycle rules, and event logging included
- Automated tests cover happy paths, failure paths, and view functions
- Local deployment and demo scripts provided
- Deployment and presentation documentation included
