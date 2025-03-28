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
import idl from "./target/idl/token_attack_program.json";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount, // Changed from getAssociatedTokenAddress
  getAssociatedTokenAddress,
  getAccount,
  getMint,  // Added for diagnostic purposes
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
  }
}

// Function to load the config keypair
function loadConfigKeypair(filePath: string): Keypair {
  console.log(`Attempting to load config keypair from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    if (process.getuid && process.getuid() !== 0) {
      console.error(`Error: config keypair file not found at ${filePath}.`);
      console.error(`Note: Accessing '/root/' typically requires root privileges. Try running the script with 'sudo'.`);
    } else {
      console.error(`Error: config keypair file not found at ${filePath}. Check the path.`);
    }
    process.exit(1); // Exit if file not found
  }

  try {
    const secretKeyString = fs.readFileSync(filePath, { encoding: 'utf8' });
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const keypair = Keypair.fromSecretKey(secretKey);
    console.log(`Successfully loaded config: ${keypair.publicKey.toString()}`);
    console.log(`Config balance check recommended before proceeding.`);
    return keypair; // Return the loaded keypair
  } catch (error) {
    console.error(`Failed to load or parse keypair from ${filePath}:`, error);
    process.exit(1); // Exit on loading error
  }
}

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
  }
}

// Function to load the mint keypair
function loadMintKeypair(filePath: string): Keypair {
  console.log(`Attempting to load mint keypair from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    if (process.getuid && process.getuid() !== 0) {
      console.error(`Error: mint keypair file not found at ${filePath}.`);
      console.error(`Note: Accessing '/root/' typically requires root privileges. Try running the script with 'sudo'.`);
    } else {
      console.error(`Error: mint keypair file not found at ${filePath}. Check the path.`);
    }
    process.exit(1); // Exit if file not found
  }

  try {
    const secretKeyString = fs.readFileSync(filePath, { encoding: 'utf8' });
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const keypair = Keypair.fromSecretKey(secretKey);
    console.log(`Successfully loaded mint: ${keypair.publicKey.toString()}`);
    console.log(`Mint balance check recommended before proceeding.`);
    return keypair; // Return the loaded keypair
  } catch (error) {
    console.error(`Failed to load or parse keypair from ${filePath}:`, error);
    process.exit(1); // Exit on loading error
  }
}

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

    // --- Load Config Keypair using the function ---
    const configWalletKeypairPath = '/root/target/deploy/configs/token-attack-config1-keypair.json'; // Use the exact path you provided
    const configKeypair = loadConfigKeypair(configWalletKeypairPath); // Call the function
    // --- End Load Config Keypair ---

    // --- Load User Keypair using the function ---
    const userWalletKeypairPath = '/root/target/deploy/user-keypair.json'; // Use the exact path you provided
    const user = loadUserKeypair(userWalletKeypairPath); // Call the function
    // --- End Load User Keypair ---

    // --- Load Mint Keypair using the function ---
    const mintWalletKeypairPath = '/root/target/deploy/mint/mint1-keypair.json'; // Use the exact path you provided
    const mintKeypair = loadMintKeypair(mintWalletKeypairPath); // Call the function
    // --- End Load Mint Keypair ---
    
    // 'authority', 'attackWallet', 'configKeypair', 'user', 'mintKeypair' are now const and guaranteed to be assigned if the script reaches here

    const programId = new PublicKey("3sM1ASvMscUm9G6XDJBQYa6SFLBxzxgaunD6WYYuzyh2");
    console.log(`Program ID: ${programId.toString()}`);
    
    // Initialize program with imported IDL and proper typing
    // Fix the constructor: Remove the explicit programId parameter
    const program = new Program<TokenAttackProgram>(
      idl as any,
      provider
    );

    console.log(`Authority: ${authority.publicKey.toString()}`);
    console.log(`Mint: ${mintKeypair.publicKey.toString()}`);
    console.log(`Config: ${configKeypair.publicKey.toString()}`);
    console.log(`Attack wallet: ${attackWallet.publicKey.toString()}`);


    console.log("Computing user token account address and minting tokens...");

    // Compute the address but let Anchor handle the creation
    const userTokenAccount = await getAssociatedTokenAddress(
      mintKeypair.publicKey, // mint
      user.publicKey,        // owner
      false,                 // allowOwnerOffCurve
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    console.log(`Computed user token account: ${userTokenAccount.toString()}`);

    console.log(`User token account: ${userTokenAccount.toString()}`);
    console.log(`[DEBUG] Derived ATA address is: ${userTokenAccount.toString()}`);
    const expectedATA = await getAssociatedTokenAddress(
      mintKeypair.publicKey,
      user.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    console.log(`[DEBUG] Expected ATA address (manually computed): ${expectedATA.toString()}`);
    console.log(`[DEBUG] Addresses match: ${userTokenAccount.equals(expectedATA)}`);
    
    // Diagnostic: Check if token account exists and get its info
    try {
      const tokenAccountInfo = await getAccount(provider.connection, userTokenAccount);
      console.log("[DEBUG] Token account exists with:");
      console.log(`- Owner: ${tokenAccountInfo.owner.toString()}`);
      console.log(`- Mint: ${tokenAccountInfo.mint.toString()}`);
      console.log(`- Expected owner: ${user.publicKey.toString()}`);
      console.log(`- Expected mint: ${mintKeypair.publicKey.toString()}`);
      
      // Verify it matches our expectations
      const ownerCorrect = tokenAccountInfo.owner.equals(user.publicKey);
      const mintCorrect = tokenAccountInfo.mint.equals(mintKeypair.publicKey);
      console.log(`[DEBUG] Owner correct: ${ownerCorrect}, Mint correct: ${mintCorrect}`);
    } catch (error) {
      console.log("[DEBUG] Token account doesn't exist yet or cannot be fetched");
    }
    
    // Diagnostic: Check the mint authority
    try {
      const mintInfo = await getMint(provider.connection, mintKeypair.publicKey);
      console.log(`[DEBUG] Mint authority: ${mintInfo.mintAuthority?.toString()}`);
      console.log(`[DEBUG] Authority public key: ${authority.publicKey.toString()}`);
      
      if (mintInfo.mintAuthority) {
        console.log(`[DEBUG] Authority keys match: ${mintInfo.mintAuthority.equals(authority.publicKey)}`);
      } else {
        console.log("[DEBUG] WARNING: Mint has no authority set!");
      }
    } catch (error) {
      console.log("[DEBUG] Error fetching mint info:", error);
    }

    // Ensure the authority is properly formed
    console.log("[DEBUG] Authority check:");
    console.log(`- Public key: ${authority.publicKey.toString()}`);
    console.log(`- Authority has secret key: ${authority.secretKey.length > 0}`);
    
    // Log all parameters before the transaction
    console.log("[DEBUG] Transaction parameters:");
    console.log(`- User: ${user.publicKey.toString()}`);
    console.log(`- Authority: ${authority.publicKey.toString()}`);
    console.log(`- Mint: ${mintKeypair.publicKey.toString()}`);
    console.log(`- Config: ${configKeypair.publicKey.toString()}`);
    console.log(`- User token account: ${userTokenAccount.toString()}`);
    
    try {
      // Mint tokens to the user account
      // Critical change: Make sure authority is a signer by including it
      console.log("[DEBUG] Attempting to mint tokens...");
      await program.methods
        .mintTokens(new BN(1 * LAMPORTS_PER_SOL))
        .accounts({
          user: user.publicKey,
          authority: authority.publicKey,
          mint: mintKeypair.publicKey,
          config: configKeypair.publicKey,
          userTokenAccount: userTokenAccount, // Use the original name from the TypeScript types
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
        } as any) // Cast to 'any' to bypass TypeScript checking
        .signers([user, authority]) // Make sure both user and authority are signing
        .rpc(); // Remove the options object completely
      console.log("[DEBUG] Mint transaction successful!");
    } catch (error) {
      console.error("[DEBUG] Detailed mint error:", error);
      throw error; // Re-throw to be caught by the outer catch block
    }

    // Verify the token balance in the user token account
    const tokenAccountInfo = await getAccount(provider.connection, userTokenAccount);
    console.log("User token account balance:", tokenAccountInfo.amount.toString());
    
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
