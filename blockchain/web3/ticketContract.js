// Contract wrapper using ethers v6
window.TicketNFT_TicketContract = {
  async _get(){
    // Load deployed address + abi if available
    const deployed = await fetch("/blockchain/web3/deployed.json").then(r => r.ok ? r.json() : null).catch(()=>null);
    if(!deployed?.TicketNFT?.address) throw new Error("Contract not deployed");

    const abi = await fetch("/blockchain/abi/TicketNFT.json").then(r => r.json());
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(deployed.TicketNFT.address, abi, signer);
    return { contract, deployed };
  },

  async buyTicket(eventId, typeId, ethValue){
    // If not deployed, throw and UI will simulate
    try{
      const { contract } = await this._get();
      const tx = await contract.buyTicket(eventId, typeId, { value: ethers.parseEther(ethValue) });
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
      return { hash: tx.hash, tokenId };
    }catch(err){
      // If contract not deployed or tx fails, rethrow to be caught in UI
      throw err;
    }
  }
};
