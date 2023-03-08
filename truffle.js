var HDWallet = require("truffle-hdwallet-provider");
var MNEMONIC =
  "candy maple cake sugar pudding cream honey rich smooth crumble sweet treat";

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1", // Localhost (default: none)
      port: 8545, // Standard Ethereum port (default: none)
      network_id: "*", // Any network (default: none)
      gas: 9999999,
    },
    sepolia: {
      provider: () => new HDWallet(MNEMONIC, INFURA_API_KEY),
      network_id: 11155111, // Sepolia's id
      confirmations: 1, // # of confirmations to wait between deployments. (default: 0)
      timeoutBlocks: 200, // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: true, // Skip dry run before migrations? (default: false for public nets )
    },
  },
  compilers: {
    solc: {
      version: "^0.8.17",
    },
  },
};
