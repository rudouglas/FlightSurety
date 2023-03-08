var Test = require("../config/testConfig.js");
var BigNumber = require("bignumber.js");

contract("Flight Surety Tests", async (accounts) => {
  const TEST_ORACLES_COUNT = 20;

  const STATUS_CODE_UNKNOWN = 0;
  const STATUS_CODE_ON_TIME = 10;
  const STATUS_CODE_LATE_AIRLINE = 20;
  const STATUS_CODE_LATE_WEATHER = 30;
  const STATUS_CODE_LATE_TECHNICAL = 40;
  const STATUS_CODE_LATE_OTHER = 50;
  var config;
  before("setup contract", async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(
      config.flightSuretyApp.address
    );
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {
    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");
  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {
    // Declare variables
    let accessDenied = false;

    // Call functions
    try {
      await config.flightSuretyData.setOperatingStatus(false, {
        from: config.testAddresses[2],
      });
    } catch (e) {
      accessDenied = true;
    }

    // Validate result
    assert.equal(accessDenied, true, "Access not restricted to Contract Owner");
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {
    // Declare variables
    let accessDenied = false;

    // Call functions
    try {
      await config.flightSuretyData.setOperatingStatus(false);
    } catch (e) {
      accessDenied = true;
    }

    // Validate result
    assert.equal(
      accessDenied,
      false,
      "Access not restricted to Contract Owner"
    );
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {
    // Set Operating status to false
    await config.flightSuretyData.setOperatingStatus(false);

    // Declare variables
    let reverted = false;

    // Call functions
    try {
      await config.flightSurety.setTestingMode(true);
    } catch (e) {
      reverted = true;
    }

    // Validate result
    assert.equal(reverted, true, "Access not blocked for requireIsOperational");

    // Set it back for other tests to work
    await config.flightSuretyData.setOperatingStatus(true);
  });

  it("(airline) cannot register an Airline using registerAirline() if the caller is not authorized", async () => {
    // Declare variables

    // Call functions
    try {
      await config.flightSuretyApp.registerAirline(
        config.firstAirline,
        "Test Airlines",
        {
          from: config.firstAirline,
        }
      );
    } catch (e) {}
    let result = await config.flightSuretyData.isAirlineRegistered.call(
      config.firstAirline
    );

    // Validate result
    assert.equal(
      result,
      false,
      "Airline should not be able to register another airline if it has not been authorized"
    );
  });

  it("(airline) cannot register an Airline using registerAirline() if the calling airline is not funded", async () => {
    // Declare variables
    let newAirline = accounts[2];

    // Call functions
    try {
      await config.flightSuretyApp.registerAirline(
        newAirline,
        "Test Airlines",
        {
          from: config.firstAirline,
        }
      );
    } catch (e) {}
    let result = await config.flightSuretyData.isAirlineRegistered.call(
      newAirline
    );

    // Validate result
    assert.equal(
      result,
      false,
      "Airline should not be able to register another airline if it hasn't provided funding"
    );
  });

  it("(airline) cannot fund an airline with less then 10 eth", async () => {
    // Declare variables
    let amount = web3.utils.toWei("9.99", "ether");

    // Call functions
    try {
      await config.flightSuretyApp.registerAirline(
        config.firstAirline,
        "Test Airlines",
        {
          from: config.owner,
        }
      );
      await config.flightSuretyApp.fundAirline(config.firstAirline, {
        from: config.owner,
        value: amount,
      });
    } catch (e) {
      // console.log(e);
    }
    let funded = await config.flightSuretyData.isAirlineFunded(
      config.firstAirline
    );

    // Validate result
    assert.equal(
      funded,
      false,
      "Airline should not be able fund an airline with less than 10 eth"
    );
  });

  it("(airline) can fund an airline with at least 10 eth", async () => {
    // Declare variables

    let amount = web3.utils.toWei("10", "ether");

    // Call functions
    try {
      await config.flightSuretyApp.fundAirline(config.firstAirline, {
        from: config.owner,
        value: amount,
      });
    } catch (e) {
      console.log(e);
    }
    let funded = await config.flightSuretyData.isAirlineFunded(
      config.firstAirline
    );

    // Validate result
    assert.equal(
      funded,
      true,
      "Airline should be able fund an airline with 10 eth"
    );
  });

  it("(airline) can register an Airline using registerAirline() if the calling airline is funded", async () => {
    // Declare variables
    let newAirline = accounts[2];

    // Call functions
    try {
      await config.flightSuretyApp.registerAirline(
        newAirline,
        "Test Airlines",
        {
          from: config.owner,
        }
      );
    } catch (e) {
      console.log("Register under 4 error");
      console.log(e);
    }
    let result = await config.flightSuretyData.isAirlineRegistered.call(
      newAirline
    );

    // Validate result
    assert.equal(
      result,
      true,
      "Airline should be able to register another airline if it has provided funding"
    );
  });

  it("(airline) can instantly register an airline if there are less than 4 total airlines", async () => {
    // Declare variables
    let newAirline2 = accounts[3];

    // Call functions
    try {
      await config.flightSuretyApp.registerAirline(
        newAirline2,
        "Test Airlines",
        {
          from: config.owner,
        }
      );
    } catch (e) {
      console.log(e);
    }
    let registered2 = await config.flightSuretyData.isAirlineRegistered(
      newAirline2
    );

    // Validate result
    assert.equal(registered2, true, "Airline 2 has not been registered");
  });

  it("(airline) requires 50% of airlines to vote in order to register a new airline when there are 4 or more registered airlines", async () => {
    // Declare variables
    let newAirline3 = accounts[4];

    // Call functions
    try {
      await config.flightSuretyApp.registerAirline(
        newAirline3,
        "Test Airlines",
        {
          from: config.owner,
        }
      );
    } catch (e) {
      console.log(e);
    }

    let registered3 = await config.flightSuretyData.isAirlineRegistered(
      newAirline3
    );
    let votes = await config.flightSuretyApp.getRegisteredAirlineVotes(
      newAirline3
    );

    // Validate result
    assert.equal(registered3, false, "Airline 5 has been registered");
    assert.equal(Number(votes), 1, "Total votes are not equal to 2");
  });

  it("(airline) can register a flight", async () => {
    // Declare variables
    let flight = "DUB2023"; // Course number
    let timestamp = Math.floor(Date.now() / 1000);
    let from = "Dublin";
    let to = "New York";

    // Call functions
    await config.flightSuretyApp.registerFlight(flight, timestamp, from, to, {
      from: config.owner,
    });
    let result = await config.flightSuretyData.getFlightInformation(flight);

    // Validate result
    assert(result[0], true, "Flight has not been registered");
  });

  it("(airline) can set flight status", async () => {
    // Declare variables
    let flight = "DUB2023"; // Course number
    let statusCode = STATUS_CODE_ON_TIME;

    // Call functions
    await config.flightSuretyData.setFlightStatus(flight, statusCode);
    let result = await config.flightSuretyData.getFlightInformation(flight);

    // Validate result
    assert.equal(
      result[1].toString(),
      statusCode,
      "Status Code does not match STATUS_CODE_ON_TIME"
    );
  });

  it("(insurance) can buy insurance for a flight", async () => {
    // Declare variables
    let flight = "DUB2023";
    let amount = web3.utils.toWei("1", "ether");

    // Call functions
    await config.flightSuretyApp.buyInsurance(flight, {
      from: config.firstAirline,
      value: amount,
    });
    let result = await config.flightSuretyData.hasInsuranceForFlight(
      flight,
      config.firstAirline,
      { from: config.firstAirline }
    );

    // Validate result
    assert.equal(result, true, "Insurance has not been bought for flight");
  });

  it("(oracles) can register oracles", async () => {
    // Declare variables
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();
    let registryResult = [];

    // Call functions
    for (let a = 0; a < TEST_ORACLES_COUNT; a++) {
      try {
        await config.flightSuretyApp.registerOracle({
          from: accounts[a],
          value: fee,
        });
        let result = await config.flightSuretyApp.getMyIndexes.call({
          from: accounts[a],
        });
        registryResult.push(result);
        // Uncomment for debugging
        //   console.log(
        //     `Oracle Registered: ${result[0]}, ${result[1]}, ${result[2]}`
        //   );
      } catch (e) {
        console.log(e);
      }
    }

    // Validate result
    assert.equal(
      registryResult.length,
      20,
      "Oracles were not registered for each account"
    );
  });

  it("(oracles) can request flight status", async () => {
    // Declare variables
    let flight = "DUB2023";
    let timestamp = Math.floor(Date.now() / 1000);

    // Submit a request for oracles to get status information for a flight
    await config.flightSuretyApp.fetchFlightStatus(flight);

    // Call functions
    // Since the Index assigned to each test account is opaque by design
    // loop through all the indices for each account
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    let statusCode = STATUS_CODE_ON_TIME;
    for (let a = 0; a < TEST_ORACLES_COUNT; a++) {
      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({
        from: accounts[a],
      });

      for (let idx = 0; idx < 3; idx++) {
        try {
          // Submit a response...it will only be accepted if there is an Index match
          await config.flightSuretyApp.submitOracleResponse(
            oracleIndexes[idx],
            flight,
            timestamp,
            statusCode,
            { from: accounts[a] }
          );
        } catch (e) {
          // Uncomment for debugging
          //  console.log('\nError', idx, oracleIndexes[idx].toNumber(), flight, timestamp);
          //  console.log(e);
        }
      }
    }

    let result = await config.flightSuretyData.getFlightInformation(flight, {
      from: config.firstAirline,
    });
    let balance = await config.flightSuretyData.getBalance({
      from: config.firstAirline,
    });
    console.log(result[1].toString());
    // Validate result
    assert.equal(result[1].toString(), statusCode, "Status Codes do not match");
    assert.equal(balance.toString(), "0", "Balance is not 0");
  });

  it("(oracles) credits 1.5 times the amount insured to an insuree if the flight was delayed", async () => {
    // Declare variables
    let flight = "DROG2024";
    let timestamp = Math.floor(Date.now() / 1000);
    let statusCode = STATUS_CODE_LATE_AIRLINE;
    let from = "Dublin";
    let to = "New York";
    let amount = web3.utils.toWei("1", "ether");
    let expectedBalance = web3.utils.toWei("1.5", "ether");

    // Call functions
    // await config.flightSuretyApp.registerFlight(flight, timestamp, from, to, {
    //   from: config.owner,
    // });
    try {
      await config.flightSuretyApp.registerFlight(flight, timestamp, from, to, {
        from: config.owner,
      });

      await config.flightSuretyApp.buyInsurance(flight, {
        from: config.owner,
        value: amount,
      });
      const hasIns = await config.flightSuretyData.hasInsuranceForFlight(
        flight,
        config.owner,
        {
          from: config.owner,
        }
      );
      const insInfo = await config.flightSuretyData.getInsuranceInfo(
        flight,
        config.owner,
        {
          from: config.owner,
        }
      );
      console.log({ hasIns, insInfo });
      const ogAmount = Number(insInfo[1]);
      // const balance = Number(insInfo[2]);
      console.log({ ogAmount });
      assert.equal(hasIns, true, "Has no insurance");
      // assert.equal(balance.toString(), expectedBalance, "Balances do not match");
    } catch (e) {
      console.log(e);
    }
    await config.flightSuretyApp.fetchFlightStatus(flight);

    for (let a = 1; a < TEST_ORACLES_COUNT; a++) {
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({
        from: accounts[a],
      });

      for (let idx = 0; idx < 3; idx++) {
        try {
          await config.flightSuretyApp.submitOracleResponse(
            oracleIndexes[idx],
            flight,
            timestamp,
            statusCode,
            { from: accounts[a] }
          );
        } catch (e) {
          // Uncomment for debugging
          console.log(e);
          console.log(
            "\nError",
            idx,
            oracleIndexes[idx].toNumber(),
            flight,
            timestamp
          );
        }
      }
    }

    let result = await config.flightSuretyData.getFlightInformation(flight, {
      from: config.owner,
    });
    let balance = await config.flightSuretyData.getBalance({
      from: config.owner,
    });
    console.log(result[1].toString());
    // Validate result
    assert.equal(result[1].toString(), statusCode, "Status codes do not match");
    assert.equal(balance.toString(), expectedBalance, "Balances do not match");
  });

  it("(insurance) can withdraw payout", async () => {
    // Declare variables
    let creditAmount = web3.utils.toBN(web3.utils.toWei("1.5", "ether"));

    // Call functions
    let balanceBefore = web3.utils.toBN(
      await web3.eth.getBalance(config.owner)
    );
    let receipt = await config.flightSuretyApp.withdrawPayout({
      from: config.owner,
    });
    let tx = await web3.eth.getTransaction(receipt.tx);
    let balanceAfter = web3.utils.toBN(await web3.eth.getBalance(config.owner));
    let gasUsed = web3.utils.toBN(receipt.receipt.gasUsed);
    let gasPrice = web3.utils.toBN(tx.gasPrice);
    let gasCost = gasUsed.mul(gasPrice);

    // Validate result
    assert.equal(
      balanceAfter.toString(),
      balanceBefore.sub(gasCost).add(creditAmount).toString()
    );
  });
});
