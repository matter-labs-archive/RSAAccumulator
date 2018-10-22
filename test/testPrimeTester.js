const PrimeTester = artifacts.require('PrimeTester');
const crypto = require("crypto");

contract('Prime tester', async (accounts) => {
    const BN = require("bn.js");

    const account = accounts[0];
    let contract;
    
    beforeEach(async () => {
        contract = await PrimeTester.new({from: account});
    })

    it('Estimate gas price for largest prime', async () => {
        const prime = new BN("18446744073709551557")
        const isPrime = await contract.IsPrime([prime])
        assert(isPrime)
        const gasEstimate = await contract.IsPrime.estimateGas([prime])
        console.log("Gas cost for one prime check is " + gasEstimate)
    })

});
