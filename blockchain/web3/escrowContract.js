// Escrow Contract wrapper using ethers v6
window.TicketNFT_EscrowContract = {

  // ============ Contract Loading ============

  async _loadHardhat() {
    const deployed = await fetch("/blockchain/web3/deployed.json")
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);
    if (!deployed?.PaymentEscrow?.address) return null;

    const abi = await fetch("/blockchain/web3/abi/PaymentEscrow.json")
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);
    if (!abi) return null;

    return { address: deployed.PaymentEscrow.address, abi };
  },

  async _loadTruffle() {
    const artifact = await fetch("/blockchain/build/contracts/PaymentEscrow.json")
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);
    if (!artifact?.abi) return null;

    const networks = artifact.networks || {};
    const networkId = await window.ethereum.request({ method: "net_version" });
    let address = networks?.[networkId]?.address;
    if (!address) {
      const chainHex = await window.ethereum.request({ method: "eth_chainId" });
      const chainId = String(parseInt(chainHex, 16));
      address = networks?.[chainId]?.address;
    }
    if (!address) {
      const entries = Object.values(networks);
      if (entries.length === 1) {
        address = entries[0]?.address || null;
      }
    }
    if (!address) return null;

    return { address, abi: artifact.abi };
  },

  async _get() {
    const deployed = await this._loadHardhat() || await this._loadTruffle();
    if (!deployed?.address) throw new Error("Escrow contract not deployed");

    const abi = deployed.abi;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const code = await provider.getCode(deployed.address);
    if (!code || code === "0x") {
      throw new Error("Escrow contract not deployed on current network");
    }
    const contract = new ethers.Contract(deployed.address, abi, signer);
    return { contract, deployed, provider, signer };
  },

  async isDeployed() {
    try {
      await this._get();
      return true;
    } catch {
      return false;
    }
  },

  // ============ Order Status Enum ============

  OrderStatus: {
    0: 'Pending',
    1: 'Confirmed',
    2: 'Disputed',
    3: 'Refunded',
    4: 'Released',
    5: 'Cancelled',
    Pending: 0,
    Confirmed: 1,
    Disputed: 2,
    Refunded: 3,
    Released: 4,
    Cancelled: 5
  },

  // ============ Read Functions ============

  async getOrder(orderId) {
    const { contract } = await this._get();
    const order = await contract.getOrder(orderId);
    return this._parseOrder(order);
  },

  async getBuyerOrders(buyerAddress) {
    const { contract } = await this._get();
    const orderIds = await contract.getBuyerOrders(buyerAddress);
    return orderIds.map(id => Number(id));
  },

  async getSellerOrders(sellerAddress) {
    const { contract } = await this._get();
    const orderIds = await contract.getSellerOrders(sellerAddress);
    return orderIds.map(id => Number(id));
  },

  async getBuyerOrdersWithDetails(buyerAddress) {
    const orderIds = await this.getBuyerOrders(buyerAddress);
    const orders = await Promise.all(
      orderIds.map(id => this.getOrder(id))
    );
    return orders;
  },

  async getSellerOrdersWithDetails(sellerAddress) {
    const orderIds = await this.getSellerOrders(sellerAddress);
    const orders = await Promise.all(
      orderIds.map(id => this.getOrder(id))
    );
    return orders;
  },

  async canAutoRelease(orderId) {
    const { contract } = await this._get();
    return await contract.canAutoRelease(orderId);
  },

  async getAutoReleaseTime(orderId) {
    const { contract } = await this._get();
    const time = await contract.getAutoReleaseTime(orderId);
    return Number(time);
  },

  async getEscrowBalance() {
    const { contract } = await this._get();
    const balance = await contract.getEscrowBalance();
    return ethers.formatEther(balance);
  },

  async getPlatformFee() {
    const { contract } = await this._get();
    const feeBps = await contract.platformFeeBps();
    return Number(feeBps) / 100; // Convert basis points to percentage
  },

  async getArbiter() {
    const { contract } = await this._get();
    return await contract.arbiter();
  },

  // ============ Write Functions ============

  async createOrder(sellerAddress, eventId, ticketTypeId, valueWei) {
    const { contract } = await this._get();
    const tx = await contract.createOrder(
      sellerAddress,
      eventId,
      ticketTypeId,
      { value: valueWei }
    );
    const receipt = await tx.wait();

    // Parse OrderCreated event
    let orderId = null;
    if (receipt?.logs) {
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed?.name === "OrderCreated") {
            orderId = Number(parsed.args.orderId);
            break;
          }
        } catch (e) {}
      }
    }

    return { hash: tx.hash, orderId };
  },

  async confirmDelivery(orderId) {
    const { contract } = await this._get();
    const tx = await contract.confirmDelivery(orderId);
    const receipt = await tx.wait();
    return { hash: tx.hash, receipt };
  },

  async raiseDispute(orderId, reason) {
    const { contract } = await this._get();
    const tx = await contract.raiseDispute(orderId, reason);
    const receipt = await tx.wait();
    return { hash: tx.hash, receipt };
  },

  async resolveDispute(orderId, releaseToSeller, resolution) {
    const { contract } = await this._get();
    const tx = await contract.resolveDispute(orderId, releaseToSeller, resolution);
    const receipt = await tx.wait();
    return { hash: tx.hash, receipt };
  },

  async autoRelease(orderId) {
    const { contract } = await this._get();
    const tx = await contract.autoRelease(orderId);
    const receipt = await tx.wait();
    return { hash: tx.hash, receipt };
  },

  async sellerRefund(orderId) {
    const { contract } = await this._get();
    const tx = await contract.sellerRefund(orderId);
    const receipt = await tx.wait();
    return { hash: tx.hash, receipt };
  },

  async cancelOrder(orderId) {
    const { contract } = await this._get();
    const tx = await contract.cancelOrder(orderId);
    const receipt = await tx.wait();
    return { hash: tx.hash, receipt };
  },

  // ============ Helper Functions ============

  _parseOrder(order) {
    return {
      orderId: Number(order.orderId),
      buyer: order.buyer,
      seller: order.seller,
      amount: ethers.formatEther(order.amount),
      amountWei: order.amount.toString(),
      platformFee: ethers.formatEther(order.platformFee),
      sellerAmount: ethers.formatEther(order.sellerAmount),
      eventId: Number(order.eventId),
      ticketTypeId: Number(order.ticketTypeId),
      tokenId: Number(order.tokenId),
      status: Number(order.status),
      statusText: this.OrderStatus[Number(order.status)],
      createdAt: Number(order.createdAt),
      createdAtDate: new Date(Number(order.createdAt) * 1000),
      deliveryDeadline: Number(order.deliveryDeadline),
      deliveryDeadlineDate: new Date(Number(order.deliveryDeadline) * 1000),
      disputeReason: order.disputeReason,
      resolution: order.resolution
    };
  },

  formatTimeRemaining(seconds) {
    if (seconds <= 0) return 'Expired';

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  },

  getStatusColor(status) {
    const colors = {
      0: '#f59e0b', // Pending - Orange
      1: '#10b981', // Confirmed - Green
      2: '#ef4444', // Disputed - Red
      3: '#6b7280', // Refunded - Gray
      4: '#10b981', // Released - Green
      5: '#6b7280'  // Cancelled - Gray
    };
    return colors[status] || '#6b7280';
  },

  getStatusBadgeClass(status) {
    const classes = {
      0: 'badge-pending',
      1: 'badge-success',
      2: 'badge-danger',
      3: 'badge-secondary',
      4: 'badge-success',
      5: 'badge-secondary'
    };
    return classes[status] || 'badge-secondary';
  }
};
