const BlockRewardHbbft = artifacts.require('BlockRewardHbbftCoinsMock');
const AdminUpgradeabilityProxy = artifacts.require('AdminUpgradeabilityProxy');
const RandomHbbft = artifacts.require('RandomHbbftMock');
const ValidatorSetHbbft = artifacts.require('ValidatorSetHbbftMock');
const StakingHbbft = artifacts.require('StakingHbbftCoinsMock');
const KeyGenHistory = artifacts.require('KeyGenHistory');

const BN = web3.utils.BN;

const fp = require('lodash/fp');
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bn')(BN))
  .should();

// delegatecall are a problem for truffle debugger
// therefore it makes sense to use a proxy for automated testing to have the proxy testet.
// and to not use it if specific transactions needs to get debugged, 
// like truffle `debug 0xabc`.
const useUpgradeProxy = !(process.env.CONTRACTS_NO_UPGRADE_PROXY == 'true');

const governanceFundAddress = '0xDA0da0da0Da0Da0Da0DA00DA0da0da0DA0DA0dA0';
console.log('useUpgradeProxy:', useUpgradeProxy);

contract('BlockRewardHbbft', async accounts => {
  let owner;
  let blockRewardHbbft;
  let randomHbbft;
  let stakingHbbft;
  let validatorSetHbbft;
  let candidateMinStake;
  let delegatorMinStake;
  let nativeRewardUndistributed = new BN(0);
  let initialValidatorsPubKeys;
  let initialValidatorsIpAddresses;

  // one epoch in 1 day.
  const STAKING_FIXED_EPOCH_DURATION = new BN(86400);

  // the transition time window is 1 hour.
  const STAKING_TRANSITION_WINDOW_LENGTH = new BN(3600);

  //const STAKING_EPOCH_DURATION = new BN(120954 + 2);

  const KEY_GEN_DURATION = new BN(2); // we assume that there is a fixed duration in blocks, in reality it varies.
  const STAKE_WITHDRAW_DISALLOW_PERIOD = 2; // one less than EPOCH DURATION, therefore it meets the conditions.
  const MIN_STAKE = new BN(web3.utils.toWei('1', 'ether'));
  const MAX_STAKE = new BN(web3.utils.toWei('100000', 'ether'));

  describe('reward()', async () => {

    it('network started', async () => {
      owner = accounts[0];

      const initialValidators = accounts.slice(1, 3 + 1); // accounts[1...3]
      const initialStakingAddresses = accounts.slice(4, 6 + 1); // accounts[4...6]
      initialStakingAddresses.length.should.be.equal(3);
      initialStakingAddresses[0].should.not.be.equal('0x0000000000000000000000000000000000000000');
      initialStakingAddresses[1].should.not.be.equal('0x0000000000000000000000000000000000000000');
      initialStakingAddresses[2].should.not.be.equal('0x0000000000000000000000000000000000000000');



      // Deploy BlockRewardHbbft contract
      blockRewardHbbft = await BlockRewardHbbft.new();
      if (useUpgradeProxy) {
        blockRewardHbbft = await AdminUpgradeabilityProxy.new(blockRewardHbbft.address, owner, []);
        blockRewardHbbft = await BlockRewardHbbft.at(blockRewardHbbft.address);
      }

      // Deploy RandomHbbft contract
      randomHbbft = await RandomHbbft.new();
      if (useUpgradeProxy) {
        randomHbbft = await AdminUpgradeabilityProxy.new(randomHbbft.address, owner, []);
        randomHbbft = await RandomHbbft.at(randomHbbft.address);
      }
      // Deploy StakingHbbft contract
      stakingHbbft = await StakingHbbft.new();
      if (useUpgradeProxy) {
        stakingHbbft = await AdminUpgradeabilityProxy.new(stakingHbbft.address, owner, []);
        stakingHbbft = await StakingHbbft.at(stakingHbbft.address);
      }
      // Deploy ValidatorSetHbbft contract
      validatorSetHbbft = await ValidatorSetHbbft.new();
      if (useUpgradeProxy) {
        validatorSetHbbft = await AdminUpgradeabilityProxy.new(validatorSetHbbft.address, owner, []);
        validatorSetHbbft = await ValidatorSetHbbft.at(validatorSetHbbft.address);
      }

      //await increaseTime(1);

      keyGenHistory = await KeyGenHistory.new();
      if (useUpgradeProxy) {
        keyGenHistory = await AdminUpgradeabilityProxy.new(keyGenHistory.address, owner, []);
        keyGenHistory = await KeyGenHistory.at(keyGenHistory.address);
      }

      // console.log('keyGenHistory._admin(): ', await keyGenHistory._admin.call());
      // console.log('owner: ', owner);

      await keyGenHistory.initialize(validatorSetHbbft.address, initialValidators, [[0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 181, 129, 31, 84, 186, 242, 5, 151, 59, 35, 196, 140, 106, 29, 40, 112, 142, 156, 132, 158, 47, 223, 253, 185, 227, 249, 190, 96, 5, 99, 239, 213, 127, 29, 136, 115, 71, 164, 202, 44, 6, 171, 131, 251, 147, 159, 54, 49, 1, 0, 0, 0, 0, 0, 0, 0, 153, 0, 0, 0, 0, 0, 0, 0, 4, 177, 133, 61, 18, 58, 222, 74, 65, 5, 126, 253, 181, 113, 165, 43, 141, 56, 226, 132, 208, 218, 197, 119, 179, 128, 30, 162, 251, 23, 33, 73, 38, 120, 246, 223, 233, 11, 104, 60, 154, 241, 182, 147, 219, 81, 45, 134, 239, 69, 169, 198, 188, 152, 95, 254, 170, 108, 60, 166, 107, 254, 204, 195, 170, 234, 154, 134, 26, 91, 9, 139, 174, 178, 248, 60, 65, 196, 218, 46, 163, 218, 72, 1, 98, 12, 109, 186, 152, 148, 159, 121, 254, 34, 112, 51, 70, 121, 51, 167, 35, 240, 5, 134, 197, 125, 252, 3, 213, 84, 70, 176, 160, 36, 73, 140, 104, 92, 117, 184, 80, 26, 240, 106, 230, 241, 26, 79, 46, 241, 195, 20, 106, 12, 186, 49, 254, 168, 233, 25, 179, 96, 62, 104, 118, 153, 95, 53, 127, 160, 237, 246, 41], [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 181, 129, 31, 84, 186, 242, 5, 151, 59, 35, 196, 140, 106, 29, 40, 112, 142, 156, 132, 158, 47, 223, 253, 185, 227, 249, 190, 96, 5, 99, 239, 213, 127, 29, 136, 115, 71, 164, 202, 44, 6, 171, 131, 251, 147, 159, 54, 49, 1, 0, 0, 0, 0, 0, 0, 0, 153, 0, 0, 0, 0, 0, 0, 0, 4, 177, 133, 61, 18, 58, 222, 74, 65, 5, 126, 253, 181, 113, 165, 43, 141, 56, 226, 132, 208, 218, 197, 119, 179, 128, 30, 162, 251, 23, 33, 73, 38, 120, 246, 223, 233, 11, 104, 60, 154, 241, 182, 147, 219, 81, 45, 134, 239, 69, 169, 198, 188, 152, 95, 254, 170, 108, 60, 166, 107, 254, 204, 195, 170, 234, 154, 134, 26, 91, 9, 139, 174, 178, 248, 60, 65, 196, 218, 46, 163, 218, 72, 1, 98, 12, 109, 186, 152, 148, 159, 121, 254, 34, 112, 51, 70, 121, 51, 167, 35, 240, 5, 134, 197, 125, 252, 3, 213, 84, 70, 176, 160, 36, 73, 140, 104, 92, 117, 184, 80, 26, 240, 106, 230, 241, 26, 79, 46, 241, 195, 20, 106, 12, 186, 49, 254, 168, 233, 25, 179, 96, 62, 104, 118, 153, 95, 53, 127, 160, 237, 246, 41], [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 181, 129, 31, 84, 186, 242, 5, 151, 59, 35, 196, 140, 106, 29, 40, 112, 142, 156, 132, 158, 47, 223, 253, 185, 227, 249, 190, 96, 5, 99, 239, 213, 127, 29, 136, 115, 71, 164, 202, 44, 6, 171, 131, 251, 147, 159, 54, 49, 1, 0, 0, 0, 0, 0, 0, 0, 153, 0, 0, 0, 0, 0, 0, 0, 4, 177, 133, 61, 18, 58, 222, 74, 65, 5, 126, 253, 181, 113, 165, 43, 141, 56, 226, 132, 208, 218, 197, 119, 179, 128, 30, 162, 251, 23, 33, 73, 38, 120, 246, 223, 233, 11, 104, 60, 154, 241, 182, 147, 219, 81, 45, 134, 239, 69, 169, 198, 188, 152, 95, 254, 170, 108, 60, 166, 107, 254, 204, 195, 170, 234, 154, 134, 26, 91, 9, 139, 174, 178, 248, 60, 65, 196, 218, 46, 163, 218, 72, 1, 98, 12, 109, 186, 152, 148, 159, 121, 254, 34, 112, 51, 70, 121, 51, 167, 35, 240, 5, 134, 197, 125, 252, 3, 213, 84, 70, 176, 160, 36, 73, 140, 104, 92, 117, 184, 80, 26, 240, 106, 230, 241, 26, 79, 46, 241, 195, 20, 106, 12, 186, 49, 254, 168, 233, 25, 179, 96, 62, 104, 118, 153, 95, 53, 127, 160, 237, 246, 41]],
        [[[0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 145, 0, 0, 0, 0, 0, 0, 0, 4, 239, 1, 112, 13, 13, 251, 103, 186, 212, 78, 44, 47, 250, 221, 84, 118, 88, 7, 64, 206, 186, 11, 2, 8, 204, 140, 106, 179, 52, 251, 237, 19, 53, 74, 187, 217, 134, 94, 66, 68, 89, 42, 85, 207, 155, 220, 101, 223, 51, 199, 37, 38, 203, 132, 13, 77, 78, 114, 53, 219, 114, 93, 21, 25, 164, 12, 43, 252, 160, 16, 23, 111, 79, 230, 121, 95, 223, 174, 211, 172, 231, 0, 52, 25, 49, 152, 79, 128, 39, 117, 216, 85, 201, 237, 242, 151, 219, 149, 214, 77, 233, 145, 47, 10, 184, 175, 162, 174, 237, 177, 131, 45, 126, 231, 32, 147, 227, 170, 125, 133, 36, 123, 164, 232, 129, 135, 196, 136, 186, 45, 73, 226, 179, 169, 147, 42, 41, 140, 202, 191, 12, 73, 146, 2]], [[0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 145, 0, 0, 0, 0, 0, 0, 0, 4, 239, 1, 112, 13, 13, 251, 103, 186, 212, 78, 44, 47, 250, 221, 84, 118, 88, 7, 64, 206, 186, 11, 2, 8, 204, 140, 106, 179, 52, 251, 237, 19, 53, 74, 187, 217, 134, 94, 66, 68, 89, 42, 85, 207, 155, 220, 101, 223, 51, 199, 37, 38, 203, 132, 13, 77, 78, 114, 53, 219, 114, 93, 21, 25, 164, 12, 43, 252, 160, 16, 23, 111, 79, 230, 121, 95, 223, 174, 211, 172, 231, 0, 52, 25, 49, 152, 79, 128, 39, 117, 216, 85, 201, 237, 242, 151, 219, 149, 214, 77, 233, 145, 47, 10, 184, 175, 162, 174, 237, 177, 131, 45, 126, 231, 32, 147, 227, 170, 125, 133, 36, 123, 164, 232, 129, 135, 196, 136, 186, 45, 73, 226, 179, 169, 147, 42, 41, 140, 202, 191, 12, 73, 146, 2]], [[0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 145, 0, 0, 0, 0, 0, 0, 0, 4, 239, 1, 112, 13, 13, 251, 103, 186, 212, 78, 44, 47, 250, 221, 84, 118, 88, 7, 64, 206, 186, 11, 2, 8, 204, 140, 106, 179, 52, 251, 237, 19, 53, 74, 187, 217, 134, 94, 66, 68, 89, 42, 85, 207, 155, 220, 101, 223, 51, 199, 37, 38, 203, 132, 13, 77, 78, 114, 53, 219, 114, 93, 21, 25, 164, 12, 43, 252, 160, 16, 23, 111, 79, 230, 121, 95, 223, 174, 211, 172, 231, 0, 52, 25, 49, 152, 79, 128, 39, 117, 216, 85, 201, 237, 242, 151, 219, 149, 214, 77, 233, 145, 47, 10, 184, 175, 162, 174, 237, 177, 131, 45, 126, 231, 32, 147, 227, 170, 125, 133, 36, 123, 164, 232, 129, 135, 196, 136, 186, 45, 73, 226, 179, 169, 147, 42, 41, 140, 202, 191, 12, 73, 146, 2]]]
      ).should.be.fulfilled;
      // The following private keys belong to the accounts 1-3, fixed by using the "--mnemonic" option when starting ganache.
      // const initialValidatorsPrivKeys = ["0x272b8400a202c08e23641b53368d603e5fec5c13ea2f438bce291f7be63a02a7", "0xa8ea110ffc8fe68a069c8a460ad6b9698b09e21ad5503285f633b3ad79076cf7", "0x5da461ff1378256f69cb9a9d0a8b370c97c460acbe88f5d897cb17209f891ffc"];
      // Public keys corresponding to the three private keys above.
      initialValidatorsPubKeys = fp.flatMap(x => [x.substring(0, 66), '0x' + x.substring(66, 130)])
        (['0x52be8f332b0404dff35dd0b2ba44993a9d3dc8e770b9ce19a849dff948f1e14c57e7c8219d522c1a4cce775adbee5330f222520f0afdabfdb4a4501ceeb8dcee',
          '0x99edf3f524a6f73e7f5d561d0030fc6bcc3e4bd33971715617de7791e12d9bdf6258fa65b74e7161bbbf7ab36161260f56f68336a6f65599dc37e7f2e397f845',
          '0xa255fd7ad199f0ee814ee00cce44ef2b1fa1b52eead5d8013ed85eade03034ae4c246658946c2e1d7ded96394a1247fb4d093c32474317ae388e8d25692a0f56']);
      // The IP addresses are irrelevant for these unit test, just initialize them to 0.
      initialValidatorsIpAddresses = ['0x00000000000000000000000000000000', '0x00000000000000000000000000000000', '0x00000000000000000000000000000000'];

      // Initialize ValidatorSetHbbft
      await validatorSetHbbft.initialize(
        blockRewardHbbft.address, // _blockRewardContract
        randomHbbft.address, // _randomContract
        stakingHbbft.address, // _stakingContract
        keyGenHistory.address, //_keyGenHistoryContract
        initialValidators, // _initialMiningAddresses
        initialStakingAddresses, // _initialStakingAddresses
      ).should.be.fulfilled;

      // Initialize StakingHbbft
      await stakingHbbft.initialize(
        validatorSetHbbft.address, // _validatorSetContract
        initialStakingAddresses, // _initialStakingAddresses
        MIN_STAKE, // _delegatorMinStake
        MIN_STAKE, // _candidateMinStake
        MAX_STAKE, // _maxStake
        STAKING_FIXED_EPOCH_DURATION, // _stakingFixedEpochDuration,
        STAKING_TRANSITION_WINDOW_LENGTH, // _stakingTransitionTimeframeLength
        STAKE_WITHDRAW_DISALLOW_PERIOD, // _stakeWithdrawDisallowPeriod
        initialValidatorsPubKeys, // _publicKeys
        initialValidatorsIpAddresses // _internetAddresses
      ).should.be.fulfilled;

      candidateMinStake = await stakingHbbft.candidateMinStake.call();
      delegatorMinStake = await stakingHbbft.delegatorMinStake.call();

      // Initialize BlockRewardHbbft
      await blockRewardHbbft.initialize(
        validatorSetHbbft.address
      ).should.be.fulfilled;

    });



    it('staking epoch #0 finished', async () => {

      let stakingEpoch = await stakingHbbft.stakingEpoch.call();
      stakingEpoch.should.be.bignumber.equal(new BN(0));
      // we are now in the Phase 1: Regular Block Creation
      //means: just a normal and boring block.
      await callReward(false);

      //boring, thing happened, we still should have zero pendingValidors.
      let pendingValidators = await validatorSetHbbft.getPendingValidators.call();
      pendingValidators.length.should.be.equal(0);

      //lets spin up the time until the beginning of the Transition phase.
      await timeTravelToTransition();
      await timeTravelToEndEpoch();

      // that was the end of epoch 0,
      // we should be in epoch 1 now.
      stakingEpoch = await stakingHbbft.stakingEpoch.call();
      stakingEpoch.should.be.bignumber.equal(new BN(1));

      // since noone stacked after all, pending validators should still be 0
      pendingValidators = await validatorSetHbbft.getPendingValidators.call();
      pendingValidators.length.should.be.equal(0);

      (await blockRewardHbbft.nativeRewardUndistributed.call()).should.be.bignumber.equal(nativeRewardUndistributed);
    });

    it('staking epoch #1 started', async () => {
      (await stakingHbbft.stakingEpoch.call()).should.be.bignumber.equal(new BN(1));
      //const stakingEpochStartBlock = await stakingHbbft.stakingEpochStartBlock.call();
      //stakingEpochStartBlock.should.be.bignumber.equal(STAKING_EPOCH_START_BLOCK.add(STAKING_FIXED_EPOCH_DURATION).add(KEY_GEN_DURATION));


      const currentValudators = await validatorSetHbbft.getValidators.call();
      currentValudators.length.should.be.equal(3);

      //Docs: The pendingValidators set returned by the ValidatorSet contract is empty in this phase,.
      const pendingValidators = await validatorSetHbbft.getPendingValidators.call();
      pendingValidators.length.should.be.equal(0);

      const pools = await stakingHbbft.getPoolsToBeElected.call();
      pools.length.should.be.equal(0);

    });

    it('validators and their delegators place stakes during the epoch #1', async () => {
      const validators = await validatorSetHbbft.getValidators.call();

      for (let i = 0; i < validators.length; i++) {
        const stakingAddress = await validatorSetHbbft.stakingByMiningAddress.call(validators[i]);
        // Validator places stake on themselves
        await stakingHbbft.stake(stakingAddress, { from: stakingAddress, value: candidateMinStake }).should.be.fulfilled;

        const delegatorsLength = 3;
        const delegators = accounts.slice(11 + i * delegatorsLength, 11 + i * delegatorsLength + delegatorsLength);
        for (let j = 0; j < delegators.length; j++) {
          // Delegator places stake on the validator
          await stakingHbbft.stake(stakingAddress, { from: delegators[j], value: delegatorMinStake }).should.be.fulfilled;
        }
      }
    });

    it('staking epoch #1 finished', async () => {

      const stakingEpoch = await stakingHbbft.stakingEpoch.call();
      stakingEpoch.should.be.bignumber.equal(new BN(1));

      // const stakingEpochStartBlock = await stakingHbbft.stakingEpochStartBlock.call();
      // stakingEpochStartBlock.should.be.bignumber.equal(STAKING_EPOCH_START_BLOCK.add(STAKING_EPOCH_DURATION));

      (await validatorSetHbbft.getPendingValidators.call()).length.should.be.equal(0);

      // we have staked just before, now there should be 3 pools.
      const pools = await stakingHbbft.getPoolsToBeElected.call();
      pools.length.should.be.equal(3);

      //lets spin up the time until the beginning of the Transition phase.
      await timeTravelToTransition();

      let pendingValidators = await validatorSetHbbft.getPendingValidators.call();
      pendingValidators.sortedEqual([
        accounts[1],
        accounts[2],
        accounts[3]
      ]);

      // now we are in phase 2.
      // Nodes are now responsible for creating a key together.
      // they have a timeframe for this (see )

      // since we are now  in phase 2 of the same epoch.
      (await stakingHbbft.stakingEpoch.call()).should.be.bignumber.equal('1');
      (await blockRewardHbbft.nativeRewardUndistributed.call()).should.be.bignumber.equal(nativeRewardUndistributed);

      await timeTravelToEndEpoch();

      //since the endEpoch happened, we should be in the epoch 2 now.
      const nextStakingEpoch = await stakingHbbft.stakingEpoch.call();
      nextStakingEpoch.should.be.bignumber.equal('2');

      // pending validators get deleted after being finalized
      (await validatorSetHbbft.getPendingValidators.call()).length.should.be.equal(0);

      validators = await validatorSetHbbft.getValidators.call();
      validators.sortedEqual([
        accounts[1],
        accounts[2],
        accounts[3]
      ]);

      for (let i = 0; i < validators.length; i++) {
        (await blockRewardHbbft.snapshotPoolValidatorStakeAmount.call(nextStakingEpoch, validators[i])).should.be.bignumber.equal(
          candidateMinStake
        );
        (await blockRewardHbbft.snapshotPoolTotalStakeAmount.call(nextStakingEpoch, validators[i])).should.be.bignumber.equal(
          candidateMinStake.add(delegatorMinStake.mul(new BN(3)))
        );
      }
    });

    const addToDeltaPotValue = new BN(web3.utils.toWei('60'));

    it('DMD Pots: filling delta pot', async () => {

      const stakingEpoch = await stakingHbbft.stakingEpoch.call();
      stakingEpoch.should.be.bignumber.equal(new BN(2));

      //checking preconditions.
      // get the current address pof the governance pot.

      const blockRewardBalance = await web3.eth.getBalance(blockRewardHbbft.address);
      blockRewardBalance.should.be.equal('0');

      (await blockRewardHbbft.deltaPot.call()).should.be.bignumber.equal(new BN('0'));
      (await blockRewardHbbft.reinsertPot.call()).should.be.bignumber.equal(new BN('0'));

      await blockRewardHbbft.addToDeltaPot({ value: addToDeltaPotValue }).should.be.fulfilled;
      (await blockRewardHbbft.deltaPot.call()).should.be.bignumber.equal(addToDeltaPotValue);

    });


    it('DMD Pots: governance and validators got correct share.', async () => {

      const currentValidators = await validatorSetHbbft.getValidators.call();
      currentValidators.length.should.be.equal(3);
      const initialGovernancePotBalance = await getCurrentGovernancePotValue();
      stakingEpoch = await stakingHbbft.stakingEpoch.call();

      await timeTravelToTransition();
      await timeTravelToEndEpoch();

      const currentGovernancePotBalance = await getCurrentGovernancePotValue();
      const governancePotIncrease = currentGovernancePotBalance.sub(initialGovernancePotBalance);

      const totalReward = addToDeltaPotValue.div(new BN('6000'));
      const expectedDAOShare = totalReward.div(new BN('10'));

      governancePotIncrease.should.to.be.bignumber.equal(expectedDAOShare);

      //since there are a lot of delegators, we need to calc it on a basis that pays out the validator min reward.
      const minValidatorSharePercent = await blockRewardHbbft.VALIDATOR_MIN_REWARD_PERCENT.call();

      const expectedValidatorReward = totalReward.sub(expectedDAOShare).div(new BN(currentValidators.length)).mul(minValidatorSharePercent).div(new BN('100'));
      const actualValidatorReward = await blockRewardHbbft.getValidatorReward.call(stakingEpoch, currentValidators[1]);

      actualValidatorReward.should.be.bignumber.equal(expectedValidatorReward);

    });



    it('DMD Pots: reinsert pot works as expected.', async () => {

      //refilling the delta pot.
      const deltaPotCurrentValue = await blockRewardHbbft.deltaPot.call()
      const fillUpMissing = addToDeltaPotValue.sub(deltaPotCurrentValue);

      await blockRewardHbbft.addToDeltaPot({ value: fillUpMissing }).should.be.fulfilled;
      (await blockRewardHbbft.deltaPot.call()).should.be.bignumber.equal(addToDeltaPotValue);

      const addedToReinsertPot = new BN(web3.utils.toWei('60'));

      await blockRewardHbbft.addToReinsertPot({ value: addedToReinsertPot }).should.be.fulfilled;
      const reinsertPotAfterAdd = await blockRewardHbbft.reinsertPot.call();
      reinsertPotAfterAdd.should.be.bignumber.equal(addedToReinsertPot);

      stakingEpoch = await stakingHbbft.stakingEpoch.call();

      const initialGovernancePotBalance = await getCurrentGovernancePotValue();

      await timeTravelToTransition();
      await timeTravelToEndEpoch();

      const currentGovernancePotBalance = await getCurrentGovernancePotValue();
      const governancePotIncrease = currentGovernancePotBalance.sub(initialGovernancePotBalance);

      const totalReward = addToDeltaPotValue.div(new BN('6000')).add(addedToReinsertPot.div(new BN('6000')));

      const expectedDAOShare = totalReward.div(new BN('10'));

      // we expect 1 wei difference, since the reward combination from 2 pots results in that.
      //expectedDAOShare.sub(governancePotIncrease).should.to.be.bignumber.lte(new BN('1'));
      governancePotIncrease.should.to.be.bignumber.equal(expectedDAOShare);

      //since there are a lot of delegators, we need to calc it on a basis that pays out the validator min reward.
      const minValidatorSharePercent = await blockRewardHbbft.VALIDATOR_MIN_REWARD_PERCENT.call();
      const currentValidators = await validatorSetHbbft.getValidators.call();
      const expectedValidatorReward = totalReward.sub(expectedDAOShare).div(new BN(currentValidators.length)).mul(minValidatorSharePercent).div(new BN('100'));
      const actualValidatorReward = await blockRewardHbbft.getValidatorReward.call(stakingEpoch, currentValidators[1]);

      actualValidatorReward.should.be.bignumber.equal(expectedValidatorReward);
    });

    it('transfers to reward contract works with 100k gas and fills reinsert pot', async () => {

      const fillUpValue = new BN(web3.utils.toWei('1'));

      const balanceBefore = new BN(await web3.eth.getBalance(blockRewardHbbft.address));
      const reinsertPotBefore = new BN(await blockRewardHbbft.reinsertPot.call());

      
      let fillUpTx = {
        from: accounts[0],
        to: blockRewardHbbft.address,
        value: fillUpValue,
        gas: '100000',
        gasPrice: web3.utils.toWei('100', 'gwei') //in some configurations the default gasPrice is used here, it uses 0 instead..
      };

      //blockRewardHbbft.address
      await web3.eth.sendTransaction(fillUpTx);

      const balanceAfter = new BN(await web3.eth.getBalance(blockRewardHbbft.address));
      const reinsertPotAfter = new BN(await blockRewardHbbft.reinsertPot.call());

      balanceAfter.should.be.bignumber.equal(balanceBefore.add(fillUpValue));
      reinsertPotAfter.should.be.bignumber.equal(reinsertPotBefore.add(fillUpValue));
    });


  });

  Array.prototype.sortedEqual = function (arr) {
    [...this].sort().should.be.deep.equal([...arr].sort());
  }

  // async function callFinalizeChange() {
  //   await validatorSetHbbft.setSystemAddress(owner).should.be.fulfilled;
  //   await validatorSetHbbft.finalizeChange({from: owner}).should.be.fulfilled;
  //   await validatorSetHbbft.setSystemAddress('0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE').should.be.fulfilled;
  // }

  async function getCurrentGovernancePotValue() {
    const governnancePotAddress = await blockRewardHbbft.governancePotAddress.call();
    (new BN(governnancePotAddress)).should.be.bignumber.gt(new BN(0));
    const result = new BN(await web3.eth.getBalance(governnancePotAddress));
    return result;
  }


  async function callReward(isEpochEndBlock) {
    // console.log('getting validators...');
    // note: this call used to crash because of a internal problem with a previous call of evm_mine and evm_increase_time https://github.com/DMDcoin/hbbft-posdao-contracts/issues/13 
    const validators = await validatorSetHbbft.getValidators.call();
    // console.log('got validators:', validators);
    await blockRewardHbbft.setSystemAddress(owner).should.be.fulfilled;
    await blockRewardHbbft.reward(isEpochEndBlock, { from: owner }).should.be.fulfilled;
    await blockRewardHbbft.setSystemAddress('0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE').should.be.fulfilled;

  }


  async function increaseTime(time) {

    const currentTimestamp = await validatorSetHbbft.getCurrentTimestamp.call();
    const futureTimestamp = currentTimestamp.add(web3.utils.toBN(time));
    await validatorSetHbbft.setCurrentTimestamp(futureTimestamp);
    const currentTimestampAfter = await validatorSetHbbft.getCurrentTimestamp.call();
    futureTimestamp.should.be.bignumber.equal(currentTimestampAfter);

  }

  //time travels forward to the beginning of the next transition,
  //and simulate a block mining (calling reward())
  async function timeTravelToTransition() {
    let startTimeOfNextPhaseTransition = await stakingHbbft.startTimeOfNextPhaseTransition.call();

    await validatorSetHbbft.setCurrentTimestamp(startTimeOfNextPhaseTransition);
    const currentTS = await validatorSetHbbft.getCurrentTimestamp.call();
    currentTS.should.be.bignumber.equal(startTimeOfNextPhaseTransition);
    await callReward(false);
  }

  async function timeTravelToEndEpoch() {

    const endTimeOfCurrentEpoch = await stakingHbbft.stakingFixedEpochEndTime.call();
    await validatorSetHbbft.setCurrentTimestamp(endTimeOfCurrentEpoch);
    await callReward(true);
  }

});
