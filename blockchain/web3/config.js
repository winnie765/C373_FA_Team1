// Basic config for prototype
window.TicketNFT_Config = {
  // 支持的网络配置
  networks: {
    // Sepolia 测试网 (主要)
    sepolia: {
      chainId: 11155111,
      chainIdHex: '0xaa36a7',
      name: 'Sepolia Testnet',
      rpcUrl: 'https://sepolia.infura.io/v3/YOUR_INFURA_ID', // 用户需替换
      blockExplorer: 'https://sepolia.etherscan.io',
      currency: {
        name: 'SepoliaETH',
        symbol: 'ETH',
        decimals: 18
      }
    },
    // Hardhat 本地 (开发)
    hardhat: {
      chainId: 31337,
      chainIdHex: '0x7a69',
      name: 'Hardhat Local',
      rpcUrl: 'http://127.0.0.1:8545',
      blockExplorer: '',
      currency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18
      }
    },
    // Ganache 本地 (开发)
    ganache: {
      chainId: 1337,
      chainIdHex: '0x539',
      name: 'Ganache Local',
      rpcUrl: 'http://127.0.0.1:7545',
      blockExplorer: '',
      currency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18
      }
    }
  },

  // 当前活动网络 (部署后自动检测)
  activeNetwork: 'ganache',

  // 默认配置
  chainId: 1337,                  // Ganache
  ganacheChainId: 1337,           // Ganache local (common default)
  hardhatChainId: 31337,          // Hardhat local
  sepoliaChainId: 11155111,       // Sepolia testnet

  // 交易配置
  ethValuePerTicket: "0.001",     // demo price in ETH for transactions
  tokPerPurchase: 10,             // loyalty TOK earned per purchase (prototype)

  // 获取当前网络配置
  getNetworkConfig(chainId) {
    const id = Number(chainId);
    if (id === 11155111) return this.networks.sepolia;
    if (id === 31337) return this.networks.hardhat;
    if (id === 1337) return this.networks.ganache;
    return null;
  },

  // 检查是否是支持的网络
  isSupportedNetwork(chainId) {
    const id = Number(chainId);
    return id === 11155111 || id === 31337 || id === 1337;
  },

  // 获取区块浏览器链接
  getExplorerUrl(chainId, txHash) {
    const network = this.getNetworkConfig(chainId);
    if (!network || !network.blockExplorer) return null;
    return `${network.blockExplorer}/tx/${txHash}`;
  },

  getAddressExplorerUrl(chainId, address) {
    const network = this.getNetworkConfig(chainId);
    if (!network || !network.blockExplorer) return null;
    return `${network.blockExplorer}/address/${address}`;
  }
};

// 自动切换到 Sepolia 网络的辅助函数
window.TicketNFT_SwitchNetwork = async function(targetChainId = 11155111) {
  if (!window.ethereum) {
    alert('MetaMask not detected');
    return false;
  }

  const chainIdHex = '0x' + targetChainId.toString(16);

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }]
    });
    return true;
  } catch (switchError) {
    // 如果网络不存在，添加它
    if (switchError.code === 4902) {
      const network = TicketNFT_Config.getNetworkConfig(targetChainId);
      if (!network) {
        alert('Unsupported network');
        return false;
      }

      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: chainIdHex,
            chainName: network.name,
            nativeCurrency: network.currency,
            rpcUrls: [network.rpcUrl],
            blockExplorerUrls: network.blockExplorer ? [network.blockExplorer] : []
          }]
        });
        return true;
      } catch (addError) {
        console.error('Failed to add network:', addError);
        return false;
      }
    }
    console.error('Failed to switch network:', switchError);
    return false;
  }
};
