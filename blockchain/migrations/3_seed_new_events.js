const TicketNFT = artifacts.require("TicketNFT");

const SELLER =
  process.env.ABC_SELLER ||
  "0x6e8Ab59e5e3CD43a78b1B5449aA522952476F36A"; // default seller used in events.json

function toNumber(v) {
  return typeof v?.toNumber === "function" ? v.toNumber() : Number(v);
}

module.exports = async function (deployer, network, accounts) {
  const sellerAddr = SELLER || accounts[0];
  const contract = await TicketNFT.deployed();

  async function findEventIdByTitle(title) {
    const count = toNumber(await contract.eventCount());
    for (let i = 0; i < count; i += 1) {
      const evt = await contract.events(i);
      if (evt.title === title) return i;
    }
    return null;
  }

  async function ensureEvent({ title, ticketTypes }) {
    let eventId = await findEventIdByTitle(title);
    if (eventId === null) {
      const tx = await contract.createEvent(title, sellerAddr);
      const log = tx.logs.find(l => l.event === "EventCreated");
      eventId = log ? toNumber(log.args.eventId) : toNumber(await contract.eventCount()) - 1;
      console.log(`Created event "${title}" with id ${eventId}`);
    } else {
      console.log(`Event "${title}" already exists as id ${eventId}`);
    }

    const evt = await contract.events(eventId);
    if (!evt.active) {
      await contract.setEventActive(eventId, true);
      console.log(`Activated event ${eventId}`);
    }

    const existingTypeCount = toNumber((await contract.events(eventId)).ticketTypeCount);
    for (const tt of ticketTypes) {
      let exists = false;
      for (let i = 0; i < existingTypeCount; i += 1) {
        const typeInfo = await contract.ticketTypes(eventId, i);
        if (typeInfo.name === tt.name) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        await contract.addTicketType(eventId, tt.name, tt.priceWei, tt.maxSupply);
        console.log(`Added ticket type "${tt.name}" to event ${eventId}`);
      }
    }
    return eventId;
  }

  await ensureEvent({
    title: "KPOP NIght",
    ticketTypes: [
      {
        name: "General",
        priceWei: web3.utils.toWei("0.08", "ether"),
        maxSupply: 80
      }
    ]
  });

  await ensureEvent({
    title: "ABC",
    ticketTypes: [
      {
        name: "Premium",
        priceWei: web3.utils.toWei("0.10", "ether"),
        maxSupply: 100
      }
    ]
  });

  console.log("Seed events migration complete.");
};
