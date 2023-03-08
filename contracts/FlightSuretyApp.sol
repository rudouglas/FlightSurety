// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./FlightSuretyData.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner; // Account used to deploy contract
    bool private operational = true;
    FlightSuretyData private flightSuretyDataContract;
    mapping(address => address[]) private registeredAirlineVotes;
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
        require(isOperational(), "Contract is currently not operational");
        _;
    }

    /**
     * @dev Modifier that requires the "ContractOwner" account to be the function caller
     */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
     * @dev Contract constructor that sets the contract owner, and initializes the data contract address
     *
     */
    constructor(address flightDataContractAddress) {
        contractOwner = msg.sender;
        flightSuretyDataContract = FlightSuretyData(
            payable(flightDataContractAddress)
        );
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Returns the contracts operational status
     *
     */
    function isOperational() public view returns (bool) {
        return operational;
    }

    /**
     * @dev CHanges the contracts operational status
     *
     */
    function setOperationalStatus(bool mode) external requireContractOwner {
        require(
            operational != mode,
            "Operational status is already set to this mode"
        );
        operational = mode;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
     *
     */
    function registerAirline(
        address _airlineAddress,
        string memory _airlineName
    ) external requireIsOperational returns (bool success, uint256 votes) {
        require(
            flightSuretyDataContract.isAirlineFunded(msg.sender),
            "Only funded airlines are allowed register a new airline"
        );
        require(
            !flightSuretyDataContract.isAirlineRegistered(_airlineAddress),
            "This airline has already been registered"
        );
        if (flightSuretyDataContract.getAirlinesCount() < 4) {
            flightSuretyDataContract.registerAirline(
                _airlineAddress,
                _airlineName
            );
            success = true;
        } else {
            for (
                uint256 i = 0;
                i < registeredAirlineVotes[_airlineAddress].length;
                i++
            ) {
                require(
                    registeredAirlineVotes[_airlineAddress][i] != msg.sender,
                    "You have already cast your vote for this airline"
                );
            }

            registeredAirlineVotes[_airlineAddress].push(msg.sender);
            uint256 votesCount = registeredAirlineVotes[_airlineAddress].length;

            if (votesCount >= flightSuretyDataContract.getAirlinesCount() / 2) {
                flightSuretyDataContract.registerAirline(
                    _airlineAddress,
                    _airlineName
                );
                success = true;
            } else {
                success = false;
            }
            votes = votesCount;
        }
        return (success, votes);
    }

    /**
     * @dev Get the amount of votes an airline has
     *
     */
    function getRegisteredAirlineVotes(address _airlineAddress)
        public
        view
        returns (uint256)
    {
        return registeredAirlineVotes[_airlineAddress].length;
    }

    /**
     * @dev Fund a registered airline
     *
     */
    function fundAirline(address _airlineAddress)
        public
        payable
        requireIsOperational
    {
        flightSuretyDataContract.fundAirline{value: msg.value}(_airlineAddress);
    }

    /**
     * @dev Register a flight
     *
     */
    function registerFlight(
        string calldata flight,
        uint256 timestamp,
        string calldata from,
        string calldata to
    ) external requireIsOperational {
        require(
            flightSuretyDataContract.isAirlineRegistered(msg.sender),
            "This airline has not been registered"
        );
        require(
            flightSuretyDataContract.isAirlineFunded(msg.sender),
            "This airline has not been funded"
        );

        flightSuretyDataContract.registerFlight(
            flight,
            timestamp,
            from,
            to,
            msg.sender
        );
    }

    /**
     * @dev Called after oracle has updated flight status
     *
     */
    function processFlightStatus(string memory _flight, uint8 _statusCode)
        internal
        requireIsOperational
    {
        flightSuretyDataContract.setFlightStatus(_flight, _statusCode);

        if (_statusCode == flightSuretyDataContract.STATUS_CODE_LATE_AIRLINE()) {
            flightSuretyDataContract.creditInsurees(_flight);
        }
    }

    /**
     * @dev Generate a request for oracles to fetch flight information
     *
     */
    function fetchFlightStatus(string calldata _flight)
        external
        requireIsOperational
    {
        require(
            flightSuretyDataContract.flightIsRegistered(_flight),
            "This flight has not been registered"
        );
        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = keccak256(abi.encodePacked(index, _flight));
        ResponseInfo storage responseInfo = oracleResponses[key];
        responseInfo.requester = msg.sender;
        responseInfo.isOpen = true;

        emit OracleRequest(index, _flight);
    }

    /**
     * @dev Buy insurance for a registered flight
     *
     */
    function buyInsurance(string memory _flight)
        external
        payable
        requireIsOperational
    {
        require(
            flightSuretyDataContract.flightIsRegistered(_flight),
            "This flight has not been registered"
        );
        require(
            !flightSuretyDataContract.hasInsuranceForFlight(
                _flight,
                msg.sender
            ),
            "You have already bought insurance for this flight"
        );
        require(
            msg.value <= 1 ether,
            "The maximum value you can insure for is 1 ether"
        );

        uint256 amountToPay = (msg.value * 3) / 2;
        flightSuretyDataContract.buyInsurance{value: msg.value}(
            _flight,
            msg.sender,
            amountToPay
        );
    }

    /**
     * @dev Withdraw payout due to an insuree
     *
     */
    function withdrawPayout() external requireIsOperational {
        flightSuretyDataContract.payoutInsurance(msg.sender);
    }

    /********************************************************************************************/
    /*                                     ORACLE MANAGEMENT                                    */
    /********************************************************************************************/

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;

    // Fee to be paid when registering oracle
    uint256 public constant REGISTRATION_FEE = 1 ether;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_RESPONSES = 3;

    struct Oracle {
        bool isRegistered;
        uint8[3] indexes;
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        address requester; // Account that requested status
        bool isOpen; // If open, oracle responses are accepted
        mapping(uint8 => address[]) responses; // Mapping key is the status code reported
        // This lets us group responses and identify
        // the response that majority of the oracles
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusInfo(string flight, uint256 timestamp, uint8 status);

    event OracleReport(string flight, uint256 timestamp, uint8 status);
    event OracleRegistered(address oracleAddress);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event OracleRequest(uint8 index, string flight);

    // Register an oracle with the contract
    function registerOracle() external payable {
        // Require registration fee
        require(
            msg.value >= REGISTRATION_FEE,
            "A registration fee is required"
        );

        uint8[3] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({isRegistered: true, indexes: indexes});
        emit OracleRegistered(msg.sender);
    }

    /**
     * @dev Register multiple oracles from the DApp
     *
     */
    function registerMultipleOracles(address[] memory oracleAddresses)
        external
        payable
    {
        uint256 valuePerOracle = msg.value.div(oracleAddresses.length);
        require(
            valuePerOracle >= REGISTRATION_FEE,
            "The registration fee provided is not sufficient"
        );
        for (uint256 i = 0; i < oracleAddresses.length; i++) {
            uint8[3] memory indexes = generateIndexes(oracleAddresses[i]);

            oracles[oracleAddresses[i]] = Oracle({
                isRegistered: true,
                indexes: indexes
            });
            emit OracleRegistered(oracleAddresses[i]);
        }
    }

    /**
     * @dev Get indexes for an oracle
     *
     */
    function getMyIndexes() external view returns (uint8[3] memory) {
        require(
            oracles[msg.sender].isRegistered,
            "Not registered as an oracle"
        );

        return oracles[msg.sender].indexes;
    }

    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse(
        uint8 index,
        string memory flight,
        uint256 timestamp,
        uint8 statusCode
    ) external {
        require(
            (oracles[msg.sender].indexes[0] == index) ||
                (oracles[msg.sender].indexes[1] == index) ||
                (oracles[msg.sender].indexes[2] == index),
            "Index does not match oracle request"
        );

        bytes32 key = keccak256(abi.encodePacked(index, flight));
        require(
            oracleResponses[key].isOpen,
            "Flight or timestamp do not match oracle request"
        );

        oracleResponses[key].responses[statusCode].push(msg.sender);

        // Information isn't considered verified until at least MIN_RESPONSES
        // oracles respond with the *** same *** information
        emit OracleReport(flight, timestamp, statusCode);
        if (
            oracleResponses[key].responses[statusCode].length >= MIN_RESPONSES
        ) {
            emit FlightStatusInfo(flight, timestamp, statusCode);

            // Handle flight status as appropriate
            processFlightStatus(flight, statusCode);
        }
    }

    function getFlightKey(
        address airline,
        string memory flight,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account)
        internal
        returns (uint8[3] memory)
    {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);

        indexes[1] = indexes[0];
        while (indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while ((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex(address account) internal returns (uint8) {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(
            uint256(
                keccak256(
                    abi.encodePacked(blockhash(block.number - nonce++), account)
                )
            ) % maxValue
        );

        if (nonce > 250) {
            nonce = 0; // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

    // endregion
}
