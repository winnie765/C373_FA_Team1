import { Router } from "express";
import {
  connectWallet,
  getRewards,
  getTickets,
  getTransactions,
  recordPurchase,
  redeemReward
} from "../controllers/apiController.js";

const router = Router();

router.post("/web3ConnectData", connectWallet);
router.get("/api/tickets", getTickets);
router.get("/api/transactions", getTransactions);
router.get("/api/rewards", getRewards);
router.post("/api/transactions/buy", recordPurchase);
router.post("/api/rewards/redeem", redeemReward);

export default router;
