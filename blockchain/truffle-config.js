require('dotenv').config();
const HDWalletProvider = require('@truffle/hdwallet-provider');

// 从环境变量获取配置
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const MNEMONIC = process.env.MNEMONIC;
const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

// Sepolia RPC URL (优先使用直接配置的URL)
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL ||
  (INFURA_PROJECT_ID ? `https://sepolia.infura.io/v3/${INFURA_PROJECT_ID}` :
  (ALCHEMY_API_KEY ? `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}` : null));

console.log('Using RPC URL:', SEPOLIA_RPC_URL ? 'Configured' : 'Not configured');

// 获取钱包 Provider
function getSepoliaProvider() {
  if (!SEPOLIA_RPC_URL) {
    console.error('Error: No RPC URL configured. Set INFURA_PROJECT_ID, ALCHEMY_API_KEY, or SEPOLIA_RPC_URL');
    return null;
  }

  if (PRIVATE_KEY) {
    return new HDWalletProvider({
      privateKeys: [PRIVATE_KEY],
      providerOrUrl: SEPOLIA_RPC_URL,
      pollingInterval: 8000
    });
  }

  if (MNEMONIC) {
    return new HDWalletProvider({
      mnemonic: MNEMONIC,
      providerOrUrl: SEPOLIA_RPC_URL,
      pollingInterval: 8000
    });
  }

  console.error('Error: No PRIVATE_KEY or MNEMONIC configured');
  return null;
}

module.exports = {
  contracts_build_directory: "./build/contracts",

  networks: {
    // 本地开发网络 (Ganache)
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*"
    },

    // Hardhat 本地网络
    hardhat: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "31337"
    },

    // Sepolia 测试网
    sepolia: {
      provider: getSepoliaProvider,
      network_id: 11155111,       // Sepolia chain ID
      gas: 5500000,               // Gas limit
      gasPrice: 25000000000,      // 25 Gwei (increased for faster confirmation)
      confirmations: 2,           // 等待2个区块确认
      timeoutBlocks: 500,         // 超时区块数
      skipDryRun: true,           // 跳过 dry run
      networkCheckTimeout: 1000000, // 网络检查超时 (增加)
      deploymentPollingInterval: 15000 // 部署轮询间隔
    }
  },

  // 编译器配置
  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        viaIR: true,  // 启用 IR 编译器解决 "stack too deep" 问题
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: "paris"
      }
    }
  },

  // Etherscan 合约验证插件配置
  plugins: [
    'truffle-plugin-verify'
  ],

  api_keys: {
    etherscan: ETHERSCAN_API_KEY
  }
};
