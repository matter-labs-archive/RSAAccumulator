# Description

Quick and dirty implementation of RSA accumulator for Plasma history reduction needs. The main problem is mapping of various IDs to primes (that is required for accumulator), as well as a requirement to have modular multiplication for Wesolowski scheme. Originally proposed scheme by Vitalik looks to require modular multiplication itself:

```
a*b = ((a+b)^2 - (a-b)^2)/4 mod N
```

Modular division itself requires modular multiplication and provision of modular inverse of 4 modulo N.