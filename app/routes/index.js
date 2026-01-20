import { Router } from "express";
import { home, homeNoConnect, about } from "../controllers/eventController.js";
import { myTickets } from "../controllers/ticketController.js";
import {
  renderLogin,
  renderSignup,
  handleLogin,
  handleSignup,
  handleLogout
} from "../controllers/authController.js";

const router = Router();
router.get("/", homeNoConnect);
router.get("/homepage", home);
router.get("/about", about);
router.get("/mytickets", myTickets);
router.get("/login", renderLogin);
router.post("/login", handleLogin);
router.get("/signup", renderSignup);
router.post("/signup", handleSignup);
router.post("/logout", handleLogout);

export default router;
