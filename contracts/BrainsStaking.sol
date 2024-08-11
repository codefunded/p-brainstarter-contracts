// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { EnumerableMap } from '@openzeppelin/contracts/utils/structs/EnumerableMap.sol';
import { EnumerableSet } from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import { IERC20, SafeERC20 } from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import { OwnableUpgradeable } from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import { Initializable } from '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import { UUPSUpgradeable } from '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import { LockedStake } from './LockedStake.sol';
import { LiquidStake } from './LiquidStake.sol';
import { UnlockFeeCalculator, LockType } from './UnlockFeeCalculator.sol';

/**
 * Contract for locking and staking $BRAINS tokens. Depending on the amount of tokens staked by the user,
 * they may be eligible for liquid staking. Liquid staking allows the user trade their stake before maturity date
 * because each liquid stake is represented by an ERC721 token that is transferable. However, if user
 * stakes less than the liquid stake threshold, the stake will be locked and not transferable.
 */
contract BrainsStaking is Initializable, OwnableUpgradeable, UUPSUpgradeable {
  using SafeERC20 for IERC20;
  using EnumerableMap for EnumerableMap.AddressToUintMap;
  using EnumerableSet for EnumerableSet.AddressSet;

  enum StakeType {
    Locked,
    Liquid
  }

  struct StakeInfo {
    uint256 stakeId;
    uint256 amount;
    LockType lockType;
    uint256 stakedAt;
    StakeType stakeType;
  }

  /// @custom:storage-location erc7201:brains.staking
  struct StakingStorage {
    IERC20 stakingToken;
    LockedStake lockedStakes;
    LiquidStake liquidStakes;
    /// @dev user can have multiple liquid stakes therefore mapping from stake id to stake info
    mapping(uint256 => StakeInfo) liquidStakeIdToInfo;
    /// @dev One locked stake per user with a cap of liquidStakeThreshold
    mapping(address => StakeInfo) lockedStakeIdToInfo;
    uint256 liquidStakeThreshold;
    EnumerableSet.AddressSet stakers;
    uint256 collectedFees;
  }

  event LiquidStaked(address indexed staker, uint256 indexed stakeId, uint256 amount);
  event LockedStaked(address indexed staker, uint256 indexed stakeId, uint256 amount);
  event LiquidUnstaked(address indexed staker, uint256 indexed stakeId, uint256 amount);
  event LockedUnstaked(address indexed staker, uint256 indexed stakeId, uint256 amount);
  event LiquidStakeThresholdSet(uint256 threshold);

  error BrainsStaking__NotStakeOwner();
  error BrainsStaking__StakeNotMatured();
  error BrainsStaking__WithdrawalNotAllowedBeforeStakeMatured();
  error BrainsStaking__WithdrawalFeeGreaterThanStakedAmount();
  error BrainsStaking__NotEnoughFeesCollected();
  error BrainsStaking__LockTypeMismatch();

  // keccak256(abi.encode(uint256(keccak256('brains.staking')) - 1)) & ~bytes32(uint256(0xff));
  bytes32 private constant MAIN_STORAGE_LOCATION = 0x0488b6ea87a9bf2c007dd47e5c684212f18293606ab6dc210d2f8a42ebef3e00;

  function _getStorage() private pure returns (StakingStorage storage $) {
    assembly {
      $.slot := MAIN_STORAGE_LOCATION
    }
  }

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    address _owner,
    IERC20 _stakingToken,
    LockedStake _lockedStakes,
    LiquidStake _liquidStakes
  ) public initializer {
    __Ownable_init(_owner);
    __UUPSUpgradeable_init();

    StakingStorage storage s = _getStorage();
    s.stakingToken = _stakingToken;
    s.lockedStakes = _lockedStakes;
    s.liquidStakes = _liquidStakes;
  }

  // ***************** EXTERNAL FUNCTIONS *****************

  /**
   * Sets the minimum amount of staked tokens required to be eligible for liquid staking.
   * When is equal to 0, all stakes are locked and not transferable.
   * @param _threshold Minimum amount of staked tokens required to be eligible for liquid staking
   */
  function setLiquidStakeThreshold(uint256 _threshold) external onlyOwner {
    StakingStorage storage s = _getStorage();
    s.liquidStakeThreshold = _threshold;
    emit LiquidStakeThresholdSet(_threshold);
  }

  /**
   * Stake tokens for a user. If the liquid stake threshold is set to 0, the whole stake will be illiquid (locked).
   * When the liquid stake threshold is set to a value greater than 0, the stake will be split into liquid and
   * illiquid (locked). The liquid stake will be minted in multiples of the liquid stake threshold and the remaining
   * amount will be staked as illiquid.
   * If user locked some tokens in the past with a given lock type, they can only stake more tokens with the same lock type
   * unless they stake up to the liquid stake threshold, in which case their stake will be converted to liquid stake and
   * now they can stake more tokens with a different lock type. User can only have a one locked stake type at a time.
   * @param _staker address to stake for
   * @param _amount amount to stake
   * @param _lockType lock type of the stake (users will use Public which has no lock and no fee but initial stakes
   * for strategic/private and seed investors will be handled through BrainsReceiptLocker contract which will
   * determine the lock type based on the receipt token they got from ICO)
   */
  function stakeFor(address _staker, uint256 _amount, LockType _lockType) external {
    StakingStorage storage s = _getStorage();

    s.stakingToken.safeTransferFrom(_msgSender(), address(this), _amount);

    s.stakers.add(_staker);

    if (s.liquidStakeThreshold == 0) {
      _mintOrSetLockedStakeData(_staker, s.lockedStakeIdToInfo[_staker].amount + _amount, _lockType);
      return;
    }

    uint256 howManyLiquidStakesToMint = _amount / s.liquidStakeThreshold;
    uint256 remainingAmountToAddToStake = _amount % s.liquidStakeThreshold;
    uint256 existingLockedStakeAmount = s.lockedStakeIdToInfo[_staker].amount;

    if (remainingAmountToAddToStake == 0) {
      _mintLiquidStakes(howManyLiquidStakesToMint, _staker, _lockType);
      return;
    }

    // If no previous locked stake, or existing one is empty, handle differently
    if (existingLockedStakeAmount == 0) {
      _mintOrSetLockedStakeData(_staker, remainingAmountToAddToStake, _lockType);
    } else {
      require(s.lockedStakeIdToInfo[_staker].lockType == _lockType, BrainsStaking__LockTypeMismatch());

      uint256 newTotalAmount = existingLockedStakeAmount + remainingAmountToAddToStake;
      if (newTotalAmount >= s.liquidStakeThreshold) {
        howManyLiquidStakesToMint += newTotalAmount / s.liquidStakeThreshold;
        s.lockedStakeIdToInfo[_staker].amount = newTotalAmount % s.liquidStakeThreshold;
      } else {
        s.lockedStakeIdToInfo[_staker].amount = newTotalAmount;
      }
      if (s.lockedStakeIdToInfo[_staker].amount == 0) {
        s.lockedStakes.burnById(s.lockedStakeIdToInfo[_staker].stakeId);
        delete s.lockedStakeIdToInfo[_staker];
      } else {
        _mintOrSetLockedStakeData(_staker, s.lockedStakeIdToInfo[_staker].amount, _lockType);
      }
    }

    _mintLiquidStakes(howManyLiquidStakesToMint, _staker, _lockType);
  }

  /**
   * Allows the user to unstake their liquid stake after it has matured. This operation will not incur a fee and
   * revert if the stake has not matured yet.
   * @param _stakeId stake id to unstake
   */
  function unstakeLiquid(uint256 _stakeId) external {
    StakingStorage storage s = _getStorage();

    require(
      UnlockFeeCalculator.getUnlockFeeAmount(
        s.liquidStakeIdToInfo[_stakeId].lockType,
        s.liquidStakeIdToInfo[_stakeId].amount,
        s.liquidStakeIdToInfo[_stakeId].stakedAt
      ) == 0,
      BrainsStaking__StakeNotMatured()
    );

    _unstakeLiquid(_stakeId);
  }

  /**
   * Allows the user to unstake their liquid stake before it has matured. This operation will
   * incur a fee that can be calculated using the `getLiquidBeforeMaturedUnstakeFee` function.
   * @param _stakeId stake id to unstake
   */
  function unstakeLiquidBeforeMaturedWithFee(uint256 _stakeId) external {
    _unstakeLiquid(_stakeId);
  }

  /**
   * Allows the user to unstake their locked stake after it has matured. This operation will not incur a fee and
   * revert if the stake has not matured yet.
   */
  function unstakeLocked() external {
    StakingStorage storage s = _getStorage();
    require(
      UnlockFeeCalculator.getUnlockFeeAmount(
        s.lockedStakeIdToInfo[_msgSender()].lockType,
        s.lockedStakeIdToInfo[_msgSender()].amount,
        s.lockedStakeIdToInfo[_msgSender()].stakedAt
      ) == 0,
      BrainsStaking__StakeNotMatured()
    );

    _unstakeLocked(_msgSender());
  }

  /**
   * Allows the user to unstake their locked stake stake before it has matured. This operation will
   * incur a fee that can be calculated using the `getLockedStakeBeforeMaturedUnstakeFee` function.
   */
  function unstakeLockedBeforeMaturedWithFee() external {
    _unstakeLocked(_msgSender());
  }

  /**
   * Allows the owner to withdraw tokens from the contract.
   * @param _token address of the token to withdraw
   * @param _amount amount of the token to withdraw
   */
  function withdrawTokens(address _token, uint256 _amount) external onlyOwner {
    StakingStorage storage s = _getStorage();
    if (_token != address(s.stakingToken)) {
      IERC20(_token).safeTransfer(_msgSender(), _amount);
      return;
    }
    require(_amount <= s.collectedFees, BrainsStaking__NotEnoughFeesCollected());
    s.collectedFees -= _amount;
    s.stakingToken.safeTransfer(_msgSender(), _amount);
  }

  function getLockedStakeInfo(address _user) external view returns (StakeInfo memory stakeInfo) {
    stakeInfo = _getStorage().lockedStakeIdToInfo[_user];
  }

  function getLiquidStakeInfo(uint256 _stakeId) external view returns (StakeInfo memory stakeInfo) {
    stakeInfo = _getStorage().liquidStakeIdToInfo[_stakeId];
  }

  /**
   * Gets the total amount of tokens staked by the user. This includes both locked and liquid stakes.
   * @param _user address of the user
   */
  function getUserTotalStakedAmount(address _user) external view returns (uint256) {
    StakingStorage storage s = _getStorage();
    uint256 amountOfLiquidStakes = s.liquidStakes.balanceOf(_user);
    uint256 totalAmount = s.lockedStakeIdToInfo[_user].amount;

    for (uint256 i = 0; i < amountOfLiquidStakes; i++) {
      uint256 tokenId = s.liquidStakes.tokenOfOwnerByIndex(_user, i);
      totalAmount += s.liquidStakeIdToInfo[tokenId].amount;
    }
    return totalAmount;
  }

  function getLiquidStakeThreshold() external view returns (uint256) {
    return _getStorage().liquidStakeThreshold;
  }

  /**
   * Calculates the amount of fee a user would have to pay if they unstaked their locked stake
   * before it has matured.
   * @param _address address of the user
   */
  function getLockedStakeBeforeMaturedUnstakeFee(address _address) external view returns (uint256) {
    StakingStorage storage s = _getStorage();
    return
      UnlockFeeCalculator.getUnlockFeeAmount(
        s.lockedStakeIdToInfo[_address].lockType,
        s.lockedStakeIdToInfo[_address].amount,
        s.lockedStakeIdToInfo[_address].stakedAt
      );
  }

  /**
   * Calculates the amount of fee a user would have to pay for unstaking a given liquid stake
   * before it has matured.
   * @param _stakeId id of the liquid stake
   */
  function getLiquidStakeBeforeMaturedUnstakeFee(uint256 _stakeId) external view returns (uint256) {
    StakingStorage storage s = _getStorage();
    return
      UnlockFeeCalculator.getUnlockFeeAmount(
        s.liquidStakeIdToInfo[_stakeId].lockType,
        s.liquidStakeIdToInfo[_stakeId].amount,
        s.liquidStakeIdToInfo[_stakeId].stakedAt
      );
  }

  /**
   * Gets the total amount of fees collected by the contract by slashing users who unstaked their stakes
   * before they have matured.
   */
  function getCollectedFees() external view returns (uint256) {
    return _getStorage().collectedFees;
  }

  function getLockedStakeAddress() external view returns (address) {
    return address(_getStorage().lockedStakes);
  }

  function getLiquidStakeAddress() external view returns (address) {
    return address(_getStorage().liquidStakes);
  }

  function getStakersAmount() external view returns (uint256) {
    return _getStorage().stakers.length();
  }

  function getStakerByIndex(uint256 _index) external view returns (address) {
    return _getStorage().stakers.at(_index);
  }

  // ***************** INTERNAL FUNCTIONS *****************

  function _mintOrSetLockedStakeData(address _staker, uint256 _stakeAmount, LockType _lockType) internal {
    StakingStorage storage s = _getStorage();
    uint256 lockedStakeId = s.lockedStakes.balanceOf(_staker) > 0
      ? s.lockedStakes.getTokenIdFromAddress(_staker)
      : s.lockedStakes.safeMint(_staker);

    s.lockedStakeIdToInfo[_staker].stakeId = lockedStakeId;
    s.lockedStakeIdToInfo[_staker].amount = _stakeAmount;
    s.lockedStakeIdToInfo[_staker].stakeType = StakeType.Locked;
    s.lockedStakeIdToInfo[_staker].lockType = _lockType;
    s.lockedStakeIdToInfo[_staker].stakedAt = block.timestamp;

    emit LockedStaked(_staker, lockedStakeId, _stakeAmount);
  }

  function _mintLiquidStakes(uint256 _howManyLiquidStakesToMint, address _staker, LockType _lockType) internal {
    StakingStorage storage s = _getStorage();
    uint256[] memory liquidStakeIds = new uint256[](_howManyLiquidStakesToMint);
    for (uint256 i = 0; i < _howManyLiquidStakesToMint; i++) {
      liquidStakeIds[i] = s.liquidStakes.safeMint(_staker);
      s.liquidStakeIdToInfo[liquidStakeIds[i]].stakeId = liquidStakeIds[i];
      s.liquidStakeIdToInfo[liquidStakeIds[i]].amount = s.liquidStakeThreshold;
      s.liquidStakeIdToInfo[liquidStakeIds[i]].stakeType = StakeType.Liquid;
      s.liquidStakeIdToInfo[liquidStakeIds[i]].lockType = _lockType;
      s.liquidStakeIdToInfo[liquidStakeIds[i]].stakedAt = block.timestamp;

      emit LiquidStaked(_staker, liquidStakeIds[i], s.liquidStakeThreshold);
    }
  }

  function _unstakeLiquid(uint256 _stakeId) internal {
    StakingStorage storage s = _getStorage();

    uint256 unlockFee = UnlockFeeCalculator.getUnlockFeeAmount(
      s.liquidStakeIdToInfo[_stakeId].lockType,
      s.liquidStakeIdToInfo[_stakeId].amount,
      s.liquidStakeIdToInfo[_stakeId].stakedAt
    );

    require(s.liquidStakes.ownerOf(_stakeId) == _msgSender(), BrainsStaking__NotStakeOwner());

    uint256 amountToUnstake = s.liquidStakeIdToInfo[_stakeId].amount - unlockFee;

    s.liquidStakes.burnById(_stakeId);
    delete s.liquidStakeIdToInfo[_stakeId];

    s.stakingToken.safeTransfer(_msgSender(), amountToUnstake);
    s.collectedFees += unlockFee;

    if (s.liquidStakes.balanceOf(_msgSender()) == 0 && s.lockedStakes.balanceOf(_msgSender()) == 0) {
      s.stakers.remove(_msgSender());
    }

    emit LiquidUnstaked(_msgSender(), _stakeId, amountToUnstake);
  }

  function _unstakeLocked(address _staker) internal {
    StakingStorage storage s = _getStorage();

    uint256 unlockFee = UnlockFeeCalculator.getUnlockFeeAmount(
      s.lockedStakeIdToInfo[_staker].lockType,
      s.lockedStakeIdToInfo[_staker].amount,
      s.lockedStakeIdToInfo[_staker].stakedAt
    );
    s.collectedFees += unlockFee;

    uint256 lockedTokenId = s.lockedStakes.getTokenIdFromAddress(_staker);
    s.lockedStakes.burnById(lockedTokenId);
    uint256 amountToUnstake = s.lockedStakeIdToInfo[_staker].amount - unlockFee;
    s.stakingToken.safeTransfer(_msgSender(), amountToUnstake);

    if (s.liquidStakes.balanceOf(_msgSender()) == 0 && s.lockedStakes.balanceOf(_msgSender()) == 0) {
      s.stakers.remove(_msgSender());
    }

    emit LockedUnstaked(_msgSender(), lockedTokenId, amountToUnstake);
  }

  function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner {}
}
