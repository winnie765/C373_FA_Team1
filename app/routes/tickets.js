import { Router } from "express";
import { checkout, success, myTickets, myOrders } from "../controllers/ticketController.js";

const router = Router();
router.get("/checkout", checkout);
router.get("/success", success);
router.get("/my", myTickets);
router.get("/orders", myOrders);

export default router;
