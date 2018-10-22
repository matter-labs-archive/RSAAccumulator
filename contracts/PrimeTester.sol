pragma solidity ^0.4.25;

contract PrimeTester {

    // uint256 constant public primeListSize = 256;
    // uint16[primeListSize] public primeTable = [
    //     3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59,
    //     61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137,
    //     139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227,
    //     229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313,
    //     317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419,
    //     421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503, 509,
    //     521, 523, 541, 547, 557, 563, 569, 571, 577, 587, 593, 599, 601, 607, 613, 617,
    //     619, 631, 641, 643, 647, 653, 659, 661, 673, 677, 683, 691, 701, 709, 719, 727,
    //     733, 739, 743, 751, 757, 761, 769, 773, 787, 797, 809, 811, 821, 823, 827, 829,
    //     839, 853, 857, 859, 863, 877, 881, 883, 887, 907, 911, 919, 929, 937, 941, 947,
    //     953, 967, 971, 977, 983, 991, 997, 1009, 1013, 1019, 1021, 1031, 1033, 1039, 1049, 1051,
    //     1061, 1063, 1069, 1087, 1091, 1093, 1097, 1103, 1109, 1117, 1123, 1129, 1151, 1153, 1163, 1171,
    //     1181, 1187, 1193, 1201, 1213, 1217, 1223, 1229, 1231, 1237, 1249, 1259, 1277, 1279, 1283, 1289,
    //     1291, 1297, 1301, 1303, 1307, 1319, 1321, 1327, 1361, 1367, 1373, 1381, 1399, 1409, 1423, 1427,
    //     1429, 1433, 1439, 1447, 1451, 1453, 1459, 1471, 1481, 1483, 1487, 1489, 1493, 1499, 1511, 1523,
    //     1531, 1543, 1549, 1553, 1559, 1567, 1571, 1579, 1583, 1597, 1601, 1607, 1609, 1613, 1619, 1621];

    function powMod(uint64 a, uint64 b, uint64 m) internal pure returns (uint64 r) {
        return manualPowMod(a, b, m);
        // Using precompile is MORE expensive!
        // return precompiledPowMod(a, b, m);
    }

    function manualPowMod(uint64 a, uint64 b, uint64 m) internal pure returns(uint64 r) {
        /* Calculate a^b (mod m)
        **
        ** Decomposes into product of squares (mod m)
        */
        r = 1;
        uint256 aCopy = uint256(a);
        uint256 bCopy = uint256(b);
        while (bCopy != 0) {
            if (bCopy&1 != 0) {
                r = uint64(mulmod(r, aCopy, m));
            }
            bCopy >>= 1;
            if (bCopy != 0) {
                aCopy = uint64(mulmod(aCopy, aCopy, m));
            }
        }
        return r;
    }

    function precompiledPowMod( uint64 base, uint64 e, uint64 m) internal view returns (uint64 output) {
        uint256 memoryPointer = 0;
        uint256 dataLength = 0;
        assembly {
            // define pointer
            memoryPointer := mload(0x40)
            // store data assembly-favouring ways
            mstore(memoryPointer, 0x20)    // Length of Base
            mstore(add(memoryPointer, 0x20), 0x20)  // Length of Exponent
            mstore(add(memoryPointer, 0x40), 0x20)  // Length of Modulus
        }
        dataLength = 0x60;

        assembly {
            mstore(add(memoryPointer, dataLength), base)  // cycle over base
        }
        dataLength += 0x20;

        assembly {
            mstore(add(memoryPointer, dataLength), e)     // Put exponent
        }
        dataLength += 0x20;

        assembly {
            mstore(add(memoryPointer, dataLength), m)  // cycle over base
        }
        dataLength += 0x20;

        // do the call
        assembly {
            let success := staticcall(sub(gas, 2000), 0x05, memoryPointer, dataLength, memoryPointer, 0x20) // here we overwrite!
            // gas fiddling
            switch success case 0 {
                revert(0, 0)
            }
        }
        assembly {
            output := mload(memoryPointer)
        }
        return output;
    }

    function isStrongProbablePrime(uint64 n, uint64 a) internal pure returns (bool isPrime) {
        /* Calculate d/s representation of n */
        uint64 d = n - 1;
        uint8 s = uint8(0);
        while (d&0xff != 0) {
            d >>= 8;
            s += 8;
        }
        while (d&0xf != 0) {
            d >>= 4;
            s += 4;
        }
        while (d&0x3 != 0) {
            d >>= 2;
            s += 2;
        }
        while (d&0x1 != 0) {
            d >>= 1;
            s++;
        }
        // Calculate a^d(mod n)
        uint64 b = powMod(a, d, n);
        if ((b == 1) || b == (n-1)) {
            return true;
        }
        for (uint8 r = uint8(1); r < s; r++) {
            b = uint64(mulmod(b, b, n));
            if (b <= 1) {
                return false;
            }
            if (b == (n - 1)) {
                return true;
            }
        }
        return false;
    }

    // IsPrime tests if uint64 is prime or not
    function IsPrime(uint64 n) public pure returns (bool isPrime) {
        // Catch easy answers
        if (n < 2) {
            return false;
        } // 0 and 1 are not prime
        if (n < 4) {
            return true;
        } // 2 and 3 are prime
        if (n&1 == 0) {
            return false;
        } // Even numbers are not

        // Perform trial division
        // !!! This one may give you speed on PC, but here it's too expensive due to SLOAD costs
        // uint64 tmp;
        // for (uint256 i = 0; i < primeListSize; i++) {
        //     tmp = uint64(primeTable[i]);
        //     if (n == tmp) {
        //         return true;
        //     }
        //     if (n%tmp == 0) {
        //         return false;
        //     }
        // }
        // Next step, SPRP tests
        //
        // Thresholds from Sloan sequence A014233
        if (!isStrongProbablePrime(n, 2)) {
            return false;
        }
        if (n < 2047) {
            return true;
        }
        if (!isStrongProbablePrime(n, 3)) {
            return false;
        }
        if (n < 1373653) {
            return true;
        }
        if (!isStrongProbablePrime(n, 5)) {
            return false;
        }
        if (n < 25326001) {
            return true;
        }
        if (!isStrongProbablePrime(n, 7)) {
            return false;
        }
        // if n<3215031751 {return true}
        if (n == 3215031751) {
            return false;
        }
        if (n < 118670087467) {
            return true;
        }
        if (!isStrongProbablePrime(n, 11)) {
            return false;
        }
        if (n < 2152302898747) {
            return true;
        }
        if (!isStrongProbablePrime(n, 13)) {
            return false;
        }
        if (n < 3474749660383) {
            return true;
        }
        if (!isStrongProbablePrime(n, 17)) {
            return false;
        }
        if (n < 341550071728321) {
            return true;
        }
        if (!isStrongProbablePrime(n, 19)) {
            return false;
        }
        if (!isStrongProbablePrime(n, 23)) {
            return false;
        }
        if (n < 3825123056546413051) {
            return true;
        }
        if (!isStrongProbablePrime(n, 29)) {
            return false;
        }
        if (!isStrongProbablePrime(n, 31)) {
            return false;
        }
        if (!isStrongProbablePrime(n, 37)) {
            return false;
        }
        // This test passes for n<2^64
        return true;
    }

}