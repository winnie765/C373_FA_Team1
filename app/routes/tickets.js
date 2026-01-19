import { Router } from "express";
import { checkout, success, myTickets } from "../controllers/ticketController.js";

const router = Router();
router.get("/checkout", checkout);
router.get("/success", success);
router.get("/my", myTickets);

export default router;
