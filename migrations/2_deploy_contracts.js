var RockPaperScissors = artifacts.require("./RockPaperScissors.sol");


module.exports = function(deployer, network, accounts) {

    const initialState = true;
    deployer.deploy(RockPaperScissors, initialState);

};