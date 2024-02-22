use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, Transfer};

declare_id!("5d9bF2TaopGL8AM8tCkhKKxSP6e6K4CPF6eQxrspG8Wi");

#[program]
pub mod staking_on_solana {
    use super::*;

    pub fn initialize_pool(ctx: Context<InitializePool>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.total_staked = 0;
        Ok(())
    }

    pub fn stake_token(ctx: Context<StakeToken>, amount: u64) -> Result<()> {
        // let staker = &ctx.accounts.staker;
        // let staker_token_account = &ctx.accounts.staker_token_account;
        // let pool_token_account = &ctx.accounts.pool_token_account;

        // Transfer Token from staker to pool account
        token::transfer(ctx.accounts.into_transfer_to_pool_context(), amount)?;

        let pool = &mut ctx.accounts.pool;
        pool.total_staked += amount;

        Ok(())
    }

}

#[account]
pub struct Pool {
    pub total_staked: u64,
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(init, payer = user, space = 8 + 8)]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StakeToken<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,
    #[account(mut)]
    pub staker_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    pub token_program: Program<'info, token::Token>,
}

// An account that goes inside a transaction instruction
#[account]
pub struct BaseAccount {
    pub count: u64,
}

impl<'info> StakeToken<'info> {
    fn into_transfer_to_pool_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.staker_token_account.to_account_info(),
            to: self.pool_token_account.to_account_info(),
            authority: self.staker.to_account_info(),
        };
        CpiContext::new(self.token_program.to_account_info(), cpi_accounts)
    }
}

