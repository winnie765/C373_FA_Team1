window.TicketNFT_MetaMask = {
  async connect(){
    if (!window.ethereum) return null;
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const address = accounts?.[0];
      return address ? { address } : null;
    } catch (err) {
      console.warn("MetaMask connect failed", err);
      return null;
    }
  }
};
