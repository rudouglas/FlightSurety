import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import Config from "./config.json";
import Web3 from "web3";
import express from "express";

const initialize = async () => {
  let config = Config["localhost"];
  let web3 = new Web3(
    new Web3.providers.WebsocketProvider(config.url.replace("http", "ws"))
  );
  let accounts = await web3.eth.getAccounts();
  web3.eth.defaultAccount = accounts[0];
  let flightSuretyApp = new web3.eth.Contract(
    FlightSuretyApp.abi,
    config.appContractAddress
  );

  let oracles = [];
  let oraclesCount = 20;
  let registrationFee = await flightSuretyApp.methods.REGISTRATION_FEE().call();
  for (let i = 5; i < oraclesCount + 5; i++) {
    let account = accounts[i];
    let indexes;
    try {
      await flightSuretyApp.methods
        .registerOracle()
        .send({ from: account, value: registrationFee, gas: 30000000 });
    } catch (e) {
      // console.log(e);
    }

    try {
      indexes = await flightSuretyApp.methods
        .getMyIndexes()
        .call({ from: account });
    } catch (e) {
      // console.log(e);
    }
    if (indexes) {
      oracles.push({
        account: account,
        indexes: indexes,
      });
      console.log(`Registered oracle ${account} ${indexes}`);
    }
  }

  let STATUS_CODE_UNKNOWN = 0;
  let STATUS_CODE_ON_TIME = 10;
  let STATUS_CODE_LATE_AIRLINE = 20;
  let STATUS_CODE_LATE_WEATHER = 30;
  let STATUS_CODE_LATE_TECHNICAL = 40;
  let STATUS_CODE_LATE_OTHER = 50;

  flightSuretyApp.events.OracleRequest(
    {
      fromBlock: 0,
    },
    function (error, event) {
      if (error) {
        console.log(error);
      }
      let flightNumber = event.returnValues.flight;
      let index = event.returnValues.index;
      console.log(
        `Oracle request for flight ${flightNumber} with index ${index}`
      );

      let statusCode = STATUS_CODE_UNKNOWN;
      let random = Math.floor(Math.random() * 6);
      if (random == 0) {
        statusCode = STATUS_CODE_UNKNOWN;
      } else if (random == 1) {
        statusCode = STATUS_CODE_ON_TIME;
      } else if (random == 2) {
        statusCode = STATUS_CODE_LATE_AIRLINE;
      } else if (random == 3) {
        statusCode = STATUS_CODE_LATE_WEATHER;
      } else if (random == 4) {
        statusCode = STATUS_CODE_LATE_TECHNICAL;
      } else if (random == 5) {
        statusCode = STATUS_CODE_LATE_OTHER;
      }

      oracles.forEach(async (oracle) => {
        if (oracle.indexes.includes(index)) {
          try {
            await flightSuretyApp.methods
              .submitOracleResponse(
                index,
                flightNumber,
                Math.floor(Date.now() / 1000),
                statusCode
              )
              .send({ from: oracle.account, gas: 3000000 });
          } catch (e) {
            console.log(e);
          }
        }
      });
    }
  );

  flightSuretyApp.events.OracleReport(
    {
      fromBlock: 0,
    },
    function (error, event) {
      if (error) {
        console.log(error);
      }
      let flightNumber = event.returnValues.flight;
      let timestamp = event.returnValues.timestamp;
      let status = event.returnValues.status;

      console.log(
        `Received response for flight ${flightNumber} Time: ${timestamp} Status Code: ${status}`
      );
    }
  );

  flightSuretyApp.events.FlightStatusInfo(
    {
      fromBlock: 0,
    },
    function (error, event) {
      if (error) {
        console.log(error);
      }
      let flightNumber = event.returnValues.flight;
      let timestamp = event.returnValues.timestamp;
      let status = event.returnValues.status;

      console.log(
        `Final status for flight ${flightNumber} Time: ${timestamp} Status Code: ${status}`
      );
    }
  );
};

initialize().then(
  (result) => {
    // console.log(result);
  },
  (error) => {
    console.log("Server initialization error:");
    console.log(error);
  }
);

const app = express();

app.get("/api", (req, res) => {
  res.send({
    message: "An API for use with your Dapp!",
  });
});
export default app;
