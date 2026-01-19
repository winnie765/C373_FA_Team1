import { Router } from "express";
import { rewards, redeem } from "../controllers/rewardController.js";

const router = Router();
router.get("/", rewards);
router.get("/redeem", redeem);

export default router;
