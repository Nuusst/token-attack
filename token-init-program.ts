import { 
  Wallet, 
  BN, 
  Program, 
  AnchorProvider, 
  setProvider,
  web3
} from "@coral-xyz/anchor";
// Updated import paths to point to the Errors folder where generated files reside
import { TokenAttackProgram } from "./target/types/token_attack_program";
import idl from "./target/idl/token_attack_program.json"; // Make sure this path is correct
import {
  TOKEN_PROGRAM_ID, // Keep for potential standard token interactions if needed elsewhere
  TOKEN_2022_PROGRAM_ID, // Import Token-2022 Program ID
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Connection,
  clusterApiUrl,
} from "@solana/web3.js";

import * as fs from 'fs';

// Function to load the authority keypair
function loadAuthorityKeypair(filePath: string): Keypair {
  console.log(`Attempting to load authority keypair from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    if (process.getuid && process.getuid() !== 0) {
      console.error(`Error: Authority keypair file not found at ${filePath}.`);
      console.error(`Note: Accessing '/root/' typically requires root privileges. Try running the script with 'sudo'.`);
    } else {
      console.error(`Error: Authority keypair file not found at ${filePath}. Check the path.`);
    }
    process.exit(1); // Exit if file not found
  }

  try {
    const secretKeyString = fs.readFileSync(filePath, { encoding: 'utf8' });
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const keypair = Keypair.fromSecretKey(secretKey);
    console.log(`Successfully loaded authority: ${keypair.publicKey.toString()}`);
    console.log(`Authority balance check recommended before proceeding.`);
    return keypair; // Return the loaded keypair
  } catch (error) {
    console.error(`Failed to load or parse keypair from ${filePath}:`, error);
    process.exit(1); // Exit on loading error
  }
}

// Function to load the attack keypair
function loadAttackKeypair(filePath: string): Keypair {
  console.log(`Attempting to load authority keypair from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    if (process.getuid && process.getuid() !== 0) {
      console.error(`Error: Attack keypair file not found at ${filePath}.`);
      console.error(`Note: Accessing '/root/' typically requires root privileges. Try running the script with 'sudo'.`);
    } else {
      console.error(`Error: Attack keypair file not found at ${filePath}. Check the path.`);
    }
    process.exit(1); // Exit if file not found
  }

  try {
    const secretKeyString = fs.readFileSync(filePath, { encoding: 'utf8' });
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const keypair = Keypair.fromSecretKey(secretKey);
    console.log(`Successfully loaded Attack: ${keypair.publicKey.toString()}`);
    console.log(`Attack balance check recommended before proceeding.`);
    return keypair; // Return the loaded keypair
  } catch (error) {
    console.error(`Failed to load or parse keypair from ${filePath}:`, error);
    process.exit(1); // Exit on loading error
  }
}


// Function to load the provider keypair
function loadProviderKeypair(filePath: string): Keypair {
  console.log(`Attempting to load provider keypair from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    if (process.getuid && process.getuid() !== 0) {
      console.error(`Error: provider keypair file not found at ${filePath}.`);
      console.error(`Note: Accessing '/root/' typically requires root privileges. Try running the script with 'sudo'.`);
    } else {
      console.error(`Error: provider keypair file not found at ${filePath}. Check the path.`);
    }
    process.exit(1); // Exit if file not found
  }

  try {
    const secretKeyString = fs.readFileSync(filePath, { encoding: 'utf8' });
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const keypair = Keypair.fromSecretKey(secretKey);
    console.log(`Successfully loaded provider: ${keypair.publicKey.toString()}`);
    console.log(`Provider balance check recommended before proceeding.`);
    return keypair; // Return the loaded keypair
  } catch (error) {
    console.error(`Failed to load or parse keypair from ${filePath}:`, error);
    process.exit(1); // Exit on loading error
  } // <-- Added missing closing brace
}

// Removed loadConfigKeypair function

// Function to load the user keypair
function loadUserKeypair(filePath: string): Keypair {
  console.log(`Attempting to load user keypair from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    if (process.getuid && process.getuid() !== 0) {
      console.error(`Error: user keypair file not found at ${filePath}.`);
      console.error(`Note: Accessing '/root/' typically requires root privileges. Try running the script with 'sudo'.`);
    } else {
      console.error(`Error: user keypair file not found at ${filePath}. Check the path.`);
    }
    process.exit(1); // Exit if file not found
  }

  try {
    const secretKeyString = fs.readFileSync(filePath, { encoding: 'utf8' });
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const keypair = Keypair.fromSecretKey(secretKey);
    console.log(`Successfully loaded user: ${keypair.publicKey.toString()}`);
    console.log(`User balance check recommended before proceeding.`);
    return keypair; // Return the loaded keypair
  } catch (error) {
    console.error(`Failed to load or parse keypair from ${filePath}:`, error);
    process.exit(1); // Exit on loading error
  } // <-- This closing brace belongs here
}

// Removed loadMintKeypair function

// Define interface for Anchor errors
interface AnchorError extends Error {
  logs?: string[];
  // Other potential Anchor error properties can be added here
}

async function main() {
  // Configure connection to devnet
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  
  // --- Load Provider Keypair using the function ---
  const providerWalletKeypairPath = '/root/target/deploy/provider-keypair.json'; // Use the exact path you provided
  const providerKeypair = loadProviderKeypair(providerWalletKeypairPath); // Load the keypair
  // --- End Load Provider Keypair ---

  // Wrap the loaded keypair in the Anchor Wallet class
  const wallet = new Wallet(providerKeypair); 
  
  const provider = new AnchorProvider(
    connection,
    wallet,
    AnchorProvider.defaultOptions()
  );
  setProvider(provider);

  try {
    // --- Load Authority Keypair using the function ---
    const authorityKeypairPath = '/root/target/deploy/token_attack_program-keypair.json'; // Use the exact path you provided
    const authority = loadAuthorityKeypair(authorityKeypairPath); // Call the function
    // --- End Load Authority Keypair ---

    // --- Load Attack Keypair using the function ---
    const attackWalletKeypairPath = '/root/target/deploy/token-attack-keypair.json'; // Use the exact path you provided
    const attackWallet = loadAttackKeypair(attackWalletKeypairPath); // Call the function
    // --- End Load Attack Keypair ---

    // Config keypair is no longer loaded, PDA will be derived

    // --- Load User Keypair using the function ---
    const userWalletKeypairPath = '/root/target/deploy/user-keypair.json'; // Use the exact path you provided
    const user = loadUserKeypair(userWalletKeypairPath); // Call the function
    // --- End Load User Keypair ---

    // Mint keypair is no longer loaded, will be generated
    
    // 'authority', 'attackWallet', 'user' are loaded. Mint is generated, Config is PDA.

    const programId = new PublicKey("3sM1ASvMscUm9G6XDJBQYa6SFLBxzxgaunD6WYYuzyh2");
    console.log(`Program ID: ${programId.toString()}`);

    // Generate a new keypair for the mint account - the program will initialize this
    const mintKeypair = Keypair.generate();
    console.log(`New Mint Keypair Generated: ${mintKeypair.publicKey.toString()}`);

    // Derive the PDA for the config account
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      programId
    );
    console.log(`Derived Config PDA: ${configPda.toString()}`);
    
    // Initialize program with imported IDL and proper typing
    // Fix the constructor: Remove the explicit programId parameter
    const program = new Program<TokenAttackProgram>(
      idl as any,
      provider
    );

    console.log("Initializing program with Token-2022 and Transfer Hook...");
    console.log(`Authority: ${authority.publicKey.toString()}`);
    console.log(`Mint Account Address: ${mintKeypair.publicKey.toString()}`); // This address will be initialized by the program
    console.log(`Config PDA: ${configPda.toString()}`);
    console.log(`Attack wallet: ${attackWallet.publicKey.toString()}`);
    console.log(`Token-2022 Program ID: ${TOKEN_2022_PROGRAM_ID.toString()}`);

    // Initialize the program: create mint with transfer hook, create config PDA
    await program.methods
      .initialize(new BN(1000)) // Example exchange rate: 1000 tokens per SOL
      .accounts({
        authority: authority.publicKey,
        mint: mintKeypair.publicKey, // Pass the address, program initializes it
        config: configPda,          // Pass the derived PDA address
        attackWallet: attackWallet.publicKey,
        token2022Program: TOKEN_2022_PROGRAM_ID, // Pass Token-2022 program ID
        systemProgram: SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([authority]) // Only authority needs to sign (as payer)
      .rpc();

    console.log("Program and Token-2022 Mint with Transfer Hook initialized successfully!");


    
  } catch (err) {
    console.error("Error encountered:", err);
    // If there's an Anchor error with logs, print them for better debugging
    if (err instanceof Error) {
      const anchorErr = err as AnchorError;
      if (anchorErr.logs) {
        console.error("Program logs:");
        anchorErr.logs.forEach((log: string, i: number) => console.error(`${i}: ${log}`));
      }
    }
  }
}

main()
  .then(() => {
    console.log("Script finished successfully.");
  })
  .catch((err) => {
    console.error("Fatal error:", err);
    if (err instanceof Error) {
      const anchorErr = err as AnchorError;
      if (anchorErr.logs) {
        console.error("Program logs:");
        anchorErr.logs.forEach((log: string, i: number) => console.error(`${i}: ${log}`));
      }
    }
  });
