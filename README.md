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

Another option is a list of roughly 2^40 precomputed primes committed in form of a Merkle tree, so mapping is done by proving tree membership and position.

## Inclusion and non-inclusion schemes
For understanding how it works from the Vitalik's [post](https://ethresear.ch/t/rsa-accumulators-for-plasma-cash-history-reduction/3739). RSA accumulators allow to prove that some prime number was or was not included in a set. It's also possible to prove non-inclusion for a (small) set of primes. 

**Inclusion proof**

Exponentiations below are mod N

One wants to prove that `(g^w)^x == A`, where `g` is an old accumulator for this block (where inclusion happens), `x` is an included value (mapping of coin ID to prime), `w` is a witness, `A` is a new accumulator. `g`, `A` and `x` are publically known, so for a membership proof one would have to supply `w`, because supplying `g^w` is not enough since it hides `g`. For a calculation of `w` one would have to mupliply all other included indexes in this block, that is potentially unbounded (there is no "modulo" operation in the exponent, cause we don't know decomposition of `N`).

**Non-inclusion proofs**

One wants to prove that some ID or a banch of indexes was not included. Keeping the same notations it's `A*(g^v) = g^(x1*x2*...*xn)` where `g` and `A` are old and new accumulators accordingly ("old" and new here may be over some range of blocks,may be better wording would be "initial" and "final"), `v` is a part of the proof, some potentially unbounded number. `x1, x2, ..., xn` are non-included values (primes).

The problem with this scheme is the following: while `x1, x2, ..., xn` should be listed separately when proof is verified on-chain, their multiplication result is potentially unbounded in length (there is no "modulo" operation in the exponent, cause we don't know decomposition of `N`). Same is for `v`.

Down to technical level long multiplication `x1*x2*...*xn` should happen on-chain, that is not trivial to implementdue to no modular reduction and absence of such precompile.

## Proof scheme for ranges

Described in this [post](https://ethresear.ch/t/log-coins-sized-proofs-of-inclusion-and-exclusion-for-rsa-accumulators/3839). This is a proof scheme(!) that is based on RSA accumulator as a primitive. It allow to efficiently prove inclusion and non-inclusion of continuous ranges, not just individual indexes.

The main parameter of this proof scheme is a "depth" of the largest tree. This largest tree is used for inclusion of individual indexes, while for continuous range inclusion and non-inclusion proofs use smaller number of included non-included IDs. In this scheme IDs are not just individual coin IDs, but enumerations of the leafs and nodes of the set of trees from the post above.

Tree depth puts the top limit on how many elements in multiplications like `x1*x2*...*xn` one will get. If we choose the largest tree depth to be `32`, so there are at maximum `2^32` coins in the system, the largest number of elements will be `32` in Vitalik's scheme.