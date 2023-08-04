// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.16;

import "../LightweightStateV2.sol";

contract LightweightStateV2Mock is LightweightStateV2 {
    function convertPubKeyToAddress(bytes calldata pubKey_) external pure returns (address) {
        return _convertPubKeyToAddress(pubKey_);
    }
}
