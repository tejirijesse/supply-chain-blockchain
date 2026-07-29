# Project Report — A Blockchain-Based Supply Chain Provenance Solution

**Application area:** Supply Chain Management
**Personal mission:** Transparency & Trust
**Solution:** `SupplyChainRegistry` — an Ethereum smart contract for tamper-proof product provenance and traceability
**Network:** Ethereum Sepolia testnet (development & local testing via Hardhat)

---

## Contents

1. Executive summary
2. Problem identification
3. Mission alignment: Transparency & Trust
4. Solution design
5. Smart contract development
6. Implementation
7. Testing
8. Deployment
9. Limitations & future work
10. Conclusion

---

## 1. Executive summary

Counterfeiting and opaque supply chains cost the global economy hundreds of
billions of dollars every year and erode consumer trust. This project delivers a
blockchain-based **product provenance registry** that records every product and
every custody hand-off on a public, tamper-proof ledger.

The core deliverable is `SupplyChainRegistry`, a Solidity smart contract that:

- lets a trusted administrator onboard supply-chain participants
  (manufacturers, distributors, retailers) with role-based permissions;
- lets registered manufacturers create products, seeding a provenance trail;
- moves custody forward through a strict, one-way lifecycle
  (Created → Manufactured → InTransit → Delivered → Sold); and
- lets **anyone** independently audit a product's origin, full chain of custody,
  and authenticity.

The contract is developed and tested with **Hardhat**, covered by **29
automated tests (all passing)**, and is deployable to the **Ethereum Sepolia
testnet** with a single scripted command plus Etherscan source verification.

---

## 2. Problem identification

### 2.1 The problem

Modern supply chains span many independent organisations across many countries.
A product may pass through a manufacturer, one or more distributors, a shipping
network, and a retailer before reaching a consumer. This fragmentation creates
three concrete problems:

1. **Counterfeiting.** Fake goods are injected into the chain and sold as
   genuine. Buyers cannot easily prove that the item they hold really came from
   the manufacturer it claims.
2. **Opacity.** Records of who held a product, and when, are scattered across
   private databases owned by different companies. No single participant — and
   certainly no consumer — can see the whole picture.
3. **Tampering & disputes.** Because each party keeps its own records, those
   records can be altered after the fact. When something goes wrong (a recall, a
   fraud claim, a lost shipment), there is no single source of truth to settle
   the dispute.

### 2.2 Why existing approaches fall short

Traditional centralised databases place trust in whoever controls the database.
That controller can edit or delete history, and outside parties must simply take
their word for it. Paper certificates and barcodes can be copied. None of these
approaches provides an **independently verifiable, tamper-evident** record that
every participant — and the public — can rely on.

### 2.3 Why blockchain fits this problem

A public blockchain provides exactly the properties this problem demands:

- **Immutability** — once written, records cannot be silently altered or
  deleted, so history is tamper-evident.
- **Transparency** — the ledger is publicly readable, so anyone can audit a
  product's provenance without asking permission.
- **Decentralised trust** — no single company owns the record; correctness is
  enforced by the network and by the contract's own rules.
- **Programmable rules** — a smart contract encodes *who* may do *what*
  (e.g. only manufacturers may create products), enforced automatically.

---

## 3. Mission alignment: Transparency & Trust

My personal mission is **Transparency & Trust** — using technology to fight
fraud and opacity by making important records verifiable and tamper-proof.

Supply chain provenance is a direct expression of that mission:

| Mission principle | How the solution delivers it |
|---|---|
| **Transparency** | Every product and every custody transfer is stored on a public ledger and emitted as an event; anyone can read the full history with no special access. |
| **Trust through verifiability** | Buyers do not have to *trust* a seller's claim — they can *verify* it on-chain via `verifyAuthenticity` and `getHistory`. |
| **Tamper-resistance** | History is append-only; the lifecycle can only move forward, so records cannot be rewritten to hide a step. |
| **Accountability** | Role-based access control ties every action to a known, authorised address, so responsibility is traceable. |

The result turns "trust me" into "check for yourself" — the essence of the
mission.

---

## 4. Solution design

### 4.1 Actors

| Actor | Role in the system | On-chain permission |
|---|---|---|
| **Admin** | The deploying organisation / consortium operator. Onboards and removes participants. | `admin` (set once at deployment) |
| **Manufacturer** | Produces goods and creates their on-chain records. | `Role.Manufacturer` |
| **Distributor** | Moves goods between manufacturer and retailer. | `Role.Distributor` |
| **Retailer** | Receives goods and sells to the end customer. | `Role.Retailer` |
| **Consumer / Auditor** | Anyone verifying a product. | none required (read-only) |

### 4.2 Core data model

- **Product** — id, name, free-form details, manufacturer address, current
  holder, current lifecycle stage, creation timestamp, and an `exists` guard
  flag.
- **CustodyRecord** — holder address, lifecycle stage, and timestamp. A product
  owns an ordered list of these records, forming its provenance trail.

### 4.3 Lifecycle model

Products advance through five stages, **forward only**:

```
Created → Manufactured → InTransit → Delivered → Sold
   0            1             2           3         4
```

`Sold` is terminal. Because each transfer must advance the stage by exactly one
and can never move backward, the recorded history is naturally append-only and
tamper-evident.

### 4.4 Design principles

- **Least privilege** — actions are gated to the narrowest role that should be
  able to perform them (only the admin manages participants; only manufacturers
  create products; only the current holder can transfer custody).
- **Business-rule integrity** — each lifecycle stage must be held by the role
  expected in the real supply chain: manufacturer for production, distributor
  for transit, and retailer for delivery/sale.
- **Fail-fast validation** — every state-changing function validates its inputs
  and reverts with a clear message rather than proceeding on bad data.
- **Auditability first** — every state change emits an event, giving off-chain
  systems (dApps, indexers) a reliable feed of the audit trail.
- **Simplicity** — the contract deliberately keeps a small, readable surface so
  it is easy to reason about and to verify.

---

## 5. Smart contract development

The contract, `contracts/SupplyChainRegistry.sol`, is written in **Solidity
0.8.24**. Solidity ≥0.8 provides built-in overflow/underflow checks, removing a
whole class of arithmetic bugs.

### 5.1 Roles and access control

```solidity
enum Role { None, Manufacturer, Distributor, Retailer }

modifier onlyAdmin() {
    require(msg.sender == admin, "Not authorized: admin only");
    _;
}

modifier onlyRole(Role required) {
    require(roles[msg.sender] == required, "Not authorized: wrong role");
    _;
}
```

`Role.None` (the default, `0`) means "not a participant", so an address must be
explicitly registered before it can act. The `admin` is stored as `immutable`,
set once in the constructor — it cannot be changed after deployment, which keeps
the trust anchor fixed and saves gas.

### 5.2 Participant management (admin only)

`registerParticipant(address, Role)` grants a role (rejecting the zero address
and `Role.None`); `removeParticipant(address)` revokes it. Both emit events
(`ParticipantRegistered`, `ParticipantRemoved`).

### 5.3 Product registration (manufacturers only)

```solidity
function registerProduct(string calldata name, string calldata details)
    external
    onlyRole(Role.Manufacturer)
    returns (uint256 productId)
{
    require(bytes(name).length > 0, "Name required");
    productId = ++productCount;          // ids start at 1
    products[productId] = Product({ ... stage: Stage.Created, exists: true });
    history[productId].push(CustodyRecord({ holder: msg.sender,
                                            stage: Stage.Created,
                                            timestamp: block.timestamp }));
    emit ProductRegistered(productId, name, msg.sender);
}
```

Each product gets a unique, sequential id and its provenance trail is **seeded**
with the manufacturer's initial custody, so the trail is complete from the very
first record.

### 5.4 Custody transfer (current holder only)

```solidity
function transferCustody(uint256 productId, address to, Stage newStage)
    external
    productExists(productId)
{
    Product storage p = products[productId];
    require(msg.sender == p.currentHolder, "Only current holder");
    require(to != address(0), "Zero address");
    require(roles[to] != Role.None, "Recipient not a participant");
    require(p.stage != Stage.Sold, "Product already sold");
    require(uint8(newStage) == uint8(p.stage) + 1, "Stage must advance by one");
    require(roles[to] == expectedRoleForStage(newStage),
            "Recipient role does not match stage");
    ...
    emit CustodyTransferred(productId, from, to, newStage);
}
```

This single function enforces the entire integrity model: only the holder can
move a product; the recipient must be a registered participant; a sold product
is frozen; and the stage can only advance by exactly one step — no skipping and
no going backward. The recipient must also have the role expected for the new
stage, so a distributor cannot mark an item manufactured and a retailer cannot
receive a product while it is still in transit.

### 5.5 Views & verification (open to everyone)

- `getProduct(id)` — full current product data.
- `getHistory(id)` — the complete, ordered provenance trail.
- `getHistoryLength(id)` — number of custody records.
- `verifyAuthenticity(id, claimedManufacturer)` — returns `true` only if the
  address really registered the product. This is the buyer-facing "is it
  genuine?" check.

All views are guarded by `productExists`, so queries on unknown ids revert
clearly rather than returning misleading empty data.

### 5.6 Security measures summary

| Measure | Purpose |
|---|---|
| Role-based access control (`onlyAdmin`, `onlyRole`) | Prevents unauthorised actions. |
| `immutable admin` | Fixes the trust anchor; cannot be hijacked post-deploy. |
| `productExists` guard | Blocks operations on non-existent products. |
| Forward-only stage check | Makes history append-only / tamper-evident. |
| Stage-to-role validation | Preserves real-world custody semantics at each lifecycle step. |
| "Current holder only" transfer rule | Prevents third parties from moving goods they don't hold. |
| Zero-address & empty-input checks | Reject malformed or accidental input. |
| Solidity 0.8 checked arithmetic | Eliminates overflow/underflow bugs. |
| Events on every state change | Provides a reliable, auditable off-chain feed. |

---

## 6. Implementation

### 6.1 Tooling

The project is built with **Hardhat**, the industry-standard Ethereum
development environment:

- `contracts/SupplyChainRegistry.sol` — the contract.
- `test/SupplyChainRegistry.test.js` — the automated test suite (Chai + Mocha +
  ethers.js v6).
- `scripts/deploy.js` — the deployment script.
- `hardhat.config.js` — compiler (Solidity 0.8.24, optimizer on, 200 runs) and
  network configuration (local Hardhat network + Sepolia) and Etherscan
  verification settings.
- `.env` (from `.env.example`) — holds the Sepolia RPC URL, deployer private
  key, and Etherscan API key; excluded from Git via `.gitignore`.

### 6.2 Configuration highlights

- The **optimizer** is enabled (200 runs) to reduce deployment and runtime gas.
- Environment variables are read with safe defaults so `compile` and local
  tests work even without a `.env` file — only the live Sepolia steps require
  secrets.
- Secrets are never committed: `.gitignore` excludes `.env`, `node_modules/`,
  and build artefacts.

### 6.3 Typical interaction flow

1. **Admin** registers a manufacturer, distributor, and retailer.
2. **Manufacturer** registers a product → receives `productId`, trail seeded at
   `Created`.
3. **Holder** transfers custody forward one stage at a time
   (Created → Manufactured → InTransit → Delivered → Sold).
4. **Anyone** calls `getProduct`, `getHistory`, or `verifyAuthenticity` to audit
   the product independently.

---

## 7. Testing

### 7.1 Approach

Testing uses Hardhat with Chai assertions and ethers.js. Reusable **fixtures**
(`loadFixture`) give each test a clean, deterministic starting state:

- `deployFixture` — fresh contract + labelled signers (admin, manufacturer,
  distributor, retailer, outsider).
- `registeredFixture` — participants pre-registered.
- `productFixture` — one product ("Organic Coffee") already registered.

The suite covers both the **happy path** (correct behaviour) and the
**negative path** (every guard clause reverts as intended), plus event emission
and full end-to-end lifecycle.

### 7.2 Results

**All 29 tests pass.** The suite spans five areas: Deployment, Participant
management, Product registration, Custody transfer, and Views & verification.
See `docs/TEST_CASES.md` for the full case-by-case table of inputs, expected
results, and actual results.

```
  29 passing
```

Representative cases:

- ✔ sets the deployer as admin
- ✔ reverts when a non-admin tries to register a participant
- ✔ lets a manufacturer register a product and emits an event
- ✔ supports the full lifecycle to Sold
- ✔ reverts when skipping a stage / moving a stage backward
- ✔ reverts when a recipient's role does not match the requested stage
- ✔ reverts when transferring a product that is already Sold
- ✔ verifyAuthenticity returns true for the real manufacturer / false for an impostor

### 7.3 Local deployment verification

The deploy script was run end-to-end against Hardhat's in-memory network to
confirm it works before any real testnet spend:

```
Network : hardhat
Deployer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Balance : 10000.0 ETH
SupplyChainRegistry deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
Admin (deployer)               : 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

---

## 8. Deployment

Deployment to the **Ethereum Sepolia testnet** is fully scripted and documented
step-by-step in `docs/DEPLOYMENT_GUIDE.md`. In summary:

1. Install dependencies (`npm install`).
2. Provide a Sepolia RPC URL (Infura/Alchemy), a funded throwaway wallet key,
   and an Etherscan API key in `.env`.
3. `npx hardhat compile` → `npx hardhat test` (29 passing).
4. `npx hardhat run scripts/deploy.js --network sepolia` → prints the live
   contract address.
5. `npx hardhat verify --network sepolia <ADDRESS>` → publishes the source on
   Etherscan so it is publicly auditable — the ultimate expression of the
   Transparency & Trust mission.

Once verified, the contract can be read and exercised directly from Etherscan's
Read/Write Contract tabs or from any dApp using ethers.js.

---

## 9. Limitations & future work

This solution is an intentionally focused foundation. Honest limitations and
natural extensions:

- **Physical–digital binding.** Like all provenance systems, the chain trusts
  that the right physical item is scanned at each step. Pairing each product with
  a tamper-evident QR/NFC tag would strengthen this link.
- **Single admin and role mutation.** Participant management is centralised in
  one admin address, and the admin can change a participant's role by calling
  `registerParticipant` again. This is acceptable for a prototype because it
  keeps governance simple, but production should require a multi-signature admin,
  role-change events/reason codes, and possibly timelocks so role changes are
  auditable before they affect custody.
- **Revocation after custody.** Removing a participant prevents future actions,
  but it does not erase historical custody records. That is intentional: past
  provenance must remain immutable. A production dApp should display revoked
  status alongside historical holders so an auditor can distinguish "held at the
  time" from "still trusted today".
- **Linear custody.** The lifecycle is a single forward chain. Real supply chains
  can branch (batches split, components assembled); a future version could model
  splits and merges.
- **Role granularity.** Roles are fixed at three types; a production system might
  support finer-grained or multi-role participants.
- **Off-chain data.** Large metadata (certificates, images) is best stored
  off-chain (e.g. IPFS) with only a content hash on-chain to keep gas low.

None of these limitations undermine the core guarantee the contract already
provides: a tamper-evident, publicly verifiable record of product origin and
custody.

---

## 10. Conclusion

`SupplyChainRegistry` demonstrates how a compact, well-secured Ethereum smart
contract can address a real and costly problem — counterfeiting and supply-chain
opacity — directly in service of a **Transparency & Trust** mission. By recording
provenance immutably, enforcing least-privilege access, and exposing open
verification functions, the solution replaces "trust the seller" with "verify on
the ledger". It is fully implemented, comprehensively tested (29 passing tests),
and ready to deploy and verify on the Ethereum Sepolia testnet.
