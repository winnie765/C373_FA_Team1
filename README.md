# TicketNFT (EJS + Express + MetaMask + Hardhat)

This is a working school prototype for an NFT concert ticketing app:
- Browse events
- Buy ticket (connect MetaMask + pay + mint NFT)
- View "My Tickets"
- Earn & redeem TOK rewards (prototype: stored locally)
- View transaction history (prototype: stored locally)

## 1) Requirements
- Node.js 18+ (recommended)
- MetaMask installed in your browser

## 2) Run the blockchain (Hardhat local)
Open a terminal:

```bash
cd blockchain
npm install
npm run node
```

Keep this terminal running.

Open a 2nd terminal:

```bash
cd blockchain
npm run deploy
```

This deploys the contracts and writes:
- `blockchain/web3/deployed.json`
- `blockchain/abi/*.json`

## 3) Run the web app (EJS)
Open a 3rd terminal:

```bash
cd app
npm install
npm run dev
```

Then open:
http://localhost:3000

## 4) MetaMask setup
- Add Hardhat network:
  - Network Name: Hardhat Local
  - RPC URL: http://127.0.0.1:8545
  - Chain ID: 31337
  - Currency Symbol: ETH

- Import a Hardhat account into MetaMask:
  - In the Hardhat node terminal, copy one private key
  - MetaMask → Import Account → paste private key

## Notes (Prototype)
- Rewards (TOK) are stored in localStorage for simplicity.
- NFT ticket minting uses `TicketNFT.buyTicket(eventId, typeId)` on the local chain.
