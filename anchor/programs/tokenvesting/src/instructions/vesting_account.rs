use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{VestingAccount, ANCHOR_DISCRIMINATOR};

#[derive(Accounts)]
#[instruction(company_name: String)]
pub struct CreateVestingAccount<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
      init,
      payer = signer,
      space = ANCHOR_DISCRIMINATOR + VestingAccount::INIT_SPACE,
      seeds = [company_name.as_ref()],
      bump
    )]
    pub vesting_account: Account<'info, VestingAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
      init,
      payer = signer,
      token::mint = mint,
      token::authority = treasury_token_account, // owned by itself
      seeds = [b"vesting_treasury", company_name.as_bytes()],
      bump,
    )]
    pub treasury_token_account: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn create_company_vesting_account(
    ctx: Context<CreateVestingAccount>,
    company_name: String,
) -> Result<()> {
    *ctx.accounts.vesting_account = VestingAccount {
        owner: ctx.accounts.signer.key(),
        mint: ctx.accounts.mint.key(),
        treasury_token_account: ctx.accounts.treasury_token_account.key(),
        company_name,
        treasury_bump: ctx.bumps.treasury_token_account,
        bump: ctx.bumps.vesting_account,
    };
    Ok(())
}
