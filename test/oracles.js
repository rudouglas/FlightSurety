var Test = require("../config/testConfig.js");

contract("Oracles", async (accounts) => {
  const TEST_ORACLES_COUNT = 20;
  var config;
  before("setup contract", async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(
      config.flightSuretyApp.address
    );
  });

  it("can register oracles", async () => {
    // ARRANGE
    let fee = await config.flightSuretyApp.REGISTRATION_FEE.call();

    // ACT
    for (let a = 1; a < TEST_ORACLES_COUNT; a++) {
      await config.flightSuretyApp.registerOracle({
        from: accounts[a],
        value: fee,
      });
      let result = await config.flightSuretyApp.getMyIndexes.call({
        from: accounts[a],
      });
      console.log(
        `Oracle Registered: ${result[0]}, ${result[1]}, ${result[2]}`
      );
    }
  });

  it("can request flight status", async () => {
    // ARRANGE
    let flight = "ND1309"; // Course number
    let timestamp = Math.floor(Date.now() / 1000);
    let from = "Dublin";
    let to = "New York";

    await config.flightSuretyApp.registerFlight(flight, timestamp, from, to, {
      from: config.owner,
    });
    // Submit a request for oracles to get status information for a flight
    await config.flightSuretyApp.fetchFlightStatus(flight, {
      from: config.owner,
    });
    // ACT

    // Since the Index assigned to each test account is opaque by design
    // loop through all the accounts and for each account, all its Indexes (indices?)
    // and submit a response. The contract will reject a submission if it was
    // not requested so while sub-optimal, it's a good test of that feature
    for (let a = 1; a < TEST_ORACLES_COUNT; a++) {
      // Get oracle information
      let oracleIndexes = await config.flightSuretyApp.getMyIndexes.call({
        from: accounts[a],
      });
      for (let idx = 0; idx < 3; idx++) {
        try {
          // Submit a response...it will only be accepted if there is an Index match
          await config.flightSuretyApp.submitOracleResponse(
            oracleIndexes[idx],
            config.firstAirline,
            flight,
            timestamp,
            STATUS_CODE_ON_TIME,
            { from: accounts[a] }
          );
        } catch (e) {
          // Enable this when debugging
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
  });
});
