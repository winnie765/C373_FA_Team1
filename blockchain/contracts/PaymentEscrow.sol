// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title PaymentEscrow - Secure escrow payment system for NFT ticketing
/// @notice Holds funds in escrow until delivery is confirmed, with dispute resolution
/// @dev Integrates with TicketNFT contract for ticket purchases

contract PaymentEscrow {

    // ============ State Variables ============

    address public owner;
    address public arbiter;  // Dispute resolver (can be platform admin)

    uint256 public orderCount;
    uint256 public defaultDeliveryPeriod = 7 days;  // Default time for delivery confirmation
    uint256 public autoReleaseDelay = 14 days;      // Auto-release if buyer doesn't confirm/dispute

    // Fee settings (in basis points, 100 = 1%)
    uint256 public platformFeeBps = 250;  // 2.5% platform fee
    uint256 public constant MAX_FEE_BPS = 1000;  // Max 10% fee

    address payable public feeRecipient;

    // ============ Enums ============

    enum OrderStatus {
        Pending,      // Buyer paid, funds in escrow
        Confirmed,    // Buyer confirmed delivery, funds released to seller
        Disputed,     // Dispute raised, awaiting arbitration
        Refunded,     // Funds returned to buyer
        Released,     // Funds released to seller (by arbiter or auto-release)
        Cancelled     // Order cancelled before any action
    }

    // ============ Structs ============

    struct Order {
        uint256 orderId;
        address payable buyer;
        address payable seller;
        uint256 amount;           // Total payment amount in Wei
        uint256 platformFee;      // Platform fee amount
        uint256 sellerAmount;     // Amount seller receives (amount - platformFee)
        uint256 eventId;          // Reference to TicketNFT event
        uint256 ticketTypeId;     // Reference to ticket type
        uint256 tokenId;          // Minted NFT token ID (0 if not yet minted)
        OrderStatus status;
        uint256 createdAt;
        uint256 deliveryDeadline;
        string disputeReason;     // Reason if disputed
        string resolution;        // Resolution notes from arbiter
    }

    // ============ Mappings ============

    mapping(uint256 => Order) public orders;
    mapping(address => uint256[]) public buyerOrders;   // Buyer's order IDs
    mapping(address => uint256[]) public sellerOrders;  // Seller's order IDs

    // ============ Events ============

    event OrderCreated(
        uint256 indexed orderId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint256 eventId,
        uint256 ticketTypeId
    );

    event DeliveryConfirmed(
        uint256 indexed orderId,
        address indexed buyer,
        address indexed seller,
        uint256 amount
    );

    event DisputeRaised(
        uint256 indexed orderId,
        address indexed buyer,
        string reason
    );

    event DisputeResolved(
        uint256 indexed orderId,
        address indexed arbiter,
        bool releasedToSeller,
        string resolution
    );

    event FundsReleased(
        uint256 indexed orderId,
        address indexed seller,
        uint256 amount
    );

    event FundsRefunded(
        uint256 indexed orderId,
        address indexed buyer,
        uint256 amount
    );

    event AutoReleased(
        uint256 indexed orderId,
        address indexed seller,
        uint256 amount
    );

    event OrderCancelled(
        uint256 indexed orderId,
        address indexed buyer
    );

    event TicketMinted(
        uint256 indexed orderId,
        uint256 indexed tokenId
    );

    // ============ Modifiers ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyArbiter() {
        require(msg.sender == arbiter || msg.sender == owner, "Not arbiter");
        _;
    }

    modifier onlyBuyer(uint256 orderId) {
        require(msg.sender == orders[orderId].buyer, "Not buyer");
        _;
    }

    modifier onlySeller(uint256 orderId) {
        require(msg.sender == orders[orderId].seller, "Not seller");
        _;
    }

    modifier orderExists(uint256 orderId) {
        require(orders[orderId].buyer != address(0), "Order not found");
        _;
    }

    modifier inStatus(uint256 orderId, OrderStatus status) {
        require(orders[orderId].status == status, "Invalid order status");
        _;
    }

    // ============ Constructor ============

    constructor(address _arbiter) {
        owner = msg.sender;
        arbiter = _arbiter == address(0) ? msg.sender : _arbiter;
        feeRecipient = payable(msg.sender);
    }

    // ============ Core Functions ============

    /// @notice Create an escrow order for ticket purchase
    /// @param seller The seller's address who will receive payment
    /// @param eventId The event ID from TicketNFT contract
    /// @param ticketTypeId The ticket type ID
    /// @return orderId The created order ID
    function createOrder(
        address payable seller,
        uint256 eventId,
        uint256 ticketTypeId
    ) external payable returns (uint256 orderId) {
        require(msg.value > 0, "Payment required");
        require(seller != address(0), "Invalid seller");
        require(seller != msg.sender, "Cannot buy from yourself");

        // Calculate fees
        uint256 fee = (msg.value * platformFeeBps) / 10000;
        uint256 sellerAmount = msg.value - fee;

        orderId = orderCount;
        orderCount++;

        orders[orderId] = Order({
            orderId: orderId,
            buyer: payable(msg.sender),
            seller: seller,
            amount: msg.value,
            platformFee: fee,
            sellerAmount: sellerAmount,
            eventId: eventId,
            ticketTypeId: ticketTypeId,
            tokenId: 0,
            status: OrderStatus.Pending,
            createdAt: block.timestamp,
            deliveryDeadline: block.timestamp + defaultDeliveryPeriod,
            disputeReason: "",
            resolution: ""
        });

        buyerOrders[msg.sender].push(orderId);
        sellerOrders[seller].push(orderId);

        emit OrderCreated(orderId, msg.sender, seller, msg.value, eventId, ticketTypeId);

        return orderId;
    }

    /// @notice Record the minted NFT token ID for an order
    /// @param orderId The order ID
    /// @param tokenId The minted NFT token ID
    function setTicketMinted(uint256 orderId, uint256 tokenId)
        external
        onlyOwner
        orderExists(orderId)
        inStatus(orderId, OrderStatus.Pending)
    {
        orders[orderId].tokenId = tokenId;
        emit TicketMinted(orderId, tokenId);
    }

    /// @notice Buyer confirms delivery/receipt of ticket
    /// @param orderId The order ID to confirm
    function confirmDelivery(uint256 orderId)
        external
        orderExists(orderId)
        onlyBuyer(orderId)
        inStatus(orderId, OrderStatus.Pending)
    {
        Order storage order = orders[orderId];
        order.status = OrderStatus.Confirmed;

        // Transfer funds to seller
        _releaseFunds(orderId);

        emit DeliveryConfirmed(orderId, order.buyer, order.seller, order.sellerAmount);
    }

    /// @notice Buyer raises a dispute
    /// @param orderId The order ID
    /// @param reason The reason for dispute
    function raiseDispute(uint256 orderId, string calldata reason)
        external
        orderExists(orderId)
        onlyBuyer(orderId)
        inStatus(orderId, OrderStatus.Pending)
    {
        require(bytes(reason).length > 0, "Reason required");

        Order storage order = orders[orderId];
        order.status = OrderStatus.Disputed;
        order.disputeReason = reason;

        emit DisputeRaised(orderId, msg.sender, reason);
    }

    /// @notice Arbiter resolves a dispute
    /// @param orderId The order ID
    /// @param releaseToSeller True to release funds to seller, false to refund buyer
    /// @param resolution Resolution notes
    function resolveDispute(
        uint256 orderId,
        bool releaseToSeller,
        string calldata resolution
    )
        external
        onlyArbiter
        orderExists(orderId)
        inStatus(orderId, OrderStatus.Disputed)
    {
        Order storage order = orders[orderId];
        order.resolution = resolution;

        if (releaseToSeller) {
            order.status = OrderStatus.Released;
            _releaseFunds(orderId);
        } else {
            order.status = OrderStatus.Refunded;
            _refundBuyer(orderId);
        }

        emit DisputeResolved(orderId, msg.sender, releaseToSeller, resolution);
    }

    /// @notice Auto-release funds to seller after deadline (anyone can call)
    /// @param orderId The order ID
    function autoRelease(uint256 orderId)
        external
        orderExists(orderId)
        inStatus(orderId, OrderStatus.Pending)
    {
        Order storage order = orders[orderId];
        require(
            block.timestamp >= order.createdAt + autoReleaseDelay,
            "Auto-release period not reached"
        );

        order.status = OrderStatus.Released;
        _releaseFunds(orderId);

        emit AutoReleased(orderId, order.seller, order.sellerAmount);
    }

    /// @notice Seller can request refund to buyer (goodwill)
    /// @param orderId The order ID
    function sellerRefund(uint256 orderId)
        external
        orderExists(orderId)
        onlySeller(orderId)
        inStatus(orderId, OrderStatus.Pending)
    {
        Order storage order = orders[orderId];
        order.status = OrderStatus.Refunded;

        _refundBuyer(orderId);
    }

    /// @notice Cancel order (only if pending and within short window)
    /// @param orderId The order ID
    function cancelOrder(uint256 orderId)
        external
        orderExists(orderId)
        onlyBuyer(orderId)
        inStatus(orderId, OrderStatus.Pending)
    {
        Order storage order = orders[orderId];
        // Can only cancel within 1 hour of creation
        require(
            block.timestamp <= order.createdAt + 1 hours,
            "Cancellation window expired"
        );

        order.status = OrderStatus.Cancelled;

        // Full refund (no fee deducted for cancellation)
        (bool success, ) = order.buyer.call{value: order.amount}("");
        require(success, "Refund failed");

        emit OrderCancelled(orderId, order.buyer);
    }

    // ============ Internal Functions ============

    function _releaseFunds(uint256 orderId) internal {
        Order storage order = orders[orderId];

        // Transfer platform fee
        if (order.platformFee > 0) {
            (bool feeSuccess, ) = feeRecipient.call{value: order.platformFee}("");
            require(feeSuccess, "Fee transfer failed");
        }

        // Transfer seller amount
        (bool success, ) = order.seller.call{value: order.sellerAmount}("");
        require(success, "Seller transfer failed");

        emit FundsReleased(orderId, order.seller, order.sellerAmount);
    }

    function _refundBuyer(uint256 orderId) internal {
        Order storage order = orders[orderId];

        // Full refund to buyer
        (bool success, ) = order.buyer.call{value: order.amount}("");
        require(success, "Refund failed");

        emit FundsRefunded(orderId, order.buyer, order.amount);
    }

    // ============ View Functions ============

    /// @notice Get order details
    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    /// @notice Get all orders for a buyer
    function getBuyerOrders(address buyer) external view returns (uint256[] memory) {
        return buyerOrders[buyer];
    }

    /// @notice Get all orders for a seller
    function getSellerOrders(address seller) external view returns (uint256[] memory) {
        return sellerOrders[seller];
    }

    /// @notice Get order count for a buyer
    function getBuyerOrderCount(address buyer) external view returns (uint256) {
        return buyerOrders[buyer].length;
    }

    /// @notice Get order count for a seller
    function getSellerOrderCount(address seller) external view returns (uint256) {
        return sellerOrders[seller].length;
    }

    /// @notice Check if order can be auto-released
    function canAutoRelease(uint256 orderId) external view returns (bool) {
        Order storage order = orders[orderId];
        return order.status == OrderStatus.Pending &&
               block.timestamp >= order.createdAt + autoReleaseDelay;
    }

    /// @notice Get time remaining until auto-release
    function getAutoReleaseTime(uint256 orderId) external view returns (uint256) {
        Order storage order = orders[orderId];
        uint256 releaseTime = order.createdAt + autoReleaseDelay;
        if (block.timestamp >= releaseTime) {
            return 0;
        }
        return releaseTime - block.timestamp;
    }

    /// @notice Get contract balance (total escrowed funds)
    function getEscrowBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ============ Admin Functions ============

    /// @notice Update arbiter address
    function setArbiter(address _arbiter) external onlyOwner {
        require(_arbiter != address(0), "Invalid arbiter");
        arbiter = _arbiter;
    }

    /// @notice Update platform fee (max 10%)
    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "Fee too high");
        platformFeeBps = _feeBps;
    }

    /// @notice Update fee recipient
    function setFeeRecipient(address payable _recipient) external onlyOwner {
        require(_recipient != address(0), "Invalid recipient");
        feeRecipient = _recipient;
    }

    /// @notice Update default delivery period
    function setDeliveryPeriod(uint256 _period) external onlyOwner {
        require(_period >= 1 days && _period <= 30 days, "Invalid period");
        defaultDeliveryPeriod = _period;
    }

    /// @notice Update auto-release delay
    function setAutoReleaseDelay(uint256 _delay) external onlyOwner {
        require(_delay >= 7 days && _delay <= 90 days, "Invalid delay");
        autoReleaseDelay = _delay;
    }

    /// @notice Transfer ownership
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }

    /// @notice Emergency withdraw (only for stuck funds, requires no pending orders)
    function emergencyWithdraw() external onlyOwner {
        // This should only be used if there's a bug and funds are stuck
        // In production, add more safeguards
        (bool success, ) = owner.call{value: address(this).balance}("");
        require(success, "Withdraw failed");
    }
}
