// Contract wrapper using ethers v6
window.TicketNFT_TicketContract = {
  async _loadHardhat() {
    const deployed = await fetch("/blockchain/web3/deployed.json")
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);
    if (!deployed?.TicketNFT?.address) return null;

    const abi = await fetch("/blockchain/abi/TicketNFT.json")
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);
    if (!abi) return null;

    return { address: deployed.TicketNFT.address, abi };
  },

  async _loadTruffle() {
    const artifact = await fetch("/blockchain/build/contracts/TicketNFT.json")
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

  async _get(){
    const deployed = await this._loadHardhat() || await this._loadTruffle();
    if (!deployed?.address) throw new Error("Contract not deployed");

    const abi = deployed.abi;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const code = await provider.getCode(deployed.address);
    if (!code || code === "0x") {
      throw new Error("Contract not deployed on current network");
    }
    const contract = new ethers.Contract(deployed.address, abi, signer);
    return { contract, deployed };
  },

  async getTicketPrice(eventId, typeId){
    const { contract } = await this._get();
    const typeInfo = await contract.ticketTypes(eventId, typeId);
    const priceWei = typeInfo?.priceWei ?? typeInfo?.[1];
    return priceWei ?? null;
  },

  async getTicketType(eventId, typeId){
    const { contract } = await this._get();
    const typeInfo = await contract.ticketTypes(eventId, typeId);
    return {
      name: typeInfo?.name ?? typeInfo?.[0] ?? "",
      priceWei: typeInfo?.priceWei ?? typeInfo?.[1] ?? null,
      maxSupply: typeInfo?.maxSupply ?? typeInfo?.[2] ?? null,
      sold: typeInfo?.sold ?? typeInfo?.[3] ?? null
    };
  },

  async getEventInfo(eventId){
    const { contract } = await this._get();
    const info = await contract.events(eventId);
    return {
      title: info?.title ?? info?.[0] ?? "",
      active: info?.active ?? info?.[1] ?? false,
      ticketTypeCount: info?.ticketTypeCount ?? info?.[2] ?? 0
    };
  },

  async hasBought(address, eventId, typeId){
    const { contract } = await this._get();
    return await contract.hasBought(address, eventId, typeId);
  },

  async buyTicket(eventId, typeId, ethValue){
    // If not deployed, throw and UI will simulate
    try{
      const { contract } = await this._get();
      const priceWei = await this.getTicketPrice(eventId, typeId);
      const valueWei = priceWei ?? ethers.parseEther(ethValue);
      const tx = await contract.buyTicket(eventId, typeId, { value: valueWei });
      const receipt = await tx.wait();

      // Try read TicketMinted event
      let tokenId = null;
      if (receipt?.logs){
        for (const log of receipt.logs){
          try{
            const iface = contract.interface;
            const parsed = iface.parseLog(log);
            if(parsed?.name === "TicketMinted"){
              tokenId = Number(parsed.args.tokenId);
              break;
            }
          }catch(e){}
        }
      }
      const priceEth = priceWei ? ethers.formatEther(priceWei) : ethValue;
      return { hash: tx.hash, tokenId, priceEth };
    }catch(err){
      // If contract not deployed or tx fails, rethrow to be caught in UI
      throw err;
    }
  }
};
