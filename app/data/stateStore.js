const walletState = new Map();
const DEFAULT_TOK_PER_PURCHASE = 10;

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
