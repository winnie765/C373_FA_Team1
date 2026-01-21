import { Router } from "express";
import { rewards, redeem, referral } from "../controllers/rewardController.js";

const router = Router();
router.get("/", rewards);
router.get("/redeem", redeem);
router.get("/referral", referral);

export default router;
