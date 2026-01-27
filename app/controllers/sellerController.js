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
  // Support both form data and JSON
  const isJson = req.headers['content-type']?.includes('application/json');
  const body = req.body;

  const title = body.title;
  const sellerWallet = body.sellerWallet;
  const date = body.date || "";
  const time = body.time || "";
  const venue = body.venue || "";
  const image = body.image || "";
  const description = body.description || "";
  const chainEventId = body.chainEventId; // From blockchain

  if (!title) {
    if (isJson) {
      return res.status(400).json({ error: "Title is required." });
    }
    return res.status(400).render("seller-new", {
      title: "Create Event",
      error: "Title is required."
    });
  }

  const events = loadEvents();

  // If chainEventId is provided, use it; otherwise generate next ID
  let nextId;
  if (chainEventId !== null && chainEventId !== undefined) {
    // Chain event ID is 0-indexed, our JSON is 1-indexed
    nextId = Number(chainEventId) + 1;
  } else {
    nextId = events.reduce((max, e) => Math.max(max, Number(e.id) || 0), 0) + 1;
  }

  const event = {
    id: nextId,
    title,
    artist: "TBD",
    date,
    time,
    venue,
    image,
    description,
    seller: sellerWallet || "",
    chainEventId: chainEventId !== null ? Number(chainEventId) : null,
    ticketTypes: []
  };

  events.push(event);
  saveEvents(events);

  if (isJson) {
    return res.json({ success: true, event });
  }
  return res.redirect("/seller");
}

export function addTicketType(req, res) {
  const { id } = req.params;
  const isJson = req.headers['content-type']?.includes('application/json');
  const { name, priceSGD, maxSupply, chainTypeId } = req.body;

  const events = loadEvents();
  const event = events.find(e => Number(e.id) === Number(id));

  if (!event) {
    if (isJson) {
      return res.status(404).json({ error: "Event not found" });
    }
    return res.status(404).send("Event not found");
  }

  if (!name || !priceSGD || !maxSupply) {
    if (isJson) {
      return res.status(400).json({ error: "All fields are required." });
    }
    return res.status(400).send("All fields are required.");
  }

  // Use chainTypeId if provided, otherwise generate locally
  let nextTypeId;
  if (chainTypeId !== null && chainTypeId !== undefined) {
    nextTypeId = Number(chainTypeId);
  } else {
    nextTypeId = event.ticketTypes.reduce((m, t) => Math.max(m, Number(t.typeId) || 0), -1) + 1;
  }

  const ticketType = {
    typeId: nextTypeId,
    name,
    priceSGD: Number(priceSGD),
    maxSupply: Number(maxSupply),
    sold: 0,
    chainTypeId: chainTypeId !== null && chainTypeId !== undefined ? Number(chainTypeId) : null
  };

  event.ticketTypes.push(ticketType);
  saveEvents(events);

  if (isJson) {
    return res.json({ success: true, ticketType });
  }
  return res.redirect("/seller");
}
