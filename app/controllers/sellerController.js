import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EVENTS_PATH = path.join(__dirname, "..", "data", "events.json");

// Simple prototype auth (in-memory) -- accept any app user flagged as seller via cookie
const SELLER_USERS = new Map([
  ["seller@example.com", "password123"]
]);

function loadEvents() {
  const raw = fs.readFileSync(EVENTS_PATH, "utf-8");
  return JSON.parse(raw);
}

function saveEvents(events) {
  fs.writeFileSync(EVENTS_PATH, JSON.stringify(events, null, 2), "utf-8");
}

function requireSeller(req, res, next) {
  const authedSeller = req.cookies?.sellerUser && SELLER_USERS.has(req.cookies.sellerUser);
  const appUser = req.cookies?.authUserRole === "seller";
  if (authedSeller || appUser) return next();
  return res.redirect("/seller/login");
}

export function sellerMiddleware(req, res, next) {
  return requireSeller(req, res, next);
}

export function renderLogin(req, res) {
  res.render("seller-login", { title: "Seller Login", error: null });
}

export function handleLogin(req, res) {
  const { email, password } = req.body;
  if (!SELLER_USERS.has(email) || SELLER_USERS.get(email) !== password) {
    return res.status(401).render("seller-login", {
      title: "Seller Login",
      error: "Invalid credentials."
    });
  }
  res.cookie("sellerUser", email, { httpOnly: true, sameSite: "lax" });
  return res.redirect("/seller");
}

export function handleLogout(req, res) {
  res.clearCookie("sellerUser");
  res.clearCookie("authUser");
  res.clearCookie("authUserRole");
  return res.redirect("/");
}

export function dashboard(req, res) {
  const events = loadEvents();
  res.render("seller-dashboard", { title: "Seller Dashboard", events });
}

export function newEventForm(req, res) {
  res.render("seller-new", { title: "Create Event", error: null });
}

export function createEvent(req, res) {
  const { title, sellerWallet, date, time, venue, image, description } = req.body;
  if (!title) {
    return res.status(400).render("seller-new", {
      title: "Create Event",
      error: "Title is required."
    });
  }
  const events = loadEvents();
  const nextId = events.reduce((max, e) => Math.max(max, Number(e.id) || 0), 0) + 1;
  const event = {
    id: nextId,
    title,
    artist: "TBD",
    date: date || "",
    time: time || "",
    venue: venue || "",
    image: image || "",
    description: description || "",
    seller: sellerWallet || "",
    ticketTypes: []
  };
  events.push(event);
  saveEvents(events);
  return res.redirect("/seller");
}

export function addTicketType(req, res) {
  const { id } = req.params;
  const { name, priceSGD, maxSupply } = req.body;
  const events = loadEvents();
  const event = events.find(e => Number(e.id) === Number(id));
  if (!event) {
    return res.status(404).send("Event not found");
  }
  if (!name || !priceSGD || !maxSupply) {
    return res.status(400).send("All fields are required.");
  }
  const nextTypeId = event.ticketTypes.reduce((m, t) => Math.max(m, Number(t.typeId) || 0), -1) + 1;
  event.ticketTypes.push({
    typeId: nextTypeId,
    name,
    priceSGD: Number(priceSGD),
    maxSupply: Number(maxSupply),
    sold: 0
  });
  saveEvents(events);
  return res.redirect("/seller");
}
