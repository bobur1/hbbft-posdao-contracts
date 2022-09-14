pragma solidity ^0.5.16;

import "./BlockRewardHbbftCoinsMock.sol";


contract BlockRewardHbbftCoinsMockV2 is BlockRewardHbbftCoinsMock {
    function version() pure external returns(uint8){
        return 2;
    }

    event ClaimedReward(
        address indexed fromPoolStakingAddress,
        uint256 nativeCoinsAmount
    );
}
