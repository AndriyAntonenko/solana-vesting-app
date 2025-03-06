use anchor_lang::prelude::*;
// use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{EmployeeAccount, VestingAccount, ANCHOR_DISCRIMINATOR};

#[derive(Accounts)]
pub struct CreateEmployeeAccount<'info> {
    #[account(mut)]
    pub owner: Signer<'info>, // Employer, over of vesting account

    pub beneficiary: SystemAccount<'info>, // Type validating that the account is owned by the system program

    #[account(
      has_one = owner
    )]
    pub vesting_account: Account<'info, VestingAccount>,

    #[account(
      init,
      space = ANCHOR_DISCRIMINATOR + EmployeeAccount::INIT_SPACE,
      payer = owner,
      seeds = [b"employee_vesting", beneficiary.key().as_ref(), vesting_account.key().as_ref()],
      bump
    )]
    pub employee_account: Account<'info, EmployeeAccount>,

    pub system_program: Program<'info, System>,
}

pub fn create_account_for_employee(
    ctx: Context<CreateEmployeeAccount>,
    start_time: i64,
    end_time: i64,
    total_amount: u64,
    cliff_time: i64,
) -> Result<()> {
    *ctx.accounts.employee_account = EmployeeAccount {
        beneficiary: ctx.accounts.beneficiary.key(),
        start_time,
        end_time,
        cliff_time,
        vesting_account: ctx.accounts.vesting_account.key(),
        total_amount,
        total_withdrawn: 0,
        bump: ctx.bumps.employee_account,
    };

    Ok(())
}
