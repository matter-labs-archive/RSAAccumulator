const RSAAccumulatorArtifact = artifacts.require('RSAAccumulator');
const PlasmaCashMockup = artifacts.require("PlasmaCashMockup");
const crypto = require("crypto");

contract('Plasma Cash mockup', async (accounts) => {
    const BN = require("bn.js");

    const account = accounts[0];
    let plasma;
    let accumulator;
    
    beforeEach(async () => {
        const modulusHex = "b2f5fd3f9f0917112ce42f8bf87ed676e15258be443f36deafb0b69bde2496b495eaad1b01cad84271b014e96f79386c636d348516da74a68a8c70fba882870c47b4218d8f49186ddf72727b9d80c21911c3e337c6e407ffb47c2f2767b0d164d8a1e9af95f6481bf8d9edfb2e3904b2529268c460256fafd0a677d29898f10b1d15128a695839fc08edd584e8335615b1d1d7277be65c532dca92ddc7050374868b117ea9154914ef9292b8443f13696e4fad50ded6bd90e5a6f7ed33be2ece31c6dd7a4253ee6cdc56787ddd1d5cd776614022db87d03bb22f23285b5a3167af8dacabbea40004471337d3781e8c5cca0ea5e27799b510e4ef938c61caa60d"
        // modulus us exactly 2048 bits
        accumulator = await RSAAccumulatorArtifact.new("0x" + modulusHex, {from: account});
        plasma = await PlasmaCashMockup.new(accumulator.address, {from: account});
    })

    it('update and prove inclusion', async () => {
            const NlengthIn32ByteLimbs = await accumulator.NlengthIn32ByteLimbs();
            const modulusLength = NlengthIn32ByteLimbs.toNumber() * 32
            const a = new BN(3) // prime index to include
            const modulusLimbs = await accumulator.getN();
            const modulus = accumulatorToBN(modulusLimbs, NlengthIn32ByteLimbs.toNumber());

            const initialBlock = await plasma.lastBlock();
            const initialAccumulatorLimbs = await plasma.getAccumulatorForBlock(initialBlock);
            const initialAccumulator = accumulatorToBN(initialAccumulatorLimbs, NlengthIn32ByteLimbs.toNumber());

            await plasma.updateAccumulator([a]);

            const finalBlock = await plasma.lastBlock();
            const finalAccumulatorLimbs = await plasma.getAccumulatorForBlock(finalBlock);
            const finalAccumulator = accumulatorToBN(finalAccumulatorLimbs, NlengthIn32ByteLimbs.toNumber());

            const inclusion = await plasma.checkInclusionProof(3, [1], initialAccumulatorLimbs, finalAccumulatorLimbs)
            assert(inclusion);
            const gas = await plasma.checkInclusionProof.estimateGas(3, [1], initialAccumulatorLimbs, finalAccumulatorLimbs)
            console.log("Signle inclusion proof is at least " + gas + " gas")
    })

    it('update and prove single non-inclusion in classical equation', async () => {
        const NlengthIn32ByteLimbs = await accumulator.NlengthIn32ByteLimbs();
        const modulusLength = NlengthIn32ByteLimbs.toNumber() * 32
        const aIncl = new BN(3) // prime index to include
        // const bIncl = new BN(5) // include this one too
        const cNonincl = new BN(7)
        const modulusLimbs = await accumulator.getN();
        const modulus = accumulatorToBN(modulusLimbs, NlengthIn32ByteLimbs.toNumber());

        const initialBlock = await plasma.lastBlock();
        const initialAccumulatorLimbs = await plasma.getAccumulatorForBlock(initialBlock);
        const initialAccumulator = accumulatorToBN(initialAccumulatorLimbs, NlengthIn32ByteLimbs.toNumber());

        await plasma.updateAccumulator([aIncl]);
        // await plasma.updateAccumulator([bIncl]);

        const finalBlock = await plasma.lastBlock();
        const finalAccumulatorLimbs = await plasma.getAccumulatorForBlock(finalBlock);
        const finalAccumulator = accumulatorToBN(finalAccumulatorLimbs, NlengthIn32ByteLimbs.toNumber());

        let aInitial = new BN(1);
        let dInitial = new BN(1);

        let {a, d} = updateWitness(aInitial, dInitial, cNonincl, {x: aIncl, c: initialAccumulator, N: modulus})

        // check equation

        // c^a = d^x*g

        const red = BN.red(modulus)

        const lhs = finalAccumulator.toRed(red).redPow(a).fromRed()
        const rhs = d.toRed(red).redPow(cNonincl).redMul(initialAccumulator.toRed(red)).fromRed()

        assert(lhs.eq(rhs));
    })

    it('update and prove single non-inclusion', async () => {
        const NlengthIn32ByteLimbs = await accumulator.NlengthIn32ByteLimbs();
        const modulusLength = NlengthIn32ByteLimbs.toNumber() * 32
        const aIncl = new BN(3) // prime index to include
        const bIncl = new BN(5) // include this one too
        const cNonincl = new BN(7)
        const dIncl = new BN(11)
        const modulusLimbs = await accumulator.getN();
        const modulus = accumulatorToBN(modulusLimbs, NlengthIn32ByteLimbs.toNumber());

        const initialBlock = await plasma.lastBlock();
        const initialAccumulatorLimbs = await plasma.getAccumulatorForBlock(initialBlock);
        const initialAccumulator = accumulatorToBN(initialAccumulatorLimbs, NlengthIn32ByteLimbs.toNumber());

        await plasma.updateAccumulator([aIncl]);
        await plasma.updateAccumulator([bIncl]);
        await plasma.updateAccumulator([dIncl]);

        const finalBlock = await plasma.lastBlock();
        const finalAccumulatorLimbs = await plasma.getAccumulatorForBlock(finalBlock);
        const finalAccumulator = accumulatorToBN(finalAccumulatorLimbs, NlengthIn32ByteLimbs.toNumber());

        const exponent = aIncl.mul(bIncl).mul(dIncl)
        assert(exponent.toNumber() == 165)
        const cofactor = exponent.div(cNonincl).addn(1)
        assert(cofactor.toNumber() == 24)
        const r = cNonincl.sub(exponent.umod(cNonincl))
        assert(r.toNumber() == 3)


        // check equation

        // A*(g^r) = g^(x1*x2*...*xn)^cofactor

        const red = BN.red(modulus)

        const lhs = finalAccumulator.toRed(red).redMul(initialAccumulator.toRed(red).redPow(r)).fromRed()
        const rhs = initialAccumulator.toRed(red).redPow(cNonincl).redPow(cofactor).fromRed()

        assert(lhs.eq(rhs));
    })

    it('update and prove single non-inclusion on contract', async () => {
        const NlengthIn32ByteLimbs = await accumulator.NlengthIn32ByteLimbs();
        const modulusLength = NlengthIn32ByteLimbs.toNumber() * 32
        const aIncl = new BN(3) // prime index to include
        const bIncl = new BN(5) // include this one too
        const cNonincl = new BN(7)
        const dIncl = new BN(11)
        const modulusLimbs = await accumulator.getN();
        const modulus = accumulatorToBN(modulusLimbs, NlengthIn32ByteLimbs.toNumber());

        const initialBlock = await plasma.lastBlock();
        const initialAccumulatorLimbs = await plasma.getAccumulatorForBlock(initialBlock);
        const initialAccumulator = accumulatorToBN(initialAccumulatorLimbs, NlengthIn32ByteLimbs.toNumber());

        await plasma.updateAccumulator([aIncl]);
        await plasma.updateAccumulator([bIncl]);
        await plasma.updateAccumulator([dIncl]);

        const finalBlock = await plasma.lastBlock();
        const finalAccumulatorLimbs = await plasma.getAccumulatorForBlock(finalBlock);
        const finalAccumulator = accumulatorToBN(finalAccumulatorLimbs, NlengthIn32ByteLimbs.toNumber());

        const exponent = aIncl.mul(bIncl).mul(dIncl)
        assert(exponent.toNumber() == 165)
        const cofactor = exponent.div(cNonincl).addn(1)
        assert(cofactor.toNumber() == 24)
        const r = cNonincl.sub(exponent.umod(cNonincl))
        assert(r.toNumber() == 3)

        const nonIncluded = await plasma.checkNonInclusionProof([cNonincl], [r], [cofactor], initialAccumulatorLimbs, finalAccumulatorLimbs);
        assert(nonIncluded);

        const gas = await plasma.checkNonInclusionProof.estimateGas([cNonincl], [r], [cofactor], initialAccumulatorLimbs, finalAccumulatorLimbs);
        console.log("Signle non-inclusion proof is at least " + gas + " gas")
    })

    it('update and prove non-inclusion for two elements on contract', async () => {
        const NlengthIn32ByteLimbs = await accumulator.NlengthIn32ByteLimbs();
        const modulusLength = NlengthIn32ByteLimbs.toNumber() * 32
        const aIncl = new BN(3) // prime index to include
        const bIncl = new BN(5) // include this one too
        const cNonincl = new BN(7)
        const dNonincl = new BN(11)
        const modulusLimbs = await accumulator.getN();
        const modulus = accumulatorToBN(modulusLimbs, NlengthIn32ByteLimbs.toNumber());

        const initialBlock = await plasma.lastBlock();
        const initialAccumulatorLimbs = await plasma.getAccumulatorForBlock(initialBlock);
        const initialAccumulator = accumulatorToBN(initialAccumulatorLimbs, NlengthIn32ByteLimbs.toNumber());

        await plasma.updateAccumulator([aIncl]);
        await plasma.updateAccumulator([bIncl]);

        const finalBlock = await plasma.lastBlock();
        const finalAccumulatorLimbs = await plasma.getAccumulatorForBlock(finalBlock);
        const finalAccumulator = accumulatorToBN(finalAccumulatorLimbs, NlengthIn32ByteLimbs.toNumber());

        const exponent = aIncl.mul(bIncl)
        const nonincludedExponent = cNonincl.mul(dNonincl)
        const cofactor = exponent.div(nonincludedExponent).addn(1)
        const r = nonincludedExponent.sub(exponent.umod(nonincludedExponent))

        const red = BN.red(modulus)

        const lhs = finalAccumulator.toRed(red).redMul(initialAccumulator.toRed(red).redPow(r)).fromRed()
        const rhs = initialAccumulator.toRed(red).redPow(nonincludedExponent).redPow(cofactor).fromRed()

        assert(lhs.eq(rhs));

        const nonIncluded = await plasma.checkNonInclusionProof([cNonincl, dNonincl], [r], [cofactor], initialAccumulatorLimbs, finalAccumulatorLimbs);
        assert(nonIncluded);

        const gas = await plasma.checkNonInclusionProof.estimateGas([cNonincl, dNonincl], [r], [cofactor], initialAccumulatorLimbs, finalAccumulatorLimbs);
        console.log("Non-inclusion proof for two elements is at least " + gas + " gas")
    })

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

    function updateWitness(a, d, y, {x, c, N}) {
        const red = BN.red(N)
        const z = x.invm(y)
        const aPrime = a.mul(z)
        const exponent = x.mul(z).subn(1).mul(a).div(y)
        const dPrime = c.toRed(red).redPow(exponent).fromRed().mul(d)
        return {a: aPrime, d: dPrime}
    }

    function findFirstDiffPos(a, b) {
        if (a.length < b.length) [a, b] = [b, a];
        return [...a].findIndex((chr, i) => chr !== b[i]);
      }
});
