// UI helpers + localStorage prototype state
const LS_KEYS = {
  wallet: "ticketnft_wallet",
  tickets: "ticketnft_tickets",
  tok: "ticketnft_tok",
  tx: "ticketnft_tx"
};

function getJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function setJSON(key, v) { localStorage.setItem(key, JSON.stringify(v)); }

function shortAddr(a){
  if(!a) return "";
  return a.slice(0,6) + "..." + a.slice(-4);
}

window.TicketNFT_UI = {
  async connectWallet(){
    const r = await TicketNFT_MetaMask.connect();
    const btn = document.getElementById("walletBtn");
    if (btn && r?.address) btn.textContent = shortAddr(r.address);
    return r;
  },

  async buyTicketFlow(eventId, typeId, priceSGD){
    // Update progress in UI
    const setP = (id, text, ok=false) => {
      const el = document.getElementById(id);
      if(!el) return;
      el.textContent = text;
      el.style.borderColor = ok ? "rgba(41,208,127,.35)" : "rgba(255,255,255,.10)";
      el.style.background = ok ? "rgba(41,208,127,.10)" : "rgba(0,0,0,.18)";
    };

    // 1) Wallet
    const w = await TicketNFT_MetaMask.connect();
    if (!w?.address){
      alert("Please install MetaMask.");
      return;
    }
    setP("p-wallet", `Wallet: Connected (${shortAddr(w.address)})`, true);

    // 2) Payment + 3) Mint
    // For prototype we charge 0.001 ETH fixed on local chain, but show SGD price in UI.
    // If contract exists (deployed address), we call buyTicket(eventId,typeId).
    const ethValue = TicketNFT_Config.ethValuePerTicket || "0.001";
    try{
      setP("p-pay", `Payment: Approve in MetaMask (≈${ethValue} ETH)`, false);

      const receipt = await TicketNFT_TicketContract.buyTicket(eventId, typeId, ethValue);
      setP("p-pay", "Payment: Confirmed", true);

      setP("p-mint", "Mint: Minting NFT Ticket…", false);
      const tokenId = receipt?.tokenId ?? Math.floor(Math.random()*900000+100000);
      setP("p-mint", `Mint: Completed (Token #${tokenId})`, true);

      // 4) Rewards (local prototype)
      const tokEarned = TicketNFT_Config.tokPerPurchase || 10;
      const tokBal = Number(localStorage.getItem(LS_KEYS.tok) || "0");
      localStorage.setItem(LS_KEYS.tok, String(tokBal + tokEarned));
      setP("p-reward", `Rewards: +${tokEarned} TOK`, true);

      // Save ticket locally for "My Tickets"
      const tickets = getJSON(LS_KEYS.tickets, []);
      tickets.push({
        eventId, typeId, tokenId,
        wallet: w.address,
        status: "Valid",
        createdAt: new Date().toISOString()
      });
      setJSON(LS_KEYS.tickets, tickets);

      // Save tx history
      const tx = getJSON(LS_KEYS.tx, []);
      tx.unshift({
        type: "BUY_TICKET",
        eventId, typeId, tokenId,
        wallet: w.address,
        valueEth: ethValue,
        createdAt: new Date().toISOString(),
        hash: receipt?.hash || null
      });
      setJSON(LS_KEYS.tx, tx);

      window.location.href = "/tickets/success";
    }catch(err){
      console.error(err);
      alert("Transaction failed or cancelled.");
    }
  },

  renderMyTickets(){
    const tickets = getJSON(LS_KEYS.tickets, []);
    const empty = document.getElementById("ticketsEmpty");
    const grid = document.getElementById("ticketsGrid");

    if(!grid || !empty) return;

    if(!tickets.length){
      empty.style.display = "block";
      grid.style.display = "none";
      return;
    }
    empty.style.display = "none";
    grid.style.display = "grid";

    grid.innerHTML = tickets.map(t => `
      <article class="card">
        <div class="card-body">
          <div class="card-top">
            <div>
              <div class="card-title">NFT Ticket</div>
              <div class="muted small">Token ID: ${t.tokenId}</div>
              <div class="muted small">Status: ${t.status}</div>
            </div>
            <span class="badge ok">Owned</span>
          </div>
          <div style="margin-top:12px" class="muted small">Wallet: ${shortAddr(t.wallet)}</div>
          <div style="margin-top:12px; padding:10px; border:1px dashed rgba(255,255,255,.25); border-radius:14px; text-align:center">
            QR (prototype)
          </div>
        </div>
      </article>
    `).join("");
  },

  renderRewards(){
    const bal = Number(localStorage.getItem(LS_KEYS.tok) || "0");
    const el = document.getElementById("tokBalance");
    if(el) el.textContent = bal;
  },

  redeem(cost, name){
    const bal = Number(localStorage.getItem(LS_KEYS.tok) || "0");
    const msg = document.getElementById("redeemMsg");
    if(bal < cost){
      if(msg) msg.textContent = `Not enough TOK. You have ${bal}, need ${cost}.`;
      return;
    }
    localStorage.setItem(LS_KEYS.tok, String(bal - cost));
    if(msg) msg.textContent = `Redeemed: ${name} (-${cost} TOK).`;

    const tx = getJSON(LS_KEYS.tx, []);
    tx.unshift({
      type: "REDEEM",
      perk: name,
      cost,
      createdAt: new Date().toISOString()
    });
    setJSON(LS_KEYS.tx, tx);
  },

  renderTxHistory(){
    const tx = getJSON(LS_KEYS.tx, []);
    const empty = document.getElementById("txEmpty");
    const list = document.getElementById("txList");

    if(!list || !empty) return;

    if(!tx.length){
      empty.style.display = "block";
      list.style.display = "none";
      return;
    }
    empty.style.display = "none";
    list.style.display = "flex";

    list.innerHTML = tx.map(item => `
      <div class="row">
        <div>
          <div class="row-title">${item.type === "BUY_TICKET" ? "Ticket Purchase" : "Redeem Reward"}</div>
          <div class="muted small">${new Date(item.createdAt).toLocaleString()}</div>
          ${item.type === "BUY_TICKET" ? `<div class="muted small">Token #${item.tokenId} • ${item.valueEth} ETH</div>` : `<div class="muted small">${item.perk} • ${item.cost} TOK</div>`}
        </div>
        <span class="pill">${item.type === "BUY_TICKET" ? "Completed" : "Applied"}</span>
      </div>
    `).join("");
  }
};

// Update wallet button label if connected previously
window.addEventListener("DOMContentLoaded", async () => {
  const btn = document.getElementById("walletBtn");
  const cached = localStorage.getItem(LS_KEYS.wallet);
  if (btn && cached) btn.textContent = shortAddr(cached);

  btn?.addEventListener("click", async () => {
    const r = await TicketNFT_UI.connectWallet();
    if(r?.address) localStorage.setItem(LS_KEYS.wallet, r.address);
  });
});
