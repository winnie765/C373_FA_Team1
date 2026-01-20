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

function setProgress(id, text, ok = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.style.borderColor = ok ? "rgba(41,208,127,.35)" : "rgba(255,255,255,.10)";
  el.style.background = ok ? "rgba(41,208,127,.10)" : "rgba(0,0,0,.18)";
}

async function apiRequest(path, options = {}) {
  const config = {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  };
  try {
    const res = await fetch(path, config);
    let data = null;
    try {
      data = await res.json();
    } catch (err) {
      data = null;
    }
    if (!res.ok) {
      return data || { success: false, message: `Request failed: ${res.status}` };
    }
    return data;
  } catch (err) {
    console.warn("API request failed", path, err);
    return null;
  }
}

const TicketNFT_API = {
  _walletParam() {
    const wallet = localStorage.getItem(LS_KEYS.wallet);
    return wallet ? `?wallet=${encodeURIComponent(wallet)}` : "";
  },
  connectWallet(wallet) {
    return apiRequest("/web3ConnectData", {
      method: "POST",
      body: JSON.stringify({ wallet })
    });
  },
  getTickets() {
    return apiRequest(`/api/tickets${this._walletParam()}`);
  },
  getTransactions() {
    return apiRequest(`/api/transactions${this._walletParam()}`);
  },
  getRewards() {
    return apiRequest(`/api/rewards${this._walletParam()}`);
  },
  recordPurchase(payload) {
    return apiRequest("/api/transactions/buy", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  redeemReward(payload) {
    return apiRequest("/api/rewards/redeem", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};

function shortAddr(a){
  if(!a) return "";
  return a.slice(0,6) + "..." + a.slice(-4);
}

window.TicketNFT_UI = {
  async connectWallet(){
    if (!window.ethereum) {
      alert("MetaMask not detected. Please install or enable it in your browser.");
      return null;
    }

    let r = null;
    try {
      r = await TicketNFT_MetaMask.connect();
    } catch (err) {
      console.error(err);
      alert("MetaMask connection failed.");
      return null;
    }

    if (!r?.address) {
      alert("MetaMask connection was cancelled or locked.");
      return null;
    }
    setProgress("p-wallet", `Wallet: Connected (${shortAddr(r.address)})`, true);
    const btn = document.getElementById("walletBtn");
    if (btn && r?.address) btn.textContent = shortAddr(r.address);
    if (r?.address) {
      localStorage.setItem(LS_KEYS.wallet, r.address);
      await TicketNFT_API.connectWallet(r.address);
    }
    return r;
  },

  async buyTicketFlow(eventId, typeId, priceSGD){
    // 1) Wallet
    if (!window.ethereum) {
      alert("MetaMask not detected. Please install or enable it in your browser.");
      return;
    }

    const w = await TicketNFT_MetaMask.connect();
    if (!w?.address){
      alert("MetaMask connection was cancelled or locked.");
      return;
    }
    await TicketNFT_API.connectWallet(w.address);
    setProgress("p-wallet", `Wallet: Connected (${shortAddr(w.address)})`, true);

    // 2) Payment + 3) Mint
    // For prototype we charge 0.001 ETH fixed on local chain, but show SGD price in UI.
    // If contract exists (deployed address), we call buyTicket(eventId,typeId).
    const chainEventId = Math.max(0, Number(eventId) - 1);
    let ethValue = TicketNFT_Config.ethValuePerTicket || "0.001";
    try{
      const [eventInfo, typeInfo, alreadyBought] = await Promise.all([
        TicketNFT_TicketContract.getEventInfo(chainEventId),
        TicketNFT_TicketContract.getTicketType(chainEventId, typeId),
        TicketNFT_TicketContract.hasBought(w.address, chainEventId, typeId)
      ]);

      if (!eventInfo?.active) {
        alert("This event is not active.");
        return;
      }
      if (alreadyBought) {
        alert("You already own this ticket type for this event.");
        return;
      }
      if (typeInfo?.maxSupply !== null && typeInfo?.sold !== null && Number(typeInfo.sold) >= Number(typeInfo.maxSupply)) {
        alert("This ticket type is sold out.");
        return;
      }

      const priceWei = await TicketNFT_TicketContract.getTicketPrice(chainEventId, typeId);
      if (priceWei) {
        ethValue = ethers.formatEther(priceWei);
      }
      setProgress("p-pay", `Payment: Approve in MetaMask (${ethValue} ETH)`, false);

      const receipt = await TicketNFT_TicketContract.buyTicket(chainEventId, typeId, ethValue);
      const paidEth = receipt?.priceEth || ethValue;
      setProgress("p-pay", "Payment: Confirmed", true);

      setProgress("p-mint", "Mint: Minting NFT Ticket", false);
      const tokenId = receipt?.tokenId ?? Math.floor(Math.random()*900000+100000);
      setProgress("p-mint", `Mint: Completed (Token #${tokenId})`, true);

      // 4) Rewards (backend)
      const tokEarned = TicketNFT_Config.tokPerPurchase || 10;
      const createdAt = new Date().toISOString();
      const stored = await TicketNFT_API.recordPurchase({
        wallet: w.address,
        eventId,
        typeId,
        tokenId,
        valueEth: paidEth,
        hash: receipt?.hash || null,
        createdAt,
        tokEarned
      });

      if (stored?.success) {
        if (stored?.tickets) setJSON(LS_KEYS.tickets, stored.tickets);
        if (stored?.transactions) setJSON(LS_KEYS.tx, stored.transactions);
        if (typeof stored?.tokBalance === "number") {
          localStorage.setItem(LS_KEYS.tok, String(stored.tokBalance));
        }
      } else {
        const tokBal = Number(localStorage.getItem(LS_KEYS.tok) || "0");
        localStorage.setItem(LS_KEYS.tok, String(tokBal + tokEarned));
        const tickets = getJSON(LS_KEYS.tickets, []);
        tickets.push({
          eventId,
          typeId,
          tokenId,
          wallet: w.address,
          status: "Valid",
          createdAt
        });
        setJSON(LS_KEYS.tickets, tickets);

        const tx = getJSON(LS_KEYS.tx, []);
        tx.unshift({
          type: "BUY_TICKET",
          eventId,
          typeId,
          tokenId,
          wallet: w.address,
          valueEth: ethValue,
          createdAt,
          hash: receipt?.hash || null
        });
        setJSON(LS_KEYS.tx, tx);
      }
      setProgress("p-reward", `Rewards: +${tokEarned} TOK`, true);

      window.location.href = "/tickets/success";
    }catch(err){
      console.error(err);
      const rawMsg = String(err?.reason || err?.data?.message || err?.message || "");
      if (rawMsg.includes("Contract not deployed")) {
        alert("Contract not deployed. Deploy TicketNFT to Ganache/Truffle before purchasing.");
      } else if (rawMsg.includes("Already owned")) {
        alert("You already own this ticket type for this event.");
      } else if (rawMsg.includes("Sold out")) {
        alert("This ticket type is sold out.");
      } else if (rawMsg.includes("Wrong payment")) {
        alert("Incorrect payment amount. Please refresh and try again.");
      } else if (rawMsg.includes("missing revert data")) {
        alert("Transaction failed during gas estimation. Check the network, ticket availability, and try again.");
      } else {
        alert(rawMsg ? `Transaction failed: ${rawMsg}` : "Transaction failed or cancelled.");
      }
    }
  },

  async renderMyTickets(){
    const response = await TicketNFT_API.getTickets();
    if (response?.tickets) setJSON(LS_KEYS.tickets, response.tickets);
    const tickets = response?.tickets ?? getJSON(LS_KEYS.tickets, []);
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

    grid.innerHTML = tickets.map(t => {
      const minted = t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "Recently";
      const status = t.status || "Valid";
      const eventLabel = Number.isFinite(Number(t.eventId)) ? `Event #${t.eventId}` : "Event";
      const typeLabel = Number.isFinite(Number(t.typeId)) ? `Type #${t.typeId}` : "Type";
      return `
        <article class="card ticket-card">
          <div class="card-body">
            <div class="ticket-card-header">
              <div>
                <div class="card-title">NFT Ticket</div>
                <div class="muted small">${eventLabel} -> ${typeLabel}</div>
              </div>
              <span class="badge ok">${status}</span>
            </div>
            <div class="ticket-meta">
              <span class="ticket-pill">Token #${t.tokenId}</span>
              <span class="ticket-dot"></span>
              <span class="muted small">Wallet ${shortAddr(t.wallet)}</span>
            </div>
            <div class="ticket-qr">QR: ${t.tokenId || "Pending"}</div>
            <div class="ticket-footer">
              <div class="muted small">Minted ${minted}</div>
              <a class="btn btn-view btn-sm" href="/events/${t.eventId}">View Event</a>
            </div>
          </div>
        </article>
      `;
    }).join("");
  },

  async renderRewards(){
    const response = await TicketNFT_API.getRewards();
    const bal = typeof response?.tokBalance === "number"
      ? response.tokBalance
      : Number(localStorage.getItem(LS_KEYS.tok) || "0");
    if (typeof response?.tokBalance === "number") {
      localStorage.setItem(LS_KEYS.tok, String(response.tokBalance));
    }
    const el = document.getElementById("tokBalance");
    if(el) el.textContent = bal;
  },

  async redeem(cost, name){
    const msg = document.getElementById("redeemMsg");
    const response = await TicketNFT_API.redeemReward({
      wallet: localStorage.getItem(LS_KEYS.wallet),
      cost,
      name,
      createdAt: new Date().toISOString()
    });

    if (response?.success === false) {
      if (msg) msg.textContent = response.message || "Redemption failed.";
      return;
    }

    if (!response) {
      const fallbackBal = Number(localStorage.getItem(LS_KEYS.tok) || "0");
      if (fallbackBal < cost) {
        if (msg) msg.textContent = `Not enough TOK. You have ${fallbackBal}, need ${cost}.`;
        return;
      }
      localStorage.setItem(LS_KEYS.tok, String(fallbackBal - cost));
      if (msg) msg.textContent = `Redeemed: ${name} (-${cost} TOK).`;

      const tx = getJSON(LS_KEYS.tx, []);
      tx.unshift({
        type: "REDEEM",
        perk: name,
        cost,
        createdAt: new Date().toISOString()
      });
      setJSON(LS_KEYS.tx, tx);
      return;
    }

    if (typeof response?.tokBalance === "number") {
      localStorage.setItem(LS_KEYS.tok, String(response.tokBalance));
    }
    if (response?.transactions) {
      setJSON(LS_KEYS.tx, response.transactions);
    }
    if (msg) msg.textContent = `Redeemed: ${name} (-${cost} TOK).`;
  },

  async renderTxHistory(){
    const response = await TicketNFT_API.getTransactions();
    if (response?.transactions) setJSON(LS_KEYS.tx, response.transactions);
    const tx = response?.transactions ?? getJSON(LS_KEYS.tx, []);
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





