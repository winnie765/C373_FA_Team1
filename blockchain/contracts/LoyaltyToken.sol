// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Minimal ERC20-like token for school prototype (not production)
contract LoyaltyToken {
    string public name = "TicketNFT Loyalty Token";
    string public symbol = "TOK";
    uint8 public decimals = 0;

    address public owner;
    mapping(address => uint256) public balanceOf;

    event Mint(address indexed to, uint256 amount);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    constructor() {
        owner = msg.sender;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        balanceOf[to] += amount;
        emit Mint(to, amount);
    }
}
