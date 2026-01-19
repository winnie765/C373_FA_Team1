import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEvents() {
  const p = path.join(__dirname, "..", "data", "events.json");
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

export function checkout(req, res) {
  const { eventId, typeId } = req.query;
  const events = loadEvents();
  const event = events.find(e => e.id === Number(eventId));
  if (!event) return res.status(404).render("404", { title: "Not Found" });
  const t = event.ticketTypes.find(x => x.typeId === Number(typeId));
  if (!t) return res.status(404).render("404", { title: "Not Found" });

  res.render("checkout", { title: "Checkout", event, ticketType: t });
}

export function success(req, res) {
  res.render("success", { title: "Purchase Complete!" });
}

export function myTickets(req, res) {
  // Tickets are read client-side from localStorage (prototype mode),
  // or from on-chain events if you extend later.
  res.render("myTickets", { title: "My Tickets" });
}
