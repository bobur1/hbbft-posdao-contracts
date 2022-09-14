pragma solidity ^0.5.0;

import "./interfaces/IDiamondUpdateService.sol";
import "./upgradeability/BaseAdminUpgradeabilityProxy.sol";

contract DiamondUpdateService is IDiamondUpdateService {
    address public owner;
    uint256 public currentUpdateId;

    struct Update {
        address[] proxyContracts;
        address[] newImplementations;
    }

    mapping(uint256 => Update) updates;
    

    modifier onlyOwner() {
        require(msg.sender == owner, "You are not the owner");
        _;
    }

    constructor(address newOwner) public {
        require(newOwner != address(0), "Zero address cannot be an owner");

        owner = newOwner;
    }

    function changeOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address cannot be an owner");
        emit OwnerChanged(owner, newOwner);
        owner = newOwner;
    }

    function registerContractUpdates(
        address[] calldata proxyContracts,
        address[] calldata newImplementations
    ) external returns(uint256){
        require(proxyContracts.length == newImplementations.length, "Address array lengths are not equal");

        Update storage currentUpdate = updates[currentUpdateId];
        
        currentUpdateId++;
        currentUpdate.proxyContracts = proxyContracts;
        currentUpdate.newImplementations = newImplementations;
        emit RigistrationOfNewUpdates(currentUpdateId - 1, proxyContracts, newImplementations);

        return currentUpdateId - 1;
    }

    function executeRegisteredContractUpdates(uint256 updateId) external {
        Update storage currentUpdate = updates[updateId];

        require(currentUpdate.proxyContracts.length > 0, "Current updates are empty");

        for (uint256 i = 0; i < currentUpdate.proxyContracts.length; i++) {
            // Casting from address to address payable in solidity >= 0.5.0
            // BaseAdminUpgradeabilityProxy(address(uint160(currentUpdate.proxyContracts[i])))
            // .upgradeTo(currentUpdate.newImplementations[i]);
            (bool success, ) = currentUpdate.proxyContracts[i].call
            (abi.encodeWithSignature("upgradeTo(address)", currentUpdate.newImplementations[i]));
            require(success, "Transaction failed");
        }
        
        emit ExecuteRegisteredUpdates(updateId, currentUpdate.proxyContracts, currentUpdate.newImplementations);
    }

    function dissmissRegisteredContractUpdates(uint256 updateId) external {
        Update storage currentUpdate = updates[updateId];
        emit DissmissRegisteredUpdates(updateId, currentUpdate.proxyContracts, currentUpdate.newImplementations);
        delete updates[updateId];
    }
}
