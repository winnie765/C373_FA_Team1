// UI helpers + localStorage prototype state
const LS_KEYS = {
  wallet: "ticketnft_wallet",
  tickets: "ticketnft_tickets",
  tok: "ticketnft_tok",
  tx: "ticketnft_tx"
};
const LOGGED_IN = typeof window !== "undefined" && window.TicketNFT_LoggedIn === true;

function getJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function setJSON(key, v) { localStorage.setItem(key, JSON.stringify(v)); }
function walletTicketsKey(wallet) {
  return wallet ? `${LS_KEYS.tickets}_${wallet.toLowerCase()}` : null;
}
function walletTxKey(wallet) {
  return wallet ? `${LS_KEYS.tx}_${wallet.toLowerCase()}` : null;
}

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
  connectWallet(wallet, payload = {}) {
    return apiRequest("/web3ConnectData", {
      method: "POST",
      body: JSON.stringify({ wallet, ...payload })
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
async function getActiveAddress(fallback) {
  try {
    if (!window.ethereum) return fallback || null;
    if (typeof ethers === "undefined") {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      return accounts?.[0] || fallback || null;
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return await signer.getAddress();
  } catch {
    return fallback || null;
  }
}

async function syncWalletState(walletAddr) {
  if (!walletAddr) return;
  const wKey = walletTicketsKey(walletAddr);
  const txKey = walletTxKey(walletAddr);
  const cachedTickets = wKey ? getJSON(wKey, []) : getJSON(LS_KEYS.tickets, []);
  const cachedTx = txKey ? getJSON(txKey, []) : getJSON(LS_KEYS.tx, []);
  const cachedTok = Number(localStorage.getItem(LS_KEYS.tok) || "0");
  await TicketNFT_API.connectWallet(walletAddr, {
    tickets: cachedTickets,
    transactions: cachedTx,
    tokBalance: cachedTok
  });
}

function handleAccountSwitch(accounts) {
  const next = Array.isArray(accounts) && accounts.length ? accounts[0] : null;
  if (!next) {
    localStorage.removeItem(LS_KEYS.wallet);
    localStorage.removeItem(LS_KEYS.tickets);
    localStorage.removeItem(LS_KEYS.tx);
    localStorage.removeItem(LS_KEYS.tok);
    TicketNFT_UI.updateWalletUI(false);
    return;
  }
  const lower = next.toLowerCase();
  const current = localStorage.getItem(LS_KEYS.wallet);
  if (current && current.toLowerCase() === lower) return;

  localStorage.setItem(LS_KEYS.wallet, next);
  const btn = document.getElementById("walletBtn");
  if (btn) btn.textContent = shortAddr(next);
  TicketNFT_UI.updateWalletUI(true);
  syncWalletState(next).then(() => {
    TicketNFT_UI.renderMyTickets?.();
    TicketNFT_UI.renderTxHistory?.();
    TicketNFT_UI.renderRewards?.();
  });
}

function startAccountPoll() {
  if (!window.ethereum || !LOGGED_IN) return;
  let last = localStorage.getItem(LS_KEYS.wallet)?.toLowerCase() || null;
  setInterval(async () => {
    try {
      const acct = await getActiveAddress(null);
      const lower = acct ? acct.toLowerCase() : null;
      if (lower !== last) {
        last = lower;
        handleAccountSwitch(acct ? [acct] : []);
      }
    } catch {
      /* ignore */
    }
  }, 2500);
}

window.TicketNFT_UI = {
  updateWalletUI(connected){
    const logoutForm = document.getElementById("logoutForm");
    const profileBtn = document.getElementById("profileBtn");
    if (logoutForm) logoutForm.style.display = connected ? "block" : "none";
    if (profileBtn) profileBtn.style.display = connected ? "inline-flex" : "none";
  },
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
    const activeAddress = await getActiveAddress(r.address);
    r = { address: activeAddress || r.address };
    setProgress("p-wallet", `Wallet: Connected (${shortAddr(r.address)})`, true);
    const btn = document.getElementById("walletBtn");
    if (btn && r?.address) btn.textContent = shortAddr(r.address);
    if (r?.address) {
      localStorage.setItem(LS_KEYS.wallet, r.address);
      await syncWalletState(r.address);
      this.updateWalletUI(true);
      await this.renderMyTickets?.();
      await this.renderTxHistory?.();
      await this.renderRewards?.();
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
    const walletAddr = await getActiveAddress(w.address);
    localStorage.setItem(LS_KEYS.wallet, walletAddr);
    await syncWalletState(walletAddr);
    setProgress("p-wallet", `Wallet: Connected (${shortAddr(walletAddr)})`, true);

    // 2) Payment + 3) Mint
    // For prototype we charge 0.001 ETH fixed on local chain, but show SGD price in UI.
    // If contract exists (deployed address), we call buyTicket(eventId,typeId).
    const chainEventId = Math.max(0, Number(eventId) - 1);
    let ethValue = TicketNFT_Config.ethValuePerTicket || "0.001";
    const numericPrice = Number(priceSGD);
    const hasDisplayPrice = Number.isFinite(numericPrice) && numericPrice > 0;
    if (hasDisplayPrice) {
      ethValue = String(numericPrice); // treat displayed price as ETH amount for prototype
      simulateOnly = true;            // avoid on-chain price override when using UI price
    }
    let tokBalance = 0;
    let discountEthDisplay = "0";
    let discountLabel = "";
    let simulateOnly = false;
    try {
      const rewards = await TicketNFT_API.getRewards();
      tokBalance = typeof rewards?.tokBalance === "number"
        ? rewards.tokBalance
        : Number(localStorage.getItem(LS_KEYS.tok) || "0");
    } catch {
      tokBalance = Number(localStorage.getItem(LS_KEYS.tok) || "0");
    }
    const maxTokensSpendable = Math.floor(tokBalance / 100) * 100; // multiples of 100
    const tokPerStep = 100;
    const ethPerStep = 0.0001;
    let tokSpent = 0;
    let discountEth = 0;
    try{
      // If we are simulating (off-chain seller event), skip on-chain checks entirely
      if (simulateOnly) {
        setProgress("p-pay", `Payment: Simulated (${ethValue} ETH)`, true);
        setProgress("p-mint", "Mint: Minting NFT Ticket", false);
        const tokenId = Math.floor(Math.random()*900000+100000);
        setProgress("p-mint", `Mint: Completed (Token #${tokenId})`, true);
        const tokEarned = TicketNFT_Config.tokPerPurchase || 10;
        const createdAt = new Date().toISOString();
        const stored = await TicketNFT_API.recordPurchase({
          wallet: walletAddr,
          eventId,
          typeId,
          tokenId,
          valueEth: ethValue,
          discountEth: 0,
          tokSpent: 0,
          hash: null,
          createdAt,
          tokEarned
        });
        if (stored?.tickets) {
          setJSON(LS_KEYS.tickets, stored.tickets);
          const wKey = walletTicketsKey(walletAddr);
          if (wKey) setJSON(wKey, stored.tickets);
        }
        if (stored?.transactions) {
          setJSON(LS_KEYS.tx, stored.transactions);
          const txKey = walletTxKey(walletAddr);
          if (txKey) setJSON(txKey, stored.transactions);
        }
        if (typeof stored?.tokBalance === "number") {
          localStorage.setItem(LS_KEYS.tok, String(stored.tokBalance));
        }
        setProgress("p-reward", `Rewards: +${tokEarned} TOK`, true);
        window.location.href = "/tickets/success";
        return;
      }

      const [eventInfo, typeInfo] = await Promise.all([
        TicketNFT_TicketContract.getEventInfo(chainEventId),
        TicketNFT_TicketContract.getTicketType(chainEventId, typeId)
      ]);

      if (!eventInfo?.active) {
        // If the event doesn't exist on-chain (off-chain added seller event), allow prototype simulation
        simulateOnly = true;
      }
      const hasSupply =
        typeInfo?.maxSupply !== null &&
        typeof typeInfo?.maxSupply !== "undefined" &&
        Number(typeInfo.maxSupply) > 0;
      if (!simulateOnly && hasSupply && typeInfo?.sold !== null && Number(typeInfo.sold) >= Number(typeInfo.maxSupply)) {
        alert("This ticket type is sold out.");
        return;
      }

      if (!simulateOnly) {
        const priceWei = await TicketNFT_TicketContract.getTicketPrice(chainEventId, typeId);
        if (priceWei) {
          ethValue = ethers.formatEther(priceWei);
        }
      }
      // Apply TOK discount off-chain (prototype): every 100 TOK = 0.0001 ETH off, capped to price
      const priceNum = Number(ethValue);
      if (Number.isFinite(priceNum) && priceNum > 0 && maxTokensSpendable > 0) {
        const maxDiscountEth = priceNum;
        const possibleDiscountEth = (maxTokensSpendable / tokPerStep) * ethPerStep;
        discountEth = Math.min(possibleDiscountEth, maxDiscountEth);
        tokSpent = Math.round((discountEth / ethPerStep) * tokPerStep);
        tokSpent = Math.min(tokSpent, maxTokensSpendable);
        const discounted = Math.max(priceNum - discountEth, 0);
        ethValue = discounted.toFixed(6);
        discountEthDisplay = discountEth.toFixed(6);
        discountLabel = `Applied ${tokSpent} TOK for -${discountEthDisplay} ETH`;
      }
      setProgress(
        "p-pay",
        discountLabel
          ? `Payment: Approve in MetaMask (${ethValue} ETH, ${discountLabel})`
          : `Payment: Approve in MetaMask (${ethValue} ETH)`,
        false
      );

      let receipt = null;
      let paidEth = ethValue;
      // If simulation mode or discount applied, avoid on-chain call (prototype path)
      if (discountEth > 0 || simulateOnly) {
        paidEth = ethValue;
        setProgress("p-pay", `Payment: Simulated${discountEth > 0 ? ` with discount (${discountEthDisplay} ETH off)` : ""}`, true);
      } else {
        receipt = await TicketNFT_TicketContract.buyTicket(chainEventId, typeId, ethValue);
        paidEth = receipt?.priceEth || ethValue;
        setProgress("p-pay", "Payment: Confirmed", true);
      }

      setProgress("p-mint", "Mint: Minting NFT Ticket", false);
      const tokenId = receipt?.tokenId ?? Math.floor(Math.random()*900000+100000);
      setProgress("p-mint", `Mint: Completed (Token #${tokenId})`, true);

      // 4) Rewards (backend)
      const tokEarned = TicketNFT_Config.tokPerPurchase || 10;
      const createdAt = new Date().toISOString();
      const stored = await TicketNFT_API.recordPurchase({
        wallet: walletAddr,
        eventId,
        typeId,
        tokenId,
        valueEth: paidEth,
        discountEth,
        tokSpent,
        hash: receipt?.hash || null,
        createdAt,
        tokEarned
      });

      if (stored?.success) {
      if (stored?.tickets) {
        setJSON(LS_KEYS.tickets, stored.tickets);
        const wKey = walletTicketsKey(walletAddr);
        if (wKey) setJSON(wKey, stored.tickets);
      }
        if (stored?.transactions) {
          setJSON(LS_KEYS.tx, stored.transactions);
          const txKey = walletTxKey(walletAddr);
          if (txKey) setJSON(txKey, stored.transactions);
        }
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
          wallet: walletAddr,
          status: "Valid",
          createdAt
        });
        setJSON(LS_KEYS.tickets, tickets);
        const wKey = walletTicketsKey(walletAddr);
        if (wKey) setJSON(wKey, tickets);

        const tx = getJSON(LS_KEYS.tx, []);
        tx.unshift({
          type: "BUY_TICKET",
          eventId,
          typeId,
          tokenId,
          wallet: walletAddr,
          valueEth: ethValue,
          createdAt,
          hash: receipt?.hash || null
        });
        setJSON(LS_KEYS.tx, tx);
        const txKey = walletTxKey(walletAddr);
        if (txKey) setJSON(txKey, tx);
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
    const cachedWallet = localStorage.getItem(LS_KEYS.wallet);
    const response = await TicketNFT_API.getTickets();
    if (Array.isArray(response?.tickets) && response.tickets.length) {
      setJSON(LS_KEYS.tickets, response.tickets);
      const wKey = walletTicketsKey(cachedWallet);
      if (wKey) setJSON(wKey, response.tickets);
    }
    if (!cachedWallet) {
      const empty = document.getElementById("ticketsEmpty");
      const grid = document.getElementById("ticketsGrid");
      if (grid) grid.style.display = "none";
      if (empty) {
        empty.style.display = "flex";
        empty.innerHTML = `
          <div class="muted">Connect MetaMask to view your tickets.</div>
          <button class="btn btn-primary" type="button" onclick="TicketNFT_UI.connectWallet()">Connect Wallet</button>
        `;
      }
      return;
    }

    const cachedWalletTickets = cachedWallet ? getJSON(walletTicketsKey(cachedWallet), []) : [];
    const cachedTickets = cachedWalletTickets.length ? cachedWalletTickets : getJSON(LS_KEYS.tickets, []);
    const tickets = (Array.isArray(response?.tickets) && response.tickets.length)
      ? response.tickets
      : cachedTickets;
    const empty = document.getElementById("ticketsEmpty");
    const grid = document.getElementById("ticketsGrid");

    if(!grid || !empty) return;

    if(!tickets.length){
      empty.style.display = "flex";
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
                <div class="muted small">Ticket ID: ${t.tokenId ?? "Pending"}</div>
                <div class="muted small">${eventLabel} -> ${typeLabel}</div>
              </div>
              <span class="badge ok">${status}</span>
            </div>
            <div class="ticket-meta">
              <span class="ticket-pill">Token #${t.tokenId}</span>
              <span class="ticket-dot"></span>
              <span class="muted small">Wallet ${shortAddr(t.wallet)}</span>
            </div>
            <div class="ticket-qr">QR: ${t.tokenId ?? "Pending"}</div>
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
    const wallet = localStorage.getItem(LS_KEYS.wallet);
    if (!wallet) {
      const balanceCard = document.querySelector(".rewards-balance-card");
      if (balanceCard) {
        balanceCard.innerHTML = `
          <div class="rewards-balance-row">
            <div>
              <div class="rewards-label">Your Balance</div>
              <div class="rewards-balance">
                <span>0</span>
                <span class="rewards-token">TOK</span>
              </div>
            </div>
            <div class="rewards-earned">
              <div class="rewards-label">Total Earned</div>
              <div class="rewards-earned-value">0 TOK</div>
            </div>
          </div>
          <div class="rewards-progress">
            <div class="rewards-progress-row">
              <span>Connect MetaMask to view rewards.</span>
              <span>0 / 20 TOK</span>
            </div>
            <div class="rewards-progress-bar">
              <span style="width:0%"></span>
            </div>
          </div>
          <div class="rewards-connect">
            <button class="btn btn-primary" type="button"
              onclick="event.preventDefault(); event.stopPropagation(); TicketNFT_UI.connectWallet().then(() => window.location.reload())">
              Connect Wallet
            </button>
          </div>
        `;
      }
      return;
    }

    const response = await TicketNFT_API.getRewards();
    const bal = typeof response?.tokBalance === "number"
      ? response.tokBalance
      : Number(localStorage.getItem(LS_KEYS.tok) || "0");
    if (typeof response?.tokBalance === "number") {
      localStorage.setItem(LS_KEYS.tok, String(response.tokBalance));
    }
    const el = document.getElementById("tokBalance");
    if(el) el.textContent = bal;

    let tx = [];
    if (wallet) {
      const txResponse = await TicketNFT_API.getTransactions();
      if (Array.isArray(txResponse?.transactions) && txResponse.transactions.length) {
        setJSON(LS_KEYS.tx, txResponse.transactions);
        const txKey = walletTxKey(wallet);
        if (txKey) setJSON(txKey, txResponse.transactions);
        tx = txResponse.transactions;
      } else {
        const cachedWalletTx = getJSON(walletTxKey(wallet), []);
        tx = cachedWalletTx.length ? cachedWalletTx : getJSON(LS_KEYS.tx, []);
      }
    }

    const redeemedTotal = tx
      .filter(item => item.type === "REDEEM")
      .reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
    const earnedTotal = bal + redeemedTotal;
    const earnedEl = document.getElementById("tokEarned");
    if (earnedEl) earnedEl.textContent = `${earnedTotal} TOK`;

    const nextRewardCost = 20;
    const currentForNext = Math.min(bal, nextRewardCost);
    const currentEl = document.getElementById("nextRewardCurrent");
    const targetEl = document.getElementById("nextRewardTarget");
    const barEl = document.getElementById("nextRewardBar");
    if (currentEl) currentEl.textContent = String(currentForNext);
    if (targetEl) targetEl.textContent = String(nextRewardCost);
    if (barEl) barEl.style.width = `${Math.min(100, Math.round((currentForNext / nextRewardCost) * 100))}%`;

    const redeemedList = document.getElementById("redeemedList");
    const redeemedEmpty = document.getElementById("redeemedEmpty");
    if (redeemedList && redeemedEmpty) {
      const redeemed = tx.filter(item => item.type === "REDEEM");
      if (!redeemed.length) {
        redeemedList.innerHTML = "";
        redeemedEmpty.textContent = "No rewards redeemed yet.";
      } else {
        redeemedEmpty.textContent = "";
        redeemedList.innerHTML = redeemed.map(item => `
          <div class="rewards-earn-card">
            <div class="rewards-earn-icon rewards-earn-icon-purple">RD</div>
            <div>
              <div class="rewards-earn-title">${item.perk}</div>
              <div class="rewards-earn-desc">Redeemed ${item.cost} TOK • ${new Date(item.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        `).join("");
      }
    }
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
      const wallet = localStorage.getItem(LS_KEYS.wallet);
      const txKey = walletTxKey(wallet);
      if (txKey) setJSON(txKey, tx);
      return;
    }

    if (typeof response?.tokBalance === "number") {
      localStorage.setItem(LS_KEYS.tok, String(response.tokBalance));
    }
    if (response?.transactions) {
      setJSON(LS_KEYS.tx, response.transactions);
      const wallet = localStorage.getItem(LS_KEYS.wallet);
      const txKey = walletTxKey(wallet);
      if (txKey) setJSON(txKey, response.transactions);
    }
    if (msg) msg.textContent = `Redeemed: ${name} (-${cost} TOK).`;
  },

  async renderTxHistory(){
    const cachedWallet = localStorage.getItem(LS_KEYS.wallet);
    if (!cachedWallet) {
      const empty = document.getElementById("txEmpty");
      const list = document.getElementById("txList");
      if (list) list.style.display = "none";
      if (empty) {
        empty.style.display = "block";
        empty.textContent = "Connect MetaMask to view your transactions.";
      }
      return;
    }
    const response = await TicketNFT_API.getTransactions();
    if (Array.isArray(response?.transactions) && response.transactions.length) {
      setJSON(LS_KEYS.tx, response.transactions);
      const txKey = walletTxKey(cachedWallet);
      if (txKey) setJSON(txKey, response.transactions);
    }
    const cachedWalletTx = cachedWallet ? getJSON(walletTxKey(cachedWallet), []) : [];
    const tx = (Array.isArray(response?.transactions) && response.transactions.length)
      ? response.transactions
      : (cachedWalletTx.length ? cachedWalletTx : getJSON(LS_KEYS.tx, []));
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
          ${item.type === "BUY_TICKET"
            ? `<div class="muted small">Token #${item.tokenId} • ${item.valueEth} ETH${item.discountEth ? ` (discount ${item.discountEth} ETH using ${item.tokSpent || 0} TOK)` : ""}</div>`
            : `<div class="muted small">${item.perk} • ${item.cost} TOK</div>`}
        </div>
        <span class="pill">${item.type === "BUY_TICKET" ? "Completed" : "Applied"}</span>
      </div>
    `).join("");
  }
};

// Update wallet button label if connected previously
window.addEventListener("DOMContentLoaded", async () => {
  const btn = document.getElementById("walletBtn");
  const logoutForm = document.getElementById("logoutForm");
  const profileBtn = document.getElementById("profileBtn");
  const cached = localStorage.getItem(LS_KEYS.wallet);
  if (btn && cached && LOGGED_IN) btn.textContent = shortAddr(cached);
  TicketNFT_UI.updateWalletUI(!!cached && LOGGED_IN);
  if (cached && LOGGED_IN) {
    await syncWalletState(cached);
  }

  btn?.addEventListener("click", async () => {
    const r = await TicketNFT_UI.connectWallet();
    if(r?.address) localStorage.setItem(LS_KEYS.wallet, r.address);
  });

  logoutForm?.addEventListener("submit", () => {
    localStorage.removeItem(LS_KEYS.wallet);
    TicketNFT_UI.updateWalletUI(false);
  });

  if (window.ethereum?.on) {
    window.ethereum.on("accountsChanged", handleAccountSwitch);
    window.ethereum.on("chainChanged", () => window.location.reload());
  }
  startAccountPoll();
});





