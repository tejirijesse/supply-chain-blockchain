const { ethers } = require("hardhat");

const Role = {
  Manufacturer: 1,
  Distributor: 2,
  Retailer: 3,
};

const Stage = {
  Created: 0,
  Manufactured: 1,
  InTransit: 2,
  Delivered: 3,
  Sold: 4,
};

const stageName = ["Created", "Manufactured", "InTransit", "Delivered", "Sold"];

async function main() {
  const [admin, manufacturer, distributor, retailer, customer] =
    await ethers.getSigners();

  const Factory = await ethers.getContractFactory("SupplyChainRegistry");
  const registry = await Factory.deploy();
  await registry.waitForDeployment();

  console.log("SupplyChainRegistry demo");
  console.log("Contract    :", await registry.getAddress());
  console.log("Admin       :", admin.address);
  console.log("Manufacturer:", manufacturer.address);
  console.log("Distributor :", distributor.address);
  console.log("Retailer    :", retailer.address);
  console.log("Customer    :", customer.address);
  console.log("");

  await registry
    .connect(admin)
    .registerParticipant(manufacturer.address, Role.Manufacturer);
  await registry
    .connect(admin)
    .registerParticipant(distributor.address, Role.Distributor);
  await registry.connect(admin).registerParticipant(retailer.address, Role.Retailer);

  await registry
    .connect(manufacturer)
    .registerProduct("Organic Coffee", "Batch #A1, Colombia origin");

  await registry
    .connect(manufacturer)
    .transferCustody(1, manufacturer.address, Stage.Manufactured);
  await registry
    .connect(manufacturer)
    .transferCustody(1, distributor.address, Stage.InTransit);
  await registry
    .connect(distributor)
    .transferCustody(1, retailer.address, Stage.Delivered);
  await registry.connect(retailer).transferCustody(1, retailer.address, Stage.Sold);

  const product = await registry.getProduct(1);
  const history = await registry.getHistory(1);

  console.log("Product");
  console.log("ID          :", product.id.toString());
  console.log("Name        :", product.name);
  console.log("Details     :", product.details);
  console.log("Stage       :", stageName[Number(product.stage)]);
  console.log("Holder      :", product.currentHolder);
  console.log("");

  console.log("Provenance trail");
  history.forEach((record, index) => {
    console.log(
      `${index + 1}. ${stageName[Number(record.stage)]} | holder ${
        record.holder
      } | timestamp ${record.timestamp.toString()}`
    );
  });
  console.log("");

  console.log(
    "Authenticity check (manufacturer):",
    await registry.verifyAuthenticity(1, manufacturer.address)
  );
  console.log(
    "Authenticity check (impostor)    :",
    await registry.verifyAuthenticity(1, customer.address)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
