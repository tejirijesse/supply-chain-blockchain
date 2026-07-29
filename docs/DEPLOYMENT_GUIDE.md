# Deployment Guide — SupplyChainRegistry

A step-by-step guide to installing, testing, and deploying the
`SupplyChainRegistry` smart contract to the **Ethereum Sepolia testnet** using
Hardhat.

Follow the sections in order. Sections 1–5 are one-time setup; sections 6–9 are
the build/test/deploy workflow you will repeat.

---

## 1. Prerequisites

Install these before you begin:

| Tool | Version | Purpose | Where to get it |
|------|---------|---------|-----------------|
| **Node.js** | 22 LTS (recommended) | Runs Hardhat and npm | https://nodejs.org |
| **npm** | Ships with Node.js | Installs project dependencies | (bundled) |
| **Git** | any recent | Clone / manage the repo | https://git-scm.com |
| **MetaMask** | latest | Provides the deploying wallet + private key | https://metamask.io |

> **Note on Node.js version.** Use the active LTS release pinned in `.nvmrc`
> (`22`) for the cleanest Hardhat experience. Newer current releases
> (e.g. Node 25) print
> `WARNING: You are currently using Node.js vXX, which is not supported by
> Hardhat.` The commands may still run, but a supported LTS version avoids
> avoidable tooling surprises.

Verify your install:

```bash
node --version
npm --version
```

---

## 2. Get the project and install dependencies

From the project root (`supply-chain-blockchain/`):

```bash
# Install all Hardhat + toolbox dependencies listed in package.json
npm install
```

This downloads Hardhat, `@nomicfoundation/hardhat-toolbox` (ethers, Chai,
Mocha, the Etherscan verify plugin, etc.) and `dotenv`. It creates the
`node_modules/` folder (which is git-ignored).

---

## 3. Create your Sepolia RPC endpoint

A deployment needs a JSON-RPC URL that talks to the Sepolia network. Get a free
one from either provider:

- **Infura** — https://infura.io → create a project → copy the Sepolia HTTPS
  endpoint (looks like `https://sepolia.infura.io/v3/YOUR_PROJECT_ID`).
- **Alchemy** — https://alchemy.com → create an app on the Sepolia network →
  copy the HTTPS URL.

Keep this URL handy for the `.env` file in the next step.

---

## 4. Prepare a deploying wallet + test ETH

1. **Use a throwaway wallet.** In MetaMask, create a *new* account dedicated to
   testing. **Never use an account that holds real funds.**
2. **Switch MetaMask to the Sepolia test network** (enable "Show test networks"
   in Settings → Advanced if it is hidden).
3. **Get free Sepolia ETH** from a faucet (you only need a small amount to pay
   gas). Popular options:
   - https://sepoliafaucet.com (Alchemy)
   - https://www.infura.io/faucet/sepolia
   - https://cloud.google.com/application/web3/faucet/ethereum/sepolia
4. **Export the private key** for that throwaway account:
   MetaMask → **Account details** → **Show private key**.
   Copy the key. **Do not add the `0x` prefix** when pasting it into `.env`.

> ⚠️ **Security:** The private key grants full control of the wallet. Only ever
> export a disposable test wallet, and never commit the key to Git. The
> `.gitignore` already excludes `.env` for this reason.

---

## 5. Configure environment variables

Copy the template and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and set the three values:

```dotenv
# JSON-RPC endpoint from step 3
SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/YOUR_PROJECT_ID"

# Private key of the throwaway wallet from step 4 (no "0x" prefix)
PRIVATE_KEY="your_test_wallet_private_key_here"

# Etherscan API key from step 5b below (used to verify the source)
ETHERSCAN_API_KEY="your_etherscan_api_key_here"
```

**5b. Get an Etherscan API key** (needed only for source verification in
section 9): sign in at https://etherscan.io/myapikey and create a free key.

The `.env` file is loaded automatically by `hardhat.config.js`
(via `dotenv`). If you skip `.env`, `npx hardhat compile` and the local
tests still work — only the live Sepolia steps require it.

---

## 6. Compile the contract

```bash
npx hardhat compile
```

Expected: `Compiled 1 Solidity file successfully`. Build artifacts are written
to `artifacts/` and `cache/` (both git-ignored).

---

## 7. Run the automated tests

Confirm the contract behaves correctly before spending any gas:

```bash
npx hardhat test
```

Expected: **29 passing**. See `docs/TEST_CASES.md` for the full list of cases
and their expected/actual results.

---

## 8. Deploy

### 8a. Local dry-run (recommended first)

Deploy to Hardhat's in-memory network to confirm the script works end-to-end.
This costs nothing and needs no `.env`:

```bash
npx hardhat run scripts/deploy.js --network hardhat
```

Expected output (addresses are deterministic on a fresh local chain):

```
-----------------------------------------------------------
Deploying SupplyChainRegistry
-----------------------------------------------------------
Network : hardhat
Deployer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Balance : 10000.0 ETH
-----------------------------------------------------------
SupplyChainRegistry deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
Admin (deployer)               : 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
-----------------------------------------------------------
```

### 8b. Deploy to Sepolia

With `.env` filled in and the wallet funded with test ETH:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

The script prints the live network name, your deployer address and balance,
the **deployed contract address**, and a ready-to-run Etherscan verify command.
**Copy the deployed contract address** — you need it for verification and for
interacting with the contract.

If deployment fails with an "insufficient funds" error, your wallet needs more
Sepolia ETH (repeat step 4).

---

## 9. Verify the source on Etherscan

Publishing the source makes the contract publicly auditable — central to the
"Transparency & Trust" mission. Using the address from step 8b:

```bash
npx hardhat verify --network sepolia <DEPLOYED_CONTRACT_ADDRESS>
```

The constructor takes no arguments, so none are supplied. On success Etherscan
returns a link such as:

```
https://sepolia.etherscan.io/address/<DEPLOYED_CONTRACT_ADDRESS>#code
```

Open it to see the verified source, read the contract, and (via the
**Read/Write Contract** tabs) interact with it directly in the browser.

---

## 10. Post-deployment: exercise the contract

Once deployed and verified, the typical flow to demonstrate the solution:

1. **Admin** calls `registerParticipant(addr, role)` to onboard a manufacturer
   (role `1`), distributor (role `2`), and retailer (role `3`).
2. **Manufacturer** calls `registerProduct(name, details)` — returns a new
   `productId` and seeds the provenance trail.
3. **Current holder** calls `transferCustody(productId, to, newStage)` to move
   the product forward one lifecycle stage at a time
   (Created → Manufactured → InTransit → Delivered → Sold).
4. **Anyone** calls `getProduct`, `getHistory`, or
   `verifyAuthenticity(productId, claimedManufacturer)` to independently audit
   the product's origin and chain of custody.

You can do all of this from the Etherscan **Write Contract** / **Read
Contract** tabs, or from a dApp/script using ethers.js.

For a fast local demonstration without manual contract calls, run:

```bash
npm run demo:local
```

The demo deploys the contract on Hardhat's in-memory network, registers the
three participants, moves an "Organic Coffee" product through the full
lifecycle, prints the provenance trail, and shows authenticity checks returning
`true` for the real manufacturer and `false` for an impostor.

---

## Quick command reference

| Action | Command |
|--------|---------|
| Install dependencies | `npm install` |
| Compile | `npx hardhat compile` |
| Test | `npx hardhat test` |
| Demo (local) | `npm run demo:local` |
| Deploy (local) | `npx hardhat run scripts/deploy.js --network hardhat` |
| Deploy (Sepolia) | `npx hardhat run scripts/deploy.js --network sepolia` |
| Verify (Sepolia) | `npx hardhat verify --network sepolia <ADDRESS>` |

Convenience npm scripts (see `package.json`) wrap the common commands:
`npm run compile`, `npm test`, `npm run deploy:local`, `npm run deploy:sepolia`,
`npm run verify`.

---

## Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| `Node.js vXX ... is not supported` warning | Use Node 22 LTS (`nvm use` reads `.nvmrc`) to silence it. |
| `insufficient funds for gas` on Sepolia | Wallet has no/low test ETH — get more from a faucet (step 4). |
| `invalid private key` / accounts empty | Ensure `PRIVATE_KEY` in `.env` has **no** `0x` prefix and no quotes issues. |
| `SEPOLIA_RPC_URL` errors / timeouts | Check the RPC URL is correct and the provider project is active. |
| Verification fails: "already verified" | The source is already published — open the Etherscan link; nothing to do. |
| Verification fails: bytecode mismatch | Ensure you verify the exact deployed address and haven't recompiled with different settings. |
