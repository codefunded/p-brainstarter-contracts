// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { EnumerableMap } from '@openzeppelin/contracts/utils/structs/EnumerableMap.sol';
import { EnumerableSet } from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import { IERC20, SafeERC20 } from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import { OwnableUpgradeable } from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import { Initializable } from '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import { UUPSUpgradeable } from '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import { IlliquidStake } from './IlliquidStake.sol';
import { LiquidStake } from './LiquidStake.sol';
import { UnlockFeeCalculator } from './UnlockFeeCalculator.sol';

contract BrainsStaking is Initializable, OwnableUpgradeable, UUPSUpgradeable {
  using SafeERC20 for IERC20;
  using EnumerableMap for EnumerableMap.AddressToUintMap;
  using EnumerableSet for EnumerableSet.AddressSet;

  error BrainsStaking__NotStakeOwner();
  error BrainsStaking__StakeNotMatured();
  error BrainsStaking__WithdrawalNotAllowedBeforeStakeMatured();
  error BrainsStaking__WithdrawalFeeGreaterThanStakedAmount();

  event LiquidStaked(address indexed staker, uint256 indexed stakeId, uint256 amount);
  event IlliquidStaked(address indexed staker, uint256 indexed stakeId, uint256 amount);
  event LiquidUnstaked(address indexed staker, uint256 indexed stakeId, uint256 amount);
  event IlliquidUnstaked(address indexed staker, uint256 indexed stakeId, uint256 amount);

  enum StakeType {
    Illiquid,
    Liquid
  }

  struct StakeInfo {
    uint256 stakeId;
    uint256 amount;
    UnlockFeeCalculator.LockType lockType;
    uint256 stakedAt;
    StakeType stakeType;
  }

  /// @custom:storage-location erc7201:brains.staking
  struct StakingStorage {
    IERC20 stakingToken;
    IlliquidStake illiquidStakes;
    LiquidStake liquidStakes;
    /// @dev user can have multiple liquid stakes therefore mapping from stake id to stake info
    mapping(uint256 => StakeInfo) liquidStakeIdToInfo;
    /// @dev One illiquid stake per user with a cap of liquidStakeThreshold
    mapping(address => StakeInfo) illiquidStakeIdToInfo;
    uint256 liquidStakeThreshold;
    EnumerableSet.AddressSet stakers;
  }

  // keccak256(abi.encode(uint256(keccak256('brains.staking')) - 1)) & ~bytes32(uint256(0xff));
  bytes32 private constant MAIN_STORAGE_LOCATION =
    0x0488b6ea87a9bf2c007dd47e5c684212f18293606ab6dc210d2f8a42ebef3e00;

  function _getStorage() private pure returns (StakingStorage storage $) {
    assembly {
      $.slot := MAIN_STORAGE_LOCATION
    }
  }

  // ***************** VIEW FUNCTIONS *****************

  function getIlliquidStakeInfo(
    address _user
  )
    external
    view
    returns (uint256 stakeId, uint256 amount, uint256 stakedAt, bool exists)
  {
    StakingStorage storage s = _getStorage();
    StakeInfo storage stakeInfo = s.illiquidStakeIdToInfo[_user];

    if (stakeInfo.amount == 0) return (0, 0, 0, false);

    return (stakeInfo.stakeId, stakeInfo.amount, stakeInfo.stakedAt, true);
  }

  function getLiquidStakeInfo(
    uint256 _stakeId
  )
    external
    view
    returns (
      uint256 amount,
      UnlockFeeCalculator.LockType lockType,
      StakeType stakeType,
      uint256 stakedAt
    )
  {
    StakeInfo storage stakeInfo = _getStorage().liquidStakeIdToInfo[_stakeId];
    return (
      stakeInfo.amount,
      stakeInfo.lockType,
      stakeInfo.stakeType,
      stakeInfo.stakedAt
    );
  }

  function getUserTotalStakedAmount(address _user) external view returns (uint256) {
    StakingStorage storage s = _getStorage();
    uint256 amountOfLiquidStakes = s.liquidStakes.balanceOf(_user);
    uint256 totalAmount = s.illiquidStakeIdToInfo[_user].amount;

    for (uint256 i = 0; i < amountOfLiquidStakes; i++) {
      uint256 tokenId = s.liquidStakes.tokenOfOwnerByIndex(_user, i);
      totalAmount += s.liquidStakeIdToInfo[tokenId].amount;
    }
    return totalAmount;
  }

  function getLiquidStakeThreshold() external view returns (uint256) {
    return _getStorage().liquidStakeThreshold;
  }

  function getIlliquidBeforeMaturedUnstakeFee(
    address _address
  ) external view returns (uint256) {
    StakingStorage storage s = _getStorage();
    return
      UnlockFeeCalculator.getUnlockFeeAmount(
        s.illiquidStakeIdToInfo[_address].lockType,
        s.illiquidStakeIdToInfo[_address].amount,
        s.illiquidStakeIdToInfo[_address].stakedAt
      );
  }

  function getLiquidBeforeMaturedUnstakeFee(
    uint256 _stakeId
  ) external view returns (uint256) {
    StakingStorage storage s = _getStorage();
    return
      UnlockFeeCalculator.getUnlockFeeAmount(
        s.liquidStakeIdToInfo[_stakeId].lockType,
        s.liquidStakeIdToInfo[_stakeId].amount,
        s.liquidStakeIdToInfo[_stakeId].stakedAt
      );
  }

  function getIlliquidStakeAddress() external view returns (address) {
    return address(_getStorage().illiquidStakes);
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

  // ***************** PUBLIC FUNCTIONS *****************

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  function initialize(
    address _owner,
    IERC20 _stakingToken,
    IlliquidStake _illiquidStakes,
    LiquidStake _liquidStakes
  ) public initializer {
    __Ownable_init(_owner);
    __UUPSUpgradeable_init();

    StakingStorage storage s = _getStorage();
    s.stakingToken = _stakingToken;
    s.illiquidStakes = _illiquidStakes;
    s.liquidStakes = _liquidStakes;
  }

  /**
   * Sets the minimum amount of staked tokens required to be eligible for liquid staking.
   * When is equal to 0, all stakes are locked and not transferable.
   * @param _threshold Minimum amount of staked tokens required to be eligible for liquid staking
   */
  function setLiquidStakeThreshold(uint256 _threshold) external onlyOwner {
    StakingStorage storage s = _getStorage();
    s.liquidStakeThreshold = _threshold;
  }

  /**
   * Stake tokens for a user. If the liquid stake threshold is set to 0, the whole stake will be illiquid.
   * When the liquid stake threshold is set to a value greater than 0, the stake will be split into liquid and
   * illiquid. The liquid stake will be minted in multiples of the liquid stake threshold and the remaining
   * amount will be staked as illiquid.
   * @param _staker address to stake for
   * @param _amount amount to stake
   * @param _lockType lock type of the stake (users will use Public which has no lock and no fee but initial stakes
   * for strategic/private and seed investors will be handled through BrainsReceiptLocker contract which will
   * determine the lock type based on the receipt token they got from ICO)
   */
  function stakeFor(
    address _staker,
    uint256 _amount,
    UnlockFeeCalculator.LockType _lockType
  ) external {
    StakingStorage storage s = _getStorage();

    s.stakingToken.safeTransferFrom(_msgSender(), address(this), _amount);

    s.stakers.add(_staker);

    if (s.liquidStakeThreshold == 0) {
      _mintOrSetIlliquidStakeData(_staker, _amount, _lockType);
      return;
    }

    uint256 howManyLiquidStakesToMint = _amount / s.liquidStakeThreshold;
    uint256 remainingAmountToAddToStake = _amount % s.liquidStakeThreshold;
    uint256 existingIlliquidStakeAmount = s.illiquidStakeIdToInfo[_staker].amount;

    // If no previous illiquid stake, or existing one is empty, handle differently
    if (existingIlliquidStakeAmount == 0) {
      _mintOrSetIlliquidStakeData(_staker, remainingAmountToAddToStake, _lockType);
    } else {
      uint256 newTotalAmount = existingIlliquidStakeAmount + remainingAmountToAddToStake;
      if (newTotalAmount >= s.liquidStakeThreshold) {
        howManyLiquidStakesToMint++;
        s.illiquidStakeIdToInfo[_staker].amount = newTotalAmount % s.liquidStakeThreshold;
      } else {
        s.illiquidStakeIdToInfo[_staker].amount = newTotalAmount;
      }
      _mintOrSetIlliquidStakeData(
        _staker,
        s.illiquidStakeIdToInfo[_staker].amount,
        _lockType
      );
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
   * Allows the user to unstake their illiquid after it has matured. This operation will not incur a fee and
   * revert if the stake has not matured yet.
   */
  function unstakeIlliquid() external {
    StakingStorage storage s = _getStorage();
    require(
      UnlockFeeCalculator.getUnlockFeeAmount(
        s.illiquidStakeIdToInfo[_msgSender()].lockType,
        s.illiquidStakeIdToInfo[_msgSender()].amount,
        s.illiquidStakeIdToInfo[_msgSender()].stakedAt
      ) == 0,
      BrainsStaking__StakeNotMatured()
    );

    _unstakeIlliquid(_msgSender());
  }

  /**
   * Allows the user to unstake their illiquid stake before it has matured. This operation will
   * incur a fee that can be calculated using the `getIlliquidBeforeMaturedUnstakeFee` function.
   */
  function unstakeIlliquidBeforeMaturedWithFee() external {
    _unstakeIlliquid(_msgSender());
  }

  /**
   * Allows the owner to withdraw tokens from the contract.
   * @param _token address of the token to withdraw
   * @param _amount amount of the token to withdraw
   */
  function withdrawTokens(address _token, uint256 _amount) external onlyOwner {
    // ADD GUARD TO NOT ALLOW WITHDRAWAL OF STAKING TOKEN
    IERC20(_token).safeTransfer(_msgSender(), _amount);
  }

  // ***************** INTERNAL FUNCTIONS *****************

  function _mintOrSetIlliquidStakeData(
    address _staker,
    uint256 stakeAmount,
    UnlockFeeCalculator.LockType _lockType
  ) internal {
    StakingStorage storage s = _getStorage();
    uint256 illiquidStakeId = s.illiquidStakes.balanceOf(_staker) > 0
      ? s.illiquidStakes.getTokenIdFromAddress(_staker)
      : s.illiquidStakes.safeMint(_staker);

    s.illiquidStakeIdToInfo[_staker].stakeId = illiquidStakeId;
    s.illiquidStakeIdToInfo[_staker].amount = stakeAmount;
    s.illiquidStakeIdToInfo[_staker].stakeType = StakeType.Illiquid;
    s.illiquidStakeIdToInfo[_staker].lockType = _lockType;
    s.illiquidStakeIdToInfo[_staker].stakedAt = block.timestamp;

    emit IlliquidStaked(_staker, illiquidStakeId, stakeAmount);
  }

  function _mintLiquidStakes(
    uint256 _howManyLiquidStakesToMint,
    address _staker,
    UnlockFeeCalculator.LockType _lockType
  ) internal {
    StakingStorage storage s = _getStorage();
    uint256[] memory liquidStakeIds = new uint256[](_howManyLiquidStakesToMint);
    for (uint256 i = 0; i < _howManyLiquidStakesToMint; i++) {
      liquidStakeIds[i] = s.liquidStakes.safeMint(_staker);
      s.illiquidStakeIdToInfo[_staker].stakeId = liquidStakeIds[i];
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

    require(
      s.liquidStakes.ownerOf(_stakeId) == _msgSender(),
      BrainsStaking__NotStakeOwner()
    );

    s.liquidStakes.burnById(_stakeId);
    s.stakingToken.safeTransfer(
      _msgSender(),
      s.liquidStakeIdToInfo[_stakeId].amount - unlockFee
    );

    if (
      s.liquidStakes.balanceOf(_msgSender()) == 0 &&
      s.illiquidStakes.balanceOf(_msgSender()) == 0
    ) {
      s.stakers.remove(_msgSender());
    }

    emit LiquidUnstaked(
      _msgSender(),
      _stakeId,
      s.liquidStakeIdToInfo[_stakeId].amount - unlockFee
    );
  }

  function _unstakeIlliquid(address _staker) internal {
    StakingStorage storage s = _getStorage();

    uint256 unlockFee = UnlockFeeCalculator.getUnlockFeeAmount(
      s.illiquidStakeIdToInfo[_staker].lockType,
      s.illiquidStakeIdToInfo[_staker].amount,
      s.illiquidStakeIdToInfo[_staker].stakedAt
    );

    uint256 illiquidTokenId = s.illiquidStakes.getTokenIdFromAddress(_staker);
    s.illiquidStakes.burnById(illiquidTokenId);
    s.stakingToken.safeTransfer(
      _msgSender(),
      s.illiquidStakeIdToInfo[_staker].amount - unlockFee
    );

    if (
      s.liquidStakes.balanceOf(_msgSender()) == 0 &&
      s.illiquidStakes.balanceOf(_msgSender()) == 0
    ) {
      s.stakers.remove(_msgSender());
    }

    emit IlliquidUnstaked(
      _msgSender(),
      illiquidTokenId,
      s.illiquidStakeIdToInfo[_staker].amount - unlockFee
    );
  }

  function _authorizeUpgrade(
    address newImplementation
  ) internal virtual override onlyOwner {}
}
