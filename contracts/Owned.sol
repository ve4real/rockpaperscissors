pragma solidity 0.4.13;

contract Owned {

	address private _owner;
	event LogNewOwner(address sender, address ondOwner, address newOwner);

	function Owned(){
		_owner = msg.sender;
	}


	function getOwner()
	constant
	returns (address owner)
	{
		return _owner;
	}


	modifier onlyOwner{
		require(msg.sender == _owner);
		_;
	}

	function changeOwner(address newOwner) 
	public 
	onlyOwner 
	returns(bool success)
	{
		require(newOwner != 0);

		address currentOwner = _owner;
		require(newOwner != currentOwner);

		LogNewOwner(msg.sender, currentOwner, newOwner);
		_owner = newOwner;
		

		return true;
	} 

}