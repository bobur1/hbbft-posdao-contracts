/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * truffleframework.com/docs/advanced/configuration
 *
 * To deploy via Infura you'll need a wallet provider (like truffle-hdwallet-provider)
 * to sign your transactions before they're sent to a remote public node. Infura API
 * keys are available for free at: infura.io/register
 *
 *   > > Using Truffle V5 or later? Make sure you install the `web3-one` version.
 *
 *   > > $ npm install truffle-hdwallet-provider@web3-one
 *
 * You'll also need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. If you're publishing your code to GitHub make sure you load this
 * phrase from a file you've .gitignored so it doesn't accidentally become public.
 *
 */

const HDWalletProvider = require("@truffle/hdwallet-provider");

const fs = require('fs');

let mnemonic; 
let network;

try {
  mnemonic = fs.readFileSync(".mnemonic").toString().trim();

} catch (e) {
  console.warn("file .mnemonic not found. Required for updating the testNet.");
}

try {
  network = fs.readFileSync(".network").toString().trim();
}
catch (e) {
  console.warn("file .network not found. Required for locating the testNet.");
}


var PrivateKeyProvider = require("truffle-privatekey-provider");

module.exports = {
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */

  networks: {
    // Useful for testing. The `development` name is special - truffle uses it by default
    // if it's defined here and no other network is specified at the command line.
    // You should run a client (like ganache-cli, geth or parity) in a separate terminal
    // tab if you use this network and you must also set the `host`, `port` and `network_id`
    // options below to some value.

    development: {
      host: "localhost",
      port: 8540,
      gas: 8000000,
      network_id: "*" // Match any network id
    },
    
    
    test: {
      host: "localhost",
      port: 8545,
      gas: 8000000,
      network_id: "*" // Match any network id
    },

    coverage: {
      host: "localhost",
      port: 8555,
      gas: 0xfffffffffff,
      gasPrice: 0x01,
      network_id: "*"
    },

    localnet: {
      provider: function() {
        return new HDWalletProvider(
          { mnemonic: mnemonic,
            providerOrUrl: 'http://127.0.0.1:8540',
            numberOfAddresses: 100}
          );
      },
      network_id: '*',
      networkCheckTimeout: 1000000,
      timeoutBlocks: 200
    },

    testNet: {
      provider: function() {
        return new HDWalletProvider(
          { mnemonic: mnemonic,
            providerOrUrl: network,
            numberOfAddresses: 100}
          );
      },
      network_id: '*',
      networkCheckTimeout: 1000000,
      timeoutBlocks: 200
    },
  },

  plugins: ["solidity-coverage"],

  // Set default mocha options here, use special reporters etc.
  mocha: {
    enableTimeouts: false,
    before_timeout: 12000000,
    timeout: 12000000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.5.17",      // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,       // Use "0.5.1" you've installed locally with docker (default: false)
      settings: {            // See the solidity docs for advice about optimization and evmVersion
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: "istanbul"
      }
    }
  }
}