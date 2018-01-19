pragma solidity ^0.4.13;

import "./Runnable.sol";

contract RockPaperScissors is Runnable{
	
	//player1 challenges player2 to play with a prize of 2xamount 
	event LogNewChallenge(address player1, address player2, uint amountToPlay, uint idChallenge);
	
	//player enrol to the challenge idChallenge (and therefore sent the amount)
	event LogNewEnrol(address player, uint idChallenge);

	//challenge idChallenge ended with the outcome. if outcome=0 is a draw, if outcome=1 player1 wins else player2 wins
	event LogEndChallenge(uint idChallenge, uint8 outcome, address player1, address player2);

	//the user player has withdrawn amount in weis
	event LogWithdraw(address player, uint amount);

	struct Challenge{ //TODO find a better name
		address owner; //TODO find a better name
		address opponent;
		bytes32 ownerChoice;
		bytes32 opponentChoice;
		uint amount;
		bytes9 ownerChoiceClear;
		bytes9 opponentChoiceClear;
		bool finished;
	}

	bytes9 public constant ROCK = "rock";
	bytes9 public constant PAPER = "paper";
	bytes9 public constant SCISSORS = "scissors";
	uint constant public MIN_AMOUNT_TO_PLAY = 100; //wei
	
	mapping(address => uint) private balances; //to manage the withdraws in draw case
	mapping(uint => Challenge) private challenges; //book of challenges
	uint private nextId = 0; //incremental id to identify each challenge


   	function computeKeccak256(bytes9 choice, uint secret)
	public
    constant 
    returns(bytes32 hash) 
    {
        return keccak256(choice, secret);
    }

    function computeWinner(bytes9 playerChoice, bytes9 opponentChoice)
    internal
    constant
    returns(uint8 result)//0 draw, 1 player wins, 2 opponent wins
    {
    	//check valid choices
    	uint8 winner = 0;
    	if((playerChoice != ROCK) && (playerChoice != PAPER) && (playerChoice != SCISSORS)) 
    		winner = 2; //owner choice is not valid and opponent could win
    	
    	if((opponentChoice != ROCK) && (opponentChoice != PAPER) && (opponentChoice != SCISSORS)){
    		//also opponent choice is not valid...
    		if(winner == 2) 
    			return 0; //but both choices are not valid - it's a stupid draw
    		else
    			winner = 1; //opponent choice is the only not valid, owner wins
    	}

    	//one choice is not valid and lose the game
    	if(winner != 0)
    		return winner;

    	//choices are valid - now check the outcome 
    	if(playerChoice == opponentChoice) return 0;
    	if(playerChoice == ROCK && opponentChoice == SCISSORS) return 1;
    	if(playerChoice == PAPER && opponentChoice == ROCK) return 1;
    	if(playerChoice == SCISSORS && opponentChoice == PAPER) return 1;
    	return 2;
    }


    function checkGame(bytes9 savedPlayerChoiceClear, 
    				bytes32 playerChoiceHashed, 
    				bytes9 playerChoiceClearProvided, 
    				bytes32 hashOfThePlayerChoiceProvided, 
    				bytes9 savedOpponentChoiceClear)
    internal
    constant
    returns(uint8 outcome) //outcome: 0=draw, 1=player wins, 2=opponent wins, 3=dunno yet 
    {
    	//check if player is cheating - he provided choice twice or the choice does not match the hash
		if(savedPlayerChoiceClear!=0x0 || (hashOfThePlayerChoiceProvided != playerChoiceHashed)) 
			return 2; //player is cheating and opponent wins
		
		//check if opponent has made the choice as well
		if(savedOpponentChoiceClear!=0x0){
			uint8 result = computeWinner(playerChoiceClearProvided, savedOpponentChoiceClear);
			return result;
		}

		return 3;
	}


	function createChallenge(address opponent, bytes32 choiceHash)//choiceHash will be the keccak256 of choice + secret
	payable
	public
	returns(uint id)
	{
		require(opponent != 0x0);
		require(choiceHash != 0x0);
		require(msg.sender != opponent);
		require(msg.value > MIN_AMOUNT_TO_PLAY);

		uint idChallenge = nextId;

		Challenge c = challenges[idChallenge];
		require(c.amount == 0);
		
		nextId++;

		c.owner = msg.sender;
		c.opponent = opponent;
		c.ownerChoice = choiceHash;
		c.amount = msg.value;
		c.finished = false;
		
		LogNewChallenge(msg.sender, opponent, msg.value, idChallenge);
		return idChallenge;
	}


	function enrol(uint idChallenge, bytes32 choiceHash)
	payable
	public
	returns(bool success)
	{
		require(choiceHash != 0x0);

		Challenge c = challenges[idChallenge];
		require(c.amount != 0);
		require(c.opponent == msg.sender);
		require(c.opponentChoice == 0x0); //to avoid double enrol 
		require(msg.value == c.amount); 

		c.opponentChoice = choiceHash;

		LogNewEnrol(msg.sender, idChallenge);
		return true;
	}

	//good to know: if size of choiceProvided is greater than 9, the rest will be dropped and the choice will
	//lead to defeat
	function play(uint idChallenge, bytes9 choiceProvided, uint secretProvided)
	public
	returns(bool success)
	{
		//check the validity of the choiceProvided later in computeWinner, not here.

		Challenge c = challenges[idChallenge];
		require(c.amount != 0); //challange must exists
		require(!c.finished);
		require(c.owner == msg.sender || c.opponent == msg.sender); //only the challengers are able to play
		require(c.ownerChoice != 0x0 && c.opponentChoice != 0x0); //to avoid that the owner send the choiceProvided in clear before the opponent made its choice

		bool isOwner = (msg.sender == c.owner) ? true : false; //thanks to the require if it's not owner is opponent
		bytes32 choiceHash = computeKeccak256(choiceProvided, secretProvided);
		uint8 outcome = 3;

		if(isOwner){
			outcome = checkGame(c.ownerChoiceClear, c.ownerChoice, choiceProvided, choiceHash, c.opponentChoiceClear);
			if(outcome == 3)
				c.ownerChoiceClear = choiceProvided;
		}else{
			outcome = checkGame(c.opponentChoiceClear, c.opponentChoice, choiceProvided, choiceHash, c.ownerChoiceClear);
			if(outcome == 3)
				c.opponentChoiceClear = choiceProvided;
		}

		if(outcome != 3){
			c.finished = true;

			if(outcome==0){
				balances[c.owner] += c.amount;
				balances[c.opponent] += c.amount;
			}else{
				if((isOwner && outcome==1) || (!isOwner && outcome==2)){
					c.owner.transfer(2*c.amount);
					outcome = 1; //i modify it just for the event
				}else{
					c.opponent.transfer(2*c.amount);
					outcome = 2; //i modify it just for the event
				}
			}

			LogEndChallenge(idChallenge, outcome, c.owner, c.opponent);
		}

		return true;
	}


	function withdraw()
	public
	returns(bool success)
	{
		uint amount = balances[msg.sender];
		require(amount != 0);

		balances[msg.sender] = 0;
		msg.sender.transfer(amount);
		return true;
	}
}