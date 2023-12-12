// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@rarimo/evm-bridge-contracts/bridge/proxy/UUPSSignableUpgradeable.sol";
import "@rarimo/evm-bridge-contracts/utils/Signers.sol";

import "./interfaces/ILightweightStateV2.sol";

contract LightweightStateV2 is ILightweightStateV2, UUPSSignableUpgradeable, Signers {
    address public override sourceStateContract;

    uint256 internal _currentGistRoot;

    // gist root => GistRootData
    mapping(uint256 => GistRootData) internal _gistsRootData;

    // identity id => IdentityInfo
    mapping(uint256 => IdentityInfo) internal _identitiesInfo;

    function __LightweightStateV2_init(
        address signer_,
        address sourceStateContract_,
        string calldata chainName_
    ) external initializer {
        __Signers_init(signer_, chainName_);

        sourceStateContract = sourceStateContract_;
    }

    function changeSigner(
        bytes calldata newSignerPubKey_,
        bytes calldata signature_
    ) external override {
        _checkSignature(keccak256(newSignerPubKey_), signature_);

        signer = _convertPubKeyToAddress(newSignerPubKey_);
    }

    function changeSourceStateContract(
        address newSourceStateContract_,
        bytes calldata signature_
    ) external override {
        require(newSourceStateContract_ != address(0), "LightweightStateV2: zero address");

        validateChangeAddressSignature(
            uint8(MethodId.ChangeSourceStateContract),
            address(this),
            newSourceStateContract_,
            signature_
        );

        sourceStateContract = newSourceStateContract_;
    }

    function signedTransitGISTData(
        uint256 prevGist_,
        GistRootData calldata gistData_,
        bytes calldata proof_
    ) external override {
        _checkMerkleSignature(_getGISTSignHash(gistData_, prevGist_), proof_);

        require(
            _gistsRootData[gistData_.root].createdAtTimestamp == 0,
            "LightweightStateV2: unable to update already stored gist data"
        );

        if (gistData_.createdAtTimestamp > _gistsRootData[_currentGistRoot].createdAtTimestamp) {
            _currentGistRoot = gistData_.root;
        }

        GistRootData storage _newGistRootData = _gistsRootData[gistData_.root];

        _newGistRootData.root = gistData_.root;
        _newGistRootData.createdAtTimestamp = gistData_.createdAtTimestamp;
        _newGistRootData.createdAtBlock = gistData_.createdAtBlock;

        _gistsRootData[prevGist_].replacedByRoot = gistData_.root;

        emit SignGISTDataTransited(gistData_.root, prevGist_);
    }

    function signedTransitStateData(
        uint256 prevState_,
        StateData calldata stateData_,
        bytes calldata proof_
    ) external override {
        _checkMerkleSignature(_getStateSignHash(stateData_, prevState_), proof_);

        IdentityInfo storage _identityInfo = _identitiesInfo[stateData_.id];

        require(
            _identityInfo.statesData[stateData_.state].createdAtTimestamp == 0,
            "LightweightStateV2: unable to update already stored states"
        );

        if (stateData_.createdAtTimestamp > _getLastStateData(stateData_.id).createdAtTimestamp) {
            _identityInfo.lastState = stateData_.state;
        }

        StateData storage _newStateData = _identityInfo.statesData[stateData_.state];

        _newStateData.id = stateData_.id;
        _newStateData.state = stateData_.state;
        _newStateData.createdAtTimestamp = stateData_.createdAtTimestamp;
        _newStateData.createdAtBlock = stateData_.createdAtBlock;

        _identityInfo.statesData[prevState_].replacedByState = stateData_.state;

        emit SignStateDataTransited(stateData_.id, stateData_.state, prevState_);
    }

    function getStateInfoById(
        uint256 identityId_
    ) external view override returns (StateInfo memory) {
        return _getStateInfo(identityId_, getIdentityLastState(identityId_));
    }

    function getStateInfoByIdAndState(
        uint256 identityId_,
        uint256 state_
    ) external view override returns (StateInfo memory) {
        return _getStateInfo(identityId_, state_);
    }

    function getGISTRoot() external view override returns (uint256) {
        return _currentGistRoot;
    }

    function getCurrentGISTRootInfo() external view override returns (GistRootInfo memory) {
        return _getGISTRootInfo(_currentGistRoot);
    }

    function getGISTRootInfo(uint256 root_) external view override returns (GistRootInfo memory) {
        return _getGISTRootInfo(root_);
    }

    function idExists(uint256 identityId_) public view override returns (bool) {
        return _identitiesInfo[identityId_].lastState > 0;
    }

    function stateExists(uint256 identityId_, uint256 state_) public view override returns (bool) {
        return _identitiesInfo[identityId_].statesData[state_].createdAtTimestamp > 0;
    }

    function getIdentityLastState(uint256 identityId_) public view returns (uint256) {
        return _identitiesInfo[identityId_].lastState;
    }

    function _authorizeUpgrade(
        address newImplementation_,
        bytes calldata signature_
    ) internal override {
        require(newImplementation_ != address(0), "LightweightStateV2: zero address");

        validateChangeAddressSignature(
            uint8(MethodId.AuthorizeUpgrade),
            address(this),
            newImplementation_,
            signature_
        );
    }

    function _authorizeUpgrade(address) internal pure override {
        revert("LightweightStateV2: this upgrade method is off");
    }

    function _getLastStateData(uint256 identityId_) internal view returns (StateData storage) {
        return _identitiesInfo[identityId_].statesData[getIdentityLastState(identityId_)];
    }

    function _getStateInfo(
        uint256 identityId_,
        uint256 state_
    ) internal view returns (StateInfo memory stateInfo_) {
        IdentityInfo storage _identityInfo = _identitiesInfo[identityId_];
        StateData memory stateData_ = _identityInfo.statesData[state_];

        if (stateData_.id != 0) {
            StateData storage _replacedStateData = _identityInfo.statesData[
                stateData_.replacedByState
            ];
            bool isLastState_ = _identityInfo.lastState == state_;

            stateInfo_ = StateInfo({
                id: stateData_.id,
                state: stateData_.state,
                replacedByState: stateData_.replacedByState,
                createdAtTimestamp: stateData_.createdAtTimestamp,
                replacedAtTimestamp: isLastState_ ? 0 : _replacedStateData.createdAtTimestamp,
                createdAtBlock: stateData_.createdAtBlock,
                replacedAtBlock: isLastState_ ? 0 : _replacedStateData.createdAtBlock
            });
        }
    }

    function _getGISTRootInfo(
        uint256 root_
    ) internal view returns (GistRootInfo memory gistRootInfo_) {
        GistRootData memory rootData_ = _gistsRootData[root_];

        if (rootData_.root != 0) {
            GistRootData storage _replacedRootData = _gistsRootData[rootData_.replacedByRoot];
            bool isCurrentRoot_ = root_ == _currentGistRoot;

            gistRootInfo_ = GistRootInfo({
                root: rootData_.root,
                replacedByRoot: rootData_.replacedByRoot,
                createdAtTimestamp: rootData_.createdAtTimestamp,
                replacedAtTimestamp: isCurrentRoot_ ? 0 : _replacedRootData.createdAtTimestamp,
                createdAtBlock: rootData_.createdAtBlock,
                replacedAtBlock: isCurrentRoot_ ? 0 : _replacedRootData.createdAtBlock
            });
        }
    }

    function _getStateSignHash(
        StateData calldata stateData_,
        uint256 prevState_
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    sourceStateContract,
                    stateData_.id,
                    stateData_.state,
                    stateData_.createdAtTimestamp,
                    stateData_.createdAtBlock,
                    prevState_
                )
            );
    }

    function _getGISTSignHash(
        GistRootData calldata gistData_,
        uint256 prevGist_
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    sourceStateContract,
                    gistData_.root,
                    gistData_.createdAtTimestamp,
                    gistData_.createdAtBlock,
                    prevGist_
                )
            );
    }
}
