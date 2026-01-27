// Truffle configuration for TicketNFT project
// Configured for Ganache local development

module.exports = {
  // Point Truffle at the actual project layout
  contracts_directory: "./blockchain/contracts",
  migrations_directory: "./blockchain/migrations",
  contracts_build_directory: "./blockchain/build/contracts",

  networks: {
    // Ganache local network (primary development network)
    development: {
      host: "127.0.0.1",     // Localhost
      port: 7545,            // Ganache default port
      network_id: "*",       // Match any network id
      gas: 6721975,          // Gas limit
      gasPrice: 20000000000  // 20 gwei
    },

    // Hardhat local network (alternative)
    hardhat: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "31337"
    }

    // Sepolia testnet configuration (commented out)
    // Uncomment and configure .env file to deploy to Sepolia
    // sepolia: {
    //   provider: () => new HDWalletProvider(
    //     process.env.PRIVATE_KEY,
    //     `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`
    //   ),
    //   network_id: 11155111,
    //   gas: 5500000,
    //   gasPrice: 25000000000,
    //   confirmations: 2,
    //   timeoutBlocks: 500,
    //   skipDryRun: true
    // }
  },

  // Mocha test configuration
  mocha: {
    timeout: 100000
  },

  // Compiler configuration
  compilers: {
    solc: {
      version: "0.8.19",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: "london"  // Compatible with Ganache
      }
    }
  }
};
