import { Router } from "express";
import { eventsList, eventDetails } from "../controllers/eventController.js";

const router = Router();
router.get("/", eventsList);
router.get("/:id", eventDetails);

export default router;
