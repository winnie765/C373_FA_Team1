import { Router } from "express";
import {
  sellerMiddleware,
  renderLogin,
  handleLogin,
  handleLogout,
  dashboard,
  newEventForm,
  createEvent,
  addTicketType
} from "../controllers/sellerController.js";

const router = Router();

router.get("/login", renderLogin);
router.post("/login", handleLogin);
router.post("/logout", handleLogout);

router.get("/", sellerMiddleware, dashboard);
router.get("/events/new", sellerMiddleware, newEventForm);
router.post("/events", sellerMiddleware, createEvent);
router.post("/events/:id/types", sellerMiddleware, addTicketType);

export default router;
