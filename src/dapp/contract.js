import FlightSuretyApp from "../../build/contracts/FlightSuretyApp.json";
import FlightSuretyData from "../../build/contracts/FlightSuretyData.json";
import Config from "./config.json";
import Web3 from "web3";

export default class Contract {
  constructor() {}

  async initialize(network) {
    let config = Config[network];
    this.config = config;
    const {
      ownerAddress,
      appContractAddress,
      dataContractAddress,
      oracleAddresses,
      initialAirlines,
      initialFlights,
    } = config;
    this.owner = ownerAddress;
    this.appContractAddress = appContractAddress;
    this.dataContractAddress = dataContractAddress;
    this.oracleAddresses = oracleAddresses;
    await this.initializeWeb3(config);
    await this.initializeContracts(config);

    this.airlines = initialAirlines;
    this.flights = initialFlights;

    await this.updateContractInfo();

    let selectAirlines = document.getElementById("airlines-airline-dropdown");
    for (let counter = 0; counter <= 3; counter++) {
      selectAirlines.options[selectAirlines.options.length] = new Option(
        `${this.airlines[counter].name}(${this.airlines[counter].address.slice(
          0,
          8
        )}...)`,
        counter
      );
    }

    var selectFlights1 = document.getElementById("flights-flights-dropdown");
    var selectFlights2 = document.getElementById("passengers-flights-dropdown");
    for (let counter = 0; counter < this.flights.length; counter++) {
      const { name, from, to } = this.flights[counter];
      const selectFlightString = `${name}(${from} --> ${to})`;
      selectFlights1.options[selectFlights1.options.length] = new Option(
        selectFlightString,
        counter
      );
      selectFlights2.options[selectFlights2.options.length] = new Option(
        selectFlightString,
        counter
      );
    }
  }

  // Initialize Web3
  async initializeWeb3(config) {
    let web3Provider;
    if (window.ethereum) {
      web3Provider = window.ethereum;
      try {
        await window.ethereum.enable();
      } catch (error) {
        console.error("User denied account access");
      }
    } else if (window.web3) {
      web3Provider = window.web3.currentProvider;
    } else {
      web3Provider = new Web3.providers.HttpProvider(config.url);
    }
    this.web3 = new Web3(web3Provider);
    console.log(this.owner);
    this.web3.eth.defaultAccount = this.owner;
  }

  // Initialize both contracts
  async initializeContracts(config) {
    this.flightSuretyApp = new this.web3.eth.Contract(
      FlightSuretyApp.abi,
      config.appContractAddress
    );
    this.flightSuretyData = new this.web3.eth.Contract(
      FlightSuretyData.abi,
      config.dataContractAddress
    );
  }

  // Authorize the caller of the contract
  async authorizeCaller() {
    let self = this;
    let success = true;
    try {
      self.flightSuretyData.methods
        .authorizeCaller(self.appContractAddress)
        .send({ from: self.owner, gas: 9999999 });
      console.log("App contract authorized");
    } catch (e) {
      success = false;
      console.log(
        `Error authorizing the App contract: ${self.appContractAddress} by ${self.owner}`
      );
      alert(
        `Error authorizing the App contract: ${self.appContractAddress} by ${self.owner}`
      );
    }

    self.updateContractInfo();
  }

  // Register multiple oracles
  async registerMultipleOracles(registrationFee) {
    let self = this;
    var success = true;
    console.log(registrationFee, self.oracleAddresses);
    let regFeeWei = self.web3.utils.toWei(registrationFee, "ether");
    console.log({ regFeeWei });
    const oraclesWithIndexes = [];

    await self.flightSuretyApp.methods
      .registerMultipleOracles(self.oracleAddresses)
      .send(
        { value: regFeeWei, from: self.owner, gas: 9999999 },
        (error, result) => {
          if (error) {
            console.log(error);
            success = false;
          } else {
            self.oracleAddresses.forEach(async (oracle) => {
              let indexes = await self.flightSuretyApp.methods
                .getMyIndexes()
                .call({ from: oracle });
              console.log(oracle, indexes);
              oraclesWithIndexes.push({ address: oracle, indexes: indexes });
            });
          }
        }
      );
  }

  // Get the operational status of the contract and surface it in the UI
  async updateContractInfo() {
    let self = this;
    var statusDataContract = false;
    try {
      statusDataContract = await self.flightSuretyData.methods
        .isOperational()
        .call({ from: self.owner });
      console.log(statusDataContract);
    } catch (error) {
      console.error(error);
    }
    if (statusDataContract) {
      document.getElementById("contract-operational-status").value =
        "Operational";
    } else {
      document.getElementById("contract-operational-status").value =
        "ERROR: Contract not operational";
    }
  }

  // Check if the Data contract is operational
  isOperational(callback) {
    let self = this;
    self.flightSuretyData.methods
      .isOperational()
      .call({ from: self.owner }, callback);
  }

  // Get flight status from the oracles
  async fetchFlightStatus(flight) {
    let self = this;
    let payload = {
      airline: self.airlines[0],
      flight,
      timestamp: Math.floor(Date.now() / 1000),
    };
    try {
      self.flightSuretyApp.methods
        .fetchFlightStatus(payload.flight)
        .send({ from: self.owner, gas: 9999999 });
      console.log("Flight information requested for: " + flight);
    } catch (e) {
      console.log(`Error fetching Flight Status: ${e}`);
      alert(`Error fetching Flight Status: ${e}`);
    }
  }

  // Get a list of registered flights
  getRegisteredFlights() {
    let self = this;
    let countRegisteredFlights = parseInt(
      self.flightSuretyData.methods.getRegisteredFlightCount().call()
    );
    self.flights = [];

    for (let i = 0; i < countRegisteredFlights; i++) {
      let flightKey = self.flightSuretyData.methods.registeredFlights(i).call();
      let flight = self.flightSuretyData.methods.flights(flightKey).call();
      self.flights.push(flight);
    }
    self.flights.sort((a, b) =>
      a.sStatusCode > b.sStatusCode ? 1 : b.sStatusCode > a.sStatusCode ? -1 : 0
    );
    return self.flights;
  }

  // Set the operating status for the App contract
  setOperatingStatus(mode, callback) {
    let self = this;
    self.flightSuretyApp.methods
      .setOperatingStatus(mode)
      .send({ from: self.owner }, (error, result) => {
        callback(error, { mode: mode });
      });
  }

  // Get information for an airline
  async getAirlineInfo(index) {
    let self = this;
    const { address, name } = self.airlines[index];
    return [address, name];
  }

  // Register an airline
  async registerAirline(airline, name) {
    let self = this;
    try {
      self.flightSuretyApp.methods
        .registerAirline(airline, name)
        .send({ from: self.owner, gas: 9999999 });
      console.log(`Airline has been registered successfully: ${airline}`);
    } catch (e) {
      console.log(`Error registering airlines: ${e}`);
      alert(`Error registering airlines: ${e}`);
    }
  }

  // Fund an airline
  async fundAirline(airline, amountEther) {
    let self = this;
    let activeAccount = await self.getActiveAccount();
    let amountInWei = await self.web3.utils.toWei(amountEther, "ether");

    try {
      self.flightSuretyApp.methods
        .fundAirline(airline)
        .send({ from: activeAccount, gas: 9999999, value: amountInWei });
      console.log(`Airline funded successfully: ${airline}`);
    } catch (e) {
      console.log(`Error funding airline ${airline}: ${e}`);
      alert(`Error funding airline ${airline}: ${e}`);
    }
  }

  // Register a flight
  async registerFlight(flight) {
    let self = this;
    try {
      console.log(flight);
      console.log(self.config.initialFlights);
      const { from, to } = self.config.initialFlights.find(
        (fli) => fli.name == flight
      );
      console.log({ from, to });
      self.flightSuretyApp.methods
        .registerFlight(flight, Math.floor(Date.now() / 1000), from, to)
        .send({ from: self.owner, gas: 9999999 });
      console.log("Flight registered successfully!");
    } catch (e) {
      console.log(`Error registering flight ${flight}: ${e}`);
      alert(`Error registering flight ${flight}: ${e}`);
    }
  }

  // Get information for a flight
  async getFlightInfo(index) {
    let self = this;
    console.log(index, self.flights[index].name);
    return self.flights[index].name;
  }

  // Allows an insuree to buy insurance for a flight
  async buyInsurance(flightKey, amount) {
    let self = this;
    let activeAccount = await self.getActiveAccount();

    try {
      self.flightSuretyApp.methods.buyInsurance(flightKey).send({
        from: activeAccount,
        value: self.web3.utils.toWei(amount, "ether"),
        gas: 9999999,
      });
      console.log("Insurance bought successfully!");
    } catch (e) {
      console.log(`Error buying insurance ${flightKey}: ${e}`);
      alert(`Error buying insurance ${flightKey}: ${e}`);
    }
  }

  // Get the current active account in Metamask
  async getActiveAccount() {
    try {
      let accounts = await this.web3.eth.getAccounts();
      return accounts[0];
    } catch (error) {
      console.log(error);
    }
  }

  // Get the payout amount available for an insuree
  async getPayoutAmount() {
    let self = this;
    let activeAccount = await self.getActiveAccount();
    let success = false;
    let balance = 0;
    try {
      balance = await self.flightSuretyData.methods
        .getBalance()
        .call({ from: activeAccount });
      success = true;
    } catch (error) {
      console.log(error);
    }
    if (success) {
      console.log("Update of balance successful.");
    }
    return self.web3.utils.fromWei(balance, "ether");
  }

  // Payout insurance to an insuree
  async payoutInsurance() {
    let self = this;
    let activeAccount = await self.getActiveAccount();

    try {
      self.flightSuretyData.methods
        .payoutInsurance(activeAccount)
        .send({ from: activeAccount, gas: 9999999 }, (error, result) => {
          callback(error, result);
        });
    } catch (error) {
      console.log(error);
    }
  }
}
