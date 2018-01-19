pragma solidity 0.4.13;

import "./Owned.sol";

contract Runnable is Owned{

	event LogChangeState(bool isRunning);

	bool private isRunning = true;

	function Runnable(bool initialState){
		isRunning = initialState;
	}

	function stop() public onlyOwner{
		require(isRunning);
		isRunning = false;
		LogChangeState(false);
	}

	function run() public onlyOwner{
		require(!isRunning);
		isRunning = true;
		LogChangeState(true);
	}

	modifier onlyIfRunning{
		require(isRunning);
		_;
	}
}