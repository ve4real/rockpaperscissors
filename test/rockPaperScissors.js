RockPaperScissors = artifacts.require('./RockPaperScissors.sol');
const Pr = require("bluebird");
Pr.promisifyAll(web3.eth, { suffix: "Promise" });

const expectedException = require("./expectedException.js");
const util = require('web3-utils');

contract('RockPaperScissors', accounts => {
	let contract;
	const owner = accounts[0];
	const player1 = accounts[1];
	const player2 = accounts[2];
	const player3 = accounts[3];

	const ROCK = "rock";
	const PAPER = "paper";
	const SCISSORS = "scissors";
	const WRONG = "wrong";

	let player1Choice = ROCK;
	let player2Choice = PAPER;
	let player2OtherChoice = ROCK;
	let player3Choice = SCISSORS;

	let player1Secret = util.randomHex(32);
	let player2Secret = util.randomHex(32);
	let player2OtherSecret = util.randomHex(32);
	let player3Secret = util.randomHex(32);
	

	let player1ChoiceHashed;
	let player2ChoiceHashed;
	let player2OtherChoiceHashed;
	let player3ChoiceHashed;
	let idChallenge1;
	let idChallenge2;

	var minPrizeToPlay = 1000; //TODO should be set in the constructor

	before(function(){
		return RockPaperScissors.new(true, {from: owner})
		.then(_instance => contract = _instance);
	});

	it("should reject direct transaction with value", function() {
        return expectedException(
            () => contract.sendTransaction({ from: player1, value: 1, gas: 3000000 }),
            3000000);
    });

	describe("Add new challenge", () => {
		
		it("Should hash a choice with a secret for player1 and player2 and player3", function(){
			return contract.computeKeccak256(player1Choice, player1Secret)
			.then(hash => player1ChoiceHashed = hash)
			.then(() => contract.computeKeccak256(player2Choice, player2Secret))
			.then(hash => player2ChoiceHashed =  hash)
			.then(() => contract.computeKeccak256(player3Choice, player3Secret))
			.then(hash => player3ChoiceHashed =  hash)
			.then(() => contract.computeKeccak256(player2OtherChoice, player2OtherSecret))
			.then(hash => player2OtherChoiceHashed =  hash);
		});

		it("should fail to create a challenge with opponent equals player", function(){
			return expectedException(
				() => contract.createChallenge(player1, player1ChoiceHashed, {from: player1, value: minPrizeToPlay, gas:3000000}),
				3000000);
		});

		it("should fail to create a challenge without the right amount of weis", function(){
			return expectedException(
				() => contract.createChallenge(player2, player1ChoiceHashed, {from: player1, value: minPrizeToPlay-1, gas:3000000}),
				3000000);
		});

		it("should fail to create a challenge without an amount", function(){
			return expectedException(
				() => contract.createChallenge(player2, player1ChoiceHashed, {from: player1, gas:3000000}),
				3000000);
		});

		//1 Vs 2
		it("Should add challenge1 and emit event", function(){
			return contract.createChallenge(player2, player1ChoiceHashed, {from: player1, value: minPrizeToPlay})
			.then(txObject => {
				assert.strictEqual(txObject.logs.length, 1);
                assert.strictEqual(txObject.logs[0].event, "LogNewChallenge");
                assert.strictEqual(txObject.logs[0].args.player1, player1);
                assert.strictEqual(txObject.logs[0].args.player2, player2);
                assert.strictEqual(txObject.logs[0].args.amountToPlay.toString(10), minPrizeToPlay.toString());
                idChallenge1 = txObject.logs[0].args.idChallenge.toNumber();
			});
		});

		//2 Vs 3 - TODO SECRET MUST BE CHANGED IN A REAL PRODUCTION ENVIRONMENT
		it("Should add challenge2 and emit event", function(){
			return contract.createChallenge(player3, player2ChoiceHashed, {from: player2, value: minPrizeToPlay})
			.then(txObject => {
				assert.strictEqual(txObject.logs.length, 1);
                assert.strictEqual(txObject.logs[0].event, "LogNewChallenge");
                assert.strictEqual(txObject.logs[0].args.player1, player2);
                assert.strictEqual(txObject.logs[0].args.player2, player3);
                assert.strictEqual(txObject.logs[0].args.amountToPlay.toString(10), minPrizeToPlay.toString());
                
                idChallenge2 = txObject.logs[0].args.idChallenge.toNumber();
                assert.strictEqual(idChallenge2, idChallenge1+1);
			});
		});

		it("Should check that challenge1 is valid", function(){
			return contract.challenges(idChallenge1)
			.then(([owner, opponent, ownerChoice, opponentChoice, amount, ownerChoiceClear, opponentChoiceClear, finished]) => {
				assert.strictEqual(owner, player1);
                assert.strictEqual(opponent, player2);
                assert.strictEqual(ownerChoice, player1ChoiceHashed);
                assert.equal(opponentChoice, 0x0); //mmmmmh
                assert.strictEqual(web3.toBigNumber(amount).toString(10), minPrizeToPlay.toString());
                assert.equal(ownerChoiceClear, 0x0);
                assert.equal(opponentChoiceClear, 0x0);
                assert.strictEqual(finished, false);
			});
		});
	});

	describe("Enrol to a challenge", () => {
		it("should fail to enrol to a challenge because of wrong id", function(){
			return expectedException(
				() => contract.enrol(3, player2ChoiceHashed, {from: player2, value: minPrizeToPlay, gas:3000000}),
				3000000);
		});

		it("should fail to enrol to a challenge because no ether is provided", function(){
			return expectedException(
				() => contract.enrol(idChallenge1, player2ChoiceHashed, {from: player2, gas:3000000}),
				3000000);
		});

		it("should fail to enrol to a challenge because player is not the opponent", function(){
			return expectedException(
				() => contract.enrol(idChallenge1, player2ChoiceHashed, {from: player3, value: minPrizeToPlay, gas:3000000}),
				3000000);
		});

		it("should fail to enrol to a challenge because of wrong amount to play", function(){
			return expectedException(
				() => contract.enrol(idChallenge1, player2ChoiceHashed, {from: player2, value: minPrizeToPlay*2, gas:3000000}),
				3000000);
		});

		it("should enrol to challenge1", function(){
			return contract.enrol(idChallenge1, player2ChoiceHashed, {from: player2, value: minPrizeToPlay})
		    .then(txObject => {
				assert.strictEqual(txObject.logs.length, 1);
                assert.strictEqual(txObject.logs[0].event, "LogNewEnrol");
                assert.strictEqual(txObject.logs[0].args.player, player2);
                assert.strictEqual(txObject.logs[0].args.idChallenge.toNumber(), idChallenge1);
			});
		});

		it("should fail to enrol to a challenge twice", function(){
			return expectedException(
				() => contract.enrol(idChallenge1, player2ChoiceHashed, {from: player2, value: minPrizeToPlay, gas:3000000}),
				3000000);
		});

		it("Should check that the challenge has been updated correctly", function(){
			return contract.challenges(idChallenge1)
			.then(([owner, opponent, ownerChoice, opponentChoice, amount, ownerChoiceClear, opponentChoiceClear, finished]) => {
				assert.strictEqual(owner, player1);
                assert.strictEqual(opponent, player2);
                assert.strictEqual(ownerChoice, player1ChoiceHashed);
                assert.equal(opponentChoice, player2ChoiceHashed); 
                assert.strictEqual(web3.toBigNumber(amount).toString(10), minPrizeToPlay.toString());
                assert.equal(ownerChoiceClear, 0x0);
                assert.equal(opponentChoiceClear, 0x0);
                assert.strictEqual(finished, false);
			});
		});

		/*it("should enrol to challenge2", function(){
			return contract.enrol(idChallenge2, player3ChoiceHashed, {from: player3, value: minPrizeToPlay})
		    .then(txObject => {
				assert.strictEqual(txObject.logs.length, 1);
                assert.strictEqual(txObject.logs[0].event, "LogNewEnrol");
                assert.strictEqual(txObject.logs[0].args.player, player3);
                assert.strictEqual(txObject.logs[0].args.idChallenge.toNumber(), idChallenge2);
			});
		});*/

	});

	describe("play the game", () => {
		let player2Balance;
		let player1Balance;

		it("should fail to play because player is not enrolled", function(){
			return expectedException(
				() => contract.play(idChallenge1, web3.fromAscii(player3Choice), player3Secret, {from: player3, gas:3000000}),
				3000000);
		});

		it("should fail to play because of wrong idChallenge", function(){
			return expectedException(
				() => contract.play(3, web3.fromAscii(player1Choice), player1Secret, {from: player1, gas:3000000}),
				3000000);
		});

		it("should fail to play because the opponent is not yet enrolled", function(){
			return expectedException(
				() => contract.play(idChallenge2, web3.fromAscii(player2Choice), player2Secret, {from: player2, gas:3000000}),
				3000000);
		});
		
		it("should now enrol to challenge2", function(){
			return contract.enrol(idChallenge2, player3ChoiceHashed, {from: player3, value: minPrizeToPlay})
		    .then(txObject => {
				assert.strictEqual(txObject.logs.length, 1);
                assert.strictEqual(txObject.logs[0].event, "LogNewEnrol");
                assert.strictEqual(txObject.logs[0].args.player, player3);
                assert.strictEqual(txObject.logs[0].args.idChallenge.toNumber(), idChallenge2);
			});
		});

		it("should correctly check the choice", function(){
			return contract.play(idChallenge1, web3.fromAscii(player2Choice), player2Secret, {from: player2})
			.then(txObject => {
				assert.strictEqual(txObject.logs.length, 1);
                assert.strictEqual(txObject.logs[0].event, "LogChoiceProvided");
                assert.strictEqual(txObject.logs[0].args.player, player2);
                assert.strictEqual(web3.toAscii(txObject.logs[0].args.choice).replace(/\u0000/g, ''), player2Choice);
                assert.strictEqual(txObject.logs[0].args.idChallenge.toNumber(), idChallenge1);
			});
		});

		it("Should check that the challenge has been updated correctly", function(){
			return contract.challenges(idChallenge1)
			.then(([owner, opponent, ownerChoice, opponentChoice, amount, ownerChoiceClear, opponentChoiceClear, finished]) => {
				assert.strictEqual(owner, player1);
                assert.strictEqual(opponent, player2);
                assert.strictEqual(ownerChoice, player1ChoiceHashed);
                assert.equal(opponentChoice, player2ChoiceHashed); 
                assert.strictEqual(web3.toBigNumber(amount).toString(10), minPrizeToPlay.toString());
                assert.equal(ownerChoiceClear, 0x0);
                assert.strictEqual(web3.toAscii(opponentChoiceClear).replace(/\u0000/g, ''), player2Choice);
                assert.strictEqual(finished, false);
			});
		});


		it("should get the balance of player1 and player2", function(){
			return web3.eth.getBalancePromise(player1)
			.then(balance => player1Balance = balance)
			.then(() => web3.eth.getBalancePromise(player2))
			.then(balance => player2Balance = balance);
		});


		it("should correctly check the choice and let player2 win", function(){
			let txFeePlayer1;
			return contract.play(idChallenge1, web3.fromAscii(player1Choice), player1Secret, {from: player1})
			.then(txObject => {
				assert.strictEqual(txObject.logs.length, 1);
                assert.strictEqual(txObject.logs[0].event, "LogEndChallenge");
                assert.strictEqual(txObject.logs[0].args.player1, player1);
                assert.strictEqual(txObject.logs[0].args.player2, player2);
                assert.strictEqual(txObject.logs[0].args.outcome.toNumber(), 2); //player2 wins
                assert.strictEqual(txObject.logs[0].args.idChallenge.toNumber(), idChallenge1);
                web3.eth.getTransactionPromise(txObject.tx)
                	.then(tx => txFeePlayer1 = tx.gasPrice.times(txObject.receipt.gasUsed));
			})
			.then(() => web3.eth.getBalancePromise(player2))
			.then(balance => assert.strictEqual(balance.toString(10), player2Balance.plus(2*minPrizeToPlay).toString(10)))
			.then(() => web3.eth.getBalancePromise(player1))
			.then(balance => assert.strictEqual(balance.toString(10), player1Balance.minus(txFeePlayer1).toString(10)));
		});

		it("Should check that the challenge has been updated correctly", function(){
			return contract.challenges(idChallenge1)
			.then(([owner, opponent, ownerChoice, opponentChoice, amount, ownerChoiceClear, opponentChoiceClear, finished]) => {
				assert.strictEqual(owner, player1);
                assert.strictEqual(opponent, player2);
                assert.strictEqual(ownerChoice, player1ChoiceHashed);
                assert.equal(opponentChoice, player2ChoiceHashed); 
                assert.strictEqual(web3.toBigNumber(amount).toString(10), minPrizeToPlay.toString());
                assert.equal(ownerChoiceClear, 0x0);
                assert.strictEqual(web3.toAscii(opponentChoiceClear).replace(/\u0000/g, ''), player2Choice);
                assert.strictEqual(finished, true);
			});
		});

		it("should fail to play because challenge is finished", function(){
			return expectedException(
				() => contract.play(idChallenge1, web3.fromAscii(player1Choice), player1Secret, {from: player1, gas:3000000}),
				3000000);
		});

		it("should correctly check the choice", function(){
			return contract.play(idChallenge2, web3.fromAscii(player3Choice), player3Secret, {from: player3})
			.then(txObject => {
				assert.strictEqual(txObject.logs.length, 1);
                assert.strictEqual(txObject.logs[0].event, "LogChoiceProvided");
                assert.strictEqual(txObject.logs[0].args.player, player3);
                assert.strictEqual(web3.toAscii(txObject.logs[0].args.choice).replace(/\u0000/g, ''), player3Choice);
                assert.strictEqual(txObject.logs[0].args.idChallenge.toNumber(), idChallenge2);
			});
		});

		it("should correctly check the choice and let player 3 win because player2 has cheated", function(){
			return contract.play(idChallenge2, web3.fromAscii(ROCK), player2Secret, {from: player2})
			.then(txObject => {
				assert.strictEqual(txObject.logs.length, 1);
                assert.strictEqual(txObject.logs[0].event, "LogEndChallenge");
                assert.strictEqual(txObject.logs[0].args.player1, player2);
                assert.strictEqual(txObject.logs[0].args.player2, player3);
                assert.strictEqual(txObject.logs[0].args.outcome.toNumber(), 2); //player2 wins
                assert.strictEqual(txObject.logs[0].args.idChallenge.toNumber(), idChallenge2);
			})
		});


		it("should create new challenge, player2 loses after providing two choice", function(){
			let idChallenge3;
			return contract.createChallenge(player2, player1ChoiceHashed, {from: player1, value: minPrizeToPlay})
			.then(txObject => {
				assert.strictEqual(txObject.logs.length, 1);
	            assert.strictEqual(txObject.logs[0].event, "LogNewChallenge");
	            assert.strictEqual(txObject.logs[0].args.player1, player1);
	            assert.strictEqual(txObject.logs[0].args.player2, player2);
	            assert.strictEqual(txObject.logs[0].args.amountToPlay.toString(10), minPrizeToPlay.toString());
	            idChallenge3 = txObject.logs[0].args.idChallenge.toNumber();
			})
			.then(() => contract.enrol(idChallenge3, player2ChoiceHashed, {from: player2, value: minPrizeToPlay}))
		    .then(txObject => {
				assert.strictEqual(txObject.logs.length, 1);
                assert.strictEqual(txObject.logs[0].event, "LogNewEnrol");
                assert.strictEqual(txObject.logs[0].args.player, player2);
                assert.strictEqual(txObject.logs[0].args.idChallenge.toNumber(), idChallenge3);
			})
			.then(() => contract.play(idChallenge3, web3.fromAscii(player2Choice), player2Secret, {from: player2}))
			.then(txObject => {
				assert.strictEqual(txObject.logs.length, 1);
                assert.strictEqual(txObject.logs[0].event, "LogChoiceProvided");
                assert.strictEqual(txObject.logs[0].args.player, player2);
                assert.strictEqual(web3.toAscii(txObject.logs[0].args.choice).replace(/\u0000/g, ''), player2Choice);
                assert.strictEqual(txObject.logs[0].args.idChallenge.toNumber(), idChallenge3);
			})
			.then(() => contract.play(idChallenge3, web3.fromAscii(ROCK), player2Secret, {from: player2}))
			.then(txObject => {
				assert.strictEqual(txObject.logs.length, 1);
                assert.strictEqual(txObject.logs[0].event, "LogEndChallenge");
                assert.strictEqual(txObject.logs[0].args.player1, player1);
                assert.strictEqual(txObject.logs[0].args.player2, player2);
                assert.strictEqual(txObject.logs[0].args.outcome.toNumber(), 1); //player1 wins
                assert.strictEqual(txObject.logs[0].args.idChallenge.toNumber(), idChallenge3);
			})
		});


		it("should create new challenge and it's a draw!", function(){
			let idChallenge4, txFeePlayer1;
			return contract.createChallenge(player2, player1ChoiceHashed, {from: player1, value: minPrizeToPlay})
			.then(txObject => {
				assert.strictEqual(txObject.logs.length, 1);
	            assert.strictEqual(txObject.logs[0].event, "LogNewChallenge");
	            assert.strictEqual(txObject.logs[0].args.player1, player1);
	            assert.strictEqual(txObject.logs[0].args.player2, player2);
	            assert.strictEqual(txObject.logs[0].args.amountToPlay.toString(10), minPrizeToPlay.toString());
	            idChallenge4 = txObject.logs[0].args.idChallenge.toNumber();
			})
			.then(() => contract.enrol(idChallenge4, player2OtherChoiceHashed, {from: player2, value: minPrizeToPlay}))
		    .then(txObject => {
				assert.strictEqual(txObject.logs.length, 1);
                assert.strictEqual(txObject.logs[0].event, "LogNewEnrol");
                assert.strictEqual(txObject.logs[0].args.player, player2);
                assert.strictEqual(txObject.logs[0].args.idChallenge.toNumber(), idChallenge4);
			})
			.then(() => contract.play(idChallenge4, web3.fromAscii(player2OtherChoice), player2OtherSecret, {from: player2}))
			.then(txObject => {
				assert.strictEqual(txObject.logs.length, 1);
                assert.strictEqual(txObject.logs[0].event, "LogChoiceProvided");
                assert.strictEqual(txObject.logs[0].args.player, player2);
                assert.strictEqual(web3.toAscii(txObject.logs[0].args.choice).replace(/\u0000/g, ''), player2OtherChoice);
                assert.strictEqual(txObject.logs[0].args.idChallenge.toNumber(), idChallenge4);
                
                //why does this need to be here and cannot be in another then(..)?? TODO
                web3.eth.getBalancePromise(player1)
					.then(balance => player1Balance = balance)
					.then(() => web3.eth.getBalancePromise(player2))
					.then(balance => player2Balance = balance);
			})
			.then(() => contract.play(idChallenge4, web3.fromAscii(player1Choice), player1Secret, {from: player1}))
			.then(txObject => {
				assert.strictEqual(txObject.logs.length, 1);
                assert.strictEqual(txObject.logs[0].event, "LogEndChallenge");
                assert.strictEqual(txObject.logs[0].args.player1, player1);
                assert.strictEqual(txObject.logs[0].args.player2, player2);
                assert.strictEqual(txObject.logs[0].args.outcome.toNumber(), 0); //draw
                assert.strictEqual(txObject.logs[0].args.idChallenge.toNumber(), idChallenge4);
                web3.eth.getTransactionPromise(txObject.tx)
                	.then(tx => txFeePlayer1 = tx.gasPrice.times(txObject.receipt.gasUsed));
			})
			.then(() => web3.eth.getBalancePromise(player2))
			.then(balance => assert.strictEqual(balance.toString(10), player2Balance.toString(10)))
			.then(() => web3.eth.getBalancePromise(player1))
			.then(balance => assert.strictEqual(balance.toString(10), player1Balance.minus(txFeePlayer1).toString(10)));
		});

		it("should get the balance of player1 and player2", function(){
			return web3.eth.getBalancePromise(player1)
			.then(balance => player1Balance = balance)
			.then(() => web3.eth.getBalancePromise(player2))
			.then(balance => player2Balance = balance);
		});

		it("should withdraw amount of player1 and player2", function(){
			let txFeePlayer1, txFeePlayer2;
			return contract.withdraw({from: player1})
			.then(txObject => {
				assert.strictEqual(txObject.logs.length, 1);
                assert.strictEqual(txObject.logs[0].event, "LogWithdraw");
                assert.strictEqual(txObject.logs[0].args.player, player1);
                assert.strictEqual(txObject.logs[0].args.amount.toString(10), minPrizeToPlay.toString());
                web3.eth.getTransactionPromise(txObject.tx)
                	.then(tx => txFeePlayer1 = tx.gasPrice.times(txObject.receipt.gasUsed));
			})
			.then(() => contract.withdraw({from: player2}))
			.then(txObject => {
				assert.strictEqual(txObject.logs.length, 1);
                assert.strictEqual(txObject.logs[0].event, "LogWithdraw");
                assert.strictEqual(txObject.logs[0].args.player, player2);
                assert.strictEqual(txObject.logs[0].args.amount.toString(10), minPrizeToPlay.toString());
                web3.eth.getTransactionPromise(txObject.tx)
                	.then(tx => txFeePlayer2 = tx.gasPrice.times(txObject.receipt.gasUsed));
			})
			.then(() => web3.eth.getBalancePromise(player2))
			.then(balance => assert.strictEqual(balance.toString(10), player2Balance.plus(minPrizeToPlay).minus(txFeePlayer2).toString(10)))
			.then(() => web3.eth.getBalancePromise(player1))
			.then(balance => assert.strictEqual(balance.toString(10), player1Balance.plus(minPrizeToPlay).minus(txFeePlayer1).toString(10)));
		});

	});
});
