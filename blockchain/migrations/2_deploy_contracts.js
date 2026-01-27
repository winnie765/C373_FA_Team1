const TicketNFT = artifacts.require("TicketNFT");
const LoyaltyToken = artifacts.require("LoyaltyToken");
const PaymentEscrow = artifacts.require("PaymentEscrow");
const fs = require('fs');
const path = require('path');

module.exports = async function (deployer, network, accounts) {
  const gas = 5_500_000;
  const owner = accounts[0];

  console.log("\n=== Deploying to", network, "===");
  console.log("Deployer account:", owner);

  // Deploy PaymentEscrow first (with owner as arbiter)
  console.log("\n1. Deploying PaymentEscrow...");
  await deployer.deploy(PaymentEscrow, owner, { gas });
  const escrow = await PaymentEscrow.deployed();
  console.log("   PaymentEscrow deployed at:", escrow.address);

  // Deploy TicketNFT
  console.log("\n2. Deploying TicketNFT...");
  await deployer.deploy(TicketNFT, { gas });
  const ticketNFT = await TicketNFT.deployed();
  console.log("   TicketNFT deployed at:", ticketNFT.address);

  // Connect TicketNFT to Escrow
  console.log("\n3. Connecting TicketNFT to Escrow...");
  await ticketNFT.setEscrow(escrow.address);
  console.log("   TicketNFT connected to Escrow");

  // Deploy LoyaltyToken
  console.log("\n4. Deploying LoyaltyToken...");
  await deployer.deploy(LoyaltyToken, { gas });
  const loyaltyToken = await LoyaltyToken.deployed();
  console.log("   LoyaltyToken deployed at:", loyaltyToken.address);

  // 保存部署地址到 deployed.json
  const deployedData = {
    network: network,
    chainId: network === 'sepolia' ? 11155111 : (network === 'hardhat' ? 31337 : 1337),
    deployedAt: new Date().toISOString(),
    deployer: owner,
    contracts: {
      PaymentEscrow: {
        address: escrow.address,
        txHash: escrow.transactionHash || null
      },
      TicketNFT: {
        address: ticketNFT.address,
        txHash: ticketNFT.transactionHash || null
      },
      LoyaltyToken: {
        address: loyaltyToken.address,
        txHash: loyaltyToken.transactionHash || null
      }
    },
    // 保持旧格式兼容
    PaymentEscrow: { address: escrow.address },
    TicketNFT: { address: ticketNFT.address },
    LoyaltyToken: { address: loyaltyToken.address }
  };

  // 写入 deployed.json
  const deployedPath = path.join(__dirname, '..', 'web3', 'deployed.json');
  fs.writeFileSync(deployedPath, JSON.stringify(deployedData, null, 2));
  console.log("\n5. Saved deployment info to:", deployedPath);

  // 同时复制 ABI 文件到 web3/abi 目录 (方便前端使用)
  const abiDir = path.join(__dirname, '..', 'web3', 'abi');
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir, { recursive: true });
  }

  const contracts = ['PaymentEscrow', 'TicketNFT', 'LoyaltyToken'];
  for (const contractName of contracts) {
    const buildPath = path.join(__dirname, '..', 'build', 'contracts', `${contractName}.json`);
    if (fs.existsSync(buildPath)) {
      const artifact = JSON.parse(fs.readFileSync(buildPath, 'utf8'));
      const abiPath = path.join(abiDir, `${contractName}.json`);
      fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
      console.log(`   Copied ABI: ${contractName}.json`);
    }
  }

  // 打印摘要
  console.log("\n========================================");
  console.log("       DEPLOYMENT SUMMARY");
  console.log("========================================");
  console.log("Network:        ", network);
  console.log("Chain ID:       ", deployedData.chainId);
  console.log("----------------------------------------");
  console.log("PaymentEscrow:  ", escrow.address);
  console.log("TicketNFT:      ", ticketNFT.address);
  console.log("LoyaltyToken:   ", loyaltyToken.address);
  console.log("----------------------------------------");
  console.log("Escrow Enabled: ", await ticketNFT.escrowEnabled());
  console.log("Escrow Address: ", await ticketNFT.getEscrowAddress());
  console.log("========================================");

  if (network === 'sepolia') {
    console.log("\n View on Etherscan:");
    console.log(`   PaymentEscrow: https://sepolia.etherscan.io/address/${escrow.address}`);
    console.log(`   TicketNFT:     https://sepolia.etherscan.io/address/${ticketNFT.address}`);
    console.log(`   LoyaltyToken:  https://sepolia.etherscan.io/address/${loyaltyToken.address}`);
    console.log("\n To verify contracts:");
    console.log("   npm run verify:sepolia");
  }

  console.log("\n");
};
