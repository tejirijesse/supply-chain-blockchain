# Presentation — SupplyChainRegistry

A slide-by-slide summary of the blockchain-based solution. Each `---` marks a
new slide. Speaker notes appear under **Notes:** for the oral assessment.

> Render tip: paste into any Markdown-slide tool (Marp, reveal.js, Slidev) or
> present directly from this file. Slides are ordered for a ~8–10 minute talk.

---

## Slide 1 — Title

# SupplyChainRegistry
### A Blockchain Solution for Transparency & Trust in Supply Chains

Ethereum · Solidity 0.8.24 · Hardhat · Sepolia Testnet

**Notes:** Introduce the project in one line — an on-chain provenance registry
that lets anyone independently verify who made a product and everyone who has
held it, fighting counterfeiting and opaque supply chains.

---

## Slide 2 — Personal Mission

### Mission: Transparency & Trust

- Fight fraud, counterfeiting, and opaque record-keeping.
- Replace "trust me" with **verifiable, tamper-proof** records.
- Anyone — buyer, auditor, regulator — can check the truth for themselves.

**Notes:** The whole design decision flows from this mission: put the record
where no single party can silently rewrite it.

---

## Slide 3 — The Problem

### Counterfeiting & opaque supply chains

- Global counterfeiting costs hundreds of billions annually and endangers
  consumers (fake medicine, food, parts).
- Traditional supply-chain records are **siloed and editable** — each company
  keeps its own database; provenance claims can't be independently verified.
- Buyers have **no reliable way** to confirm a product's origin or chain of
  custody.

**Notes:** Frame it concretely — a shopper holding a "premium" coffee bag has
no way to know it's authentic or where it's really been.

---

## Slide 4 — Why Blockchain

### The right tool for the problem

| Requirement | How blockchain delivers |
|-------------|-------------------------|
| Tamper-proof history | Append-only ledger; records can't be silently changed |
| Independent verification | Public, auditable state anyone can read |
| No single trusted owner | Shared source of truth across participants |
| Automatic audit trail | Events emitted on every state change |

**Notes:** These four properties map one-to-one onto the mission. A private
database fails every row.

---

## Slide 5 — Application Area

### Supply Chain — product provenance & traceability

Track a physical product from creation to sale:

**Created → Manufactured → InTransit → Delivered → Sold**

Each step records **who** holds custody and **when**, building an immutable
provenance trail.

**Notes:** Chose supply chain because provenance is the clearest, most tangible
demonstration of "transparency & trust" — and it maps cleanly to on-chain logic.

---

## Slide 6 — Solution Design: Actors & Roles

### Role-based access control

| Role | Who | Can do |
|------|-----|--------|
| **Admin** | Deployer | Register / remove participants |
| **Manufacturer** | Producer | Register new products |
| **Distributor** | Logistics | Receive & forward custody |
| **Retailer** | Seller | Receive custody, mark Sold |

`enum Role { None, Manufacturer, Distributor, Retailer }`

**Notes:** The deployer becomes admin in the constructor. Only the admin
onboards trusted participants — this gates every sensitive action.

---

## Slide 7 — Solution Design: Data Model

### What we store on-chain

- **Product** — id, name, details, manufacturer, currentHolder, stage,
  createdAt, exists.
- **CustodyRecord** — holder, stage, timestamp (one per hand-off).
- Mappings: `roles`, `products`, and `history[productId]` (the provenance
  trail).

**Notes:** `history` is the heart of the mission — an ordered, append-only list
of every custody event for a product.

---

## Slide 8 — Core Logic

### Three actions, strictly guarded

1. `registerParticipant(addr, role)` — admin onboards participants.
2. `registerProduct(name, details)` — manufacturer mints a product (id starts
   at 1) and seeds its history.
3. `transferCustody(productId, to, newStage)` — current holder advances the
   product **exactly one** stage and hands off custody.

Plus read-only: `getProduct`, `getHistory`, `verifyAuthenticity`.

**Notes:** Note the forward-only rule — `uint8(newStage) == uint8(stage) + 1`.
No skipping, no rewinding, no re-selling.

---

## Slide 9 — Security Measures

### Defence built into the contract

| Guard | Enforces |
|-------|----------|
| `onlyAdmin` | Only deployer manages participants |
| `onlyRole(Manufacturer)` | Only manufacturers create products |
| `productExists` | No actions on unknown products |
| "Only current holder" | Custody can't be hijacked |
| "Stage must advance by one" | Lifecycle can't be skipped or reversed |
| "Product already sold" | Terminal state is final |
| Zero-address & empty-name checks | Reject invalid input |

**Notes:** Every state-changing function validates caller, inputs, and state
before writing — best-practice checks-then-effects ordering.

---

## Slide 10 — Implementation & Tooling

### Built with the standard Ethereum stack

- **Solidity 0.8.24** — built-in overflow checks; optimizer on (runs: 200).
- **Hardhat** — compile, test, deploy, verify.
- **ethers.js v6** + **Chai/Mocha** for tests.
- **Sepolia** testnet target; **Etherscan** source verification.
- Secrets via `.env` (git-ignored); `.env.example` documents required keys.

**Notes:** Everything runs from the CLI — `npm run compile`, `npm test`,
`npm run deploy:sepolia`, `npm run verify`.

---

## Slide 11 — Testing

### 29 automated tests — all passing

| Area | Cases | Result |
|------|-------|--------|
| Deployment / initial state | 2 | ✔ |
| Participant management | 7 | ✔ |
| Product registration | 6 | ✔ |
| Custody transfer (lifecycle + guards) | 11 | ✔ |
| Views & authenticity | 3 | ✔ |
| **Total** | **29** | **✔ 29 passing** |

Every happy path **and** every guard clause is exercised.

**Notes:** Fixtures (`loadFixture`) give each test a clean state. Full
expected-vs-actual mapping is in `docs/TEST_CASES.md`.

---

## Slide 12 — Deployment Workflow

### From code to verified on-chain contract

1. `npm install` → `npx hardhat compile`
2. `npx hardhat test` → **29 passing**
3. Local demo: `npm run demo:local`
4. Local deploy dry-run: `hardhat run scripts/deploy.js --network hardhat`
5. Fund throwaway wallet from a Sepolia faucet
6. `hardhat run scripts/deploy.js --network sepolia`
7. `hardhat verify --network sepolia <ADDRESS>` → public, auditable source

**Notes:** The deploy script prints the deployer, balance, deployed address, and
a ready-to-run verify command. Full guide in `docs/DEPLOYMENT_GUIDE.md`.

---

## Slide 13 — Demo Flow

### Proving transparency end-to-end

1. **Admin** registers a manufacturer, distributor, retailer.
2. **Manufacturer** registers "Organic Coffee" / "Batch #A1" → product id 1.
3. Custody moves Created → Manufactured → InTransit → Delivered → Sold, with
   each stage held by the correct participant role.
4. **Anyone** calls `getHistory(1)` to see the full trail, and
   `verifyAuthenticity(1, manufacturer)` → **true**; an impostor → **false**.

**Notes:** This is the live story for the oral assessment — show the history
grow and the authenticity check succeed, then fail for a fake.

---

## Slide 14 — Results & Impact

### Mission delivered

- ✅ Tamper-proof, append-only provenance for every product.
- ✅ Independent, public authenticity verification.
- ✅ Role-gated actions — no unauthorized writes.
- ✅ Stage-to-role validation for realistic custody semantics.
- ✅ Fully tested (29/29) and deployable to a live testnet.

**Transparency & Trust — enforced by code, not by promises.**

**Notes:** Tie back to slide 2: each mission goal now has a concrete on-chain
mechanism behind it.

---

## Slide 15 — Limitations & Future Work

### Honest scope + next steps

- **On/off-chain link:** on-chain proves the record, not the physical item —
  pair with tamper-evident QR/NFC tags.
- **Admin centralisation:** single admin onboards participants — could move to
  multi-sig / DAO governance.
- **Branching custody:** current model is linear — extend for splits/recalls.
- **Privacy:** all data is public — add commitments/ZK for sensitive fields.

**Notes:** Showing the limits demonstrates engineering maturity and points to a
credible roadmap.

---

## Slide 16 — Summary & Deliverables

### What's in the submission

- **Contract:** `contracts/SupplyChainRegistry.sol` (commented, secured).
- **Tests:** `test/SupplyChainRegistry.test.js` — 29 passing.
- **Demo/Deploy:** `scripts/demo.js` and `scripts/deploy.js`.
- **Docs:** Project Report, Deployment Guide, Test Cases, this Presentation.

**Thank you — questions welcome.**

**Notes:** Close by restating the one-liner: a public, tamper-proof registry
that lets anyone verify a product's origin and journey — transparency and trust,
enforced on-chain.
