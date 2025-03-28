// @ts-nocheck
/// <reference types="mocha" />
/// <reference types="node" />

declare module "@project-serum/anchor" {}
declare module "chai" {}
declare module "../target/types/token_attack_program" {}

declare var describe: any;
declare var before: any;
declare var it: any;


// DISCLAIMER: This code is for EDUCATIONAL AND TESTING PURPOSES ONLY
// Use only in a controlled development environment
// DO NOT deploy on mainnet or use with real funds

 // @ts-ignore
 import * as anchor from "@project-serum/anchor";
 // @ts-ignore
 import { Program } from "@project-serum/anchor";
 // @ts-ignore
 import { TokenAttackProgram } from "../target/types/token_attack_program";
 // @ts-ignore
 import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createMint,
  getOrCreateAssociatedTokenAccount,
  getMint,
  getAccount,
} from "@solana/spl-token";
 // @ts-ignore
 import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
 // @ts-ignore
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
    assert.equal(config.token_mint.toString(), mint.toString());
    assert.equal(config.exchange_rate.toNumber(), EXCHANGE_RATE);
    assert.equal(config.attack_wallet.toString(), attackWallet.publicKey.toString());
    
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
});
