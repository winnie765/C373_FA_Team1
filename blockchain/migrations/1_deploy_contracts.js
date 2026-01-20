const TicketNFT = artifacts.require("TicketNFT");
const LoyaltyToken = artifacts.require("LoyaltyToken");

module.exports = function (deployer, network, accounts) {
  const gas = 6_500_000;
  deployer.deploy(TicketNFT, { gas });
  deployer.deploy(LoyaltyToken, { gas });
};
