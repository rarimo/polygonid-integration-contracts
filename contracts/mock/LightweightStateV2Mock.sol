// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "../LightweightStateV2.sol";

contract LightweightStateV2Mock is LightweightStateV2 {
    function setSigner(address newSigner_) external {
        signer = newSigner_;
    }

    function convertPubKeyToAddress(bytes calldata pubKey_) external pure returns (address) {
        return _convertPubKeyToAddress(pubKey_);
    }

    function getGISTData(uint256 gistRoot_) external view returns (GistRootData memory) {
        return _gistsRootData[gistRoot_];
    }
}
