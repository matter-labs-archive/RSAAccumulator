const RSAAccumulatorArtifact = artifacts.require('RSAAccumulator');
const crypto = require("crypto");

contract('RSA accumulator', async (accounts) => {
    const BN = require("bn.js");

    const account = accounts[0];
    let contract;
    
    beforeEach(async () => {
        const modulusHex = "b2f5fd3f9f0917112ce42f8bf87ed676e15258be443f36deafb0b69bde2496b495eaad1b01cad84271b014e96f79386c636d348516da74a68a8c70fba882870c47b4218d8f49186ddf72727b9d80c21911c3e337c6e407ffb47c2f2767b0d164d8a1e9af95f6481bf8d9edfb2e3904b2529268c460256fafd0a677d29898f10b1d15128a695839fc08edd584e8335615b1d1d7277be65c532dca92ddc7050374868b117ea9154914ef9292b8443f13696e4fad50ded6bd90e5a6f7ed33be2ece31c6dd7a4253ee6cdc56787ddd1d5cd776614022db87d03bb22f23285b5a3167af8dacabbea40004471337d3781e8c5cca0ea5e27799b510e4ef938c61caa60d"
        // modulus us exactly 2048 bits
        contract = await RSAAccumulatorArtifact.new("0x" + modulusHex, {from: account});
    })

    it('test overflowing addition', async () => {
        for (let j = 0; j < 10; j++) {
            const NlengthIn32ByteLimbs = await contract.NlengthIn32ByteLimbs();
            const modulusLength = NlengthIn32ByteLimbs.toNumber() * 32
            const a = new BN(crypto.randomBytes(modulusLength), "16", "be");
            const b = new BN(crypto.randomBytes(modulusLength), "16", "be");
            const modulusLimbs = await contract.getN();
            const modulus = accumulatorToBN(modulusLimbs, NlengthIn32ByteLimbs.toNumber());

            const aString = a.toString(16);

            const wrapperingModulus = (new BN(1)).ushln(modulusLength * 8);
            const result = a.add(b).umod(wrapperingModulus);

            const aLimbs = bnToAccumulator(a, NlengthIn32ByteLimbs.toNumber())
            let aLimbsString = aLimbs[0].toString(16)
            for (let i = 1; i < NlengthIn32ByteLimbs.toNumber(); i++) {
                aLimbsString = aLimbsString + aLimbs[i].toString(16).padStart(64, "0");
            }
            assert(aString === aLimbsString, "Invalid conversion to limbs");

            const bLimbs = bnToAccumulator(b, NlengthIn32ByteLimbs.toNumber())
            const contractResultLimbs = await contract.wrappingAdd(aLimbs, bLimbs);

            const resultString = result.toString(16);
            let resultLimbsString = contractResultLimbs[0].toString(16)
            for (let i = 1; i < NlengthIn32ByteLimbs.toNumber(); i++) {
                resultLimbsString = resultLimbsString + contractResultLimbs[i].toString(16).padStart(64, "0");
            }
            assert(resultString === resultLimbsString, "Invalid conversion to limbs");

            const contractResult = accumulatorToBN(contractResultLimbs, NlengthIn32ByteLimbs.toNumber());

            assert(contractResult.eq(result), "Addition results are different");
        }
    })

    it('test overflowing subtraction', async () => {
        for (let j = 0; j < 10; j++) {
            const NlengthIn32ByteLimbs = await contract.NlengthIn32ByteLimbs();
            const modulusLength = NlengthIn32ByteLimbs.toNumber() * 32
            const a = new BN(crypto.randomBytes(modulusLength), "16", "be");
            const b = new BN(crypto.randomBytes(modulusLength), "16", "be");
            const modulusLimbs = await contract.getN();
            const modulus = accumulatorToBN(modulusLimbs, NlengthIn32ByteLimbs.toNumber());

            const aString = a.toString(16);

            const wrapperingModulus = (new BN(1)).ushln(modulusLength * 8);
            let result;
            if (a.cmp(b) == -1) {
                result = wrapperingModulus.sub(b.sub(a))
            } else {
                result = a.sub(b)
            }

            const aLimbs = bnToAccumulator(a, NlengthIn32ByteLimbs.toNumber())

            const bLimbs = bnToAccumulator(b, NlengthIn32ByteLimbs.toNumber())
            const contractResultLimbs = await contract.wrappingSub(aLimbs, bLimbs);

            const resultString = result.toString(16);
            let resultLimbsString = contractResultLimbs[0].toString(16)
            for (let i = 1; i < NlengthIn32ByteLimbs.toNumber(); i++) {
                resultLimbsString = resultLimbsString + contractResultLimbs[i].toString(16).padStart(64, "0");
            }
            assert(resultString === resultLimbsString, "Invalid conversion to limbs");

            const contractResult = accumulatorToBN(contractResultLimbs, NlengthIn32ByteLimbs.toNumber());

            assert(contractResult.eq(result), "Subtraction results are different");
        }
    })

    it('test comparison', async () => {
        for (let j = 0; j < 10; j++) {
            const NlengthIn32ByteLimbs = await contract.NlengthIn32ByteLimbs();
            const modulusLength = NlengthIn32ByteLimbs.toNumber() * 32
            const a = new BN(crypto.randomBytes(modulusLength), "16", "be");
            const b = new BN(crypto.randomBytes(modulusLength), "16", "be");
            
            const result = a.cmp(b)

            const aLimbs = bnToAccumulator(a, NlengthIn32ByteLimbs.toNumber())
            
            const bLimbs = bnToAccumulator(b, NlengthIn32ByteLimbs.toNumber())

            const contractResult = await contract.compare(aLimbs, bLimbs);

            assert(result === contractResult.toNumber(), "Comparison results are different");
        }
        const NlengthIn32ByteLimbs = await contract.NlengthIn32ByteLimbs();
        const modulusLength = NlengthIn32ByteLimbs.toNumber() * 32
        const a = new BN(crypto.randomBytes(modulusLength), "16", "be");
        const b = a.clone()

        const aLimbs = bnToAccumulator(a, NlengthIn32ByteLimbs.toNumber())
        
        const bLimbs = bnToAccumulator(b, NlengthIn32ByteLimbs.toNumber())

        const contractResult = await contract.compare(aLimbs, bLimbs);

        assert(0 === contractResult.toNumber(), "Comparison results are different");
    })

    it('test modular addition', async () => {
        for (let j = 0; j < 10; j++) {
            const NlengthIn32ByteLimbs = await contract.NlengthIn32ByteLimbs();
            const modulusLength = NlengthIn32ByteLimbs.toNumber() * 32
            let a = new BN(crypto.randomBytes(modulusLength), "16", "be");
            let b = new BN(crypto.randomBytes(modulusLength), "16", "be");

            const modulusLimbs = await contract.getN();
            const modulus = accumulatorToBN(modulusLimbs, NlengthIn32ByteLimbs.toNumber());

            a = a.umod(modulus)
            b = b.umod(modulus)

            const comparison = (a.add(b)).cmp(modulus);
            const result = a.add(b).umod(modulus);

            const aLimbs = bnToAccumulator(a, NlengthIn32ByteLimbs.toNumber())
            
            const bLimbs = bnToAccumulator(b, NlengthIn32ByteLimbs.toNumber())
            const contractResultLimbs = await contract.modularAdd(aLimbs, bLimbs, modulusLimbs);
            const contractResult = accumulatorToBN(contractResultLimbs, NlengthIn32ByteLimbs.toNumber());
            assert(contractResult.cmp(modulus) === -1, "Result should always be less than modulus");

            assert(contractResult.eq(result), "Modular add results are different for iteration " + j + " and comparison " + comparison);

            const resultString = result.toString(16);
            let resultLimbsString = contractResultLimbs[0].toString(16)
            for (let i = 1; i < NlengthIn32ByteLimbs.toNumber(); i++) {
                resultLimbsString = resultLimbsString + contractResultLimbs[i].toString(16).padStart(64, "0");
            }
            assert(resultString === resultLimbsString, "Invalid conversion to limbs for iteration " + j + " and comparison " + comparison);
        }
    })

    it('test modular subtraction', async () => {
        for (let j = 0; j < 10; j++) {
            const NlengthIn32ByteLimbs = await contract.NlengthIn32ByteLimbs();
            const modulusLength = NlengthIn32ByteLimbs.toNumber() * 32

            let a = new BN(crypto.randomBytes(modulusLength), "16", "be");
            let b = new BN(crypto.randomBytes(modulusLength), "16", "be");

            const modulusLimbs = await contract.getN();
            const modulus = accumulatorToBN(modulusLimbs, NlengthIn32ByteLimbs.toNumber());

            a = a.umod(modulus)
            b = b.umod(modulus)

            const result = a.add(modulus).sub(b).umod(modulus);

            const aLimbs = bnToAccumulator(a, NlengthIn32ByteLimbs.toNumber())
            
            const bLimbs = bnToAccumulator(b, NlengthIn32ByteLimbs.toNumber())
            const contractResultLimbs = await contract.modularSub(aLimbs, bLimbs, modulusLimbs);
            const contractResult = accumulatorToBN(contractResultLimbs, NlengthIn32ByteLimbs.toNumber());
            assert(contractResult.cmp(modulus) === -1, "Result should always be less than modulus");

            assert(contractResult.eq(result), "Modular sub results are different for iteration " + j);
        }
    })

    it('test modular exponentiation', async () => {
        for (let j = 0; j < 10; j++) {
            const NlengthIn32ByteLimbs = await contract.NlengthIn32ByteLimbs();
            const modulusLength = NlengthIn32ByteLimbs.toNumber() * 32
            
            let a = new BN(crypto.randomBytes(modulusLength), "16", "be");
            let exp = new BN(crypto.randomBytes(32), "16", "be");

            const modulusLimbs = await contract.getN();
            const modulus = accumulatorToBN(modulusLimbs, NlengthIn32ByteLimbs.toNumber());

            const redContext = BN.red(modulus);
            a = a.umod(modulus)
            const redA = a.toRed(redContext)

            const result = redA.redPow(exp).fromRed()

            const aLimbs = bnToAccumulator(a, NlengthIn32ByteLimbs.toNumber())
            
            const contractResultLimbs = await contract.modularExp(aLimbs, [exp], modulusLimbs);
            const contractResult = accumulatorToBN(contractResultLimbs, NlengthIn32ByteLimbs.toNumber());
            assert(contractResult.cmp(modulus) === -1, "Result should always be less than modulus");

            assert(contractResult.eq(result), "Modular exp results are different for iteration " + j);
        }
    })

    it('test modular squaring', async () => {
        for (let j = 0; j < 10; j++) {
            const NlengthIn32ByteLimbs = await contract.NlengthIn32ByteLimbs();
            const modulusLength = NlengthIn32ByteLimbs.toNumber() * 32
            
            let a = new BN(crypto.randomBytes(modulusLength), "16", "be");
            let exp = new BN(2);

            const modulusLimbs = await contract.getN();
            const modulus = accumulatorToBN(modulusLimbs, NlengthIn32ByteLimbs.toNumber());

            const redContext = BN.red(modulus);
            a = a.umod(modulus)
            const redA = a.toRed(redContext)

            const result = redA.redPow(exp).fromRed()

            const aLimbs = bnToAccumulator(a, NlengthIn32ByteLimbs.toNumber())
            
            const contractResultLimbs = await contract.modularExp(aLimbs, [exp], modulusLimbs);
            const contractResult = accumulatorToBN(contractResultLimbs, NlengthIn32ByteLimbs.toNumber());
            assert(contractResult.cmp(modulus) === -1, "Result should always be less than modulus");

            assert(contractResult.eq(result), "Modular squaring results are different for iteration " + j);
        }
    })

    // this one is a temporary test for 4*a*b intermediate result
    it('test intermediate modular multiplication', async () => {
        for (let j = 0; j < 10; j++) {
            const NlengthIn32ByteLimbs = await contract.NlengthIn32ByteLimbs();
            const modulusLength = NlengthIn32ByteLimbs.toNumber() * 32
            
            let a = new BN(crypto.randomBytes(modulusLength), "16", "be");
            let b = new BN(crypto.randomBytes(modulusLength), "16", "be");

            const modulusLimbs = await contract.getN();
            const modulus = accumulatorToBN(modulusLimbs, NlengthIn32ByteLimbs.toNumber());

            a = a.umod(modulus)
            b = b.umod(modulus)

            const result = (a.add(b).umod(modulus)).sqr().umod(modulus).add(modulus)
            .sub(a.add(modulus).sub(b).umod(modulus).sqr()).umod(modulus)

            const aLimbs = bnToAccumulator(a, NlengthIn32ByteLimbs.toNumber())
            
            const bLimbs = bnToAccumulator(b, NlengthIn32ByteLimbs.toNumber())
            const contractResultLimbs = await contract.modularMul4(aLimbs, bLimbs, modulusLimbs);
            const contractResult = accumulatorToBN(contractResultLimbs, NlengthIn32ByteLimbs.toNumber());
            assert(contractResult.cmp(modulus) === -1, "Result should always be less than modulus");
            assert(contractResult.eq(result), "Intermediate mul results are different for iteration " + j);
        }
    })

    it('test modular multiplication by 4', async () => {
        for (let j = 0; j < 10; j++) {
            const NlengthIn32ByteLimbs = await contract.NlengthIn32ByteLimbs();
            const modulusLength = NlengthIn32ByteLimbs.toNumber() * 32
            
            let a = new BN(crypto.randomBytes(modulusLength), "16", "be");
            let b = new BN(4);

            const modulusLimbs = await contract.getN();
            const modulus = accumulatorToBN(modulusLimbs, NlengthIn32ByteLimbs.toNumber());

            a = a.umod(modulus)
            b = b.umod(modulus)

            const result = a.mul(b).umod(modulus)
            const aLimbs = bnToAccumulator(a, NlengthIn32ByteLimbs.toNumber())

            const contractResultLimbs = await contract.modularMulBy4(aLimbs, modulusLimbs);
            const contractResult = accumulatorToBN(contractResultLimbs, NlengthIn32ByteLimbs.toNumber());
            assert(contractResult.cmp(modulus) === -1, "Result should always be less than modulus");
            assert(contractResult.eq(result), "Intermediate mul results are different for iteration " + j);
        }
    })

    // it('make proof and check proof', async () => {
    //     const coinID = 1;
    //     const x = 1; // there will be no other included coins

    //     const NlengthIn32ByteLimbs = await contract.NlengthIn32ByteLimbs();
    //     const initialAccumulator = await contract.accumulator(NlengthIn32ByteLimbs.toNumber() - 1)
    //     assert(initialAccumulator.toNumber() === 3);

    //     const coinMapping = await contract.mapCoinToPrime(coinID);
    //     const submissionResult = await contract.includeCoin(coinID);
    //     const updatedAccumulator = await contract.accumulator(NlengthIn32ByteLimbs.toNumber() - 1)

    //     // this is a trivial check, for a last limb only
    //     const expectedAccumulator = initialAccumulator.pow(coinMapping);
    //     assert(expectedAccumulator.eq(updatedAccumulator));

    //     const proof = await contract.calculateProof(coinID, x);

    //     const isValid = await contract.checkProof(coinID, proof[0], proof[1], proof[2]);
    
    //     assert(isValid, "Proof is invalid");
    // })

    function accumulatorToBN(accumulator, numLimbs) {
        const shift = 256;
        let newBN = (new BN(accumulator[0].toString(16), 16))
        for (let i = 1; i < numLimbs; i++) {
            newBN.iushln(shift);
            const limb = (new BN(accumulator[i].toString(16), 16))
            newBN.iadd(limb);
        }
        return newBN;
    }

    function bnToAccumulator(bn, numLimbs) {
        const newBN = bn.clone()
        const reversedAccumulator = [];
        const shift = 256;
        const modulus = (new BN(1).iushln(256));
        let limb = newBN.umod(modulus);
        reversedAccumulator.push(limb);
        for (let i = 1; i < numLimbs; i++) {
            newBN.iushrn(shift);
            limb = newBN.umod(modulus);
            reversedAccumulator.push(limb);
        }
        return reversedAccumulator.reverse();
    }

    function findFirstDiffPos(a, b) {
        if (a.length < b.length) [a, b] = [b, a];
        return [...a].findIndex((chr, i) => chr !== b[i]);
      }
});
