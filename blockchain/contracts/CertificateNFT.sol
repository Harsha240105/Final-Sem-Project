// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CertificateNFT
 * @notice Soulbound ERC721 NFT contract for minting non-transferable certificates.
 *         Based on ERC-5192 standard - tokens are permanently bound to the recipient wallet.
 * @dev    Deployed on Polygon Amoy Testnet.
 *         Only the contract owner (platform wallet) can mint certificates.
 *         Transfers, approvals, and sales are permanently disabled.
 */
contract CertificateNFT is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;

    event CertificateMinted(address indexed student, uint256 indexed tokenId, string tokenURI);

    constructor() ERC721("Web3Connect Certificate", "W3CERT") Ownable(msg.sender) {
        _tokenIdCounter = 0;
    }

    /**
     * @notice Locked: transfers are permanently disabled for soulbound tokens.
     */
    function transferFrom(address, address, uint256) public pure override {
        revert("Soulbound: Transfers are permanently disabled");
    }

    /**
     * @notice Locked: safe transfers are permanently disabled for soulbound tokens.
     */
    function safeTransferFrom(address, address, uint256) public pure override {
        revert("Soulbound: Transfers are permanently disabled");
    }

    /**
     * @notice Locked: safe transfers with data are permanently disabled.
     */
    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert("Soulbound: Transfers are permanently disabled");
    }

    /**
     * @notice Locked: approvals are permanently disabled for soulbound tokens.
     */
    function approve(address, uint256) public pure override {
        revert("Soulbound: Approvals are permanently disabled");
    }

    /**
     * @notice Locked: setApprovalForAll is permanently disabled.
     */
    function setApprovalForAll(address, bool) public pure override {
        revert("Soulbound: Approvals are permanently disabled");
    }

    /**
     * @notice Locked: getApproved always returns zero address.
     */
    function getApproved(uint256) public pure override returns (address) {
        return address(0);
    }

    /**
     * @notice Locked: isApprovedForAll always returns false.
     */
    function isApprovedForAll(address, address) public pure override returns (bool) {
        return false;
    }

    /**
     * @notice Mint a soulbound NFT certificate to a student's wallet.
     * @param student  The wallet address of the student receiving the certificate.
     * @param tokenURI IPFS URI pointing to the NFT metadata JSON.
     * @return The newly minted token ID.
     */
    function mintCertificate(address student, string memory tokenURI) public returns (uint256) {
        require(student != address(0), "Invalid student address");
        require(bytes(tokenURI).length > 0, "Token URI cannot be empty");

        _tokenIdCounter++;
        uint256 newTokenId = _tokenIdCounter;

        _safeMint(student, newTokenId);
        _setTokenURI(newTokenId, tokenURI);

        emit CertificateMinted(student, newTokenId, tokenURI);
        return newTokenId;
    }

    /**
     * @notice Get the total number of certificates minted.
     */
    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter;
    }

    /**
     * @notice ERC-5192 compliance: check if a token is locked (soulbound).
     * @return bool Always true - all tokens are permanently locked.
     */
    function locked(uint256) public pure returns (bool) {
        return true;
    }
}
