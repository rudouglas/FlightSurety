import Contract from "./contract";
import "./flightsurety.css";

window.addEventListener("load", async () => {
  let contract = new Contract();
  await contract.initialize("localhost");

  // Authorize script
  document
    .getElementById("contract-register-app-contract")
    .addEventListener("click", async () => {
      await contract.authorizeCaller();
    });

  // Oracle scripts
  document
    .getElementById("contract-register-oracles")
    .addEventListener("click", async () => {
      let registrationFee = document.getElementById(
        "contract-registration-fee"
      ).value;
      await contract.registerMultipleOracles(registrationFee);
    });

  // Airline scripts
  document
    .getElementById("airlines-register-new-airline")
    .addEventListener("click", async () => {
      let airlineAddress = document.getElementById(
        "register-airline-address"
      ).value;
      let airlineName = document.getElementById("register-airline-name").value;
      await contract.registerAirline(airlineAddress, airlineName);
    });

  document
    .getElementById("airlines-register-airline")
    .addEventListener("click", async () => {
      let selectIndex = document.getElementById(
        "airlines-airline-dropdown"
      ).value;
      let airline = await contract.getAirlineInfo(selectIndex);
      let airlineAddress = airline[0];
      let airlineName = airline[1];
      await contract.registerAirline(airlineAddress, airlineName);
    });

  document.getElementById("fund-button").addEventListener("click", async () => {
    let selectIndex = document.getElementById(
      "airlines-airline-dropdown"
    ).value;
    let airline = await contract.getAirlineInfo(selectIndex);
    let amount = document.getElementById("airlines-fund-amount").value;
    await contract.fundAirline(airline[0], amount);
  });

  // Flight scripts
  document
    .getElementById("flights-register-flight")
    .addEventListener("click", async () => {
      let selectIndex = document.getElementById(
        "flights-flights-dropdown"
      ).value;
      let flight = await contract.getFlightInfo(selectIndex);
      await contract.registerFlight(flight);
    });
  document
    .getElementById("flights-request-oracles")
    .addEventListener("click", async () => {
      let selectIndex = document.getElementById(
        "flights-flights-dropdown"
      ).value;
      let flight = await contract.getFlightInfo(selectIndex);
      console.log(`Getting flight info: ${flight}`);
      await contract.fetchFlightStatus(flight);
    });

  // Passenger scripts
  document
    .getElementById("passengers-insurance-button")
    .addEventListener("click", async () => {
      let selectIndex = document.getElementById(
        "passengers-flights-dropdown"
      ).value;
      let flight = await contract.getFlightInfo(selectIndex);
      let amount = document.getElementById("passengers-insurance-amount").value;

      await contract.buyInsurance(flight, amount);
    });

  document
    .getElementById("passengers-withdraw-payout")
    .addEventListener("click", async () => {
      await contract.payoutInsurance();
      let amount = await contract.getPayoutAmount();
      document.getElementById("passengers-payout-amount").value = amount;
    });

  document
    .getElementById("passengers-get-payout-amount")
    .addEventListener("click", async () => {
      let amount = await contract.getPayoutAmount();
      document.getElementById("passengers-payout-amount").value = amount;
    });
});
