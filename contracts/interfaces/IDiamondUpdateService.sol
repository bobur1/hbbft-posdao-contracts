pragma solidity ^0.5.0;

interface IDiamondUpdateService {
    event OwnerChanged(address previousOwner, address newOwner);
    event RigistrationOfNewUpdates(
        uint256 updateId,
        address[] proxyContracts,
        address[] newImplementations
    );
    event DissmissRegisteredUpdates(
        uint256 updateId,
        address[] proxyContracts,
        address[] newImplementations
    );
    event ExecuteRegisteredUpdates(
        uint256 updateId,
        address[] proxyContracts,
        address[] newImplementations
    );

    function registerContractUpdates(address[] calldata, address[] calldata) external returns(uint256);
    function executeRegisteredContractUpdates(uint256) external;
    function dissmissRegisteredContractUpdates(uint256) external;
}
