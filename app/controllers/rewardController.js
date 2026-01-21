export function rewards(req, res) {
  res.render("rewards", { title: "Loyalty Rewards" });
}

export function redeem(req, res) {
  res.render("redeem", { title: "Redeem Rewards" });
}

export function referral(req, res) {
  res.render("referral", { title: "Referral Code" });
}
