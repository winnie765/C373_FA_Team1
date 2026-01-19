import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import hre from "hardhat";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const TicketNFT = await hre.ethers.getContractFactory("TicketNFT");
  const ticket = await TicketNFT.deploy();
  await ticket.waitForDeployment();

  const LoyaltyToken = await hre.ethers.getContractFactory("LoyaltyToken");
  const tok = await LoyaltyToken.deploy();
  await tok.waitForDeployment();

  const deployed = {
    TicketNFT: { address: await ticket.getAddress() },
    LoyaltyToken: { address: await tok.getAddress() }
  };

  const outPath = path.join(__dirname, "..", "web3", "deployed.json");
  fs.writeFileSync(outPath, JSON.stringify(deployed, null, 2));
  console.log("Deployed:", deployed);
  console.log("Wrote:", outPath);

  // Also export ABI to /abi folder for frontend
  const artifactTicket = await hre.artifacts.readArtifact("TicketNFT");
  const artifactTok = await hre.artifacts.readArtifact("LoyaltyToken");

  fs.writeFileSync(path.join(__dirname, "..", "abi", "TicketNFT.json"), JSON.stringify(artifactTicket.abi, null, 2));
  fs.writeFileSync(path.join(__dirname, "..", "abi", "LoyaltyToken.json"), JSON.stringify(artifactTok.abi, null, 2));
  console.log("ABI exported to blockchain/abi/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
