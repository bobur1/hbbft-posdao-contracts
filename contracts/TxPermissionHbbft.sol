pragma solidity ^0.5.16;

import "./interfaces/ICertifier.sol";
import "./interfaces/IKeyGenHistory.sol";
import "./interfaces/IRandomHbbft.sol";
import "./interfaces/IStakingHbbft.sol";
import "./interfaces/ITxPermission.sol";
import "./interfaces/IValidatorSetHbbft.sol";
import "./upgradeability/UpgradeableOwned.sol";




/// @dev Controls the use of zero gas price by validators in service transactions,
/// protecting the network against "transaction spamming" by malicious validators.
/// The protection logic is declared in the `allowedTxTypes` function.
contract TxPermissionHbbft is UpgradeableOwned, ITxPermission {

    // =============================================== Storage ========================================================

    // WARNING: since this contract is upgradeable, do not remove
    // existing storage variables, do not change their order,
    // and do not change their types!

    address[] internal _allowedSenders;

    /// @dev The address of the `Certifier` contract.
    ICertifier public certifierContract;

    /// @dev 
    IKeyGenHistory public keyGenHistoryContract;

    /// @dev A boolean flag indicating whether the specified address is allowed
    /// to initiate transactions of any type. Used by the `allowedTxTypes` getter.
    /// See also the `addAllowedSender` and `removeAllowedSender` functions.
    mapping(address => bool) public isSenderAllowed;

    /// @dev The address of the `ValidatorSetHbbft` contract.
    IValidatorSetHbbft public validatorSetContract;

     /// @dev this is a constant for testing purposes to not cause upgrade issues with an existing network 
    /// because of storage modifictions.
    uint256 public minimumGasPrice;

    // ============================================== Constants =======================================================

    /// @dev defines the block gas limit, respected by the hbbft validators.
    uint256 public blockGasLimit;

    // ============================================== Modifiers =======================================================

    /// @dev Ensures the `initialize` function was called before.
    modifier onlyInitialized {
        require(isInitialized());
        _;
    }

    // =============================================== Setters ========================================================

    /// @dev Initializes the contract at network startup.
    /// Can only be called by the constructor of the `Initializer` contract or owner.
    /// @param _allowed The addresses for which transactions of any type must be allowed.
    /// See the `allowedTxTypes` getter.
    /// @param _certifier The address of the `Certifier` contract. It is used by `allowedTxTypes` function to know
    /// whether some address is explicitly allowed to use zero gas price.
    /// @param _validatorSet The address of the `ValidatorSetHbbft` contract.
    function initialize(
        address[] calldata _allowed,
        address _certifier,
        address _validatorSet,
        address _keyGenHistoryContract
    ) external {
        require(msg.sender == _admin() || tx.origin ==  _admin() || address(0) == _admin() || block.number == 0);
        require(!isInitialized(), "initialization can only be done once");
        require(_certifier != address(0));
        require(_validatorSet != address(0), "ValidatorSet must not be 0");
        for (uint256 i = 0; i < _allowed.length; i++) {
            _addAllowedSender(_allowed[i]);
        }
        certifierContract = ICertifier(_certifier);
        validatorSetContract = IValidatorSetHbbft(_validatorSet);
        keyGenHistoryContract = IKeyGenHistory(_keyGenHistoryContract);
        minimumGasPrice = 1000000000; // (1 gwei)
        blockGasLimit = 1000000000; // 1 giga gas block
    }

    /// @dev Adds the address for which transactions of any type must be allowed.
    /// Can only be called by the `owner`. See also the `allowedTxTypes` getter.
    /// @param _sender The address for which transactions of any type must be allowed.
    function addAllowedSender(address _sender)
    public
    onlyOwner
    onlyInitialized {
        _addAllowedSender(_sender);
    }

    /// @dev Removes the specified address from the array of addresses allowed
    /// to initiate transactions of any type. Can only be called by the `owner`.
    /// See also the `addAllowedSender` function and `allowedSenders` getter.
    /// @param _sender The removed address.
    function removeAllowedSender(address _sender)
    public
    onlyOwner
    onlyInitialized {
        require(isSenderAllowed[_sender]);

        uint256 allowedSendersLength = _allowedSenders.length;

        for (uint256 i = 0; i < allowedSendersLength; i++) {
            if (_sender == _allowedSenders[i]) {
                _allowedSenders[i] = _allowedSenders[allowedSendersLength - 1];
                _allowedSenders.length--;
                break;
            }
        }

        isSenderAllowed[_sender] = false;
    }

    /// @dev set's the minimum gas price that is allowed by non-service transactions.
    /// IN HBBFT, there must be consens about the validator nodes about wich transaction is legal, 
    /// and wich is not.
    /// therefore the contract (could be the DAO) has to check the minimum gas price.
    /// HBBFT Node implementations can also check if a transaction surpases the minimumGasPrice,
    /// before submitting it as contribution.
    /// The limit can be changed by the owner (typical the DAO)
    /// @param _value The new minimum gas price.
    function setMinimumGasPrice(uint256 _value)
    public
    onlyOwner
    onlyInitialized {

        // currently, we do not allow to set the minimum gas price to 0,
        // that would open pandoras box, and the consequences of doing that, 
        // requires deeper research.
        require(_value > 0, "Minimum gas price must not be zero"); 
        minimumGasPrice = _value;
    }


    /// @dev set's the block gas limit.
    /// IN HBBFT, there must be consens about the block gas limit.
    function setBlockGasLimit(uint256 _value)
    public
    onlyOwner
    onlyInitialized {

        // we make some check that the block gas limit can not be set to low, 
        // to prevent the chain to be completly inoperatable.
        // this value is chosen arbitrarily
        require(_value >= 1000000, "Block Gas limit gas price must be at minimum 1,000,000");
        blockGasLimit = _value;
    }


    // =============================================== Getters ========================================================

    /// @dev Returns the contract's name recognizable by node's engine.
    function contractName()
    public
    pure
    returns(string memory) {
        return "TX_PERMISSION_CONTRACT";
    }

    /// @dev Returns the contract name hash needed for node's engine.
    function contractNameHash()
    public
    pure
    returns(bytes32) {
        return keccak256(abi.encodePacked(contractName()));
    }

    /// @dev Returns the contract's version number needed for node's engine.
    function contractVersion()
    public
    pure
    returns(uint256) {
        return 3;
    }

    /// @dev Returns the list of addresses allowed to initiate transactions of any type.
    /// For these addresses the `allowedTxTypes` getter always returns the `ALL` bit mask
    /// (see https://wiki.parity.io/Permissioning.html#how-it-works-1).
    function allowedSenders()
    public
    view
    returns(address[] memory) {
        return _allowedSenders;
    }

    /// @dev Defines the allowed transaction types which may be initiated by the specified sender with
    /// the specified gas price and data. Used by node's engine each time a transaction is about to be
    /// included into a block. See https://wiki.parity.io/Permissioning.html#how-it-works-1
    /// @param _sender Transaction sender address.
    /// @param _to Transaction recipient address. If creating a contract, the `_to` address is zero.
    /// @param _gasPrice Gas price in wei for the transaction.
    /// @param _data Transaction data.
    /// @return `uint32 typesMask` - Set of allowed transactions for `_sender` depending on tx `_to` address,
    /// `_gasPrice`, and `_data`. The result is represented as a set of flags:
    /// 0x01 - basic transaction (e.g. ether transferring to user wallet);
    /// 0x02 - contract call;
    /// 0x04 - contract creation;
    /// 0x08 - private transaction.
    /// `bool cache` - If `true` is returned, the same permissions will be applied from the same
    /// `_sender` without calling this contract again.
    function allowedTxTypes(
        address _sender,
        address _to,
        uint256 /*_value */,
        uint256 _gasPrice,
        bytes memory _data
    )
    public
    view
    returns(uint32 typesMask, bool cache) {
        if (isSenderAllowed[_sender]) {
            // Let the `_sender` initiate any transaction if the `_sender` is in the `allowedSenders` list
            return (ALL, false);
        }

        // Get the called function's signature
        bytes4 signature = bytes4(0);
        
        uint256 i;
        for (i = 0; _data.length >= 4 && i < 4; i++) {
            signature |= bytes4(_data[i]) >> i*8;
        }


        if (_to == address(validatorSetContract)) {
            // The rules for the ValidatorSet contract
            if (signature == REPORT_MALICIOUS_SIGNATURE) {
                bytes memory abiParams;
                abiParams = new bytes(_data.length - 4 > 64 ? 64 : _data.length - 4);

                for (i = 0; i < abiParams.length; i++) {
                    abiParams[i] = _data[i + 4];
                }

                (
                    address maliciousMiningAddress,
                    uint256 blockNumber
                ) = abi.decode(
                    abiParams,
                    (address, uint256)
                );

                // The `reportMalicious()` can only be called by the validator's mining address
                // when the calling is allowed
                (bool callable,) = validatorSetContract.reportMaliciousCallable(
                    _sender, maliciousMiningAddress, blockNumber
                );
                return (callable ? CALL : NONE, false);
            } else if (signature == ANNOUNCE_AVAILABILITY_SIGNATURE) {
                return (validatorSetContract.canCallAnnounceAvailability(_sender) ? CALL : NONE, false);
            } else if (signature == SET_VALIDATOR_IP) {
                return (CALL, false);
            } else if (_gasPrice > 0) {
                // The other functions of ValidatorSet contract can be called
                // by anyone except validators' mining addresses if gasPrice is not zero
                return (validatorSetContract.isValidator(_sender) ? NONE : CALL, false);
            }
        } else if (_to == address(keyGenHistoryContract)) {

            // we allow all calls to the validatorSetContract if the pending validator
            // has to send it's acks and Parts,
            // but has not done this yet.

            if (signature == WRITE_PART_SIGNATURE) {

                if (validatorSetContract.getPendingValidatorKeyGenerationMode(_sender)
                    == IValidatorSetHbbft.KeyGenMode.WritePart) {
                    //is the epoch parameter correct ?

                    // return if the data length is not big enough to pass a upcommingEpoch parameter.
                    // we could add an addition size check, that include the minimal size of the part as well.
                    if (_data.length < 36) {
                        return (NONE, false);
                    }

                    uint256 epochNumber = _getSliceUInt256(4, _data);

                    if (epochNumber == IStakingHbbft(validatorSetContract.stakingContract()).stakingEpoch() + 1) {
                        return (CALL, false);
                    } else {
                        return (NONE, false);
                    }

                } else {
                    // we want to write the Part, but it's not time for write the part.
                    // so this transaction is not allowed.
                    return (NONE, false);
                }

            } else if (signature == WRITE_ACKS_SIGNATURE) {

                if (validatorSetContract.getPendingValidatorKeyGenerationMode(_sender)
                    == IValidatorSetHbbft.KeyGenMode.WriteAck) {

                    // return if the data length is not big enough to pass a upcommingEpoch parameter.
                    // we could add an addition size check, that include the minimal size of the part as well.
                    if (_data.length < 36) {
                        return (NONE, false);
                    }

                    //is the correct epoch parameter passed ?

                    if (_getSliceUInt256(4, _data) 
                        == IStakingHbbft(validatorSetContract.stakingContract()).stakingEpoch() + 1) {
                        return (CALL, false);
                    }

                    // is the correct round passed ? (filters out messages from earlier key gen rounds.)

                    if (_getSliceUInt256(36, _data) 
                        == IStakingHbbft(validatorSetContract.stakingContract()).stakingEpoch() + 1) {
                        return (CALL, false);
                    }

                    return (NONE, false);

                } else {
                    // we want to write the Acks, but it's not time for write the Acks.
                    // so this transaction is not allowed.
                    return (NONE, false);
                }
            }

            // if there is another external call to keygenhistory contracts.
            // just treat it as normal call
        }

        //TODO: figure out if this applies to HBBFT as well.
        if (validatorSetContract.isValidator(_sender) && _gasPrice > 0) {
            // Let the validator's mining address send their accumulated tx fees to some wallet
            return (_sender.balance > 0 ? BASIC : NONE, false);
        }

        if (validatorSetContract.isValidator(_to)) {
            // Validator's mining address can't receive any coins
            return (NONE, false);
        }

        // Don't let the `_sender` use a zero gas price, if it is not explicitly allowed by the `Certifier` contract
        if (_gasPrice == 0) {
            return (certifierContract.certifiedExplicitly(_sender) ? ALL : NONE, false);
        }

        // In other cases let the `_sender` create any transaction with non-zero gas price,
        // as long the gas price is above the minimum gas price.
        return (_gasPrice >= minimumGasPrice ? ALL : NONE, false);
    }

    /// @dev Returns a boolean flag indicating if the `initialize` function has been called.
    function isInitialized()
    public
    view
    returns(bool) {
        return validatorSetContract != IValidatorSetHbbft(0);
    }

    // ============================================== Internal ========================================================

    // Allowed transaction types mask
    uint32 internal constant NONE = 0;
    uint32 internal constant ALL = 0xffffffff;
    uint32 internal constant BASIC = 0x01;
    uint32 internal constant CALL = 0x02;
    uint32 internal constant CREATE = 0x04;
    uint32 internal constant PRIVATE = 0x08;

    // Function signatures

    // bytes4(keccak256("reportMalicious(address,uint256,bytes)"))
    bytes4 public constant REPORT_MALICIOUS_SIGNATURE = 0xc476dd40;

    // bytes4(keccak256("writePart(uint256,uint256,bytes)"))
    bytes4 public constant WRITE_PART_SIGNATURE = 0x2d4de124;

    // bytes4(keccak256("writeAcks(uint256,uint256,bytes[])"))
    bytes4 public constant WRITE_ACKS_SIGNATURE = 0x5623208e;

    bytes4 public constant SET_VALIDATOR_IP = 0x03ce87a3;

    bytes4 public constant ANNOUNCE_AVAILABILITY_SIGNATURE = 0x43bcce9f;

    /// @dev An internal function used by the `addAllowedSender` and `initialize` functions.
    /// @param _sender The address for which transactions of any type must be allowed.
    function _addAllowedSender(address _sender)
    internal {
        require(!isSenderAllowed[_sender]);
        require(_sender != address(0));
        _allowedSenders.push(_sender);
        isSenderAllowed[_sender] = true;
    }


    /// @dev retrieves a UInt256 slice of a bytes array on a specific location 
    /// @param _begin offset to start reading the 32 bytes.
    /// @param _data byte[] to read the data from.
    /// @return uint256 value found on offset _begin in _data.
    function _getSliceUInt256(uint256 _begin, bytes memory _data) 
    internal
    pure
    returns (uint256) {
        
        uint256 a = 0;
        for(uint256 i=0;i<32;i++) {
            a = a + (((uint256)((uint8)(_data[_begin + i]))) * ((uint256)(2 ** ((31 - i) * 8))));
        }
        return a;
    }
}
