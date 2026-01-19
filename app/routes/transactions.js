import { Router } from "express";
import { transactions } from "../controllers/transactionController.js";

const router = Router();
router.get("/", transactions);

export default router;
