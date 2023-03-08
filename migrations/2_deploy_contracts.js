const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const fs = require("fs");

module.exports = function (deployer, network, accounts) {
  deployer.deploy(FlightSuretyData).then(() => {
    return deployer
      .deploy(FlightSuretyApp, FlightSuretyData.address)
      .then(() => {
        let config = {
          localhost: {
            url: "http://127.0.0.1:8545",
            dataContractAddress: FlightSuretyData.address,
            appContractAddress: FlightSuretyApp.address,
            ownerAddress: "0x627306090abaB3A6e1400e9345bC60c78a8BEf57",
            initialAirlines: [
              {
                name: "Contract Owner Airlines",
                address: "0x627306090abaB3A6e1400e9345bC60c78a8BEf57",
              }, //ganache accounts[0]
              {
                name: "Fursht Airlines",
                address: "0xf17f52151EbEF6C7334FAD080c5704D77216b732",
              }, //ganache accounts[1]
              {
                name: "Second Best Airlines",
                address: "0xC5fdf4076b8F3A5357c5E395ab970B5B54098Fef",
              }, //ganache accounts[2]
              {
                name: "Third Wheel Air",
                address: "0x821aEa9a577a9b44299B9c15c88cf3087F3b5544",
              }, //ganache accounts[3]
            ],
            initialFlights: [
              { name: "DUB123", from: "DUB", to: "CHI" },
              { name: "DUB462", from: "DUB", to: "AMS" },
              { name: "DUB239", from: "DUB", to: "ICE" },
            ],
            oracleAddresses: [
              "0xA2CAd9a05fe8B6942d7aCE68D7a72176a0e6838A",
              "0x6391ad5ff11aB19fABdB9BB530c287e4a0e0E66E",
              "0xbcA025101952eAA6fa6831dE704c59DC4535a744",
              "0x62cBE04f5a048a9D009b6377A3f9Ad15E6AfB77c",
              "0x1DBe89C8d92A989E4B6ecF9a93dF6f3ddDBDdC7f",
              "0xa88E96d08FA8D9b845998f554830404DD2B23197",
              "0xA063084879E5d19e7654fFB03c6eB9273f65196B",
              "0xd73B35f18e630fC6F7406A1310611c47c1b653d4",
              "0x1BaE2E8A3215a6F42c62E7Df5692da1717Ba9f1D",
              "0x017BC042cd705F0845Df4aaa34950f342e280d58",
              "0x2F6E72494beDF510c3d8e4f472740Bfe9199A399",
              "0x2EA817488E5F8c54b315d9bBBcDB60ae96D9960d",
              "0x4984475420E55A53005D70caB4496088C07984a2",
              "0x18aC4AC282A23f0f9d6a739DE6FF543d3ebce8F0",
              "0xE3c27A49b81a7D59DC516D58ab2E5ee6A545c008",
              "0xc496E6FEACf5D7ee4E1609179fA4C1D1698116ec",
              "0x5598CA13044003326C25459B4E9B778922C8a00e",
              "0x5Fb25C1c734D077fdFb603E9f586Bee11706a042",
              "0x3E5a0f348C831b489deC1be087f8Ef182A4CfE54",
              "0x6a90Ed741Fe4B87545a127879bA18F41FD17fdB5",
              "0xa1AD47355B994Cc18Bd709789055DeFD54e738E3",
            ],
          },
        };
        fs.writeFileSync(
          __dirname + "/../src/dapp/config.json",
          JSON.stringify(config, null, "\t"),
          "utf-8"
        );
        fs.writeFileSync(
          __dirname + "/../src/server/config.json",
          JSON.stringify(config, null, "\t"),
          "utf-8"
        );
      });
  });
};
