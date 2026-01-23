const TicketNFT = artifacts.require("TicketNFT");

module.exports = async function (callback) {
  try {
    const c = await TicketNFT.deployed();
    const ec = (await c.eventCount()).toNumber();
    console.log("eventCount", ec);
    for (let i = 0; i < ec; i++) {
      const e = await c.events(i);
      console.log(
        "event",
        i,
        e.title,
        "active:",
        e.active,
        "types:",
        e.ticketTypeCount.toString()
      );
      const typeCount = e.ticketTypeCount.toNumber
        ? e.ticketTypeCount.toNumber()
        : Number(e.ticketTypeCount);
      for (let t = 0; t < typeCount; t++) {
        const tt = await c.ticketTypes(i, t);
        console.log(
          "  type",
          t,
          tt.name,
          "priceWei:",
          tt.priceWei.toString(),
          "max:",
          tt.maxSupply.toString(),
          "sold:",
          tt.sold.toString()
        );
      }
    }
  } catch (err) {
    console.error(err);
  }
  callback();
};
