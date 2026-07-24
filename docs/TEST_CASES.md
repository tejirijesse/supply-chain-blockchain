# Test Cases — SupplyChainRegistry

This document records the automated test suite for the `SupplyChainRegistry`
contract, mapping every test to its **preconditions / input**, its **expected
result**, and its **actual result**.

- **Framework:** Hardhat + Mocha + Chai (`@nomicfoundation/hardhat-toolbox`,
  ethers.js v6).
- **Source of tests:** `test/SupplyChainRegistry.test.js`.
- **How to run:** `npx hardhat test` (or `npm test`).
- **Overall result:** **28 passing (977 ms).** Every case's actual result
  matches its expected result.

---

## How the tests are structured

The suite uses three Hardhat fixtures (`loadFixture`) so each test starts from a
clean, known state:

| Fixture | Sets up | Used to test |
|---------|---------|--------------|
| `deployFixture` | Deploys the contract; exposes signers `admin`, `manufacturer`, `distributor`, `retailer`, `outsider` | Deployment + access control |
| `registeredFixture` | `deployFixture` + admin registers the manufacturer (role 1), distributor (role 2), retailer (role 3) | Product registration + custody |
| `productFixture` | `registeredFixture` + manufacturer registers product `"Organic Coffee"` / `"Batch #A1"` (id `1`) | Custody transfer + views |

Enum mirrors used in the tests:

- `Role = { None: 0, Manufacturer: 1, Distributor: 2, Retailer: 3 }`
- `Stage = { Created: 0, Manufactured: 1, InTransit: 2, Delivered: 3, Sold: 4 }`

---

## 1. Deployment

| # | Test | Input / Preconditions | Expected result | Actual |
|---|------|-----------------------|-----------------|--------|
| 1 | sets the deployer as admin | Fresh deploy | `admin()` equals the deploying address | ✔ Pass |
| 2 | starts with a product count of zero | Fresh deploy | `productCount()` returns `0` | ✔ Pass |

---

## 2. Participant management

| # | Test | Input / Preconditions | Expected result | Actual |
|---|------|-----------------------|-----------------|--------|
| 3 | lets the admin register a participant and emits an event | admin calls `registerParticipant(manufacturer, Manufacturer)` | `roles(manufacturer) == 1`; emits `ParticipantRegistered(manufacturer, 1)` | ✔ Pass |
| 4 | reverts when a non-admin tries to register a participant | `outsider` calls `registerParticipant(...)` | Reverts with `"Not authorized: admin only"` | ✔ Pass |
| 5 | rejects the zero address | admin calls `registerParticipant(0x0, Manufacturer)` | Reverts with `"Zero address"` | ✔ Pass |
| 6 | rejects the None role | admin calls `registerParticipant(addr, None)` | Reverts with `"Invalid role"` | ✔ Pass |
| 7 | lets the admin remove a participant and emits an event | Participant registered, then admin calls `removeParticipant(addr)` | `roles(addr) == 0`; emits `ParticipantRemoved(addr)` | ✔ Pass |
| 8 | reverts when removing an address that is not a participant | admin calls `removeParticipant(outsider)` | Reverts with `"Not a participant"` | ✔ Pass |
| 9 | reverts when a non-admin tries to remove a participant | `outsider` calls `removeParticipant(addr)` | Reverts with `"Not authorized: admin only"` | ✔ Pass |

---

## 3. Product registration

| # | Test | Input / Preconditions | Expected result | Actual |
|---|------|-----------------------|-----------------|--------|
| 10 | lets a manufacturer register a product and emits an event | manufacturer calls `registerProduct("Organic Coffee", "Batch #A1")` | Returns id `1`; emits `ProductRegistered(1, "Organic Coffee", manufacturer)` | ✔ Pass |
| 11 | stores the product with the correct initial data | After registration | Product has correct `name`, `details`, `manufacturer`, `currentHolder == manufacturer`, `stage == Created`, `exists == true` | ✔ Pass |
| 12 | assigns sequential ids starting at 1 | Two products registered | ids are `1` then `2`; `productCount == 2` | ✔ Pass |
| 13 | reverts when a non-manufacturer tries to register a product | `distributor` (role 2) calls `registerProduct(...)` | Reverts with `"Not authorized: wrong role"` | ✔ Pass |
| 14 | reverts when the product name is empty | manufacturer calls `registerProduct("", "...")` | Reverts with `"Name required"` | ✔ Pass |
| 15 | seeds the provenance trail with the manufacturer's initial custody | After registration | `getHistory(1)` has length `1`; record `{ holder: manufacturer, stage: Created }` | ✔ Pass |

---

## 4. Custody transfer

| # | Test | Input / Preconditions | Expected result | Actual |
|---|------|-----------------------|-----------------|--------|
| 16 | advances the stage by one and moves custody, emitting an event | Holder (manufacturer) calls `transferCustody(1, distributor, Manufactured)` | `currentHolder == distributor`, `stage == Manufactured`; emits `CustodyTransferred(1, manufacturer, distributor, Manufactured)` | ✔ Pass |
| 17 | appends a record to the provenance trail on each transfer | One transfer performed | `getHistory(1)` length grows from `1` to `2`; last record matches new holder/stage | ✔ Pass |
| 18 | supports the full lifecycle to Sold | Sequential transfers Created→Manufactured→InTransit→Delivered→Sold | Each step succeeds; final `stage == Sold`; history length `5` | ✔ Pass |
| 19 | reverts when a non-holder tries to transfer | `outsider` (not current holder) calls `transferCustody(...)` | Reverts with `"Only current holder"` | ✔ Pass |
| 20 | reverts when skipping a stage | Holder calls `transferCustody(1, distributor, InTransit)` from `Created` | Reverts with `"Stage must advance by one"` | ✔ Pass |
| 21 | reverts when moving a stage backward | Advance to `Manufactured`, then attempt `Created` | Reverts with `"Stage must advance by one"` | ✔ Pass |
| 22 | reverts when the recipient is not a registered participant | Holder transfers to `outsider` (role None) | Reverts with `"Recipient not a participant"` | ✔ Pass |
| 23 | reverts when the recipient is the zero address | Holder calls `transferCustody(1, 0x0, Manufactured)` | Reverts with `"Zero address"` | ✔ Pass |
| 24 | reverts when transferring a product that is already Sold | Product advanced to `Sold`, then another transfer attempted | Reverts with `"Product already sold"` | ✔ Pass |
| 25 | reverts when the product does not exist | `transferCustody(999, ...)` on unregistered id | Reverts with `"Product does not exist"` | ✔ Pass |

---

## 5. Views and verification

| # | Test | Input / Preconditions | Expected result | Actual |
|---|------|-----------------------|-----------------|--------|
| 26 | verifyAuthenticity returns true for the real manufacturer | Product 1 registered by manufacturer | `verifyAuthenticity(1, manufacturer) == true` | ✔ Pass |
| 27 | verifyAuthenticity returns false for an impostor | Product 1 registered by manufacturer | `verifyAuthenticity(1, outsider) == false` | ✔ Pass |
| 28 | reverts view calls for a non-existent product | `getProduct(999)` on unregistered id | Reverts with `"Product does not exist"` | ✔ Pass |

---

## Raw test runner output

The verbatim output of `npx hardhat test`:

```
  SupplyChainRegistry
    Deployment
      ✔ sets the deployer as admin (924ms)
      ✔ starts with a product count of zero
    Participant management
      ✔ lets the admin register a participant and emits an event
      ✔ reverts when a non-admin tries to register a participant
      ✔ rejects the zero address
      ✔ rejects the None role
      ✔ lets the admin remove a participant and emits an event
      ✔ reverts when removing an address that is not a participant
      ✔ reverts when a non-admin tries to remove a participant
    Product registration
      ✔ lets a manufacturer register a product and emits an event
      ✔ stores the product with the correct initial data
      ✔ assigns sequential ids starting at 1
      ✔ reverts when a non-manufacturer tries to register a product
      ✔ reverts when the product name is empty
      ✔ seeds the provenance trail with the manufacturer's initial custody
    Custody transfer
      ✔ advances the stage by one and moves custody, emitting an event
      ✔ appends a record to the provenance trail on each transfer
      ✔ supports the full lifecycle to Sold
      ✔ reverts when a non-holder tries to transfer
      ✔ reverts when skipping a stage
      ✔ reverts when moving a stage backward
      ✔ reverts when the recipient is not a registered participant
      ✔ reverts when the recipient is the zero address
      ✔ reverts when transferring a product that is already Sold
      ✔ reverts when the product does not exist
    Views and verification
      ✔ verifyAuthenticity returns true for the real manufacturer
      ✔ verifyAuthenticity returns false for an impostor
      ✔ reverts view calls for a non-existent product

  28 passing (977ms)
```

---

## Deployment verification (local dry-run)

Running the deploy script against the in-memory Hardhat network confirms the
deploy path works end-to-end and the deployer is recorded as admin:

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

---

## Coverage summary

| Area | Cases | Result |
|------|-------|--------|
| Deployment / initial state | 2 | ✔ All pass |
| Participant management (access control) | 7 | ✔ All pass |
| Product registration | 6 | ✔ All pass |
| Custody transfer (lifecycle + guards) | 10 | ✔ All pass |
| Views & authenticity verification | 3 | ✔ All pass |
| **Total** | **28** | **✔ 28 passing** |

Every happy path and every guard clause (access control, input validation,
lifecycle ordering, existence checks) is exercised, giving confidence the
contract enforces its intended rules before any gas is spent on Sepolia.
