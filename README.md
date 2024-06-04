## Deploy your own DLP smart contracts on Testnet


1. Install hardhat: https://hardhat.org/hardhat-runner/docs/getting-started#installation
2. Clone the DLP Smart Contract Repo: https://github.com/vana-com/dlp-smart-contracts/
3. Install dependencies

```bash
yarn install
```

4. Run tests to be sure everything is ok
```bash
npx hardhat test
```

5. Create an `.env` file for the smart contract repo. You will need the owner address and private key. 

```
DEPLOYER_PRIVATE_KEY=8...7
OWNER_ADDRESS=0x3....1
SATORI_RPC_URL=http://....
```
6. Deploy smart contract

a. Deploy the new DLP version
```bash
npx hardhat deploy --network satori --tags DLPDeploy
```

b. Deploy the legacy DLP version
```bash
npx hardhat deploy --network satori --tags DLPLegacyDeploy
```

7. Congratulations, you've deployed the DLP smart contract. You can confirm it's up by searching the address on the block explorer: https://satori.vanascan.io/address/<contract_address>. 

8. verify the contract:
```bash
npx hardhat verify --network satori <contract_address>
```
