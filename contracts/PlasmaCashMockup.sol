pragma solidity ^0.4.25;

import {RSAAccumulator} from "./RSAAccumulator.sol";

contract PlasmaCashMockup {

    uint64 constant public numberOfCoins = uint64(1) << 32;
    RSAAccumulator public rsaAccumulator;

    uint256 constant public NlengthIn32ByteLimbs = 8; // 1024 bits for factors, 2048 for modulus
    uint256 constant public NlengthInBytes = 32 * NlengthIn32ByteLimbs;
    uint256 constant public NLength = NlengthIn32ByteLimbs * 8 * 32;
    uint256 constant public g = 3;

    mapping(uint64 => uint256[NlengthIn32ByteLimbs]) public blockAccumulators; // try to store as static array for now; In BE

    constructor(address _accumulator)
    public
    {
        blockAccumulators[0][NlengthIn32ByteLimbs - 1] = g;
        rsaAccumulator = RSAAccumulator(_accumulator);
    }

    function updateAccumulator(
        uint256[NlengthIn32ByteLimbs] previousAccumulator,
        uint256 _value) 
        public view returns (uint256[NlengthIn32ByteLimbs] newAccumulator) {
        newAccumulator = modularExp(previousAccumulator, _value, N);
    }


}