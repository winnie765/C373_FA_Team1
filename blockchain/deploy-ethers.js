// Deploy script using ethers.js v6
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 选择网络: 'ganache' 或 'sepolia'
const NETWORK = process.env.DEPLOY_NETWORK || 'ganache';

// 网络配置
const NETWORKS = {
  ganache: {
    rpcUrl: 'http://127.0.0.1:7545',
    chainId: 1337,
    // Ganache 默认第一个账户私钥（如果需要可以从 Ganache UI 复制）
    privateKey: process.env.GANACHE_PRIVATE_KEY || process.env.PRIVATE_KEY
  },
  sepolia: {
    rpcUrl: process.env.SEPOLIA_RPC_URL,
    chainId: 11155111,
    privateKey: process.env.PRIVATE_KEY
  }
};

async function main() {
  const config = NETWORKS[NETWORK];

  if (!config) {
    console.error('Unknown network:', NETWORK);
    process.exit(1);
  }

  console.log(`Starting deployment to ${NETWORK.toUpperCase()}...\n`);

  // Connect to network
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);

  let wallet;
  if (config.privateKey) {
    wallet = new ethers.Wallet(config.privateKey, provider);
  } else {
    // For Ganache, get first account if no private key
    const accounts = await provider.listAccounts();
    if (accounts.length === 0) {
      console.error('No accounts found. Make sure Ganache is running.');
      process.exit(1);
    }
    wallet = await provider.getSigner(0);
  }

  const deployer = await wallet.getAddress();
  console.log('Deployer:', deployer);
  const balance = await provider.getBalance(deployer);
  console.log('Balance:', ethers.formatEther(balance), 'ETH\n');

  // Load artifacts
  const escrowArtifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'build/contracts/PaymentEscrow.json'), 'utf8')
  );
  const ticketArtifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'build/contracts/TicketNFT.json'), 'utf8')
  );

  // Deploy PaymentEscrow
  console.log('1. Deploying PaymentEscrow...');
  const EscrowFactory = new ethers.ContractFactory(
    escrowArtifact.abi,
    escrowArtifact.bytecode,
    wallet
  );
  const escrow = await EscrowFactory.deploy(deployer); // arbiter = deployer
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log('   PaymentEscrow deployed at:', escrowAddress);

  // Deploy TicketNFT
  console.log('\n2. Deploying TicketNFT...');
  const TicketFactory = new ethers.ContractFactory(
    ticketArtifact.abi,
    ticketArtifact.bytecode,
    wallet
  );
  const ticket = await TicketFactory.deploy();
  await ticket.waitForDeployment();
  const ticketAddress = await ticket.getAddress();
  console.log('   TicketNFT deployed at:', ticketAddress);

  // Link contracts: setEscrow on TicketNFT
  console.log('\n3. Linking TicketNFT to PaymentEscrow...');
  const ticketContract = new ethers.Contract(ticketAddress, ticketArtifact.abi, wallet);
  const tx1 = await ticketContract.setEscrow(escrowAddress);
  await tx1.wait();
  console.log('   setEscrow done');

  // Update deployed.json
  const deployedPath = path.join(__dirname, 'web3/deployed.json');
  const deployed = {
    network: NETWORK,
    chainId: config.chainId,
    deployer: deployer,
    deployedAt: new Date().toISOString(),
    PaymentEscrow: {
      address: escrowAddress
    },
    TicketNFT: {
      address: ticketAddress
    }
  };
  fs.writeFileSync(deployedPath, JSON.stringify(deployed, null, 2));
  console.log('\n4. Updated web3/deployed.json');

  // Update ABI files
  const abiDir = path.join(__dirname, 'web3/abi');
  if (!fs.existsSync(abiDir)) {
    fs.mkdirSync(abiDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(abiDir, 'PaymentEscrow.json'),
    JSON.stringify(escrowArtifact.abi, null, 2)
  );
  fs.writeFileSync(
    path.join(abiDir, 'TicketNFT.json'),
    JSON.stringify(ticketArtifact.abi, null, 2)
  );
  console.log('5. Updated ABI files');

  console.log('\n✅ Deployment complete!\n');
  console.log('Network:', NETWORK);
  console.log('PaymentEscrow:', escrowAddress);
  console.log('TicketNFT:', ticketAddress);
}

main().catch((err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
