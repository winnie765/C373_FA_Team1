import express from "express";
import path from "path";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";

import indexRoutes from "./routes/index.js";
import eventRoutes from "./routes/events.js";
import ticketRoutes from "./routes/tickets.js";
import rewardRoutes from "./routes/rewards.js";
import txRoutes from "./routes/transactions.js";
import apiRoutes from "./routes/api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static: app assets
app.use("/public", express.static(path.join(__dirname, "public")));

// Static: expose blockchain folder to browser (MetaMask scripts + ABI + addresses)
app.use("/blockchain", express.static(path.join(__dirname, "..", "blockchain")));

// Routes
app.use("/", indexRoutes);
app.use("/events", eventRoutes);
app.use("/tickets", ticketRoutes);
app.use("/rewards", rewardRoutes);
app.use("/transactions", txRoutes);
app.use("/", apiRoutes);

// 404
app.use((req, res) => {
  res.status(404).render("404", { title: "Not Found" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TicketNFT app running on http://localhost:${PORT}`));
