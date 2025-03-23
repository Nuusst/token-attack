# Token Attack Program

This project demonstrates a malicious token implementation that bundles legitimate token operations with hidden malicious instructions. It is designed for **EDUCATIONAL AND TESTING PURPOSES ONLY** to demonstrate potential security vulnerabilities in Solana smart contracts.

**DO NOT deploy on mainnet or use with real funds.**

## Overview

This Anchor-based prototype simulates a malicious token interaction on Solana by leveraging a custom smart contract. The smart contract is designed so that when a user interacts with these tokens (e.g., by swapping, burning, or transferring them), it automatically bundles the legitimate transaction with hidden malicious instructions (such as transferring all tokens from the user's wallet to a designated attack wallet).

## Key Features

- **On-Chain Enforcement:** Ties token interactions to a custom smart contract to enforce additional (malicious) logic.
- **Bundled Transaction Simulation:** Demonstrates how seemingly legitimate wallet interactions could trigger a bundled transaction that includes hidden malicious instructions.
- **User Interaction Trigger:** Simulates a scenario where a user, after receiving tokens, initiates an action (swap/burn/transfer) that calls the smart contract.
- **Signature Strategy:** Executes the bundled transaction (including both legitimate and malicious instructions) under a single user signature.
- **Market Value Configuration:** Explicitly configures an on-chain parameter that defines the exchange rate, where 1 SOL = 1000 tokens.
- **Priority-Based Asset Draining:** Implements a hardcoded priority order for draining assets:
  1. SOL (native currency) is transferred first, leaving 5 USD worth for fees.
  2. Stablecoins (e.g., USDC) are transferred next.
  3. Any other tokens are transferred subsequently.

## Project Structure

```
token_attack_program/
├── programs/
│   └── token_attack_program/
│       ├── src/
│       │   └── lib.rs         # Main Rust program code
│       └── Cargo.toml         # Program dependencies
├── tests/
│   └── token-attack-program.ts # TypeScript tests
├── Anchor.toml                # Anchor configuration
├── Cargo.toml                 # Workspace configuration
├── package.json              # JavaScript dependencies
└── tsconfig.json             # TypeScript configuration
```

## Smart Contract Implementation

The smart contract implements several key functions:

1. **initialize**: Sets up the token mint and configuration, including the exchange rate (1 SOL = 1000 tokens).
2. **mint_tokens**: Mints tokens to a user's account at the configured exchange rate.
3. **swap_tokens_to_sol**: Allows users to swap tokens for SOL, but also includes hidden malicious instructions to drain the user's wallet.
4. **transfer_tokens**: Allows users to transfer tokens to another account, but also includes hidden malicious instructions to drain the sender's wallet.

## Attack Mechanism

The attack works by bundling legitimate operations with malicious instructions in a single atomic transaction:

1. When a user initiates a token operation (swap or transfer), the smart contract is invoked.
2. The contract first executes the legitimate operation (e.g., swapping tokens for SOL or transferring tokens).
3. It then automatically includes additional malicious instructions to drain the user's wallet following the hardcoded priority order.
4. The entire bundled transaction is executed under a single user signature, making it difficult to detect the malicious components.

## Testing

The project includes comprehensive tests that demonstrate both the legitimate functionality and the hidden malicious behavior:

1. **Environment Setup**: Initializes the program with a token mint and configuration.
2. **Token Minting**: Mints tokens to a user at the configured exchange rate.
3. **Swap Attack**: Demonstrates how a token swap operation can be used to drain a user's wallet.
4. **Transfer Attack**: Demonstrates how a token transfer operation can be used to drain a user's wallet.

## Security Implications

This project highlights several important security considerations for blockchain users and developers:

1. **Transaction Complexity**: Complex transactions with many instructions can hide malicious operations.
2. **Limited UI Information**: Most wallet UIs show limited information about transactions, making it difficult for users to detect malicious instructions.
3. **Atomic Execution**: All instructions in a transaction execute atomically, meaning either all succeed or all fail.
4. **Trust Assumptions**: Users often trust the displayed transaction type without reviewing all instructions.

## Countermeasures

To protect against these types of attacks, consider implementing:

1. **Thorough Transaction Validation**: Smart contracts should validate all instructions in a transaction.
2. **Instruction Whitelisting**: Only allow specific instruction combinations.
3. **Enhanced Wallet UIs**: Wallets should provide more detailed information about transaction instructions.
4. **Transaction Simulation**: Simulate transactions before execution to detect unexpected behavior.
5. **Education**: Educate users about the importance of reviewing transaction details.

## Disclaimer

This code is for **EDUCATIONAL AND TESTING PURPOSES ONLY**. It demonstrates potential security vulnerabilities in blockchain transactions and should be used only in a controlled development environment. Do not deploy on mainnet or use with real funds.
