use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{CustomErrorCodes, EmployeeAccount, VestingAccount};

#[derive(Accounts)]
#[instruction(company_name: String)]
pub struct ClaimTokens<'info> {
    #[account(mut)]
    pub beneficiary: Signer<'info>,

    #[account(
      mut,
      has_one = beneficiary,
      has_one = vesting_account,
      seeds = [b"employee_vesting", beneficiary.key().as_ref(), vesting_account.key().as_ref()],
      bump = employee_account.bump
    )]
    pub employee_account: Account<'info, EmployeeAccount>,

    #[account(
      seeds = [company_name.as_ref()],
      bump = vesting_account.bump,
      has_one = treasury_token_account,
      has_one = mint,
    )]
    pub vesting_account: Account<'info, VestingAccount>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
      mut, // balance will change
      token::mint = mint,
      token::authority = treasury_token_account, // owned by itself
      seeds = [b"vesting_treasury", company_name.as_bytes()],
      bump = vesting_account.treasury_bump,
    )]
    pub treasury_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
      init_if_needed,
      payer = beneficiary,
      associated_token::mint = mint,
      associated_token::authority = beneficiary,
      associated_token::token_program = token_program,
    )]
    pub employee_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn claim_employee_tokens(ctx: Context<ClaimTokens>, _company_name: String) -> Result<()> {
    let employee_account = &mut ctx.accounts.employee_account;

    let current_time = Clock::get()?.unix_timestamp;
    if current_time < employee_account.cliff_time {
        return Err(CustomErrorCodes::ClaimNotAvailableYet.into());
    }

    let time_since_start = current_time.saturating_sub(employee_account.start_time);
    let total_vesting_time = employee_account
        .end_time
        .saturating_sub(employee_account.start_time);

    if total_vesting_time == 0 {
        return Err(CustomErrorCodes::InvalidVestingTime.into());
    }

    let vested_amount: u64 = if current_time >= employee_account.end_time {
        employee_account.total_amount
    } else {
        match employee_account
            .total_amount
            .checked_mul(time_since_start as u64)
        {
            Some(product) => product.checked_div(total_vesting_time as u64).unwrap(),
            None => {
                return Err(CustomErrorCodes::CalculationOverflow.into());
            }
        }
    };

    let amount_to_withdraw = vested_amount.saturating_sub(employee_account.total_withdrawn);

    if amount_to_withdraw == 0 {
        return Err(CustomErrorCodes::NoTokensToClaim.into());
    }

    employee_account.total_withdrawn = match employee_account
        .total_withdrawn
        .checked_add(amount_to_withdraw)
    {
        Some(total) => total,
        None => {
            return Err(CustomErrorCodes::CalculationOverflow.into());
        }
    };

    let transfer_cpi_accounts = TransferChecked {
        from: ctx.accounts.treasury_token_account.to_account_info(),
        to: ctx.accounts.employee_token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        authority: ctx.accounts.treasury_token_account.to_account_info(),
    };

    let cpi_program = ctx.accounts.token_program.to_account_info();

    let pda_signer_seeds: &[&[&[u8]]] = &[&[
        b"vesting_treasury",
        ctx.accounts.vesting_account.company_name.as_ref(),
        &[ctx.accounts.vesting_account.treasury_bump],
    ]];

    let cpi_context =
        CpiContext::new_with_signer(cpi_program, transfer_cpi_accounts, pda_signer_seeds);

    let decimals = ctx.accounts.mint.decimals;

    token_interface::transfer_checked(cpi_context, amount_to_withdraw, decimals)?;

    Ok(())
}
