## Deploy your own DLP & Token smart contracts on Satori

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

5. Create an `.env` file for the smart contract repo. You will need the owner address and private key. 

```
DEPLOYER_PRIVATE_KEY=8...7
OWNER_ADDRESS=0x3....1
SATORI_RPC_URL=http://....
```
6. Deploy DataLiquidityPool and Token smart contracts

```bash
npx hardhat deploy --network satori --tags DLPDeploy
```

This will deploy 2 smart contracts (`DataLiquidityPool`, `DataLiquidityPoolToken`) using the recommended params for testing. If you need other setup, you can change them in the `deploy/dlp-deploy` script

7. verify the contract:
```bash
npx hardhat verify --network satori <data_liquidity_pool_address>
npx hardhat verify --network satori <data_liquidity_pool_token_address> <owner_address>
```

8. Congratulations, you've deployed the DLP & token smart contracts. You can confirm it's up by searching the address on the block explorer: [https://satori.vanascan.org](https://satori.vanascan.io/address/<contract_address>. 




Based on the provided Solidity contract, here is a README file in Markdown format for the `DLPT` contract:

---

# DLPT Contract

The `DLPT` (DLP Token) contract is an ERC20 token with additional features such as minting permissions, an admin role, and a blocklist for addresses. It leverages OpenZeppelin's ERC20, ERC20Permit, ERC20Votes, and Ownable modules for extended functionality.

## Features

- **Minting Control:** Minting can be blocked permanently.
- **Admin Management:** Change and assign an admin who has special permissions.
- **Blocklist Management:** Add and remove addresses from a blocklist.
- **Voting and Permit:** Supports ERC20Votes and ERC20Permit extensions for governance and permit functionality.

## Events

- `MintBlocked()`
- `AdminChanged(address indexed oldAdmin, address indexed newAdmin)`
- `AddressBlocked(address indexed blockedAddress)`
- `AddressUnblocked(address indexed unblockedAddress)`

## Errors

- `EnforceMintBlocked()`
- `UnauthorizedAdminAction(address account)`
- `UnauthorizedUserAction(address account)`


## Functions

### Constructor

#### DLPT
```solidity
constructor(address ownerAddress) ERC20("DLP Token", "DLPT") ERC20Permit("DLP Token") Ownable(ownerAddress)
```
you can modify the contract name and the constructor's arguments for deploying Token with your own name and symbol.


### mint
```solidity
function mint(address to, uint256 amount) external virtual onlyOwner whenMintIsAllowed
```
Mints a specified amount of tokens to the given address.

### blockMint
```solidity
function blockMint() external virtual onlyOwner whenMintIsAllowed
```
Blocks any future minting of tokens permanently.

### changeAdmin
```solidity
function changeAdmin(address newAdmin) external virtual onlyOwner
```
Changes the admin address.

### blockAddress
```solidity
function blockAddress(address addressToBeBlocked) external virtual onlyAdmin
```
Adds an address to the blocklist.

### unblockAddress
```solidity
function unblockAddress(address addressToBeUnblocked) external virtual onlyAdmin
```
Removes an address from the blocklist.

### blockListLength
```solidity
function blockListLength() external view returns(uint256)
```
Returns the number of addresses in the blocklist.

### blockListAt
```solidity
function blockListAt(uint256 _index) external view returns(address)
```
Returns the address at the specified index in the blocklist.


---

# Data Liquidity Pool Smart Contract

The Data Liquidity Pool smart contract is designed to manage the registration of validators, file uploading by data contributors, and reward distribution within a decentralized network. This contract ensures that validators can participate in maintaining the network's integrity and security while earning rewards for their contributions.

The Data Liquidity Pool contract facilitates several key functions:

- **Validator Registration**: Allows users to register as validators and participate in the network.
- **Reward Distribution**: Validators earn rewards based on their performance and contribution, distributed periodically.
- **File uploads**: Data contributors can upload files and earn rewards based on the quality of their data

## Functions

### registerValidator
```solidity
function registerValidator(address validatorAddress,address validatorOwnerAddress, uint256 stakeAmount) external override whenNotPaused nonReentrant
```

Registers a new validator in the system. The caller must have enough Tokens to stake as part of the process. Once registered, the validator must be approved by the DLP owner in order to be eligible for validating files and for epoch rewards.

#### Parameters

- `validatorAddress` (address): The address of the validator to be registered.
- `validatorOwnerAddress` (address): The owner address of the validator.
- `stakeAmount` (uint256): The amount of tokens to be staked by the validator.

#### Functionality

1. Checks if the validator is not already registered.
2. Ensures the stake amount is above the minimum required.
3. Transfers the stake amount from the sender to the contract.
4. Updates the validator's information and status.
5. Increases the total count of validators and updates the total staked amount.
6. Emits the `ValidatorRegistered` event.

#### Event

- `ValidatorRegistered(address validatorAddress, address validatorOwnerAddress, uint256 stakeAmount)`

### approveValidator
```solidity
function approveValidator(address validatorAddress) public onlyOwner
```

Approves a registered validator and marks them as active.

#### Parameters

- `validatorAddress` (address): The address of the validator to be approved.

#### Functionality

1. Creates epochs if necessary.
2. Copies the current active validators list to a new list.
3. Checks if the validator is in a registered state.
4. Adds the validator to the new active validators list and marks them as active.
5. Updates the validator's first block number.
6. Sets the current epoch's validators list ID.
7. Emits the `ValidatorApproved` event.

#### Event

- `ValidatorApproved(address validatorAddress)`


### inactivateValidator
```solidity
function inactivateValidator(address validatorAddress) public onlyValidatorOwner(validatorAddress)
```

Inactivates an active validator.

#### Parameters

- `validatorAddress` (address): The address of the validator to be inactivated.

#### Functionality

1. Creates epochs if necessary.
2. Checks if the validator is in an active state.
3. Calls the internal `_inactivateValidator` function to process the inactivation.


#### Events
- `ValidatorApproved(address validatorAddress)`


### addFile
```solidity
function addFile(string memory url,string memory encryptedKey) external whenNotPaused 
```

Adds a new file to the pool for validation.

#### Parameters

- `url` (string): The URL of the file to be added.
- `encryptedKey` (string): The encrypted key for the file.

#### Functionality

1. Creates epochs if necessary.
2. Computes a hash of the file URL to ensure uniqueness.
3. Checks if the file has already been added using the hash.
4. Adds the file URL hash to the set of file URL hashes.
5. Stores the file information including the contributor address, URL, encrypted key, and timestamp.
6. Assigns the file to a validator based on the current epoch's validators list.
7. Updates the validator's and contributor's information to track the new file.
8. Emits the `FileAdded` event.

#### Event

- `FileAdded(address contributorAddress, uint256 filesId)`

### verifyFile
```solidity
function verifyFile(uint256 fileId,uint256 score, string memory metadata) external onlyActiveValidators
```

Verifies a file and assigns a score to it.

#### Parameters

- `fileId` (uint256): The ID of the file to be verified.
- `score` (uint256): The score assigned to the file.
- `metadata` (string): Additional metadata related to the verification.

#### Functionality

1. Creates epochs if necessary.
2. Checks if the file has already been verified.
3. Retrieves the next file to verify for the validator.
4. Ensures the file ID is valid and matches the expected file ID.
5. Updates the file's verification information including the validator address, timestamp, score, and metadata.
6. Increases the file's verification count.
7. Calculates and assigns the reward for the file based on the score.
8. Updates the validator's file verification index.
9. Removes the validator from the list of validators with files to verify if all files have been verified and the validator is not active.
10. Emits the `FileVerified` event.

#### Event

- `FileVerified(address validatorAddress, uint256 fileId, uint256 score)`
