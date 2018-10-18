# Description

Quick and dirty implementation of RSA accumulator for Plasma history reduction needs. The main problem is mapping of various IDs to primes (that is required for accumulator)

As a result of Plasma implementers call it was decided to map coinID to the first prime number as the following

```
    uint256 coinID = ...;
    uint256 shifted = coinID << 15; // or 16, one should just cover the prime gap for the first 2^32 numbers
    uint256 potentialMapping = shifted;
    for (uint i = 0; i < uint256(1) << 15; i++) {
        potentialMapping++;
        if (isPrime(potentialMapping)) {
            return potentialMapping;
        }
    }
```

where the `isPrime` function should do a Fermat test for a prime (it's relatively cheap to run on-chain) and also check agains a blacklist of pseudoprimes and trivial divisors (2, 3, 5, 7, 11, 13, 17, 19 at least). Information about Fermat test is on the [wiki](https://en.wikipedia.org/wiki/Fermat_primality_test)