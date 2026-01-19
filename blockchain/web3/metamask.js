window.TicketNFT_MetaMask = {
  async connect(){
    if(!window.ethereum) return null;
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const address = accounts?.[0];
    return { address };
  }
};
