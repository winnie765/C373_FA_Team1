// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./PaymentEscrow.sol";

/// @title TicketNFT - minimal ticketing NFT with escrow payment system
/// @notice Prototype contract with secure escrow payments for ticket purchases
contract TicketNFT {
    address public owner;
    PaymentEscrow public escrow;
    bool public escrowEnabled = true;  // Toggle between escrow and direct payment

    struct TicketType {
        string name;
        uint256 priceWei;
        uint256 maxSupply;
        uint256 sold;
    }

    struct EventInfo {
        string title;
        address payable seller;   // who receives funds for this event
        bool active;
        uint256 ticketTypeCount;
    }

    // Ticket metadata for NFT
    struct TicketData {
        uint256 eventId;
        uint256 ticketTypeId;
        uint256 orderId;      // Escrow order ID (0 if direct payment)
        uint256 purchaseTime;
        bool isEscrow;        // Whether purchased via escrow
    }

    uint256 public eventCount;
    mapping(uint256 => EventInfo) public events; // eventId -> event info
    mapping(uint256 => mapping(uint256 => TicketType)) public ticketTypes; // eventId -> typeId -> ticket type

    // Simple NFT ownership (minimal, not full ERC721 - enough for school prototype)
    uint256 public nextTokenId;
    mapping(uint256 => address) public ownerOf; // tokenId -> owner
    mapping(address => uint256[]) public tokensOf; // owner -> tokenIds
    mapping(uint256 => TicketData) public ticketData; // tokenId -> ticket metadata

    event EventCreated(uint256 indexed eventId, string title, address indexed seller);
    event TicketTypeAdded(uint256 indexed eventId, uint256 indexed typeId, string name, uint256 priceWei, uint256 maxSupply);
    event TicketMinted(address indexed buyer, uint256 indexed eventId, uint256 indexed typeId, uint256 tokenId);
    event TicketMintedWithEscrow(address indexed buyer, uint256 indexed eventId, uint256 indexed typeId, uint256 tokenId, uint256 orderId);
    event SellerChanged(uint256 indexed eventId, address indexed seller);
    event EventStatus(uint256 indexed eventId, bool active);
    event EscrowSet(address indexed escrowAddress);
    event EscrowToggled(bool enabled);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;

        // Seed 3 demo events + types (so UI works immediately), owner is the default seller.
        _createEvent("Acoustic Nights", payable(msg.sender));
        _addType(0, "General Admission", 0.001 ether, 500);
        _addType(0, "VIP", 0.002 ether, 100);

        _createEvent("Neon Dreams Festival", payable(msg.sender));
        _addType(1, "Standard", 0.001 ether, 800);
        _addType(1, "Premium", 0.002 ether, 200);

        _createEvent("Campus Carnival Live", payable(msg.sender));
        _addType(2, "Entry Pass", 0.001 ether, 300);
        _addType(2, "Fast Lane", 0.0015 ether, 50);
    }

    /// @notice Create a new event; anyone can create. Seller receives payments.
    function createEvent(string calldata title, address payable seller) external returns (uint256 eventId) {
        address payable s = seller == address(0) ? payable(msg.sender) : seller;
        return _createEvent(title, s);
    }

    /// @notice Change seller payout wallet for an event.
    function setEventSeller(uint256 eventId, address payable seller) external onlyOwner {
        require(events[eventId].seller != address(0), "Event missing");
        events[eventId].seller = seller == address(0) ? payable(owner) : seller;
        emit SellerChanged(eventId, events[eventId].seller);
    }

    /// @notice Pause or resume an event.
    function setEventActive(uint256 eventId, bool active) external onlyOwner {
        require(events[eventId].seller != address(0), "Event missing");
        events[eventId].active = active;
        emit EventStatus(eventId, active);
    }

    /// @notice Add a ticket type for an event. Only event seller or owner can add.
    function addTicketType(
        uint256 eventId,
        string calldata name,
        uint256 priceWei,
        uint256 maxSupply
    ) external returns (uint256 typeId) {
        require(
            events[eventId].seller == msg.sender || msg.sender == owner,
            "Not authorized"
        );
        return _addType(eventId, name, priceWei, maxSupply);
    }

    /// @notice Buy a ticket with escrow - funds held until delivery confirmed
    /// @param eventId The event ID
    /// @param typeId The ticket type ID
    /// @return orderId The escrow order ID
    /// @return tokenId The minted NFT token ID
    function buyTicketWithEscrow(uint256 eventId, uint256 typeId)
        external
        payable
        returns (uint256 orderId, uint256 tokenId)
    {
        require(escrowEnabled, "Escrow not enabled");
        require(address(escrow) != address(0), "Escrow not set");

        EventInfo storage e = events[eventId];
        require(e.active, "Event not active");
        TicketType storage t = ticketTypes[eventId][typeId];
        require(t.maxSupply > 0, "Type not exist");
        require(t.sold < t.maxSupply, "Sold out");
        require(msg.value == t.priceWei, "Wrong payment");

        t.sold += 1;

        // Mint NFT
        tokenId = nextTokenId;
        nextTokenId += 1;
        ownerOf[tokenId] = msg.sender;
        tokensOf[msg.sender].push(tokenId);

        // Create escrow order - forward the payment to escrow contract
        orderId = escrow.createOrder{value: msg.value}(
            e.seller,
            eventId,
            typeId
        );

        // Store ticket metadata
        ticketData[tokenId] = TicketData({
            eventId: eventId,
            ticketTypeId: typeId,
            orderId: orderId,
            purchaseTime: block.timestamp,
            isEscrow: true
        });

        // Notify escrow about the minted token
        escrow.setTicketMinted(orderId, tokenId);

        emit TicketMintedWithEscrow(msg.sender, eventId, typeId, tokenId, orderId);
    }

    /// @notice Buy a ticket; payment is forwarded to the event's seller immediately (legacy mode)
    function buyTicket(uint256 eventId, uint256 typeId) external payable {
        EventInfo storage e = events[eventId];
        require(e.active, "Event not active");
        TicketType storage t = ticketTypes[eventId][typeId];
        require(t.maxSupply > 0, "Type not exist");
        require(t.sold < t.maxSupply, "Sold out");
        require(msg.value == t.priceWei, "Wrong payment");

        t.sold += 1;

        uint256 tokenId = nextTokenId;
        nextTokenId += 1;
        ownerOf[tokenId] = msg.sender;
        tokensOf[msg.sender].push(tokenId);

        // Store ticket metadata (no escrow)
        ticketData[tokenId] = TicketData({
            eventId: eventId,
            ticketTypeId: typeId,
            orderId: 0,
            purchaseTime: block.timestamp,
            isEscrow: false
        });

        // Payout seller
        (bool ok,) = e.seller.call{ value: msg.value }("");
        require(ok, "Payout failed");

        emit TicketMinted(msg.sender, eventId, typeId, tokenId);
    }

    // ============ Escrow Management ============

    /// @notice Set the escrow contract address
    function setEscrow(address _escrow) external onlyOwner {
        require(_escrow != address(0), "Invalid escrow address");
        escrow = PaymentEscrow(_escrow);
        emit EscrowSet(_escrow);
    }

    /// @notice Enable or disable escrow payments
    function setEscrowEnabled(bool enabled) external onlyOwner {
        escrowEnabled = enabled;
        emit EscrowToggled(enabled);
    }

    /// @notice Get escrow contract address
    function getEscrowAddress() external view returns (address) {
        return address(escrow);
    }

    /// @notice Check if escrow is enabled and configured
    function isEscrowReady() external view returns (bool) {
        return escrowEnabled && address(escrow) != address(0);
    }

    // ============ View Functions ============

    /// @notice Get ticket metadata
    function getTicketData(uint256 tokenId) external view returns (TicketData memory) {
        return ticketData[tokenId];
    }

    /// @notice Get all tokens owned by an address
    function getTokensOf(address _owner) external view returns (uint256[] memory) {
        return tokensOf[_owner];
    }

    /// @notice Get ticket type info
    function getTicketType(uint256 eventId, uint256 typeId) external view returns (TicketType memory) {
        return ticketTypes[eventId][typeId];
    }

    /// @notice Get event info
    function getEventInfo(uint256 eventId) external view returns (EventInfo memory) {
        return events[eventId];
    }

    // internal helpers
    function _createEvent(string memory title, address payable seller) internal returns (uint256 eventId) {
        eventId = eventCount;
        events[eventId] = EventInfo({
            title: title,
            seller: seller,
            active: true,
            ticketTypeCount: 0
        });
        eventCount += 1;
        emit EventCreated(eventId, title, seller);
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
}
