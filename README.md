# PolygonId integration contracts

#### Test

To run the tests, execute the following command:

```bash
npm run test
```

Or to see the coverage, run:

```bash
npm run coverage
```

#### Deployment

Before deployment, you need to create an **.env** file following the example from **.env.example**

Next you need to fill in the config file `deploy/data/config.json`

The config has the following structure:

```json
{
  "validatorContractInfo": {
    "validatorAddr": "",
    "isSigValidator": "false"
  },
  "stateContractInfo": {
    "stateAddr": "0x134B1...07a4",
    "stateInitParams": {
      "signer": "0xda323...afa6",
      "sourceStateContract": "0x134B1...07a4",
      "chainName": "Sepolia"
    }
  },
  "verifiedSBTInfo": {
    "name": "Polygon ID × Rarimo",
    "symbol": "PRA",
    "tokenURI": "some URI"
  },
  "poseidonFacade": ""
}

```

To deploy new contracts it is enough to leave the fields with addresses empty while filling in the fields with init values.
If you already have contract addresses, just fill in the corresponding fields. In this configuration, the specified contract addresses will be used during deployment

To deploy, run command `npm run deploy-<network>`, where *network* is the network name from the **hardhat.config.ts** file. The list of available commands and their settings can be found in **package.json** file

#### Local deployment

To deploy the contracts locally, run the following commands (in the different terminals):

```bash
npm run private-network
npm run deploy-localhost
```

#### Bindings

The command to generate the bindings is as follows:

```bash
npm run generate-types
```

> See the full list of available commands in the `package.json` file.
