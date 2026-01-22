import {
  ensureWalletState,
  getTokPerPurchase,
  getWalletFromReq,
  normalizeWallet,
  saveWalletState,
  setWalletCookie
} from "../data/stateStore.js";

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function uniqueTokenId(state) {
  const existing = new Set(state.tickets.map(t => t.tokenId).filter(Number.isFinite));
  let tokenId = Date.now() % 1000000000;
  while (existing.has(tokenId)) {
    tokenId = (tokenId + Math.floor(Math.random() * 1000) + 1) % 1000000000;
  }
  return tokenId;
}

export function connectWallet(req, res) {
  const wallet = normalizeWallet(req.body?.wallet);
  if (!wallet) {
    return res.status(400).json({ success: false, message: "Wallet required." });
  }
  const state = ensureWalletState(wallet);
  if (Array.isArray(req.body?.tickets)) {
    state.tickets = req.body.tickets;
  }
  if (Array.isArray(req.body?.transactions)) {
    state.transactions = req.body.transactions;
  }
  const tokBalance = toNumber(req.body?.tokBalance);
  if (tokBalance !== null) {
    state.tok = tokBalance;
  }
  saveWalletState(wallet);
  setWalletCookie(res, wallet);
  return res.json({ success: true });
}

export function recordPurchase(req, res) {
  const wallet = normalizeWallet(req.body?.wallet);
  if (!wallet) {
    return res.status(400).json({ success: false, message: "Wallet required." });
  }

  const eventId = toNumber(req.body?.eventId);
  const typeId = toNumber(req.body?.typeId);
  if (eventId === null || typeId === null) {
    return res.status(400).json({ success: false, message: "Invalid ticket data." });
  }

  const state = ensureWalletState(wallet);
  const createdAt = req.body?.createdAt || new Date().toISOString();
  let tokenId = toNumber(req.body?.tokenId);
  const ticket = {
    eventId,
    typeId,
    tokenId,
    wallet,
    status: "Valid",
    createdAt
  };

  if (tokenId === null || state.tickets.some(t => t.tokenId === tokenId)) {
    tokenId = uniqueTokenId(state);
    ticket.tokenId = tokenId;
  }

  if (!state.tickets.some(t => t.tokenId === tokenId)) {
    state.tickets.push(ticket);
  }

  const tx = {
    type: "BUY_TICKET",
    eventId,
    typeId,
    tokenId,
    wallet,
    valueEth: req.body?.valueEth || null,
    discountEth: req.body?.discountEth || 0,
    tokSpent: req.body?.tokSpent || 0,
    createdAt,
    hash: req.body?.hash || null
  };
  state.transactions.unshift(tx);

  const tokEarned = toNumber(req.body?.tokEarned);
  const tokSpent = Math.max(0, toNumber(req.body?.tokSpent) || 0);
  state.tok = Math.max(0, state.tok - tokSpent);
  state.tok += tokEarned !== null ? tokEarned : getTokPerPurchase();

  saveWalletState(wallet);
  setWalletCookie(res, wallet);
  return res.json({
    success: true,
    tickets: state.tickets,
    transactions: state.transactions,
    tokBalance: state.tok
  });
}

export function redeemReward(req, res) {
  const wallet = normalizeWallet(req.body?.wallet);
  if (!wallet) {
    return res.status(400).json({ success: false, message: "Wallet required." });
  }
  const cost = toNumber(req.body?.cost);
  const perk = req.body?.name;
  if (cost === null || cost <= 0 || !perk) {
    return res.status(400).json({ success: false, message: "Invalid redemption." });
  }

  const state = ensureWalletState(wallet);
  if (state.tok < cost) {
    return res.status(400).json({
      success: false,
      message: `Not enough TOK. You have ${state.tok}, need ${cost}.`
    });
  }

  state.tok -= cost;
  state.transactions.unshift({
    type: "REDEEM",
    perk,
    cost,
    createdAt: req.body?.createdAt || new Date().toISOString()
  });

  saveWalletState(wallet);
  setWalletCookie(res, wallet);
  return res.json({
    success: true,
    tokBalance: state.tok,
    transactions: state.transactions
  });
}

export function getTickets(req, res) {
  const wallet = getWalletFromReq(req);
  if (!wallet) {
    return res.json({ success: true, tickets: [] });
  }
  const state = ensureWalletState(wallet);
  return res.json({ success: true, tickets: state.tickets });
}

export function getTransactions(req, res) {
  const wallet = getWalletFromReq(req);
  if (!wallet) {
    return res.json({ success: true, transactions: [] });
  }
  const state = ensureWalletState(wallet);
  return res.json({ success: true, transactions: state.transactions });
}

export function getRewards(req, res) {
  const wallet = getWalletFromReq(req);
  if (!wallet) {
    return res.json({ success: true, tokBalance: 0 });
  }
  const state = ensureWalletState(wallet);
  return res.json({ success: true, tokBalance: state.tok });
}
