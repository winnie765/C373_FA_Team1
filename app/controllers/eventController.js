import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEvents() {
  const p = path.join(__dirname, "..", "data", "events.json");
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

export function home(req, res) {
  const events = loadEvents();
  res.render("home", { title: "TicketNFT", events, showConnect: true });
}

export function homeNoConnect(req, res) {
  const events = loadEvents();
  res.render("home", { title: "TicketNFT", events, showConnect: false });
}

export function eventsList(req, res) {
  const events = loadEvents();
  res.render("events", { title: "All Events", events });
}

export function eventDetails(req, res) {
  const events = loadEvents();
  const id = Number(req.params.id);
  const event = events.find(e => e.id === id);
  if (!event) return res.status(404).render("404", { title: "Not Found" });

  // Status labels
  event.ticketTypes = event.ticketTypes.map(t => ({
    ...t,
    remaining: Math.max(0, t.maxSupply - t.sold),
    soldOut: t.sold >= t.maxSupply
  }));

  res.render("eventDetails", { title: event.title, event });
}

export function about(req, res) {
  res.render("about", { title: "About TicketNFT" });
}
