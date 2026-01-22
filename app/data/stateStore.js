import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_PATH = path.join(__dirname, "state.json");
const walletState = new Map();
const DEFAULT_TOK_PER_PURCHASE = 10;

function loadStateFromDisk() {
  try {
    if (!fs.existsSync(STATE_PATH)) return;
    const raw = fs.readFileSync(STATE_PATH, "utf-8");
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return;
    Object.entries(data).forEach(([wallet, state]) => {
      if (!wallet || !state) return;
      walletState.set(wallet, {
        tickets: Array.isArray(state.tickets) ? state.tickets : [],
        transactions: Array.isArray(state.transactions) ? state.transactions : [],
        tok: Number.isFinite(Number(state.tok)) ? Number(state.tok) : 0
      });
    });
  } catch {
    // Ignore load errors and start fresh
  }
}

function saveStateToDisk() {
  try {
    const obj = {};
    walletState.forEach((state, wallet) => {
      obj[wallet] = state;
    });
    fs.writeFileSync(STATE_PATH, JSON.stringify(obj, null, 2), "utf-8");
  } catch {
    // Ignore save errors in prototype mode
  }
}

loadStateFromDisk();

export function normalizeWallet(wallet) {
  if (typeof wallet !== "string") return null;
  const trimmed = wallet.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

export function getWalletFromReq(req) {
  return normalizeWallet(
    req.body?.wallet || req.query?.wallet || req.cookies?.ticketnft_wallet
  );
}

export function ensureWalletState(wallet) {
  if (!wallet) return null;
  if (!walletState.has(wallet)) {
    walletState.set(wallet, { tickets: [], transactions: [], tok: 0 });
    saveStateToDisk();
  }
  return walletState.get(wallet);
}

export function setWalletCookie(res, wallet) {
  if (!wallet) return;
  res.cookie("ticketnft_wallet", wallet, { httpOnly: true, sameSite: "lax" });
}

export function getTokPerPurchase() {
  return DEFAULT_TOK_PER_PURCHASE;
}

export function saveWalletState(wallet) {
  if (!wallet) return;
  if (!walletState.has(wallet)) return;
  saveStateToDisk();
}
