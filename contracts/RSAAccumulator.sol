pragma solidity ^0.4.25;

contract RSAAccumulator {
    // all arithmetics is modulo N

    uint256 constant public NlengthIn32ByteLimbs = 8; // 1024 bits for factors, 2048 for modulus
    uint256 constant public NlengthInBytes = 32 * NlengthIn32ByteLimbs;
    uint256 constant public NLength = NlengthIn32ByteLimbs * 8 * 32;
    uint256 constant public g = 3;

    uint256[NlengthIn32ByteLimbs] public emptyAccumulator;
    uint256[NlengthIn32ByteLimbs] public accumulator; // try to store as static array for now; In BE
    uint256[NlengthIn32ByteLimbs] public N;

    event AccumulatorUpdated(uint256 indexed _coinID);
    event DebugEvent(uint256 _uint, bool _bool);
    // constructor(uint256[NlengthIn32ByteLimbs] modulus) public {
    //     accumulator[NlengthIn32ByteLimbs - 1] = g;
    //     N = modulus;
    // }

    constructor(bytes modulus) public {
        accumulator[NlengthIn32ByteLimbs - 1] = g;
        emptyAccumulator[NlengthIn32ByteLimbs - 1] = g;
        require(modulus.length == NlengthInBytes, "Modulus should be at least padded");
        uint256 limb = 0;
        uint256 dataLength = 0x20; // skip length;
        for (uint256 i = 0; i < NlengthIn32ByteLimbs; i++) {
            assembly {
                limb := mload(add(modulus, dataLength))        
            }
            N[i] = limb;
            dataLength += 0x20;
        }
    }

    function updateAccumulator(uint256 _value) public {
        accumulator = modularExp(accumulator, _value, N);
    }

    function includeCoin(uint256 _coinID) public {
        accumulator = modularExp(accumulator, mapCoinToPrime(_coinID), N);
        emit AccumulatorUpdated(_coinID);
    }

    function mapCoinToPrime(uint256 _id) public
    view
    returns (uint256 prime) {
        // Sony's way to determine randomness :)
        return 11;
    }

    function getN()
    public
    view
    returns (uint256[NlengthIn32ByteLimbs] n) {
        return N;
    }

    function mapHashToPrime(bytes32 _hash) public
    view
    returns (uint256 prime) {
        // Another Sony's way to determine randomness :)
        return 17;
    }

    // this is kind of Wesolowski scheme. 'x' parameter is some exponent to show that (g^v)^x == A,
    // where g is an old accumulator (before inclusion of some coin), A is a final accumulator.
    // A proof should be just 'r' and 'b', cause 'z' in this scheme is a new accumulator itself
    function calculateProof(uint256 _coinID, uint256 x)
    public 
    view 
    returns (uint256[NlengthIn32ByteLimbs] b, uint256[NlengthIn32ByteLimbs] z, uint256 r) {
        uint256[NlengthIn32ByteLimbs] memory nReadOnce = N;
        uint256[NlengthIn32ByteLimbs] memory h = modularExp(emptyAccumulator, mapCoinToPrime(_coinID), nReadOnce);
        z = modularExp(h, x, nReadOnce);
        uint256 B = mapHashToPrime(keccak256(abi.encodePacked(h, z)));
        uint256 exp = x / B;
        b = modularExp(h, exp, nReadOnce);
        r = x % B;
    }

    // vefity proof is Wesolowski scheme. Modular multiplication is not yet implemented, so proof can not be checked
    function checkProof(
        uint256 _coinID,
        uint256[NlengthIn32ByteLimbs] b, 
        uint256[NlengthIn32ByteLimbs] z, 
        uint256 r)
    public 
    view 
    returns (bool isValid) {
        uint256[NlengthIn32ByteLimbs] memory nReadOnce = N;
        uint256[NlengthIn32ByteLimbs] memory h = modularExp(emptyAccumulator, mapCoinToPrime(_coinID), nReadOnce);
        uint256 B = mapHashToPrime(keccak256(abi.encodePacked(h, z))); // no mod N due to size difference
        uint256[NlengthIn32ByteLimbs] memory b_B = modularExp(b, B, nReadOnce);
        uint256[NlengthIn32ByteLimbs] memory h_R = modularExp(h, r, nReadOnce);
        uint256[NlengthIn32ByteLimbs] memory lhs = modularMul4(b_B, h_R, nReadOnce);
        uint256[NlengthIn32ByteLimbs] memory rhs = modularMulBy4(z, nReadOnce);
        if (compare(lhs, rhs) != 0) {
            return false;
        }
        return true;
    }

    function modularMul4(
        uint256[NlengthIn32ByteLimbs] _a,
        uint256[NlengthIn32ByteLimbs] _b,
        uint256[NlengthIn32ByteLimbs] _m)
    public 
    view 
    returns (uint256[NlengthIn32ByteLimbs] c) {
        uint256[NlengthIn32ByteLimbs] memory aPlusB = modularExp(modularAdd(_a, _b, _m), 2, _m);
        uint256[NlengthIn32ByteLimbs] memory aMinusB = modularExp(modularSub(_a, _b, _m), 2, _m);
        uint256[NlengthIn32ByteLimbs] memory t = modularSub(aPlusB, aMinusB, _m);
        return t;
        // TODO
        // divide by 4
        // for (uint256 i = NlengthIn32ByteLimbs - 1; i > 0; i--) {
        //     c[i] = (t[i] >> 2) | (t[i-1] << 254);
        // }
        // c[0] = t[0] >> 2;
        // return c;
    }

    // cheat and just do two additions
    function modularMulBy4(
        uint256[NlengthIn32ByteLimbs] _a,
        uint256[NlengthIn32ByteLimbs] _m)
    public
    view
    returns (uint256[NlengthIn32ByteLimbs] c) {
        uint256[NlengthIn32ByteLimbs] memory t  = modularAdd(_a, _a, _m);
        c = modularAdd(t, t, _m);
    }

    function compare(
        uint256[NlengthIn32ByteLimbs] _a, 
        uint256[NlengthIn32ByteLimbs] _b)
    public
    view
    returns (int256 result) {
        for (uint256 i = 0; i < NlengthIn32ByteLimbs; i++) {
            if (_a[i] > _b[i]) {
                return 1;
            } else if (_a[i] < _b[i]) {
                return -1;
            }
        }
        return 0;
    }

    function wrappingSub(
        uint256[NlengthIn32ByteLimbs] _a, 
        uint256[NlengthIn32ByteLimbs] _b
    )
    public
    view 
    returns (uint256[NlengthIn32ByteLimbs] o) {
        bool borrow = false;
        uint256 limb = 0;
        for (uint256 i = NlengthIn32ByteLimbs - 1; i < NlengthIn32ByteLimbs; i--) {
            limb = _a[i];
            if (borrow) {
                if (limb == 0) {
                    borrow = true;
                    limb--;
                    o[i] = limb - _b[i];
                } else {
                    limb--;
                    if (limb >= _b[i]) {
                        borrow = false;
                    }
                    o[i] = limb - _b[i];
                }
            } else {
                if (limb < _b[i]) {
                    borrow = true;
                }
                o[i] = limb - _b[i];
            }
        }
        return o;
    }

    function wrappingAdd(
        uint256[NlengthIn32ByteLimbs] _a, 
        uint256[NlengthIn32ByteLimbs] _b
    )
    public
    view 
    returns (uint256[NlengthIn32ByteLimbs] o) {
        bool carry = false;
        uint256 limb = 0;
        uint256 subaddition = 0;
        for (uint256 i = NlengthIn32ByteLimbs - 1; i < NlengthIn32ByteLimbs; i--) {
            limb = _a[i];
            if (carry) {
                if (limb == uint256(~0)) {
                    carry = true;
                    o[i] = _b[i];
                } else {
                    limb++;
                    subaddition = limb + _b[i];
                    if (subaddition >= limb) {
                        carry = false;
                    }
                    o[i] = subaddition;
                }
            } else {
                subaddition = limb + _b[i];
                if (subaddition < limb) {
                    carry = true;
                }
                o[i] = subaddition;
            }
        }
        return o;
    }

    function modularSub(
        uint256[NlengthIn32ByteLimbs] _a, 
        uint256[NlengthIn32ByteLimbs] _b,
        uint256[NlengthIn32ByteLimbs] _m)
    public
    view 
    returns (uint256[NlengthIn32ByteLimbs] o) {
        int256 comparison = compare(_a, _b);
        if (comparison == 0) {
            return o;
        } else if (comparison == 1) {
            return wrappingSub(_a, _b);
        } else {
            uint256[NlengthIn32ByteLimbs] memory tmp = wrappingSub(_b, _a);
            return wrappingSub(_m, tmp);
        }
    }

    function modularAdd(
        uint256[NlengthIn32ByteLimbs] _a, 
        uint256[NlengthIn32ByteLimbs] _b,
        uint256[NlengthIn32ByteLimbs] _m)
    public
    view 
    returns (uint256[NlengthIn32ByteLimbs] o) {
        uint256[NlengthIn32ByteLimbs] memory space = wrappingSub(_m, _a);
        // see how much "space" has left before an overflow
        int256 comparison = compare(space, _b);
        if (comparison == 0) {
            return o;
        } else if (comparison == 1) {
            return wrappingAdd(_a, _b);
        } else {
            return wrappingSub(_b, space);
        }
    }

    // this assumes that exponent in never larger than 256 bits
    function modularExp(
        uint256[NlengthIn32ByteLimbs] base, 
        uint256 e, 
        uint256[NlengthIn32ByteLimbs] m) 
    public view returns (uint256[NlengthIn32ByteLimbs] output) {
        uint256 modulusLength = NlengthInBytes;
        uint256 memoryPointer = 0;
        uint256 dataLength = 0;
        assembly {
            // define pointer
            memoryPointer := mload(0x40)
            // store data assembly-favouring ways
            mstore(memoryPointer, modulusLength)    // Length of Base
            mstore(add(memoryPointer, 0x20), 0x20)  // Length of Exponent
            mstore(add(memoryPointer, 0x40), modulusLength)  // Length of Modulus
        }
        dataLength = 0x60;
        // now properly pack bases, etc
        uint256 limb = 0;
        for (uint256 i = 0; i < NlengthIn32ByteLimbs; i++) {
            limb = base[i];
            assembly {
                mstore(add(memoryPointer, dataLength), limb)  // cycle over base
            }
            dataLength += 0x20;
        }

        assembly {
            mstore(add(memoryPointer, dataLength), e)     // Put exponent
        }
        dataLength += 0x20;

        for (i = 0; i < NlengthIn32ByteLimbs; i++) {
            limb = m[i];
            assembly {
                mstore(add(memoryPointer, dataLength), limb)  // cycle over base
            }
            dataLength += 0x20;
        }
        // do the call
        assembly {
            let success := staticcall(sub(gas, 2000), 0x05, memoryPointer, dataLength, memoryPointer, modulusLength) // here we overwrite!
            // gas fiddling
            switch success case 0 {
                revert(0, 0)
            }
        }
        dataLength = 0;
        limb = 0;
        for (i = 0; i < NlengthIn32ByteLimbs; i++) {
            assembly {
                limb := mload(add(memoryPointer, dataLength))
            }
            dataLength += 0x20;
            output[i] = limb;
        }
        return output;
    }

}