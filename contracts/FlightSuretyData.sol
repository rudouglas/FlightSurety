// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../node_modules/@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Flight status codees
    uint8 public constant STATUS_CODE_UNKNOWN = 0;
    uint8 public constant STATUS_CODE_ON_TIME = 10;
    uint8 public constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 public constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 public constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 public constant STATUS_CODE_LATE_OTHER = 50;

    address private contractOwner; // Account used to deploy contract
    bool private operational = true; // Blocks all state changes throughout the contract if false

    mapping(address => bool) private authorizedContracts;

    struct Airline {
        string name;
        bool isFunded;
        bool isRegistered;
        uint256 amountFunded;
    }
    mapping(address => Airline) public airlines;

    struct Flight {
        address airline;
        bool isRegistered;
        uint8 statusCode;
        uint256 timestamp;
        string from;
        string to;
    }
    mapping(bytes32 => Flight) private flights;

    struct Insurance {
        address insuree;
        uint256 insuranceAmount;
        uint256 amountToPay;
        bool insureeEligible;
    }
    mapping(bytes32 => Insurance[]) private insurances;

    mapping(address => uint256) private balance;
    uint256 public airlineCounter = 0;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Constructor
     *      The deploying account becomes contractOwner
     *      Create an initial airline for the deploying account and authorize them
     */
    constructor() {
        contractOwner = msg.sender;
        airlines[msg.sender] = Airline(
            "Contract Owner Airlines",
            true,
            true,
            10
        );
        airlineCounter = 1;

        authorizedContracts[msg.sender] = true;
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
     * @dev Modifier that requires the "operational" boolean variable to be "true"
     *      This is used on all state changing functions to pause the contract in
     *      the event there is an issue that needs to be fixed
     */
    modifier requireIsOperational() {
        require(operational, "The contract is currently not operational");
        _;
    }

    /**
     * @dev Modifier that requires the caller to be authorized
     */
    modifier requireIsAuthorized() {
        require(
            authorizedContracts[msg.sender],
            string.concat(
                Strings.toHexString(uint160(msg.sender)),
                "The caller is not authorized to execute this function"
            )
        );
        _;
    }

    /**
     * @dev Modifier that requires the "ContractOwner" account to be the function caller
     */
    modifier requireContractOwner() {
        require(
            msg.sender == contractOwner,
            "The caller is not the contract owner"
        );
        _;
    }
    /**
     * @dev Modifier that requires the airlines account is funded
     */
    modifier requireIsFunded() {
        require(msg.value > 0, "This aiirline is not funded");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Get operating status of contract
     *
     * @return A bool that is the current operating status
     */
    function isOperational() public view requireIsAuthorized returns (bool) {
        return operational;
    }

    /**
     * @dev Add an airline to the registration queue
     *      Can only be called from FlightSuretyApp contract
     * @return A bool that is the current operating status
     */
    function isAirlineRegistered(address _airline) public view returns (bool) {
        return airlines[_airline].isRegistered;
    }

    /**
     * @dev Check if an airline is currently funded
     *
     * @return A bool that is the current funded status of the airline
     */
    function isAirlineFunded(address _airline) public view returns (bool) {
        return airlines[_airline].isFunded;
    }

    /**
     * @dev Sets contract operations on/off
     *
     * When operational mode is disabled, all write transactions except for this one will fail
     */
    function setOperatingStatus(bool mode) external requireContractOwner {
        operational = mode;
    }

    /**
     * @dev authorize the caller of the contract
     *      Called by the App contract
     */
    function authorizeCaller(address _caller) public requireContractOwner {
        _authorizeCaller(_caller);
    }

    /**
     * @dev authorize the caller of the contract
     *      Only callable internally
     *
     */
    function _authorizeCaller(address _caller) internal {
        require(
            authorizedContracts[_caller] != true,
            "Caller is already authorized"
        );
        authorizedContracts[_caller] = true;
    }

    /**
     * @dev Deauthorize the caller of the contract
     *
     */

    function deauthorizeCaller(address _caller) external {
        authorizedContracts[_caller] = false;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
     *      Can only be called from FlightSuretyApp contract
     *
     */
    function registerAirline(address _newAirline, string memory _airlineName)
        external
        requireIsOperational
        requireIsAuthorized
    {
        _registerAirline(_newAirline, _airlineName);
    }

    /**
     * @dev Add an airline to the registration queue
     *      Can only be called internally
     *
     */
    function _registerAirline(address _newAirline, string memory _airlineName)
        internal
        requireIsOperational
    {
        require(
            !isAirlineRegistered(_newAirline),
            "This airline is already registered"
        );

        airlines[_newAirline].isRegistered = true;
        airlines[_newAirline].name = _airlineName;
        airlineCounter++;
    }

    /**
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
     *      resulting in insurance payouts, the contract should be self-sustaining
     *
     */
    function fundAirline(address _airline)
        public
        payable
        requireIsOperational
        requireIsAuthorized
    {
        require(
            isAirlineRegistered(_airline),
            "Airline has not been registered yet"
        );
        airlines[_airline].amountFunded += msg.value;
        if (getAirlineFundedAmount(_airline) >= 10 ether) {
            setAirlineFunded(_airline, true);
        }
    }

    /**
     * @dev Set the airlines status to "isFunded"
     *
     */
    function setAirlineFunded(address _airline, bool _funded)
        internal
        requireIsOperational
    {
        airlines[_airline].isFunded = _funded;
    }

    /**
     * @dev Get the count of all registered airlines
     *
     */
    function getAirlinesCount() public view returns (uint256) {
        return airlineCounter;
    }

    /**
     * @dev Get the current funding amount for a registered airline
     *
     */
    function getAirlineFundedAmount(address _airlineAddress)
        public
        view
        returns (uint256)
    {
        return airlines[_airlineAddress].amountFunded;
    }

    /**
     * @dev Get information for a registered airline
     *
     * @return The airlines name, registration status, funding status and amount
     */
    function getAirlineInformation(address _airlineAddress)
        external
        view
        returns (
            string memory,
            bool,
            bool,
            uint256
        )
    {
        string memory name = airlines[_airlineAddress].name;
        bool isRegistered = airlines[_airlineAddress].isRegistered;
        bool isFunded = airlines[_airlineAddress].isFunded;
        uint256 amountFunded = airlines[_airlineAddress].amountFunded;
        return (name, isRegistered, isFunded, amountFunded);
    }

    /**
     * @dev Register a flight
     *
     */
    function registerFlight(
        string calldata _flight,
        uint256 _timestamp,
        string calldata _from,
        string calldata _to,
        address _airlineAddress
    ) external requireIsOperational requireIsAuthorized {
        bytes32 flightKey = getFlightKey(_flight);
        require(
            !flights[flightKey].isRegistered,
            "This flight has already been registered"
        );
        flights[flightKey] = Flight({
            isRegistered: true,
            statusCode: STATUS_CODE_UNKNOWN,
            timestamp: _timestamp,
            airline: _airlineAddress,
            from: _from,
            to: _to
        });
    }

    /**
     * @dev Checks if a flight is registered
     *
     */
    function flightIsRegistered(string memory _flight)
        external
        view
        returns (bool)
    {
        bytes32 flightKey = getFlightKey(_flight);
        return flights[flightKey].isRegistered;
    }

    /**
     * @dev Sets a flight status
     *
     */
    function setFlightStatus(string memory _flight, uint8 _statusCode)
        external
        requireIsOperational
        requireIsAuthorized
    {
        bytes32 flightKey = getFlightKey(_flight);
        require(
            flights[flightKey].isRegistered,
            "Flight has not been registered"
        );
        flights[flightKey].statusCode = _statusCode;
    }

    /**
     * @dev Gets a flights flight key
     *
     */
    function getFlightKey(string memory flight)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(flight));
    }

    /**
     * @dev Get the information for a flight
     *
     */
    function getFlightInformation(string memory flight)
        external
        view
        returns (
            bool,
            uint8,
            uint256,
            address
        )
    {
        bytes32 flightKey = getFlightKey(flight);
        bool isRegistered = flights[flightKey].isRegistered;
        uint8 statusCode = flights[flightKey].statusCode;
        uint256 timestamp = flights[flightKey].timestamp;
        address airline = flights[flightKey].airline;
        return (isRegistered, statusCode, timestamp, airline);
    }

    /**
     * @dev Buy insurance for a flight
     */
    function buyInsurance(
        string memory _flight,
        address _insuree,
        uint256 _amountToPay
    ) external payable requireIsOperational requireIsAuthorized {
        bytes32 flightKey = getFlightKey(_flight);
        require(
            !hasInsuranceForFlight(_flight, msg.sender),
            "You already bought insurance for this flight"
        );
        insurances[flightKey].push(
            Insurance({
                insuree: _insuree,
                insuranceAmount: msg.value,
                amountToPay: _amountToPay,
                insureeEligible: false
            })
        );
    }

    /**
     * @dev Buy insurance for a flight
     */
    function getInsuranceInfo(string memory _flight, address _insuree)
        public
        view
        returns (
            address,
            uint256,
            uint256,
            bool
        )
    {
        bytes32 flightKey = getFlightKey(_flight);
        require(
            hasInsuranceForFlight(_flight, msg.sender),
            "You don't have insurance for this flight"
        );
        address insuree = _insuree;
        uint256 insuranceAmount;
        uint256 amountToPay;
        bool insureeEligible;

        for (uint256 i = 0; i < insurances[flightKey].length; i++) {
            if (insurances[flightKey][i].insuree == _insuree) {
                insuranceAmount = insurances[flightKey][i]
                    .insuranceAmount;
                amountToPay = insurances[flightKey][i].amountToPay;
                insureeEligible = insurances[flightKey][i].insureeEligible;
                
            }
        }
        return (insuree, insuranceAmount, amountToPay, insureeEligible);
    }

    /**
     * @dev Check if a caller already has insurance for a flight
     */
    function hasInsuranceForFlight(string memory _flight, address _insuree)
        public
        view
        returns (bool)
    {
        bytes32 flightKey = getFlightKey(_flight);
        for (uint256 i = 0; i < insurances[flightKey].length; i++) {
            if (insurances[flightKey][i].insuree == _insuree) {
                return true;
            }
        }
        return false;
    }

    /**
     *  @dev Credits payouts to insurees
     */
    function creditInsurees(string memory _flight)
        external
        requireIsOperational
        requireIsAuthorized
    {
        bytes32 flightKey = getFlightKey(_flight);
        for (uint256 i = 0; i < insurances[flightKey].length; i++) {
            if (!insurances[flightKey][i].insureeEligible) {
                insurances[flightKey][i].insureeEligible = true;
                address insuree = insurances[flightKey][i].insuree;
                balance[insuree] += insurances[flightKey][i].amountToPay;
            }
        }
    }

    /**
     *  @dev Get an insurees balance
     */
    function getBalance() external view returns (uint256) {
        return balance[msg.sender];
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     */
    function payoutInsurance(address insuree)
        external
        payable
        requireIsOperational
        requireIsAuthorized
    {
        require(balance[insuree] > 0, "Your balance is at 0");
        uint256 amount = balance[insuree];
        balance[insuree] = 0;
        payable(insuree).transfer(amount);
    }

    /**
     * @dev Fallback function for funding smart contract.
     *
     */
    fallback() external payable {
        fundAirline(msg.sender);
    }

    receive() external payable {
        fundAirline(msg.sender);
    }
}
