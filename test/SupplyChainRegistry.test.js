// -----------------------------------------------------------------------------
// Automated test suite for SupplyChainRegistry.
//
// Run with:  npx hardhat test
//
// The suite exercises every branch of the contract on a local Hardhat network:
//   - access control (admin-only, role-gated actions)
//   - product registration and input validation
//   - the strict, forward-only custody lifecycle
//   - the append-only provenance trail
//   - authenticity verification
//   - emitted events
//
// Framework: Hardhat + Mocha (describe/it) + Chai (expect) + ethers.js.
// `loadFixture` deploys a fresh contract for each test so cases stay isolated.
// -----------------------------------------------------------------------------

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

// Mirror of the on-chain enums so the tests read clearly.
const Role = { None: 0, Manufacturer: 1, Distributor: 2, Retailer: 3 };
const Stage = {
  Created: 0,
  Manufactured: 1,
  InTransit: 2,
  Delivered: 3,
  Sold: 4,
};

describe("SupplyChainRegistry", function () {
  // ---------------------------------------------------------------------------
  // Shared deployment fixture.
  // Returns the deployed contract plus a set of labelled signers representing
  // the different actors in a supply chain.
  // ---------------------------------------------------------------------------
  async function deployFixture() {
    const [admin, manufacturer, distributor, retailer, outsider] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory("SupplyChainRegistry");
    const registry = await Factory.deploy(); // deployer becomes admin
    await registry.waitForDeployment();

    return { registry, admin, manufacturer, distributor, retailer, outsider };
  }

  // Convenience: deploy and pre-register the three trusted participants.
  async function registeredFixture() {
    const base = await deployFixture();
    const { registry, admin, manufacturer, distributor, retailer } = base;

    await registry
      .connect(admin)
      .registerParticipant(manufacturer.address, Role.Manufacturer);
    await registry
      .connect(admin)
      .registerParticipant(distributor.address, Role.Distributor);
    await registry
      .connect(admin)
      .registerParticipant(retailer.address, Role.Retailer);

    return base;
  }

  // ===========================================================================
  // Deployment
  // ===========================================================================
  describe("Deployment", function () {
    it("sets the deployer as admin", async function () {
      const { registry, admin } = await loadFixture(deployFixture);
      expect(await registry.admin()).to.equal(admin.address);
    });

    it("starts with a product count of zero", async function () {
      const { registry } = await loadFixture(deployFixture);
      expect(await registry.productCount()).to.equal(0);
    });
  });

  // ===========================================================================
  // Participant management (admin only)
  // ===========================================================================
  describe("Participant management", function () {
    it("lets the admin register a participant and emits an event", async function () {
      const { registry, admin, manufacturer } = await loadFixture(deployFixture);

      await expect(
        registry
          .connect(admin)
          .registerParticipant(manufacturer.address, Role.Manufacturer)
      )
        .to.emit(registry, "ParticipantRegistered")
        .withArgs(manufacturer.address, Role.Manufacturer);

      expect(await registry.roles(manufacturer.address)).to.equal(
        Role.Manufacturer
      );
    });

    it("reverts when a non-admin tries to register a participant", async function () {
      const { registry, manufacturer, outsider } = await loadFixture(
        deployFixture
      );

      await expect(
        registry
          .connect(outsider)
          .registerParticipant(manufacturer.address, Role.Manufacturer)
      ).to.be.revertedWith("Not authorized: admin only");
    });

    it("rejects the zero address", async function () {
      const { registry, admin } = await loadFixture(deployFixture);

      await expect(
        registry
          .connect(admin)
          .registerParticipant(ethers.ZeroAddress, Role.Manufacturer)
      ).to.be.revertedWith("Zero address");
    });

    it("rejects the None role", async function () {
      const { registry, admin, manufacturer } = await loadFixture(deployFixture);

      await expect(
        registry
          .connect(admin)
          .registerParticipant(manufacturer.address, Role.None)
      ).to.be.revertedWith("Invalid role");
    });

    it("lets the admin remove a participant and emits an event", async function () {
      const { registry, admin, manufacturer } = await loadFixture(
        registeredFixture
      );

      await expect(
        registry.connect(admin).removeParticipant(manufacturer.address)
      )
        .to.emit(registry, "ParticipantRemoved")
        .withArgs(manufacturer.address);

      expect(await registry.roles(manufacturer.address)).to.equal(Role.None);
    });

    it("reverts when removing an address that is not a participant", async function () {
      const { registry, admin, outsider } = await loadFixture(deployFixture);

      await expect(
        registry.connect(admin).removeParticipant(outsider.address)
      ).to.be.revertedWith("Not a participant");
    });

    it("reverts when a non-admin tries to remove a participant", async function () {
      const { registry, manufacturer, outsider } = await loadFixture(
        registeredFixture
      );

      await expect(
        registry.connect(outsider).removeParticipant(manufacturer.address)
      ).to.be.revertedWith("Not authorized: admin only");
    });
  });

  // ===========================================================================
  // Product registration
  // ===========================================================================
  describe("Product registration", function () {
    it("lets a manufacturer register a product and emits an event", async function () {
      const { registry, manufacturer } = await loadFixture(registeredFixture);

      await expect(
        registry
          .connect(manufacturer)
          .registerProduct("Organic Coffee", "Batch #A1, Colombia")
      )
        .to.emit(registry, "ProductRegistered")
        .withArgs(1, "Organic Coffee", manufacturer.address);

      expect(await registry.productCount()).to.equal(1);
    });

    it("stores the product with the correct initial data", async function () {
      const { registry, manufacturer } = await loadFixture(registeredFixture);

      await registry
        .connect(manufacturer)
        .registerProduct("Organic Coffee", "Batch #A1");

      const p = await registry.getProduct(1);
      expect(p.id).to.equal(1);
      expect(p.name).to.equal("Organic Coffee");
      expect(p.details).to.equal("Batch #A1");
      expect(p.manufacturer).to.equal(manufacturer.address);
      expect(p.currentHolder).to.equal(manufacturer.address);
      expect(p.stage).to.equal(Stage.Created);
      expect(p.exists).to.equal(true);
    });

    it("assigns sequential ids starting at 1", async function () {
      const { registry, manufacturer } = await loadFixture(registeredFixture);

      await registry.connect(manufacturer).registerProduct("A", "");
      await registry.connect(manufacturer).registerProduct("B", "");

      expect((await registry.getProduct(1)).name).to.equal("A");
      expect((await registry.getProduct(2)).name).to.equal("B");
      expect(await registry.productCount()).to.equal(2);
    });

    it("reverts when a non-manufacturer tries to register a product", async function () {
      const { registry, distributor } = await loadFixture(registeredFixture);

      await expect(
        registry.connect(distributor).registerProduct("X", "")
      ).to.be.revertedWith("Not authorized: wrong role");
    });

    it("reverts when the product name is empty", async function () {
      const { registry, manufacturer } = await loadFixture(registeredFixture);

      await expect(
        registry.connect(manufacturer).registerProduct("", "no name")
      ).to.be.revertedWith("Name required");
    });

    it("seeds the provenance trail with the manufacturer's initial custody", async function () {
      const { registry, manufacturer } = await loadFixture(registeredFixture);

      await registry.connect(manufacturer).registerProduct("A", "");

      expect(await registry.getHistoryLength(1)).to.equal(1);
      const history = await registry.getHistory(1);
      expect(history[0].holder).to.equal(manufacturer.address);
      expect(history[0].stage).to.equal(Stage.Created);
    });
  });

  // ===========================================================================
  // Custody transfer / lifecycle
  // ===========================================================================
  describe("Custody transfer", function () {
    // Deploy, register participants, and create one product held by the
    // manufacturer at Stage.Created.
    async function productFixture() {
      const base = await loadFixture(registeredFixture);
      await base.registry
        .connect(base.manufacturer)
        .registerProduct("Organic Coffee", "Batch #A1");
      return base;
    }

    it("advances the stage by one and records custody, emitting an event", async function () {
      const { registry, manufacturer, distributor } = await productFixture();

      await expect(
        registry
          .connect(manufacturer)
          .transferCustody(1, manufacturer.address, Stage.Manufactured)
      )
        .to.emit(registry, "CustodyTransferred")
        .withArgs(
          1,
          manufacturer.address,
          manufacturer.address,
          Stage.Manufactured
        );

      await expect(
        registry
          .connect(manufacturer)
          .transferCustody(1, distributor.address, Stage.InTransit)
      )
        .to.emit(registry, "CustodyTransferred")
        .withArgs(1, manufacturer.address, distributor.address, Stage.InTransit);

      const p = await registry.getProduct(1);
      expect(p.currentHolder).to.equal(distributor.address);
      expect(p.stage).to.equal(Stage.InTransit);
    });

    it("appends a record to the provenance trail on each transfer", async function () {
      const { registry, manufacturer } = await productFixture();

      await registry
        .connect(manufacturer)
        .transferCustody(1, manufacturer.address, Stage.Manufactured);

      expect(await registry.getHistoryLength(1)).to.equal(2);
      const history = await registry.getHistory(1);
      expect(history[1].holder).to.equal(manufacturer.address);
      expect(history[1].stage).to.equal(Stage.Manufactured);
    });

    it("supports the full lifecycle to Sold", async function () {
      const { registry, manufacturer, distributor, retailer } =
        await productFixture();

      await registry
        .connect(manufacturer)
        .transferCustody(1, manufacturer.address, Stage.Manufactured);
      await registry
        .connect(manufacturer)
        .transferCustody(1, distributor.address, Stage.InTransit);
      await registry
        .connect(distributor)
        .transferCustody(1, retailer.address, Stage.Delivered);
      await registry
        .connect(retailer)
        .transferCustody(1, retailer.address, Stage.Sold);

      const p = await registry.getProduct(1);
      expect(p.stage).to.equal(Stage.Sold);
      expect(await registry.getHistoryLength(1)).to.equal(5);
    });

    it("reverts when a non-holder tries to transfer", async function () {
      const { registry, distributor } = await productFixture();

      await expect(
        registry
          .connect(distributor)
          .transferCustody(1, distributor.address, Stage.Manufactured)
      ).to.be.revertedWith("Only current holder");
    });

    it("reverts when skipping a stage", async function () {
      const { registry, manufacturer, distributor } = await productFixture();

      await expect(
        registry
          .connect(manufacturer)
          .transferCustody(1, distributor.address, Stage.InTransit)
      ).to.be.revertedWith("Stage must advance by one");
    });

    it("reverts when moving a stage backward", async function () {
      const { registry, manufacturer, distributor } = await productFixture();

      // First advance to Manufactured, then attempt to go back to Created.
      await registry
        .connect(manufacturer)
        .transferCustody(1, manufacturer.address, Stage.Manufactured);

      await expect(
        registry
          .connect(manufacturer)
          .transferCustody(1, distributor.address, Stage.Created)
      ).to.be.revertedWith("Stage must advance by one");
    });

    it("reverts when the recipient role does not match the new stage", async function () {
      const { registry, manufacturer, distributor, retailer } =
        await productFixture();

      await expect(
        registry
          .connect(manufacturer)
          .transferCustody(1, distributor.address, Stage.Manufactured)
      ).to.be.revertedWith("Recipient role does not match stage");

      await registry
        .connect(manufacturer)
        .transferCustody(1, manufacturer.address, Stage.Manufactured);

      await expect(
        registry
          .connect(manufacturer)
          .transferCustody(1, retailer.address, Stage.InTransit)
      ).to.be.revertedWith("Recipient role does not match stage");
    });

    it("reverts when the recipient is not a registered participant", async function () {
      const { registry, manufacturer, outsider } = await productFixture();

      await expect(
        registry
          .connect(manufacturer)
          .transferCustody(1, outsider.address, Stage.Manufactured)
      ).to.be.revertedWith("Recipient not a participant");
    });

    it("reverts when the recipient is the zero address", async function () {
      const { registry, manufacturer } = await productFixture();

      await expect(
        registry
          .connect(manufacturer)
          .transferCustody(1, ethers.ZeroAddress, Stage.Manufactured)
      ).to.be.revertedWith("Zero address");
    });

    it("reverts when transferring a product that is already Sold", async function () {
      const { registry, manufacturer, distributor, retailer } =
        await productFixture();

      // Walk the product all the way to Sold.
      await registry
        .connect(manufacturer)
        .transferCustody(1, manufacturer.address, Stage.Manufactured);
      await registry
        .connect(manufacturer)
        .transferCustody(1, distributor.address, Stage.InTransit);
      await registry
        .connect(distributor)
        .transferCustody(1, retailer.address, Stage.Delivered);
      await registry
        .connect(retailer)
        .transferCustody(1, retailer.address, Stage.Sold);

      await expect(
        registry
          .connect(retailer)
          .transferCustody(1, retailer.address, Stage.Sold)
      ).to.be.revertedWith("Product already sold");
    });

    it("reverts when the product does not exist", async function () {
      const { registry, manufacturer, distributor } = await productFixture();

      await expect(
        registry
          .connect(manufacturer)
          .transferCustody(999, distributor.address, Stage.Manufactured)
      ).to.be.revertedWith("Product does not exist");
    });
  });

  // ===========================================================================
  // Views & verification
  // ===========================================================================
  describe("Views and verification", function () {
    async function productFixture() {
      const base = await loadFixture(registeredFixture);
      await base.registry
        .connect(base.manufacturer)
        .registerProduct("Organic Coffee", "Batch #A1");
      return base;
    }

    it("verifyAuthenticity returns true for the real manufacturer", async function () {
      const { registry, manufacturer } = await productFixture();
      expect(
        await registry.verifyAuthenticity(1, manufacturer.address)
      ).to.equal(true);
    });

    it("verifyAuthenticity returns false for an impostor", async function () {
      const { registry, outsider } = await productFixture();
      expect(await registry.verifyAuthenticity(1, outsider.address)).to.equal(
        false
      );
    });

    it("reverts view calls for a non-existent product", async function () {
      const { registry } = await loadFixture(registeredFixture);
      await expect(registry.getProduct(1)).to.be.revertedWith(
        "Product does not exist"
      );
      await expect(registry.getHistory(1)).to.be.revertedWith(
        "Product does not exist"
      );
      await expect(registry.getHistoryLength(1)).to.be.revertedWith(
        "Product does not exist"
      );
      await expect(
        registry.verifyAuthenticity(1, ethers.ZeroAddress)
      ).to.be.revertedWith("Product does not exist");
    });
  });
});
