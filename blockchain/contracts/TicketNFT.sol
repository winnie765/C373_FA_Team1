// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract TicketNFT {
    address public owner;

    struct TicketType {
        string name;
        uint256 priceWei;
        uint256 maxSupply;
        uint256 sold;
    }

    struct EventInfo {
        string title;
        bool active;
        uint256 ticketTypeCount;
    }

    uint256 public eventCount;
    mapping(uint256 => EventInfo) public events; // eventId -> event info
    mapping(uint256 => mapping(uint256 => TicketType)) public ticketTypes; // eventId -> typeId -> ticket type

    // Simple NFT ownership (minimal, not full ERC721 - enough for school prototype)
    uint256 public nextTokenId;
    mapping(uint256 => address) public ownerOf; // tokenId -> owner
    mapping(address => uint256[]) public tokensOf; // owner -> tokenIds
    mapping(address => mapping(uint256 => mapping(uint256 => bool))) public hasBought; // prevent double-buy per type

    event EventCreated(uint256 indexed eventId, string title);
    event TicketTypeAdded(uint256 indexed eventId, uint256 indexed typeId, string name, uint256 priceWei, uint256 maxSupply);
    event TicketMinted(address indexed buyer, uint256 indexed eventId, uint256 indexed typeId, uint256 tokenId);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;

        // Seed 3 demo events + types (so UI works immediately)
        _createEvent("Acoustic Nights");
        _addType(0, "General Admission", 0.001 ether, 500);
        _addType(0, "VIP", 0.002 ether, 100);

        _createEvent("Neon Dreams Festival");
        _addType(1, "Standard", 0.001 ether, 800);
        _addType(1, "Premium", 0.002 ether, 200);

        _createEvent("Campus Carnival Live");
        _addType(2, "Entry Pass", 0.001 ether, 300);
        _addType(2, "Fast Lane", 0.0015 ether, 50);
    }

    function createEvent(string calldata title) external onlyOwner returns (uint256 eventId) {
        return _createEvent(title);
    }

    function addTicketType(
        uint256 eventId,
        string calldata name,
        uint256 priceWei,
        uint256 maxSupply
    ) external onlyOwner returns (uint256 typeId) {
        return _addType(eventId, name, priceWei, maxSupply);
    }

    function buyTicket(uint256 eventId, uint256 typeId) external payable {
        EventInfo storage e = events[eventId];
        require(e.active, "Event not active");
        TicketType storage t = ticketTypes[eventId][typeId];
        require(t.maxSupply > 0, "Type not exist");
        require(t.sold < t.maxSupply, "Sold out");
        require(msg.value == t.priceWei, "Wrong payment");

        require(!hasBought[msg.sender][eventId][typeId], "Already owned");
        hasBought[msg.sender][eventId][typeId] = true;

        t.sold += 1;

        uint256 tokenId = nextTokenId;
        nextTokenId += 1;
        ownerOf[tokenId] = msg.sender;
        tokensOf[msg.sender].push(tokenId);

        emit TicketMinted(msg.sender, eventId, typeId, tokenId);
    }

    function _createEvent(string memory title) internal returns (uint256 eventId) {
        eventId = eventCount;
        events[eventId] = EventInfo({
            title: title,
            active: true,
            ticketTypeCount: 0
        });
        eventCount += 1;
        emit EventCreated(eventId, title);
    }

    function _addType(
        uint256 eventId,
        string memory name,
        uint256 priceWei,
        uint256 maxSupply
    ) internal returns (uint256 typeId) {
        require(events[eventId].active, "Event not active");
        typeId = events[eventId].ticketTypeCount;
        ticketTypes[eventId][typeId] = TicketType({
            name: name,
            priceWei: priceWei,
            maxSupply: maxSupply,
            sold: 0
        });
        events[eventId].ticketTypeCount += 1;
        emit TicketTypeAdded(eventId, typeId, name, priceWei, maxSupply);
    }

    function withdraw() external onlyOwner {
        (bool ok,) = owner.call{ value: address(this).balance }("");
        require(ok, "Withdraw failed");
    }
}
