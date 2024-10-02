
1. Install hardhat: https://hardhat.org/hardhat-runner/docs/getting-started#installation
2. Clone the DLP Smart Contract Repo: https://github.com/vana-com/vana-dlp-smart-contracts/
3. Install dependencies

```bash
yarn install
```

4. Run tests to be sure everything is ok
```bash
npx hardhat test
```

5. Deploy your own Token & DLP
```bash
npx hardhat deploy --network satori --tags DLPDeploy  
```




### Deployments:
| Contract                                                              | Moksha                                     | Satori                                                                            | Mainnet |
|-----------------------------------------------------------------------|--------------------------------------------|-----------------------------------------------------------------------------------|--------------------------------------------|
| `DataLiquidityPoolsRoot`                                              | [0xf408A064d640b620219F510963646Ed2bD5606BB](https://moksha.vanascan.io/address/0xf408A064d640b620219F510963646Ed2bD5606BB) | [0xf408A064d640b620219F510963646Ed2bD5606BB](https://satori.vanascan.io/address/0xf408A064d640b620219F510963646Ed2bD5606BB) |  |
| `DataRegistry`                                                        | [0xEA882bb75C54DE9A08bC46b46c396727B4BFe9a5](https://moksha.vanascan.io/address/0xEA882bb75C54DE9A08bC46b46c396727B4BFe9a5) | [0xEA882bb75C54DE9A08bC46b46c396727B4BFe9a5](https://satori.vanascan.io/address/0xEA882bb75C54DE9A08bC46b46c396727B4BFe9a5) |  |
| `TeePool`                                                             | [0xF084Ca24B4E29Aa843898e0B12c465fAFD089965](https://moksha.vanascan.io/address/0xF084Ca24B4E29Aa843898e0B12c465fAFD089965) | [0xF084Ca24B4E29Aa843898e0B12c465fAFD089965](https://satori.vanascan.io/address/0xF084Ca24B4E29Aa843898e0B12c465fAFD089965) |  |